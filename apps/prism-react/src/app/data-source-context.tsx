import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { DataSourceStore, type BlotterSource } from '@macro/prism-core';

const StoreContext = createContext<DataSourceStore | null>(null);

/** Provides one shared DataSourceStore (catalog + ad-hoc) and loads the seed catalog on mount. */
export function DataSourceProvider({ children }: { children: ReactNode }) {
  const store = useMemo(() => new DataSourceStore(), []);
  useEffect(() => {
    // base is '/prism-react/', so the public asset is served at BASE_URL + 'data-sources.json'.
    void store.loadCatalog((url) => fetch(url).then((r) => r.json()), `${import.meta.env.BASE_URL}data-sources.json`);
  }, [store]);
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useDataSourceStore(): DataSourceStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useDataSourceStore must be used within a DataSourceProvider');
  return store;
}

/** Reactive list of all sources (catalog + ad-hoc), via useSyncExternalStore. */
export function useAllSources(): BlotterSource[] {
  const store = useDataSourceStore();
  return useSyncExternalStore(store.subscribe, store.getAll);
}
