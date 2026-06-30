import { Subscription } from 'rxjs';
import {
  AmpsTransport,
  NatsJetStreamTransport,
  NatsTransport,
  SolaceTransport,
  type TransportClient,
  type TransportMessage,
} from '@macro/transports';
import { ConflationSubject } from '@macro/utils';
import type { BlotterSource } from './blotter-source';

export type FeedStatus = 'idle' | 'connecting' | 'snapshot-loading' | 'live' | 'error' | 'stopped';

/** Immutable status snapshot the host UI renders (Angular reads it via a signal bridge, React via useSyncExternalStore). */
export interface FeedState {
  status: FeedStatus;
  rowCount: number;
  msgsPerSec: number;
  error: string | null;
}

/**
 * The minimal grid surface {@link BlotterFeed} writes to. Each app adapts its grid:
 *  - Angular `MacroAngularGrid`: addRows/updateRows/deleteRows → the `addRows$/updateRows$/deleteRows$`
 *    Subjects; `setInitialRowData` → the method of the same name.
 *  - React `MacroReactGrid`: addRows/updateRows/deleteRows → the ref Subjects; `setInitialRowData` →
 *    set the `rowData` prop state (the React ref has no `setInitialRowData`).
 */
export interface GridOps {
  addRows(rows: unknown[]): void;
  updateRows(rows: unknown[]): void;
  deleteRows(rows: unknown[]): void;
  setInitialRowData(rows: unknown[]): void;
}

type Row = Record<string, unknown>;

/**
 * Drives one blotter: instantiates the right core transport for a {@link BlotterSource}, connects,
 * and wires snapshot + live data into a {@link GridOps} according to the source's `mode`:
 *  - AMPS → `sowAndSubscribe` (snapshot then stream).
 *  - NATS JetStream → `snapshotAndSubscribe` (last-per-subject snapshot then stream).
 *  - NATS core / Solace → live `subscribeAsObservable` (no snapshot).
 * One instance per blotter so each source gets its own connection. Framework-free: status is a
 * snapshot exposed via `getState()` + `subscribe()`.
 */
export class BlotterFeed {
  private state: FeedState = { status: 'idle', rowCount: 0, msgsPerSec: 0, error: null };
  private readonly listeners = new Set<() => void>();

  private transport?: TransportClient;
  private subId?: string;
  private readonly subs = new Subscription();
  private conflation?: ConflationSubject<string, Row>;

  /** Distinct keys seen for keyed modes (snapshot-update / streaming) → row count + upsert decisions. */
  private readonly keys = new Set<string>();
  /** Ordered ids for append mode → trimming to `maxRows`. */
  private readonly appendQueue: Row[] = [];
  private idCounter = 0;
  private firstRecordHandled = false;

