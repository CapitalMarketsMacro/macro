import { Subject } from 'rxjs';
import { BlotterFeed, type GridOps } from './blotter-feed';
import type { BlotterSource } from './blotter-source';

// ── Mocks ────────────────────────────────────────────────────────────

const mockTransportInstances: any[] = [];

function mockMakeTransport() {
  const live = new Subject<any>();
  const sow = new Subject<any>();
  const snap = new Subject<any>();
  let resolveSow!: () => void;
  let resolveSnap!: () => void;
  const sowComplete = new Promise<void>((r) => (resolveSow = r));
  const snapshotComplete = new Promise<void>((r) => (resolveSnap = r));

  const t: any = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    unsubscribe: jest.fn().mockResolvedValue(undefined),
    onError: jest.fn(),
    subscribeAsObservable: jest.fn().mockResolvedValue({ observable: live.asObservable(), subscriptionId: 'sub-live' }),
    sowAndSubscribe: jest.fn().mockResolvedValue({ observable: sow.asObservable(), subscriptionId: 'sub-sow', sowComplete }),
    snapshotAndSubscribe: jest
      .fn()
      .mockResolvedValue({ observable: snap.asObservable(), subscriptionId: 'sub-snap', snapshotComplete }),
    __live: live,
    __sow: sow,
    __snap: snap,
    __resolveSow: () => resolveSow(),
    __resolveSnap: () => resolveSnap(),
  };
  mockTransportInstances.push(t);
  return t;
}

jest.mock('@macro/transports', () => ({
  AmpsTransport: jest.fn().mockImplementation(() => mockMakeTransport()),
  NatsTransport: jest.fn().mockImplementation(() => mockMakeTransport()),
  NatsJetStreamTransport: jest.fn().mockImplementation(() => mockMakeTransport()),
  SolaceTransport: jest.fn().mockImplementation(() => mockMakeTransport()),
}));

const mockWsClientInstances: any[] = [];

function mockMakeWsClient() {
  const stream = new Subject<any>();
  let resolveSnap!: () => void;
  let rejectSnap!: (e: Error) => void;
  const snapshotComplete = new Promise<void>((res, rej) => {
    resolveSnap = res;
    rejectSnap = rej;
  });
  const c: any = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    onError: jest.fn(),
    subscribeTable: jest
      .fn()
      .mockImplementation((table: string) => ({ observable: stream.asObservable(), subscriptionId: `ws-table-${table}`, snapshotComplete })),
    __stream: stream,
    __resolveSnap: () => resolveSnap(),
    __rejectSnap: (e: Error) => rejectSnap(e),
  };
  mockWsClientInstances.push(c);
  return c;
}

jest.mock('./ws-table-client', () => ({
  WsTableClient: jest.fn().mockImplementation(() => mockMakeWsClient()),
}));

const mockRestClientInstances: any[] = [];
/** Snapshots served in order by the mocked RestSnapshotClient — push BEFORE start()/refresh(). */
const restRowsQueue: unknown[][] = [];

function mockMakeRestClient() {
  const c: any = {
    fetchRows: jest.fn().mockImplementation(() => Promise.resolve(restRowsQueue.length ? restRowsQueue.shift() : [])),
  };
  mockRestClientInstances.push(c);
  return c;
}

jest.mock('./rest-table-client', () => ({
  RestSnapshotClient: jest.fn().mockImplementation(() => mockMakeRestClient()),
}));

// Conflation as an immediate passthrough so streaming updates are deterministic in tests.
jest.mock('@macro/utils', () => ({
  ConflationSubject: jest.fn().mockImplementation(() => {
    let cb: ((v: { key: string; value: unknown }) => void) | undefined;
    return {
      subscribeToConflated: (fn: (v: { key: string; value: unknown }) => void) => {
        cb = fn;
        return { unsubscribe: jest.fn() };
      },
      next: (v: { key: string; value: unknown }) => cb?.(v),
      complete: jest.fn(),
    };
  }),
}));

