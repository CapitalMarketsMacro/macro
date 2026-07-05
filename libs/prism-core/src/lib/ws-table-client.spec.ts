import { WsTableClient, discoverWsTables, type WebSocketLike, type WsTableInfo } from './ws-table-client';
import type { TransportMessage } from '@macro/transports';

/** Scriptable fake of the minimal WebSocket surface the client uses. */
class FakeWs implements WebSocketLike {
  onopen: ((ev?: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onerror: ((ev?: unknown) => void) | null = null;
  onclose: ((ev?: { code?: number; reason?: string }) => void) | null = null;
  readyState = 0; // CONNECTING
  readonly sent: string[] = [];
  closed?: { code?: number; reason?: string };

  send(data: string): void {
    this.sent.push(data);
  }
  close(code?: number, reason?: string): void {
    this.readyState = 3; // CLOSED
    this.closed = { code, reason };
  }
  open(): void {
    this.readyState = 1; // OPEN
    this.onopen?.();
  }
  receive(frame: unknown): void {
    this.onmessage?.({ data: typeof frame === 'string' ? frame : JSON.stringify(frame) });
  }
  lastSent(): unknown {
    return JSON.parse(this.sent[this.sent.length - 1]);
  }
}

const TABLES: WsTableInfo[] = [
  { name: 'ust_trades', title: 'US Treasury Trades', keyField: 'tradeId', mode: 'append' },
  { name: 'ust_market_data', title: 'UST Market Data', keyField: 'symbol', mode: 'snapshot-update' },
];

async function connected(): Promise<{ ws: FakeWs; client: WsTableClient }> {
  const ws = new FakeWs();
  const client = new WsTableClient(() => ws);
  const connecting = client.connect('ws://x/prism');
  ws.open();
  await connecting;
  return { ws, client };
}

function collect(observable: { subscribe: (cb: (m: TransportMessage) => void) => unknown }): unknown[] {
  const got: unknown[] = [];
  observable.subscribe((m) => got.push(m.json()));
  return got;
}

describe('WsTableClient', () => {
  it('connect resolves on open and rejects on close before open', async () => {
    const { client } = await connected();
    await client.disconnect();

    const ws2 = new FakeWs();
    const client2 = new WsTableClient(() => ws2);
    const connecting = client2.connect('ws://down');
    ws2.onclose?.({ reason: 'refused' });
    await expect(connecting).rejects.toThrow(/closed before connecting/);
  });

  it('listTables resolves from the on-connect announcement', async () => {
    const { ws, client } = await connected();
    ws.receive({ type: 'tables', tables: TABLES });
    await expect(client.listTables()).resolves.toEqual(TABLES);
  });

  it('listTables sends a listTables request and awaits the announcement', async () => {
    const { ws, client } = await connected();
    const listing = client.listTables(1000);
    expect(ws.lastSent()).toEqual({ type: 'listTables' });
    ws.receive({ type: 'tables', tables: TABLES });
    await expect(listing).resolves.toEqual(TABLES);
  });

  it('subscribeTable sends subscribe, delivers the snapshot array, then resolves snapshotComplete', async () => {
    const { ws, client } = await connected();
    const { observable, subscriptionId, snapshotComplete } = client.subscribeTable('ust_market_data');
    expect(ws.lastSent()).toEqual({ type: 'subscribe', table: 'ust_market_data' });
    expect(subscriptionId).toBe('ws-table-ust_market_data');

    const got = collect(observable);
    ws.receive({ type: 'subscribed', table: 'ust_market_data' }); // ack only — not a row
    ws.receive({ type: 'snapshot', table: 'ust_market_data', rows: [{ symbol: 'UST 2Y' }, { symbol: 'ZTU6' }] });
    await snapshotComplete;
    expect(got).toEqual([[{ symbol: 'UST 2Y' }, { symbol: 'ZTU6' }]]);
  });

  it('update frames deliver both single-row and batch payloads unwrapped', async () => {
    const { ws, client } = await connected();
    const { observable, snapshotComplete } = client.subscribeTable('ust_trades');
    const got = collect(observable);

    ws.receive({ type: 'snapshot', table: 'ust_trades', rows: [] });
    await snapshotComplete;
    ws.receive({ type: 'update', table: 'ust_trades', row: { tradeId: 'T-1' } });
    ws.receive({ type: 'update', table: 'ust_trades', rows: [{ tradeId: 'T-2' }, { tradeId: 'T-3' }] });

    expect(got).toEqual([[], { tradeId: 'T-1' }, [{ tradeId: 'T-2' }, { tradeId: 'T-3' }]]);
  });

  it('is lenient with envelope-less servers: bare arrays and objects are rows', async () => {
    const { ws, client } = await connected();
    const { observable, snapshotComplete } = client.subscribeTable('anything');
    const got = collect(observable);

    ws.receive([{ a: 1 }, { a: 2 }]); // bare batch
    ws.receive({ a: 3 }); // bare row, no recognised control type
    await snapshotComplete; // resolved by the first data frame — no snapshot frame needed

    expect(got).toEqual([[{ a: 1 }, { a: 2 }], { a: 3 }]);
  });

  it('a lone bare-array frame ends the snapshot phase (no stall against envelope-less servers)', async () => {
    const { ws, client } = await connected();
    const { snapshotComplete } = client.subscribeTable('anything');
    ws.receive([{ a: 1 }]);
    await expect(snapshotComplete).resolves.toBeUndefined();
  });

  it('a deliberate disconnect during connect settles connect() without firing onError', async () => {
    const ws = new FakeWs();
    const client = new WsTableClient(() => ws);
    const errors: string[] = [];
    client.onError((e) => errors.push(e.message));

    const connecting = client.connect('ws://slow-host'); // never opens
    await client.disconnect();

    await expect(connecting).rejects.toThrow('Disconnected');
    // The browser may still fire error/close on the aborted CONNECTING socket — must stay silent.
    ws.onerror?.();
    ws.onclose?.({ reason: 'aborted' });
    expect(errors).toEqual([]);
  });

  it('a server error frame rejects snapshotComplete and fires onError', async () => {
    const { ws, client } = await connected();
    const errors: string[] = [];
    client.onError((e) => errors.push(e.message));
    const { snapshotComplete } = client.subscribeTable('nope');

    ws.receive({ type: 'error', message: 'Unknown table: nope' });

    await expect(snapshotComplete).rejects.toThrow('Unknown table: nope');
    expect(errors).toEqual(['Unknown table: nope']);
  });

  it('an unexpected close rejects snapshotComplete and fires onError', async () => {
    const { ws, client } = await connected();
    const errors: string[] = [];
    client.onError((e) => errors.push(e.message));
    const { snapshotComplete } = client.subscribeTable('ust_trades');

    ws.onclose?.({ reason: 'server going away' });

    await expect(snapshotComplete).rejects.toThrow(/server going away/);
    expect(errors).toHaveLength(1);
  });

  it('disconnect unsubscribes, closes the socket, and completes the stream', async () => {
    const { ws, client } = await connected();
    const { observable } = client.subscribeTable('ust_trades');
    let completed = false;
    (observable as unknown as { subscribe: (o: { complete: () => void; next: () => void }) => void }).subscribe({
      next: () => undefined,
      complete: () => (completed = true),
    });

    await client.disconnect();

    expect(ws.lastSent()).toEqual({ type: 'unsubscribe', table: 'ust_trades' });
    expect(ws.closed?.code).toBe(1000);
    expect(completed).toBe(true);
  });

  it('discoverWsTables connects, reads the announced tables, and disconnects', async () => {
    const ws = new FakeWs();
    const RealWebSocket = (globalThis as { WebSocket?: unknown }).WebSocket;
    (globalThis as { WebSocket?: unknown }).WebSocket = function () {
      return ws;
    };
    try {
      const discovering = discoverWsTables('ws://x/prism', 1000);
      ws.open();
      ws.receive({ type: 'tables', tables: TABLES });
      await expect(discovering).resolves.toEqual(TABLES);
      expect(ws.closed?.code).toBe(1000);
    } finally {
      (globalThis as { WebSocket?: unknown }).WebSocket = RealWebSocket;
    }
  });
});
