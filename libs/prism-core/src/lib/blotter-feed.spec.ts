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