// ── Helpers ──────────────────────────────────────────────────────────

const macro = () => new Promise((r) => setTimeout(r, 0));
const msg = (obj: unknown) => ({ json: () => obj, data: JSON.stringify(obj), topic: 't' });
const lastTransport = () => mockTransportInstances[mockTransportInstances.length - 1];
const lastWsClient = () => mockWsClientInstances[mockWsClientInstances.length - 1];
const lastRestClient = () => mockRestClientInstances[mockRestClientInstances.length - 1];

/** A fake GridOps capturing what the feed writes (mirrors both grids' addRows$/updateRows$/etc.). */
function makeGrid() {
  const adds: any[] = [];
  const updates: any[] = [];
  const removes: any[] = [];
  const setInitial = jest.fn();
  const grid: GridOps = {
    addRows: (r) => adds.push(...r),
    updateRows: (r) => updates.push(...r),
    deleteRows: (r) => removes.push(...r),
    setInitialRowData: setInitial,
  };
  return { grid, adds, updates, removes, setInitial };
}

const base: Omit<BlotterSource, 'transport' | 'mode' | 'connection'> = {
  id: 's1',
  name: 'Test',
  category: 'Test',
  topic: 't',
  columnMode: 'infer',
};

// ── Tests ────────────────────────────────────────────────────────────

