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
import type { BlotterSource, RestConn, WsConn } from './blotter-source';
import { mergeSample } from './column-inference';
import { WsTableClient } from './ws-table-client';
import { RestSnapshotClient } from './rest-table-client';

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
 *  - WebSocket → table protocol via {@link WsTableClient} (table snapshot then stream).
 *  - REST → snapshot-only via {@link RestSnapshotClient}; no stream — call {@link refresh} to
 *    re-fetch and diff the new snapshot into the grid in place.
 * One instance per blotter so each source gets its own connection. Framework-free: status is a
 * snapshot exposed via `getState()` + `subscribe()`.
 */
export class BlotterFeed {
  private state: FeedState = { status: 'idle', rowCount: 0, msgsPerSec: 0, error: null };
  private readonly listeners = new Set<() => void>();

  private transport?: TransportClient;
  private wsClient?: WsTableClient;
  private restClient?: RestSnapshotClient;
  private refreshing = false;
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
  /** Set by stop(): suppresses late connect/close errors from overwriting the 'stopped' state. */
  private stopping = false;

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

      // No conflation for snapshot-only REST — there is no stream, refresh() writes to the grid directly.
      if (
        this.source.transport !== 'rest' &&
        this.source.mode !== 'append' &&
        (this.source.mode === 'streaming' || this.source.conflationMs != null)
      ) {
        this.conflation = new ConflationSubject<string, Row>(this.source.conflationMs ?? 250);
        this.subs.add(this.conflation.subscribeToConflated(({ value }) => this.grid.updateRows([value])));
      }