  private msgWindow = 0;
  private rateTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly source: BlotterSource,
    private readonly grid: GridOps,
    /** Called once with the first record so the host can infer columns. */
    private readonly onColumns: (rec: Row) => void,
  ) {}

  /** Current status snapshot (stable reference between changes — safe for useSyncExternalStore). */
  readonly getState = (): FeedState => this.state;

  /** Subscribe to status changes; returns an unsubscribe fn. */
  readonly subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  private patch(next: Partial<FeedState>): void {
    this.state = { ...this.state, ...next };
    for (const l of this.listeners) l();
  }

  async start(): Promise<void> {
    try {
      this.patch({ status: 'connecting', error: null });
      this.transport = this.makeTransport();
      this.transport.onError((e) => this.patch({ error: e.message, status: 'error' }));
      await this.transport.connect(this.connectOpts());

      if (this.source.mode !== 'append' && (this.source.mode === 'streaming' || this.source.conflationMs != null)) {
        this.conflation = new ConflationSubject<string, Row>(this.source.conflationMs ?? 250);
        this.subs.add(this.conflation.subscribeToConflated(({ value }) => this.grid.updateRows([value])));
      }

      switch (this.source.transport) {
        case 'amps':
          await this.wireAmps();
          break;
        case 'nats-js':
          await this.wireNatsJs();
          break;
        case 'nats':
        case 'solace':
          await this.wireLive();
          break;
      }
      this.startRateMeter();
    } catch (e) {
      this.patch({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  }

  async stop(): Promise<void> {
    if (this.rateTimer) clearInterval(this.rateTimer);
    this.subs.unsubscribe();
    this.conflation?.complete();
    if (this.subId) await this.transport?.unsubscribe(this.subId).catch(() => undefined);
    await this.transport?.disconnect().catch(() => undefined);
    this.patch({ status: 'stopped' });
  }

  // ── transport wiring ──

  private makeTransport(): TransportClient {
    const name = `prism-${this.source.id}`;
    switch (this.source.transport) {
      case 'amps':
        return new AmpsTransport(name);
      case 'nats':
        return new NatsTransport(name);
      case 'nats-js':
        return new NatsJetStreamTransport(name);
      case 'solace':
        return new SolaceTransport();
    }
  }

  /** Strip the `transport` discriminant before handing the rest to `connect()`. */
  private connectOpts(): Record<string, unknown> {
    const conn = { ...this.source.connection } as Record<string, unknown>;
    delete conn['transport'];
    return conn;
  }

  /** AMPS: SOW snapshot (buffered until `sowComplete`) then live, routed per mode. */
  private async wireAmps(): Promise<void> {
    const amps = this.transport as AmpsTransport;
    this.patch({ status: 'snapshot-loading' });
    const { observable, subscriptionId, sowComplete } = await amps.sowAndSubscribe(this.source.topic, this.source.filter);
    this.subId = subscriptionId;
    await this.consumeSnapshotThenLive(observable, sowComplete);
  }

  /** NATS JetStream: last-per-subject snapshot then live, routed per mode. */
  private async wireNatsJs(): Promise<void> {
    const js = this.transport as NatsJetStreamTransport;
    this.patch({ status: 'snapshot-loading' });
    const { observable, subscriptionId, snapshotComplete } = await js.snapshotAndSubscribe(this.source.topic);
    this.subId = subscriptionId;
    await this.consumeSnapshotThenLive(observable, snapshotComplete);
  }

  /** NATS core / Solace: live-only — no snapshot, every record routed per mode (upsert / append). */
  private async wireLive(): Promise<void> {
    const { observable, subscriptionId } = await this.transport!.subscribeAsObservable(this.source.topic);
    this.subId = subscriptionId;
    this.subs.add(observable.subscribe((m) => this.route(this.read(m))));
    this.patch({ status: 'live' });
  }

  /** Shared snapshot handshake for AMPS / JetStream. */
  private async consumeSnapshotThenLive(
    observable: { subscribe: (cb: (m: TransportMessage) => void) => Subscription },
    complete: Promise<void>,
  ): Promise<void> {
    const snapshot: Row[] = [];
    let inSnapshot = true;
    this.subs.add(
      observable.subscribe((m) => {
        const rec = this.read(m);
        if (inSnapshot) {
          this.maybeInferColumns(rec);
          snapshot.push(rec);
        } else {
          this.route(rec);
        }
      }),
    );
    await complete;
    inSnapshot = false;
    this.seedSnapshot(snapshot);
    this.patch({ status: 'live' });
  }

  // ── routing ──

  private route(rec: Row): void {
    this.msgWindow++;
    this.maybeInferColumns(rec);
    if (this.source.mode === 'append') this.routeAppend(rec);
    else this.routeKeyed(rec);
  }

  /** Append: every message is a new immutable row (synthetic `__id`), trimmed to `maxRows`. */
  private routeAppend(rec: Row): void {
    const row = this.stampId(rec);
    this.grid.addRows([row]);
    this.appendQueue.push(row);
    const max = this.source.maxRows;
    if (max && this.appendQueue.length > max) {
      const removed = this.appendQueue.splice(0, this.appendQueue.length - max);
      this.grid.deleteRows(removed);
    }
    this.patch({ rowCount: this.appendQueue.length });
  }

  /** Keyed (snapshot-update / streaming): add a row the first time a key is seen, then update it. */
  private routeKeyed(rec: Row): void {
    const key = this.keyOf(rec);
    if (!this.keys.has(key)) {
      this.keys.add(key);
      this.grid.addRows([rec]);
      this.patch({ rowCount: this.keys.size });
    } else if (this.conflation) {
      this.conflation.next({ key, value: rec });
    } else {
      this.grid.updateRows([rec]);
    }
  }

  private seedSnapshot(snapshot: Row[]): void {
    if (this.source.mode === 'append') {
      const seeded = snapshot.map((r) => this.stampId(r));
      this.appendQueue.push(...seeded);
      this.grid.setInitialRowData(seeded);
      this.patch({ rowCount: this.appendQueue.length });
    } else {
      for (const r of snapshot) this.keys.add(this.keyOf(r));
      this.grid.setInitialRowData(snapshot);
      this.patch({ rowCount: this.keys.size });
    }
  }

  // ── helpers ──

  private read(m: TransportMessage): Row {
    try {
      return m.json<Row>();
    } catch {
      return { value: m.data };
    }
  }

  private keyOf(rec: Row): string {
    return String(rec[this.source.keyField ?? 'id']);
  }

  private stampId(rec: Row): Row {
    return { ...rec, __id: `r${this.idCounter++}` };
  }

  private maybeInferColumns(rec: Row): void {
    if (this.firstRecordHandled) return;
    this.firstRecordHandled = true;
    this.onColumns(rec);
  }

  private startRateMeter(): void {
    this.rateTimer = setInterval(() => {
      this.patch({ msgsPerSec: this.msgWindow });
      this.msgWindow = 0;
    }, 1000);
  }
}
