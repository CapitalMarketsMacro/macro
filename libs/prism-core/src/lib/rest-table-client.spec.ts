import { RestSnapshotClient, discoverRestTables, type FetchLike } from './rest-table-client';

type Call = { url: string };

function fakeFetch(routes: Record<string, { payload?: unknown; ok?: boolean; status?: number; badJson?: boolean }>) {
  const calls: Call[] = [];
  const fetchFn: FetchLike = async (url) => {
    calls.push({ url });
    const route = routes[url];
    if (!route) throw new Error(`no route for ${url}`);
    return {
      ok: route.ok !== false,
      status: route.status ?? (route.ok !== false ? 200 : 500),
      statusText: route.ok !== false ? 'OK' : 'Server Error',
      json: async () => {
        if (route.badJson) throw new SyntaxError('bad json');
        return route.payload;
      },
    };
  };
  return { fetchFn, calls };
}

const TABLES = [
  { name: 'ust_trades', title: 'US Treasury Trades', keyField: 'tradeId', mode: 'append' },
  { name: 'ust_market_data', title: 'UST Market Data', keyField: 'symbol', mode: 'snapshot-update' },
];

describe('RestSnapshotClient', () => {
  it('listTables accepts a { tables: [...] } envelope', async () => {
    const { fetchFn } = fakeFetch({ 'http://x/tables': { payload: { tables: TABLES } } });
    await expect(new RestSnapshotClient(fetchFn).listTables('http://x/tables')).resolves.toEqual(TABLES);
  });

  it('listTables accepts a bare array and drops malformed entries', async () => {
    const { fetchFn } = fakeFetch({
      'http://x/tables': { payload: [TABLES[0], null, 42, { title: 'no name' }, TABLES[1]] },
    });
    await expect(new RestSnapshotClient(fetchFn).listTables('http://x/tables')).resolves.toEqual(TABLES);
  });

  it('listTables rejects a payload that is not a table catalog', async () => {
    const { fetchFn } = fakeFetch({ 'http://x/tables': { payload: { hello: 'world' } } });
    await expect(new RestSnapshotClient(fetchFn).listTables('http://x/tables')).rejects.toThrow(/table catalog/);
  });

  it('fetchRows appends the encoded table name, tolerating trailing slashes', async () => {
    const rows = [{ symbol: 'UST 2Y' }];
    const { fetchFn, calls } = fakeFetch({ 'http://x/tables/ust%20md': { payload: rows } });
    await expect(new RestSnapshotClient(fetchFn).fetchRows('http://x/tables/', 'ust md')).resolves.toEqual(rows);
    expect(calls.map((c) => c.url)).toEqual(['http://x/tables/ust%20md']);
  });

  it('fetchRows keeps a query string at the end when appending the table', async () => {
    const rows = [{ a: 1 }];
    const { fetchFn, calls } = fakeFetch({ 'http://x/api/t1?key=abc': { payload: rows } });
    await expect(new RestSnapshotClient(fetchFn).fetchRows('http://x/api?key=abc', 't1')).resolves.toEqual(rows);
    expect(calls.map((c) => c.url)).toEqual(['http://x/api/t1?key=abc']);
  });

  it('fetchRows with an empty table treats the url itself as the rows endpoint', async () => {
    const rows = [{ a: 1 }, { a: 2 }];
    const { fetchFn, calls } = fakeFetch({ 'http://x/my-rows': { payload: rows } });
    await expect(new RestSnapshotClient(fetchFn).fetchRows('http://x/my-rows', '')).resolves.toEqual(rows);
    expect(calls.map((c) => c.url)).toEqual(['http://x/my-rows']);
  });

  it('fetchRows accepts { rows } and { data } envelopes and wraps a single object', async () => {
    const client = (payload: unknown) =>
      new RestSnapshotClient(fakeFetch({ 'http://x/t': { payload } }).fetchFn).fetchRows('http://x/t', '');
    await expect(client({ rows: [{ a: 1 }] })).resolves.toEqual([{ a: 1 }]);
    await expect(client({ data: [{ b: 2 }] })).resolves.toEqual([{ b: 2 }]);
    await expect(client({ c: 3 })).resolves.toEqual([{ c: 3 }]);
  });

  it('fetchRows surfaces HTTP errors with the status', async () => {
    const { fetchFn } = fakeFetch({ 'http://x/t': { ok: false, status: 404 } });
    await expect(new RestSnapshotClient(fetchFn).fetchRows('http://x/t', '')).rejects.toThrow(/404/);
  });

  it('surfaces invalid JSON as a friendly error', async () => {
    const { fetchFn } = fakeFetch({ 'http://x/t': { badJson: true } });
    await expect(new RestSnapshotClient(fetchFn).fetchRows('http://x/t', '')).rejects.toThrow(/valid JSON/);
  });

  it('times out a hung BODY read, not just hung headers', async () => {
    // Headers arrive instantly, but json() only settles when the abort signal fires.
    const fetchFn: FetchLike = async (_url, init) => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    });
    await expect(new RestSnapshotClient(fetchFn).fetchRows('http://x/slow-body', '', 50)).rejects.toThrow(
      /timed out.*body/i,
    );
  });

  it('discoverRestTables reads the catalog via the global fetch', async () => {
    const { fetchFn } = fakeFetch({ 'http://x/tables': { payload: { tables: TABLES } } });
    const realFetch = globalThis.fetch;
    (globalThis as { fetch: unknown }).fetch = fetchFn;
    try {
      await expect(discoverRestTables('http://x/tables')).resolves.toEqual(TABLES);
    } finally {
      (globalThis as { fetch: unknown }).fetch = realFetch;
    }
  });
});
