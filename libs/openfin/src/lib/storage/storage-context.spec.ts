import {
  ClientFavoritesStore,
  getActiveStorageEnvironment,
  getWorkspaceStorage,
  initWorkspaceStorage,
  onWorkspaceStorageInitialized,
  resetWorkspaceStorageForTests,
  resolveConfigUrl,
  whenWorkspaceStorageReady,
} from './storage-context';
import { LocalStorageWorkspaceStorageClient } from './local-storage-client';
import { RestWorkspaceStorageClient } from './rest-storage-client';
import type { StorageSettings } from './storage-types';

jest.mock('@macro/logger', () => ({
  Logger: {
    getLogger: () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }),
  },
}));

const REST_SETTINGS: StorageSettings = {
  defaultEnvironment: 'dev',
  environments: {
    dev: { mode: 'rest', baseUrl: 'http://localhost:3000/workspace/v1' },
  },
};

describe('storage context', () => {
  beforeEach(() => {
    // Tests run in a node environment — provide the browser localStorage (repo convention).
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
    };
    resetWorkspaceStorageForTests();
  });

  it('defaults to the local client and environment before initialization', () => {
    expect(getActiveStorageEnvironment().name).toBe('local');
    expect(getWorkspaceStorage()).toBeInstanceOf(
      LocalStorageWorkspaceStorageClient,
    );
  });

  it('builds a REST client for a rest environment', () => {
    const env = initWorkspaceStorage(REST_SETTINGS, { search: '' });
    expect(env.name).toBe('dev');
    expect(getWorkspaceStorage()).toBeInstanceOf(RestWorkspaceStorageClient);
    expect(getActiveStorageEnvironment().config.baseUrl).toBe(
      'http://localhost:3000/workspace/v1',
    );
  });

  it('builds a local client when the resolved environment is localStorage mode', () => {
    initWorkspaceStorage(REST_SETTINGS, { search: '?storageEnv=local' });
    expect(getActiveStorageEnvironment().name).toBe('local');
    expect(getWorkspaceStorage()).toBeInstanceOf(
      LocalStorageWorkspaceStorageClient,
    );
  });

  describe('resolveConfigUrl', () => {
    it('serves config from the storage service in REST mode (stripping .json)', () => {
      initWorkspaceStorage(REST_SETTINGS, { search: '' });
      expect(resolveConfigUrl('apps.json')).toBe(
        'http://localhost:3000/workspace/v1/config/apps',
      );
      expect(resolveConfigUrl('dock-config.json')).toBe(
        'http://localhost:3000/workspace/v1/config/dock-config',
      );
    });

    it('falls back to the static per-env path in local mode', () => {
      initWorkspaceStorage(undefined, { search: '' });
      expect(resolveConfigUrl('apps.json')).toBe('/local/apps.json');
    });

    it('falls back to the static path before initialization', () => {
      expect(resolveConfigUrl('storefront-config.json')).toBe(
        '/local/storefront-config.json',
      );
    });
  });

  describe('whenWorkspaceStorageReady', () => {
    it('resolves immediately once initialized', async () => {
      initWorkspaceStorage(undefined, { search: '' });
      await expect(whenWorkspaceStorageReady(50)).resolves.toBeUndefined();
    });

    it('blocks until initialization happens', async () => {
      const ready = whenWorkspaceStorageReady(10_000);
      let resolved = false;
      void ready.then(() => (resolved = true));
      await Promise.resolve();
      expect(resolved).toBe(false);

      initWorkspaceStorage(undefined, { search: '' });
      await ready;
    });

    it('fails open after the timeout when nothing initializes storage', async () => {
      await expect(whenWorkspaceStorageReady(20)).resolves.toBeUndefined();
    });
  });

  describe('ClientFavoritesStore', () => {
    it('delegates to the active client after a successful load (key argument is ignored)', async () => {
      initWorkspaceStorage(undefined, {
        search: '',
        getUserId: async () => 'u-42',
      });
      const store = new ClientFavoritesStore();

      await expect(store.load('ignored-key')).resolves.toEqual([]);
      await store.save('ignored-key', ['app-1', 'app-2']);
      expect(localStorage.getItem('workspace-store-favorites:u-42')).toBe(
        JSON.stringify(['app-1', 'app-2']),
      );
      await expect(store.load('ignored-key')).resolves.toEqual([
        'app-1',
        'app-2',
      ]);
    });

    it('skips persisting until a load has succeeded — a never-hydrated cache must not wipe stored favorites', async () => {
      initWorkspaceStorage(undefined, {
        search: '',
        getUserId: async () => 'u-42',
      });
      localStorage.setItem(
        'workspace-store-favorites:u-42',
        JSON.stringify(['precious']),
      );
      const store = new ClientFavoritesStore();

      await store.save('ignored-key', []);
      expect(localStorage.getItem('workspace-store-favorites:u-42')).toBe(
        JSON.stringify(['precious']),
      );

      await store.load('ignored-key');
      await store.save('ignored-key', ['replacement']);
      expect(localStorage.getItem('workspace-store-favorites:u-42')).toBe(
        JSON.stringify(['replacement']),
      );
    });
  });

  describe('onWorkspaceStorageInitialized', () => {
    it('fires on init and immediately when already initialized', () => {
      const calls: string[] = [];
      onWorkspaceStorageInitialized(() => calls.push('early'));
      expect(calls).toEqual([]);

      initWorkspaceStorage(undefined, { search: '' });
      expect(calls).toEqual(['early']);

      onWorkspaceStorageInitialized(() => calls.push('late'));
      expect(calls).toEqual(['early', 'late']);
    });
  });
});
