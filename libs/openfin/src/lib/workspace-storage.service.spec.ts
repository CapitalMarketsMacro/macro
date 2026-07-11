import { WorkspaceStorageService } from './workspace-storage.service';
import { initWorkspaceStorage, resetWorkspaceStorageForTests } from './storage/storage-context';
import type { Page, Workspace } from '@openfin/workspace-platform';
import type { DockProviderConfigWithIdentity } from '@openfin/workspace';

// Mock @macro/logger
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

const STORAGE_KEY = 'workspace-platform-workspaces';
const PAGES_KEY = 'workspace-platform-pages';
const LAST_SAVED_KEY = 'workspace-platform-last-saved';

const makeWorkspace = (id: string, title: string): Workspace =>
  ({ workspaceId: id, title } as Workspace);

const makePage = (id: string, title: string): Page => ({ pageId: id, title } as Page);

describe('WorkspaceStorageService (facade over the unified storage client)', () => {
  let service: WorkspaceStorageService;
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};

    // Mock localStorage since tests run in node environment
    (globalThis as any).localStorage = {
      getItem: jest.fn((key: string) => store[key] ?? null),
      setItem: jest.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: jest.fn((key: string) => {
        delete store[key];
      }),
    };

    // Uninitialized context falls back to the local localStorage client.
    resetWorkspaceStorageForTests();
    service = new WorkspaceStorageService();
  });

  // ── workspaces ─────────────────────────────────────────────

  describe('getWorkspaces', () => {
    it('should return empty array when nothing is stored', async () => {
      const result = await service.getWorkspaces();
      expect(result).toEqual([]);
      expect(localStorage.getItem).toHaveBeenCalledWith(STORAGE_KEY);
    });

    it('should return parsed workspaces from storage (legacy key intact)', async () => {
      const workspaces = [makeWorkspace('1', 'WS1'), makeWorkspace('2', 'WS2')];
      store[STORAGE_KEY] = JSON.stringify(workspaces);

      const result = await service.getWorkspaces();
      expect(result).toEqual(workspaces);
    });

    it('should return empty array and log error on invalid JSON', async () => {
      store[STORAGE_KEY] = 'not-json';
      const result = await service.getWorkspaces();
      expect(result).toEqual([]);
    });
  });

  describe('getWorkspace', () => {
    it('should find a workspace by id, undefined otherwise', async () => {
      store[STORAGE_KEY] = JSON.stringify([makeWorkspace('a', 'Alpha')]);
      expect(await service.getWorkspace('a')).toEqual(makeWorkspace('a', 'Alpha'));
      expect(await service.getWorkspace('missing')).toBeUndefined();
    });
  });

  describe('saveWorkspace', () => {
    it('should insert a new workspace', async () => {
      await service.saveWorkspace(makeWorkspace('1', 'WS1'));
      expect(await service.getWorkspaces()).toEqual([makeWorkspace('1', 'WS1')]);
    });

    it('should upsert (replace) an existing workspace by id', async () => {
      await service.saveWorkspace(makeWorkspace('1', 'Old'));
      await service.saveWorkspace(makeWorkspace('2', 'Other'));
      await service.saveWorkspace(makeWorkspace('1', 'New'));

      expect(await service.getWorkspaces()).toEqual([makeWorkspace('1', 'New'), makeWorkspace('2', 'Other')]);
    });

    it('should throw when the underlying write fails (saves must never silently succeed)', async () => {
      (localStorage.setItem as jest.Mock).mockImplementation(() => {
        throw new Error('quota exceeded');
      });
      await expect(service.saveWorkspace(makeWorkspace('1', 'WS1'))).rejects.toThrow('quota exceeded');
    });
  });

  describe('deleteWorkspace', () => {
    it('should remove the workspace and keep the rest', async () => {
      await service.saveWorkspace(makeWorkspace('1', 'WS1'));
      await service.saveWorkspace(makeWorkspace('2', 'WS2'));

      await service.deleteWorkspace('1');
      expect(await service.getWorkspaces()).toEqual([makeWorkspace('2', 'WS2')]);
    });

    it('should resolve when the id does not exist', async () => {
      await expect(service.deleteWorkspace('nope')).resolves.toBeUndefined();
    });
  });

  // ── pages ──────────────────────────────────────────────────

  describe('pages', () => {
    it('should round-trip save/get/delete', async () => {
      await service.savePage(makePage('p1', 'Page 1'));
      await service.savePage(makePage('p2', 'Page 2'));
      expect(await service.getPages()).toEqual([makePage('p1', 'Page 1'), makePage('p2', 'Page 2')]);
      expect(await service.getPage('p2')).toEqual(makePage('p2', 'Page 2'));

      await service.savePage(makePage('p1', 'Renamed'));
      expect(await service.getPage('p1')).toEqual(makePage('p1', 'Renamed'));

      await service.deletePage('p1');
      expect(await service.getPages()).toEqual([makePage('p2', 'Page 2')]);
      expect(store[PAGES_KEY]).toBe(JSON.stringify([makePage('p2', 'Page 2')]));
    });
  });

  // ── dock ───────────────────────────────────────────────────

  describe('dock config', () => {
    it('should round-trip per dock provider id', async () => {
      const config = { id: 'macro-dock', buttons: [{ tooltip: 'X' }] } as unknown as DockProviderConfigWithIdentity;
      expect(await service.getDockConfig('macro-dock')).toBeUndefined();
      await service.saveDockConfig(config);
      expect(await service.getDockConfig('macro-dock')).toEqual(config);
    });
  });

  // ── last-saved workspace pointer ───────────────────────────

  describe('getLastSavedWorkspaceId', () => {
    it('should return null when no id is stored', async () => {
      const result = await service.getLastSavedWorkspaceId();
      expect(result).toBeNull();
      expect(localStorage.getItem).toHaveBeenCalledWith(LAST_SAVED_KEY);
    });

    it('should read a legacy bare-string id (pre-API format)', async () => {
      store[LAST_SAVED_KEY] = 'ws-42';
      expect(await service.getLastSavedWorkspaceId()).toBe('ws-42');
    });
  });

  describe('setLastSavedWorkspaceId', () => {
    it('should store the workspace id on the legacy key', async () => {
      await service.setLastSavedWorkspaceId('ws-99');
      expect(store[LAST_SAVED_KEY]).toBe(JSON.stringify('ws-99'));
      expect(await service.getLastSavedWorkspaceId()).toBe('ws-99');
    });
  });

  describe('removeLastSavedWorkspaceId', () => {
    it('should remove the stored id', async () => {
      store[LAST_SAVED_KEY] = 'ws-99';
      await service.removeLastSavedWorkspaceId();
      expect(localStorage.removeItem).toHaveBeenCalledWith(LAST_SAVED_KEY);
      expect(store[LAST_SAVED_KEY]).toBeUndefined();
    });
  });

  // ── preferences ────────────────────────────────────────────

  describe('preferences', () => {
    it('should round-trip arbitrary JSON values', async () => {
      await service.setPreference('pages-migrated', true);
      expect(await service.getPreference('pages-migrated')).toBe(true);
      expect(await service.getPreference('unknown')).toBeUndefined();
    });
  });

  // ── round-trip ─────────────────────────────────────────────

  describe('round-trip', () => {
    it('should persist and retrieve last saved id end-to-end', async () => {
      await service.setLastSavedWorkspaceId('a');
      expect(await service.getLastSavedWorkspaceId()).toBe('a');

      await service.removeLastSavedWorkspaceId();
      expect(await service.getLastSavedWorkspaceId()).toBeNull();
    });
  });

  // ── error posture against a failing REST backend ──────────

  describe('error posture (REST backend down)', () => {
    const origFetch = globalThis.fetch;

    beforeEach(() => {
      // Stub fetch BEFORE the context builds its REST client (which binds fetch).
      (globalThis as { fetch: unknown }).fetch = jest.fn().mockRejectedValue(new Error('storage down'));
      initWorkspaceStorage(
        { defaultEnvironment: 'dev', environments: { dev: { mode: 'rest', baseUrl: 'http://storage.test/workspace/v1' } } },
        { search: '' },
      );
    });

    afterEach(() => {
      (globalThis as { fetch: unknown }).fetch = origFetch;
      resetWorkspaceStorageForTests();
    });

    it('reads degrade to empty results so boot never bricks', async () => {
      await expect(service.getWorkspaces()).resolves.toEqual([]);
      await expect(service.getWorkspace('w')).resolves.toBeUndefined();
      await expect(service.getPages()).resolves.toEqual([]);
      await expect(service.getPage('p')).resolves.toBeUndefined();
      await expect(service.getDockConfig('d')).resolves.toBeUndefined();
      await expect(service.getPreference('k')).resolves.toBeUndefined();
      await expect(service.getLastSavedWorkspaceId()).resolves.toBeNull();
    });

    it('writes reject so a failed save is never reported as success', async () => {
      await expect(service.saveWorkspace(makeWorkspace('w', 'W'))).rejects.toThrow();
      await expect(service.savePage(makePage('p', 'P'))).rejects.toThrow();
      await expect(service.saveDockConfig({ id: 'd' } as never)).rejects.toThrow();
      await expect(service.setPreference('k', 1)).rejects.toThrow();
    });

    it('last-saved pointer writes degrade (non-critical metadata)', async () => {
      await expect(service.setLastSavedWorkspaceId('w')).resolves.toBeUndefined();
      await expect(service.removeLastSavedWorkspaceId()).resolves.toBeUndefined();
    });
  });
});