describe('BlotterFeed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransportInstances.length = 0;
    mockWsClientInstances.length = 0;
    mockRestClientInstances.length = 0;
    restRowsQueue.length = 0;
  });

  it('NATS append: appends each message and trims to maxRows', async () => {
    const { grid, adds, removes } = makeGrid();
    const onColumns = jest.fn();
    const source: BlotterSource = {
      ...base,
      transport: 'nats',
      mode: 'append',
      maxRows: 2,
      connection: { transport: 'nats', servers: 'ws://x' },
    };
    const feed = new BlotterFeed(source, grid, onColumns);
    await feed.start();
    const t = lastTransport();

    t.__live.next(msg({ a: 1 }));
    t.__live.next(msg({ a: 2 }));
    t.__live.next(msg({ a: 3 }));

    expect(adds).toHaveLength(3);
    expect(removes).toHaveLength(1);
    expect(removes[0]).toMatchObject({ a: 1 });
    expect(feed.getState().rowCount).toBe(2);
    expect(onColumns).toHaveBeenCalledTimes(1);
    expect(onColumns).toHaveBeenCalledWith({ a: 1 });
    expect(feed.getState().status).toBe('live');
  });

  it('NATS snapshot-update (no snapshot): adds new keys, updates existing ones', async () => {
    const { grid, adds, updates } = makeGrid();
    const source: BlotterSource = {
      ...base,
      transport: 'nats',
      mode: 'snapshot-update',
      keyField: 'symbol',
      connection: { transport: 'nats', servers: 'ws://x' },
    };
    const feed = new BlotterFeed(source, grid, jest.fn());
    await feed.start();
    const t = lastTransport();

    t.__live.next(msg({ symbol: 'EUR', px: 1 }));
    t.__live.next(msg({ symbol: 'EUR', px: 2 }));
    t.__live.next(msg({ symbol: 'JPY', px: 3 }));

    expect(adds.map((r) => r.symbol)).toEqual(['EUR', 'JPY']);
    expect(updates).toEqual([{ symbol: 'EUR', px: 2 }]);
    expect(feed.getState().rowCount).toBe(2);
  });

  it('streaming: conflated updates route to updateRows for known keys', async () => {
    const { grid, adds, updates } = makeGrid();
    const source: BlotterSource = {
      ...base,
      transport: 'nats',
      mode: 'streaming',
      keyField: 'symbol',
      conflationMs: 100,
      connection: { transport: 'nats', servers: 'ws://x' },
    };
    const feed = new BlotterFeed(source, grid, jest.fn());
    await feed.start();
    const t = lastTransport();

    t.__live.next(msg({ symbol: 'EUR', px: 1 })); // new -> add
    t.__live.next(msg({ symbol: 'EUR', px: 2 })); // known -> conflation -> update
    expect(adds).toEqual([{ symbol: 'EUR', px: 1 }]);
    expect(updates).toEqual([{ symbol: 'EUR', px: 2 }]);
  });

  it('AMPS: buffers the SOW snapshot, seeds it, then streams live updates', async () => {
    const { grid, updates, setInitial } = makeGrid();
    const source: BlotterSource = {
      ...base,
      transport: 'amps',
      mode: 'snapshot-update',
      keyField: 'symbol',
      connection: { transport: 'amps', url: 'ws://x/amps/json' },
    };
    const feed = new BlotterFeed(source, grid, jest.fn());
    const starting = feed.start();
    await macro(); // let start() reach `await sowComplete`
    const t = lastTransport();
    expect(t.sowAndSubscribe).toHaveBeenCalledWith('t', undefined);
    expect(feed.getState().status).toBe('snapshot-loading');

    t.__sow.next(msg({ symbol: 'EUR', px: 1 }));
    t.__sow.next(msg({ symbol: 'JPY', px: 2 }));
    t.__resolveSow();
    await starting;

    expect(setInitial).toHaveBeenCalledWith([
      { symbol: 'EUR', px: 1 },
      { symbol: 'JPY', px: 2 },
    ]);
    expect(feed.getState().rowCount).toBe(2);
    expect(feed.getState().status).toBe('live');

    t.__sow.next(msg({ symbol: 'EUR', px: 9 }));
    expect(updates).toEqual([{ symbol: 'EUR', px: 9 }]);
  });

  it('JetStream: uses snapshotAndSubscribe and seeds the snapshot', async () => {
    const { grid, setInitial } = makeGrid();
    const source: BlotterSource = {
      ...base,
      transport: 'nats-js',
      mode: 'snapshot-update',
      keyField: 'bookId',
      connection: { transport: 'nats-js', servers: 'ws://x' },
    };
    const feed = new BlotterFeed(source, grid, jest.fn());
    const starting = feed.start();
    await macro();
    const t = lastTransport();
    expect(t.snapshotAndSubscribe).toHaveBeenCalledWith('t');

    t.__snap.next(msg({ bookId: 'B1', qty: 10 }));
    t.__resolveSnap();
    await starting;

    expect(setInitial).toHaveBeenCalledWith([{ bookId: 'B1', qty: 10 }]);
    expect(feed.getState().status).toBe('live');
  });

  it('array payload: expands a JSON array into one row per element (append)', async () => {
    const { grid, adds } = makeGrid();
    const onColumns = jest.fn();
    const source: BlotterSource = {
      ...base,
      transport: 'nats',
      mode: 'append',
      connection: { transport: 'nats', servers: 'ws://x' },
    };
    const feed = new BlotterFeed(source, grid, onColumns);
    await feed.start();
    const t = lastTransport();

    t.__live.next(msg([{ a: 1 }, { a: 2 }, { a: 3 }]));

    expect(adds).toHaveLength(3);
    expect(adds.map((r) => r.a)).toEqual([1, 2, 3]);
    expect(feed.getState().rowCount).toBe(3);
    // Columns inferred from the FIRST element of the array, not the array itself.
    expect(onColumns).toHaveBeenCalledTimes(1);
    expect(onColumns).toHaveBeenCalledWith({ a: 1 });
  });

  it('array payload: upserts each element by key (snapshot-update)', async () => {
    const { grid, adds, updates } = makeGrid();
    const source: BlotterSource = {
      ...base,
      transport: 'nats',
      mode: 'snapshot-update',
      keyField: 'symbol',
      connection: { transport: 'nats', servers: 'ws://x' },
    };
    const feed = new BlotterFeed(source, grid, jest.fn());
    await feed.start();
    const t = lastTransport();

    t.__live.next(msg([{ symbol: 'EUR', px: 1 }, { symbol: 'JPY', px: 2 }]));
    t.__live.next(msg([{ symbol: 'EUR', px: 5 }])); // known key -> update

    expect(adds.map((r) => r.symbol)).toEqual(['EUR', 'JPY']);
    expect(updates).toEqual([{ symbol: 'EUR', px: 5 }]);
    expect(feed.getState().rowCount).toBe(2);
  });

  it('expandArrays:false treats an array payload as a single record', async () => {
    const { grid, adds } = makeGrid();
    const source: BlotterSource = {
      ...base,
      transport: 'nats',
      mode: 'append',
      expandArrays: false,
      connection: { transport: 'nats', servers: 'ws://x' },
    };
    const feed = new BlotterFeed(source, grid, jest.fn());
    await feed.start();
    const t = lastTransport();

    t.__live.next(msg([{ a: 1 }, { a: 2 }]));

    expect(adds).toHaveLength(1);
    expect(feed.getState().rowCount).toBe(1);
  });

  it('array payload in the JetStream snapshot seeds one row per element', async () => {
    const { grid, setInitial } = makeGrid();
    const source: BlotterSource = {
      ...base,
      transport: 'nats-js',
      mode: 'snapshot-update',
      keyField: 'bookId',
      connection: { transport: 'nats-js', servers: 'ws://x' },
    };
    const feed = new BlotterFeed(source, grid, jest.fn());
    const starting = feed.start();
    await macro();
    const t = lastTransport();

    t.__snap.next(msg([{ bookId: 'B1', qty: 10 }, { bookId: 'B2', qty: 20 }]));
    t.__resolveSnap();
    await starting;

    expect(setInitial).toHaveBeenCalledWith([
      { bookId: 'B1', qty: 10 },
      { bookId: 'B2', qty: 20 },
    ]);
    expect(feed.getState().rowCount).toBe(2);
  });

  it('WebSocket: connects, subscribes to the table, seeds the snapshot, then streams keyed updates', async () => {
    const { grid, updates, setInitial } = makeGrid();
    const source: BlotterSource = {
      ...base,
      transport: 'websocket',
      mode: 'snapshot-update',
      keyField: 'symbol',
      connection: { transport: 'websocket', url: 'ws://x/prism' },
    };
    const feed = new BlotterFeed(source, grid, jest.fn());
    const starting = feed.start();
    await macro(); // let start() reach `await snapshotComplete`
    const c = lastWsClient();
    expect(c.connect).toHaveBeenCalledWith('ws://x/prism');
    expect(c.subscribeTable).toHaveBeenCalledWith('t');
    expect(feed.getState().status).toBe('snapshot-loading');

    // Snapshot arrives as ONE message whose payload is a JSON array — one row per element.
    c.__stream.next(msg([{ symbol: 'UST 2Y', px: 99.8 }, { symbol: 'ZTU6', px: 103.4 }]));
    c.__resolveSnap();
    await starting;

    expect(setInitial).toHaveBeenCalledWith([
      { symbol: 'UST 2Y', px: 99.8 },
      { symbol: 'ZTU6', px: 103.4 },
    ]);
    expect(feed.getState().rowCount).toBe(2);
    expect(feed.getState().status).toBe('live');

    c.__stream.next(msg({ symbol: 'UST 2Y', px: 99.9 })); // single-row live update
    expect(updates).toEqual([{ symbol: 'UST 2Y', px: 99.9 }]);
  });

  it('WebSocket append: seeds trade history then appends single prints and array bursts', async () => {
    const { grid, adds, setInitial } = makeGrid();
    const source: BlotterSource = {
      ...base,
      transport: 'websocket',
      mode: 'append',
      connection: { transport: 'websocket', url: 'ws://x/prism' },
    };
    const feed = new BlotterFeed(source, grid, jest.fn());
    const starting = feed.start();
    await macro();
    const c = lastWsClient();

    c.__stream.next(msg([{ tradeId: 'T-1' }, { tradeId: 'T-2' }]));
    c.__resolveSnap();
    await starting;
    expect(setInitial).toHaveBeenCalledWith([
      expect.objectContaining({ tradeId: 'T-1' }),
      expect.objectContaining({ tradeId: 'T-2' }),
    ]);

    c.__stream.next(msg({ tradeId: 'T-3' })); // single print
    c.__stream.next(msg([{ tradeId: 'T-4' }, { tradeId: 'T-5' }])); // burst as array
    expect(adds.map((r) => r.tradeId)).toEqual(['T-3', 'T-4', 'T-5']);
    expect(feed.getState().rowCount).toBe(5);
  });

  it('WebSocket: stop() disconnects the table client', async () => {
    const { grid } = makeGrid();
    const source: BlotterSource = {
      ...base,
      transport: 'websocket',
      mode: 'append',
      connection: { transport: 'websocket', url: 'ws://x/prism' },
    };
    const feed = new BlotterFeed(source, grid, jest.fn());
    const starting = feed.start();
    await macro();
    const c = lastWsClient();
    c.__resolveSnap();
    await starting;

    await feed.stop();
    expect(c.disconnect).toHaveBeenCalled();
    expect(feed.getState().status).toBe('stopped');
  });

  it('WebSocket: array frames always expand, even with expandArrays:false (protocol framing)', async () => {
    const { grid, setInitial } = makeGrid();
    const source: BlotterSource = {
      ...base,
      transport: 'websocket',
      mode: 'append',
      expandArrays: false,
      connection: { transport: 'websocket', url: 'ws://x/prism' },
    };
    const feed = new BlotterFeed(source, grid, jest.fn());
    const starting = feed.start();
    await macro();
    const c = lastWsClient();

    c.__stream.next(msg([{ tradeId: 'T-1' }, { tradeId: 'T-2' }]));
    c.__resolveSnap();
    await starting;

    expect(setInitial).toHaveBeenCalledWith([
      expect.objectContaining({ tradeId: 'T-1' }),
      expect.objectContaining({ tradeId: 'T-2' }),
    ]);
    expect(feed.getState().rowCount).toBe(2);
  });

  it('WebSocket: stop() during snapshot-loading is not overwritten by the late connect rejection', async () => {
    const { grid } = makeGrid();
    const source: BlotterSource = {
      ...base,
      transport: 'websocket',
      mode: 'append',
      connection: { transport: 'websocket', url: 'ws://x/prism' },
    };
    const feed = new BlotterFeed(source, grid, jest.fn());
    const starting = feed.start();
    await macro();
    const c = lastWsClient();

    await feed.stop();
    c.__rejectSnap(new Error('WebSocket closed: client disconnect')); // late rejection after stop
    await starting;

    expect(feed.getState().status).toBe('stopped');
    expect(feed.getState().error).toBeNull();
  });

  it('WebSocket: a rejected snapshot (e.g. unknown table) surfaces as an error state', async () => {
    const { grid } = makeGrid();
    const source: BlotterSource = {
      ...base,
      transport: 'websocket',
      mode: 'append',
      connection: { transport: 'websocket', url: 'ws://x/prism' },
    };
    const feed = new BlotterFeed(source, grid, jest.fn());
    const starting = feed.start();
    await macro();
    lastWsClient().__rejectSnap(new Error('Unknown table: t'));
    await starting;

    expect(feed.getState().status).toBe('error');
    expect(feed.getState().error).toBe('Unknown table: t');
  });

  it('REST: fetches one snapshot, seeds it, infers columns, and reports live', async () => {
    const { grid, setInitial } = makeGrid();
    const onColumns = jest.fn();
    const source: BlotterSource = {
      ...base,
      transport: 'rest',
      mode: 'snapshot-update',
      keyField: 'symbol',
      connection: { transport: 'rest', url: 'http://x/tables' },
    };
    restRowsQueue.push([
      { symbol: 'UST 2Y', px: 99.8 },
      { symbol: 'ZTU6', px: 103.4 },
    ]);
    const feed = new BlotterFeed(source, grid, onColumns);
    await feed.start();

    expect(lastRestClient().fetchRows).toHaveBeenCalledWith('http://x/tables', 't');
    expect(setInitial).toHaveBeenCalledWith([
      { symbol: 'UST 2Y', px: 99.8 },
      { symbol: 'ZTU6', px: 103.4 },
    ]);
    expect(onColumns).toHaveBeenCalledTimes(1);
    expect(onColumns).toHaveBeenCalledWith({ symbol: 'UST 2Y', px: 99.8 });
    expect(feed.getState().rowCount).toBe(2);
    expect(feed.getState().status).toBe('live');
  });

  it('REST refresh: diffs the new snapshot — adds new keys, updates existing, removes missing', async () => {
    const { grid, adds, updates, removes, setInitial } = makeGrid();
    const source: BlotterSource = {
      ...base,
      transport: 'rest',
      mode: 'snapshot-update',
      keyField: 'symbol',
      connection: { transport: 'rest', url: 'http://x/tables' },
    };
    restRowsQueue.push(
      [
        { symbol: 'UST 2Y', px: 1 },
        { symbol: 'UST 5Y', px: 2 },
      ],
      [
        { symbol: 'UST 5Y', px: 9 }, // existing -> update
        { symbol: 'ZTU6', px: 3 }, // new -> add
        // UST 2Y missing -> remove
      ],
    );
    const feed = new BlotterFeed(source, grid, jest.fn());
    await feed.start();
    expect(feed.getState().rowCount).toBe(2);

    await feed.refresh();
    expect(updates).toEqual([{ symbol: 'UST 5Y', px: 9 }]);
    expect(adds).toEqual([{ symbol: 'ZTU6', px: 3 }]);
    expect(removes).toEqual([{ symbol: 'UST 2Y' }]);
    expect(feed.getState().rowCount).toBe(2);
    expect(feed.getState().status).toBe('live');
    expect(setInitial).toHaveBeenCalledTimes(1); // only the initial snapshot seeds the grid
  });

  it('REST refresh in append mode replaces all rows', async () => {
    const { grid, adds, removes } = makeGrid();
    const source: BlotterSource = {
      ...base,
      transport: 'rest',
      mode: 'append',
      connection: { transport: 'rest', url: 'http://x/tables' },
    };
    restRowsQueue.push([{ tradeId: 'T-1' }], [{ tradeId: 'T-1' }, { tradeId: 'T-2' }]);
    const feed = new BlotterFeed(source, grid, jest.fn());
    await feed.start(); // seeds T-1 via setInitialRowData

    await feed.refresh();
    expect(removes.map((r) => r.tradeId)).toEqual(['T-1']); // old rows dropped
    expect(adds.map((r) => r.tradeId)).toEqual(['T-1', 'T-2']); // replaced wholesale
    expect(feed.getState().rowCount).toBe(2);
  });

  it('REST: a failed refresh surfaces as an error state without touching the grid', async () => {
    const { grid, adds, updates, removes } = makeGrid();
    const source: BlotterSource = {
      ...base,
      transport: 'rest',
      mode: 'snapshot-update',
      keyField: 'symbol',
      connection: { transport: 'rest', url: 'http://x/tables' },
    };
    const feed = new BlotterFeed(source, grid, jest.fn());
    await feed.start(); // empty snapshot
    lastRestClient().fetchRows.mockRejectedValueOnce(new Error('http://x/tables responded 500 Server Error'));

    await feed.refresh();
    expect(feed.getState().status).toBe('error');
    expect(feed.getState().error).toMatch(/500/);
    expect(adds).toEqual([]);
    expect(updates).toEqual([]);
    expect(removes).toEqual([]);
  });

  it('REST: a late initial snapshot after stop() does not seed the grid or revive the feed', async () => {
    const { grid, setInitial } = makeGrid();
    const source: BlotterSource = {
      ...base,
      transport: 'rest',
      mode: 'snapshot-update',
      keyField: 'symbol',
      connection: { transport: 'rest', url: 'http://x/tables' },
    };
    let release!: (rows: unknown[]) => void;
    restRowsQueue.push(new Promise<unknown[]>((r) => (release = r)) as unknown as unknown[]);
    const feed = new BlotterFeed(source, grid, jest.fn());
    const starting = feed.start();
    await macro();
    expect(feed.getState().status).toBe('snapshot-loading');

    await feed.stop(); // user disconnects while the fetch is in flight
    release([{ symbol: 'UST 2Y' }]); // ...then the slow endpoint finally answers
    await starting;

    expect(setInitial).not.toHaveBeenCalled();
    expect(feed.getState().status).toBe('stopped');
  });

  it('REST: refresh() during the initial snapshot load is a no-op (no racing double-insert)', async () => {
    const { grid } = makeGrid();
    const source: BlotterSource = {
      ...base,
      transport: 'rest',
      mode: 'snapshot-update',
      keyField: 'symbol',
      connection: { transport: 'rest', url: 'http://x/tables' },
    };
    let release!: (rows: unknown[]) => void;
    restRowsQueue.push(new Promise<unknown[]>((r) => (release = r)) as unknown as unknown[]);
    const feed = new BlotterFeed(source, grid, jest.fn());
    const starting = feed.start();
    await macro();

    await feed.refresh(); // status is 'snapshot-loading' — must not fire a second fetch
    expect(lastRestClient().fetchRows).toHaveBeenCalledTimes(1);

    release([{ symbol: 'UST 2Y' }]);
    await starting;
    expect(feed.getState().status).toBe('live');
  });

  it('REST refresh: duplicate keys within one snapshot dedupe last-wins', async () => {
    const { grid, adds, updates } = makeGrid();
    const source: BlotterSource = {
      ...base,
      transport: 'rest',
      mode: 'snapshot-update',
      keyField: 'symbol',
      connection: { transport: 'rest', url: 'http://x/tables' },
    };
    restRowsQueue.push(
      [],
      [
        { symbol: 'UST 2Y', px: 1 },
        { symbol: 'UST 2Y', px: 2 }, // same key — last wins, single add
      ],
    );
    const feed = new BlotterFeed(source, grid, jest.fn());
    await feed.start();

    await feed.refresh();
    expect(adds).toEqual([{ symbol: 'UST 2Y', px: 2 }]);
    expect(updates).toEqual([]);
    expect(feed.getState().rowCount).toBe(1);
  });

  it('REST: refresh() is a no-op for streaming transports', async () => {
    const { grid, adds } = makeGrid();
    const source: BlotterSource = {
      ...base,
      transport: 'nats',
      mode: 'append',
      connection: { transport: 'nats', servers: 'ws://x' },
    };
    const feed = new BlotterFeed(source, grid, jest.fn());
    await feed.start();
    await feed.refresh(); // must not throw or touch anything
    expect(adds).toEqual([]);
    expect(feed.getState().status).toBe('live');
  });

  it('notifies subscribers and stop() unsubscribes + disconnects', async () => {
    const { grid } = makeGrid();
    const source: BlotterSource = {
      ...base,
      transport: 'nats',
      mode: 'append',
      connection: { transport: 'nats', servers: 'ws://x' },
    };
    const feed = new BlotterFeed(source, grid, jest.fn());
    const changes = jest.fn();
    const off = feed.subscribe(changes);
    await feed.start();
    expect(changes).toHaveBeenCalled();
    const t = lastTransport();
    await feed.stop();

    expect(t.unsubscribe).toHaveBeenCalledWith('sub-live');
    expect(t.disconnect).toHaveBeenCalled();
    expect(feed.getState().status).toBe('stopped');
    off();
  });
});
