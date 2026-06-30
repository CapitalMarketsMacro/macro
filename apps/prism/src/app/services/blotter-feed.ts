import { signal } from '@angular/core';
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
import type { MacroAngularGrid } from '@macro/macro-angular-grid';
import type { BlotterSource } from '../models/blotter-source';

export type FeedStatus = 'idle' | 'connecting' | 'snapshot-loading' | 'live' | 'error' | 'stopped';

type Row = Record<string, unknown>;

/**
 * Drives one blotter: instantiates the right core transport for a {@link BlotterSource}, connects,
 * and wires snapshot + live data into a {@link MacroAngularGrid} according to the source's `mode`:
 *  - AMPS → `sowAndSubscribe` (snapshot then stream).
 *  - NATS JetStream → `snapshotAndSubscribe` (last-per-subject snapshot then stream).
 *  - NATS core / Solace → live `subscribeAsObservable` (no snapshot).
 * One instance per blotter so each source gets its own connection (the Angular transport services
 * are root singletons and only hold a single connection).
 */
export class FeedController {
  readonly status = signal<FeedStatus>('idle');
  readonly rowCount = signal(0);
  readonly msgsPerSec = signal(0);
  readonly error = signal<string | null>(null);

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
    private readonly grid: MacroAngularGrid,
    /** Called once with the first record so the host can infer columns. */
    private readonly onColumns: (rec: Row) => void,
  ) {}

  async start(): Promise<void> {
    try {
      this.status.set('connecting');
      this.error.set(null);
      this.transport = this.makeTransport();
      this.transport.onError((e) => {
        this.error.set(e.message);
        this.status.set('error');
      });
      await this.transport.connect(this.connectOpts());

      if (this.source.mode !== 'append' && (this.source.mode === 'streaming' || this.source.conflationMs != null)) {
        this.conflation = new ConflationSubject<string, Row>(this.source.conflationMs ?? 250);
        this.subs.add(this.conflation.subscribeToConflated(({ value }) => this.grid.updateRows$.next([value])));
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
      this.error.set(e instanceof Error ? e.message : String(e));
      this.status.set('error');
    }
  }

  async stop(): Promise<void> {
    if (this.rateTimer) clearInterval(this.rateTimer);
    this.subs.unsubscribe();
    this.conflation?.complete();
    if (this.subId) await this.transport?.unsubscribe(this.subId).catch(() => undefined);
    await this.transport?.disconnect().catch(() => undefined);
    this.status.set('stopped');
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
    this.status.set('snapshot-loading');
    const { observable, subscriptionId, sowComplete } = await amps.sowAndSubscribe(this.source.topic, this.source.filter);
    this.subId = subscriptionId;
    await this.consumeSnapshotThenLive(observable, sowComplete);
  }

  /** NATS JetStream: last-per-subject snapshot then live, routed per mode. */
  private async wireNatsJs(): Promise<void> {
    const js = this.transport as NatsJetStreamTransport;
    this.status.set('snapshot-loading');
    const { observable, subscriptionId, snapshotComplete } = await js.snapshotAndSubscribe(this.source.topic);
    this.subId = subscriptionId;
    await this.consumeSnapshotThenLive(observable, snapshotComplete);
  }

  /** NATS core / Solace: live-only — no snapshot, every record routed per mode (upsert / append). */
  private async wireLive(): Promise<void> {
    const { observable, subscriptionId } = await this.transport!.subscribeAsObservable(this.source.topic);
    this.subId = subscriptionId;
    this.subs.add(observable.subscribe((m) => this.route(this.read(m))));
    this.status.set('live');
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
    this.status.set('live');
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
    this.grid.addRows$.next([row]);
    this.appendQueue.push(row);
    const max = this.source.maxRows;
    if (max && this.appendQueue.length > max) {
      const removed = this.appendQueue.splice(0, this.appendQueue.length - max);
      this.grid.deleteRows$.next(removed);
    }
    this.rowCount.set(this.appendQueue.length);
  }

  /** Keyed (snapshot-update / streaming): add a row the first time a key is seen, then update it. */
  private routeKeyed(rec: Row): void {
    const key = this.keyOf(rec);
    if (!this.keys.has(key)) {
      this.keys.add(key);
      this.grid.addRows$.next([rec]);
      this.rowCount.set(this.keys.size);
    } else if (this.conflation) {
      this.conflation.next({ key, value: rec });
    } else {
      this.grid.updateRows$.next([rec]);
    }
  }

  private seedSnapshot(snapshot: Row[]): void {
    if (this.source.mode === 'append') {
      const seeded = snapshot.map((r) => this.stampId(r));
      this.appendQueue.push(...seeded);
      this.grid.setInitialRowData(seeded);
      this.rowCount.set(this.appendQueue.length);
    } else {
      for (const r of snapshot) this.keys.add(this.keyOf(r));
      this.grid.setInitialRowData(snapshot);
      this.rowCount.set(this.keys.size);
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
      this.msgsPerSec.set(this.msgWindow);
      this.msgWindow = 0;
    }, 1000);
  }
}