      if (this.source.transport === 'websocket') {
        await this.wireWebSocket();
      } else if (this.source.transport === 'rest') {
        await this.wireRest();
      } else {
        this.transport = this.makeTransport();
        this.transport.onError((e) => {
          if (!this.stopping) this.patch({ error: e.message, status: 'error' });
        });
        await this.transport.connect(this.connectOpts());

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
      }
      if (this.source.transport !== 'rest') this.startRateMeter(); // snapshot-only: no msgs/sec
    } catch (e) {
      this.conflation?.complete(); // don't leave the conflation interval ticking on a failed start
      if (!this.stopping) {
        this.patch({ status: 'error', error: e instanceof Error ? e.message : String(e) });
      }
    }
  }

  async stop(): Promise<void> {
    this.stopping = true;
    if (this.rateTimer) clearInterval(this.rateTimer);
    this.subs.unsubscribe();
    this.conflation?.complete();
    if (this.subId) await this.transport?.unsubscribe(this.subId).catch(() => undefined);
    await this.transport?.disconnect().catch(() => undefined);
    await this.wsClient?.disconnect().catch(() => undefined);
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
      case 'websocket':
        throw new Error('websocket sources are wired via WsTableClient, not a TransportClient');
      case 'rest':
        throw new Error('rest sources are wired via RestSnapshotClient, not a TransportClient');
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

  /** WebSocket table protocol: connect, subscribe to the table (`topic`), snapshot then live. */
  private async wireWebSocket(): Promise<void> {
    const conn = this.source.connection as WsConn;
    const client = new WsTableClient();
    this.wsClient = client;
    client.onError((e) => {
      if (!this.stopping) this.patch({ error: e.message, status: 'error' });
    });
    await client.connect(conn.url);
    this.patch({ status: 'snapshot-loading' });
    const { observable, subscriptionId, snapshotComplete } = client.subscribeTable(this.source.topic);
    this.subId = subscriptionId;
    await this.consumeSnapshotThenLive(observable, snapshotComplete);
  }

  /** REST: one-shot snapshot (JSON array), no stream. Later data comes only from {@link refresh}. */
  private async wireRest(): Promise<void> {
    const conn = this.source.connection as RestConn;
    this.restClient = new RestSnapshotClient();
    this.patch({ status: 'snapshot-loading' });
    const rows = (await this.restClient.fetchRows(conn.url, this.source.topic)).map((r) => this.asRow(r));
    // stop() cannot abort an in-flight fetch — a late snapshot must not seed a stopped feed's grid.
    if (this.stopping) return;
    this.inferFromBatch(rows);
    this.seedSnapshot(rows);
    this.patch({ status: 'live' });
  }

  /**
   * Re-fetch the REST snapshot and diff it into the grid in place: new keys are added, existing
   * keys updated, and keys missing from the new snapshot removed (append mode replaces all rows).
   * No-op for streaming transports — their data is already live.
   */
  async refresh(): Promise<void> {
    const conn = this.source.connection;
    if (conn.transport !== 'rest' || !this.restClient || this.refreshing || this.stopping) return;
    // Only refresh a settled feed — racing the initial wireRest() fetch would double-insert rows.
    if (this.state.status !== 'live' && this.state.status !== 'error') return;
    this.refreshing = true;
    try {
      this.patch({ status: 'snapshot-loading', error: null });
      const fetched = (await this.restClient.fetchRows(conn.url, this.source.topic)).map((r) => this.asRow(r));
      if (this.stopping) return;
      // Dedupe within the snapshot (last wins) — duplicate keys would double-insert as adds.
      const rows =
        this.source.mode === 'append' ? fetched : [...new Map(fetched.map((r) => [this.keyOf(r), r])).values()];
      this.inferFromBatch(rows);
      if (this.source.mode === 'append') {
        const removed = this.appendQueue.splice(0);
        if (removed.length) this.grid.deleteRows(removed);
        const seeded = rows.map((r) => this.stampId(r));
        this.appendQueue.push(...seeded);
        this.grid.addRows(seeded);
        this.patch({ rowCount: this.appendQueue.length, status: 'live' });
      } else {
        const keyField = this.source.keyField ?? 'id';
        const nextKeys = new Set(rows.map((r) => this.keyOf(r)));
        const adds = rows.filter((r) => !this.keys.has(this.keyOf(r)));
        const updates = rows.filter((r) => this.keys.has(this.keyOf(r)));
        // Removal only needs the row id — a stub with the key field satisfies getRowId.
        const removedKeys = [...this.keys].filter((k) => !nextKeys.has(k));
        if (adds.length) this.grid.addRows(adds);
        if (updates.length) this.grid.updateRows(updates);
        if (removedKeys.length) this.grid.deleteRows(removedKeys.map((k) => ({ [keyField]: k })));
        this.keys.clear();
        for (const k of nextKeys) this.keys.add(k);
        this.patch({ rowCount: this.keys.size, status: 'live' });
      }
    } catch (e) {
      if (!this.stopping) {
        this.patch({ status: 'error', error: e instanceof Error ? e.message : String(e) });
      }
    } finally {
      this.refreshing = false;
    }
  }

  /** NATS core / Solace: live-only — no snapshot, every record routed per mode (upsert / append). */
  private async wireLive(): Promise<void> {
    const { observable, subscriptionId } = await this.transport!.subscribeAsObservable(this.source.topic);
    this.subId = subscriptionId;
    this.subs.add(observable.subscribe((m) => this.readRecords(m).forEach((r) => this.route(r))));
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
        const recs = this.readRecords(m);
        if (inSnapshot) {
          for (const rec of recs) snapshot.push(rec);
        } else {
          for (const rec of recs) this.route(rec);
        }
      }),
    );
    await complete;
    inSnapshot = false;
    this.inferFromBatch(snapshot);
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

  /**
   * Parse a transport message into one or more rows. A payload that is a JSON array is expanded so
   * each element becomes its own row (unless the source opts out via `expandArrays: false`); a plain
   * object payload is a single row. Non-object array elements are wrapped as `{ value }`.
   * WebSocket table sources ALWAYS expand — there the array is protocol framing (snapshot / batch
   * frames), never a value.
   */
  private readRecords(m: TransportMessage): Row[] {
    const expand = this.source.transport === 'websocket' || this.source.expandArrays !== false;
    const payload = this.readPayload(m);
    if (expand && Array.isArray(payload)) {
      return payload.map((el) => this.asRow(el));
    }
    return [this.asRow(payload)];
  }

  private readPayload(m: TransportMessage): unknown {
    try {
      return m.json<unknown>();
    } catch {
      return { value: m.data };
    }
  }

  private asRow(value: unknown): Row {
    return value != null && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : { value };
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

  /**
   * Snapshot batches infer from a MERGED sample (first non-null value per field across the first
   * rows) so sparse fields — e.g. `yield`, null on futures but numeric on cash — still infer as
   * numeric no matter which record happens to arrive first. Live-only feeds (no snapshot) still
   * infer from their first record via {@link maybeInferColumns}.
   */
  private inferFromBatch(rows: Row[]): void {
    if (!rows.length) return;
    this.maybeInferColumns(mergeSample(rows));
  }

  private startRateMeter(): void {
    this.rateTimer = setInterval(() => {
      this.patch({ msgsPerSec: this.msgWindow });
      this.msgWindow = 0;
    }, 1000);
  }
}
