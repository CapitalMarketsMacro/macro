import { Subject, type Observable } from 'rxjs';
import type { TransportMessage } from '@macro/transports';

/**
 * Plain-WebSocket "table" protocol client (framework-free, browser `WebSocket`).
 *
 * Protocol — all JSON text frames:
 *  server → client on connect:   `{ type: 'tables', tables: [{ name, title?, description?, keyField?, mode? }] }`
 *  client → server:              `{ type: 'listTables' }` / `{ type: 'subscribe', table }` / `{ type: 'unsubscribe', table }`
 *  server → client on subscribe: `{ type: 'subscribed', table, ... }` then `{ type: 'snapshot', table, rows: [...] }`
 *  server → client streaming:    `{ type: 'update', table, row: {...} }` or `{ type: 'update', table, rows: [...] }`
 *  server → client on problems:  `{ type: 'error', message }`
 *
 * Lenient by design so it also works against servers that skip the envelope: a bare JSON array is
 * treated as a batch of rows, a bare object without a recognised control `type` as a single row,
 * and `snapshotComplete` falls back to resolving on the first live row (or a timeout) when the
 * server never sends a `snapshot` frame.
 */

/** A table announced by the server. `name` is what `subscribe` takes (→ `BlotterSource.topic`). */
export interface WsTableInfo {
  name: string;
  title?: string;
  description?: string;
  /** Server-suggested natural key for the table's rows. */
  keyField?: string;
  /** Server-suggested blotter mode (e.g. 'snapshot-update' | 'append'). */
  mode?: string;
}

