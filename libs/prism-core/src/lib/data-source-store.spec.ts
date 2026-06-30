import { DataSourceStore } from './data-source-store';
import type { BlotterSource } from './blotter-source';

const seedSource = (over: Partial<BlotterSource> = {}): BlotterSource => ({
  id: 'a',
  name: 'A',
  category: 'FX',
  transport: 'nats',
  mode: 'append',
  connection: { transport: 'nats', servers: 'ws://x' },
  topic: 't',
  columnMode: 'infer',
  ...over,
});

describe('DataSourceStore', () => {
  beforeEach(() => localStorage.clear());

  it('loads the seed catalog via the injected fetcher and stamps origin=catalog', async () => {
    const store = new DataSourceStore();
    await store.loadCatalog(async () => [seedSource()]);
    expect(store.getAll()).toHaveLength(1);
    expect(store.getAll()[0].origin).toBe('catalog');
  });

  it('passes the url to the fetcher (default /data-sources.json, overridable)', async () => {
    const store = new DataSourceStore();
    const fetchJson = jest.fn().mockResolvedValue([]);
    await store.loadCatalog(fetchJson);
    expect(fetchJson).toHaveBeenCalledWith('/data-sources.json');
    await store.loadCatalog(fetchJson, '/prism-react/data-sources.json');
    expect(fetchJson).toHaveBeenCalledWith('/prism-react/data-sources.json');
  });

  it('degrades to an empty catalog when the fetch rejects', async () => {
    const store = new DataSourceStore();
    await store.loadCatalog(async () => {
      throw new Error('network');
    });
    expect(store.getAll()).toHaveLength(0);
  });

  it('adds, updates and removes ad-hoc sources, persists, and notifies subscribers', () => {
    const store = new DataSourceStore();
    const changes = jest.fn();
    const off = store.subscribe(changes);

    const created = store.addAdhoc(seedSource({ name: 'My FX', mode: 'streaming', keyField: 'symbol' }));
    expect(created.id).toContain('adhoc-');
    expect(created.origin).toBe('adhoc');
    expect(store.getAdhoc()).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('prism.adhoc-sources.v1') as string)).toHaveLength(1);
    expect(changes).toHaveBeenCalled();

    store.updateAdhoc({ ...created, name: 'Renamed' });
    expect(store.get(created.id)?.name).toBe('Renamed');

    store.removeAdhoc(created.id);
    expect(store.getAdhoc()).toHaveLength(0);
    off();
  });

  it('getAll returns a stable reference between changes (useSyncExternalStore identity)', () => {
    const store = new DataSourceStore();
    const a = store.getAll();
    expect(store.getAll()).toBe(a);
    store.addAdhoc(seedSource());
    expect(store.getAll()).not.toBe(a);
  });

  it('filters by transport / mode and groups by category', () => {
    const store = new DataSourceStore();
    store.addAdhoc(seedSource({ name: 'A', category: 'FX', transport: 'nats', mode: 'streaming', keyField: 's' }));
    store.addAdhoc(
      seedSource({ name: 'B', category: 'Rates', transport: 'amps', mode: 'append', connection: { transport: 'amps', url: 'ws://u/amps/json' } }),
    );
    expect(store.byTransport('nats')).toHaveLength(1);
    expect(store.byMode('append')).toHaveLength(1);
    expect(store.groupedByCategory().map((g) => g.category)).toEqual(expect.arrayContaining(['FX', 'Rates']));
  });
});