/** Minimal surface of the browser WebSocket the client uses — injectable for tests. */
export interface WebSocketLike {
  onopen: ((ev?: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onerror: ((ev?: unknown) => void) | null;
  onclose: ((ev?: { code?: number; reason?: string }) => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  readonly readyState: number;
}

export type WebSocketFactory = (url: string) => WebSocketLike;

const defaultFactory: WebSocketFactory = (url) => new WebSocket(url) as unknown as WebSocketLike;

const OPEN = 1; // WebSocket.OPEN without depending on the global in non-browser test envs

interface PendingSubscription {
  table: string;
  subject: Subject<TransportMessage>;
  resolveSnapshot: () => void;
  rejectSnapshot: (err: Error) => void;
  snapshotSettled: boolean;
  snapshotTimer?: ReturnType<typeof setTimeout>;
}

export class WsTableClient {
  private ws?: WebSocketLike;
  private url = '';
  private closedByUs = false;

  private tables?: WsTableInfo[];
  private tableWaiters: { resolve: (t: WsTableInfo[]) => void; reject: (e: Error) => void }[] = [];

  private sub?: PendingSubscription;
  private errorHandler?: (err: Error) => void;
  /** Settles a still-pending connect() when disconnect() is called mid-handshake. */
  private abortConnect?: (msg: string) => void;

  constructor(private readonly wsFactory: WebSocketFactory = defaultFactory) {}

  /** Open the socket; resolves once connected. Rejects on failure or `timeoutMs`. */
  connect(url: string, timeoutMs = 10_000): Promise<void> {
    this.url = url;
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const fail = (msg: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error(msg));
      };
      const timer = setTimeout(() => fail(`WebSocket connect timeout after ${timeoutMs}ms: ${url}`), timeoutMs);
      this.abortConnect = fail;
      let ws: WebSocketLike;
      try {
        ws = this.wsFactory(url);
      } catch (e) {
        fail(e instanceof Error ? e.message : String(e));
        return;
      }
      this.ws = ws;
      ws.onopen = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.abortConnect = undefined;
        resolve();
      };
      ws.onmessage = (ev) => this.handleFrame(typeof ev.data === 'string' ? ev.data : String(ev.data));
      ws.onerror = () => {
        fail(`WebSocket error connecting to ${url}`);
        // A deliberate disconnect() can fail a CONNECTING socket — that is not an error.
        if (!this.closedByUs) this.fireError(new Error(`WebSocket error (${this.url})`));
      };
      ws.onclose = (ev) => {
        fail(`WebSocket closed before connecting to ${url}`);
        this.handleClose(ev?.reason);
      };
    });
  }

  /**
   * Tables announced by the server. The server sends them on connect; if they have not arrived
   * yet a `listTables` request is sent and the result awaited (up to `timeoutMs`).
   */
  listTables(timeoutMs = 5_000): Promise<WsTableInfo[]> {
    if (this.tables) return Promise.resolve(this.tables);
    return new Promise<WsTableInfo[]>((resolve, reject) => {
      const waiter = {
        resolve: (t: WsTableInfo[]) => {
          clearTimeout(timer);
          resolve(t);
        },
        reject: (e: Error) => {
          clearTimeout(timer);
          reject(e);
        },
      };
      const timer = setTimeout(() => {
        this.tableWaiters = this.tableWaiters.filter((w) => w !== waiter);
        reject(new Error(`Server did not announce tables within ${timeoutMs}ms — is it a Prism table server?`));
      }, timeoutMs);
      this.tableWaiters.push(waiter);
      this.trySend({ type: 'listTables' });
    });
  }

  /**
   * Subscribe to one table. Snapshot rows and live rows flow through the same observable
   * (payloads are the unwrapped row object / rows array, `TransportMessage`-shaped);
   * `snapshotComplete` resolves at the snapshot/live boundary — mirroring the shape of
   * `AmpsTransport.sowAndSubscribe` / `NatsJetStreamTransport.snapshotAndSubscribe`.
   */
  subscribeTable(
    table: string,
    snapshotTimeoutMs = 10_000,
  ): { observable: Observable<TransportMessage>; subscriptionId: string; snapshotComplete: Promise<void> } {
    const subject = new Subject<TransportMessage>();
    const sub: PendingSubscription = {
      table,
      subject,
      resolveSnapshot: () => undefined,
      rejectSnapshot: () => undefined,
      snapshotSettled: false,
    };
    const snapshotComplete = new Promise<void>((resolve, reject) => {
      sub.resolveSnapshot = () => {
        if (sub.snapshotSettled) return;
        sub.snapshotSettled = true;
        clearTimeout(sub.snapshotTimer);
        resolve();
      };
      sub.rejectSnapshot = (err: Error) => {
        if (sub.snapshotSettled) return;
        sub.snapshotSettled = true;
        clearTimeout(sub.snapshotTimer);
        reject(err);
      };
    });
    // Servers without snapshot support: go live after the timeout instead of hanging.
    sub.snapshotTimer = setTimeout(() => sub.resolveSnapshot(), snapshotTimeoutMs);
    this.sub = sub;
    this.trySend({ type: 'subscribe', table });
    return { observable: subject.asObservable(), subscriptionId: `ws-table-${table}`, snapshotComplete };
  }

  onError(handler: (err: Error) => void): void {
    this.errorHandler = handler;
  }

  disconnect(): Promise<void> {
    this.closedByUs = true;
    this.abortConnect?.('Disconnected');
    if (this.sub) {
      this.trySend({ type: 'unsubscribe', table: this.sub.table });
      this.teardownSub();
    }
    this.rejectWaiters(new Error('Disconnected'));
    try {
      this.ws?.close(1000, 'client disconnect');
    } catch {
      // already closed
    }
    this.ws = undefined;
    return Promise.resolve();
  }

  // ── frame handling ──

  private handleFrame(raw: string): void {
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      // Not JSON — surface it as a single row (BlotterFeed wraps unparseable data as { value }).
      this.emitRows(raw, raw);
      return;
    }

    if (Array.isArray(payload)) {
      // Bare array — a batch of rows from an envelope-less server. Live data ends the snapshot phase.
      this.emitRows(payload, raw);
      this.sub?.resolveSnapshot();
      return;
    }
    if (payload === null || typeof payload !== 'object') {
      this.emitRows(payload, raw);
      this.sub?.resolveSnapshot();
      return;
    }

    const frame = payload as Record<string, unknown>;
    switch (frame['type']) {
      case 'tables': {
        const tables = (Array.isArray(frame['tables']) ? frame['tables'] : []) as WsTableInfo[];
        this.tables = tables;
        const waiters = this.tableWaiters;
        this.tableWaiters = [];
        for (const w of waiters) w.resolve(tables);
        return;
      }
      case 'subscribed':
        return; // ack only — the snapshot frame carries the data
      case 'snapshot': {
        const rows = Array.isArray(frame['rows']) ? frame['rows'] : [];
        this.emitRows(rows, raw);
        this.sub?.resolveSnapshot();
        return;
      }
      case 'update': {
        const rows = frame['rows'] ?? frame['row'] ?? frame['data'];
        this.emitRows(rows ?? frame, raw);
        // A server that streams without a snapshot frame: first update ends the snapshot phase.
        this.sub?.resolveSnapshot();
        return;
      }
      case 'error': {
        const err = new Error(String(frame['message'] ?? 'WebSocket table server error'));
        this.sub?.rejectSnapshot(err);
        this.rejectWaiters(err);
        this.fireError(err);
        return;
      }
      default:
        // Unrecognised shape — treat as a plain data row (plain-WS servers with their own envelope).
        this.emitRows(frame, raw);
        this.sub?.resolveSnapshot();
    }
  }

  /** Wrap an unwrapped payload (row object or rows array) as a TransportMessage and emit it. */
  private emitRows(payload: unknown, raw: string): void {
    const sub = this.sub;
    if (!sub) return; // data before any subscription (e.g. greeting frames) — nothing to feed yet
    sub.subject.next({
      topic: sub.table,
      data: typeof payload === 'string' ? payload : JSON.stringify(payload),
      json: <R>() => payload as R,
      raw,
    });
  }

  private handleClose(reason?: string): void {
    const err = new Error(reason ? `WebSocket closed: ${reason}` : 'WebSocket closed');
    if (!this.closedByUs) {
      this.sub?.rejectSnapshot(err);
      this.rejectWaiters(err);
      this.fireError(err);
    }
    this.teardownSub();
  }

  private teardownSub(): void {
    if (!this.sub) return;
    clearTimeout(this.sub.snapshotTimer);
    this.sub.subject.complete();
    this.sub = undefined;
  }

  private rejectWaiters(err: Error): void {
    const waiters = this.tableWaiters;
    this.tableWaiters = [];
    for (const w of waiters) w.reject(err);
  }

  private trySend(msg: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private fireError(err: Error): void {
    this.errorHandler?.(err);
  }
}

/**
 * One-shot table discovery for the ad-hoc source dialogs: connect, read the announced tables,
 * disconnect. Rejects if the endpoint is unreachable or never announces tables.
 */
export async function discoverWsTables(url: string, timeoutMs = 5_000): Promise<WsTableInfo[]> {
  const client = new WsTableClient();
  try {
    await client.connect(url, timeoutMs);
    return await client.listTables(timeoutMs);
  } finally {
    void client.disconnect();
  }
}
