import { WorkspaceOverrideService } from './workspace-override.service';
import { WorkspaceStorageService } from './workspace-storage.service';
import type { Workspace } from '@openfin/workspace-platform';

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

// Mock @openfin/workspace-platform
jest.mock('@openfin/workspace-platform', () => ({
  ColorSchemeOptionType: {
    Dark: 'dark',
    Light: 'light',
  },
}));

const makeWorkspace = (id: string, title: string): Workspace =>
  ({ workspaceId: id, title } as Workspace);

describe('WorkspaceOverrideService', () => {
  let service: WorkspaceOverrideService;
  let storageService: jest.Mocked<WorkspaceStorageService>;
  let mockPublish: jest.Mock;
  let mockGetSnapshot: jest.Mock;

  beforeEach(() => {
    storageService = {
      getWorkspaces: jest.fn().mockResolvedValue([]),
      getWorkspace: jest.fn().mockResolvedValue(undefined),
      saveWorkspace: jest.fn().mockResolvedValue(undefined),
      deleteWorkspace: jest.fn().mockResolvedValue(undefined),
      getPages: jest.fn().mockResolvedValue([]),
      getPage: jest.fn().mockResolvedValue(undefined),
      savePage: jest.fn().mockResolvedValue(undefined),
      deletePage: jest.fn().mockResolvedValue(undefined),
      getDockConfig: jest.fn().mockResolvedValue(undefined),
      saveDockConfig: jest.fn().mockResolvedValue(undefined),
      getPreference: jest.fn().mockResolvedValue(undefined),
      setPreference: jest.fn().mockResolvedValue(undefined),
      getLastSavedWorkspaceId: jest.fn().mockResolvedValue(null),
      setLastSavedWorkspaceId: jest.fn().mockResolvedValue(undefined),
      removeLastSavedWorkspaceId: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<WorkspaceStorageService>;

    mockPublish = jest.fn().mockResolvedValue(undefined);
    mockGetSnapshot = jest.fn().mockResolvedValue({ windows: [] });

    (globalThis as any).fin = {
      InterApplicationBus: { publish: mockPublish },
      Platform: {
        getCurrentSync: () => ({ getSnapshot: mockGetSnapshot }),
      },
    };

    const mockSnapService = {
      init: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      decorateSnapshot: jest.fn().mockImplementation((s: any) => Promise.resolve(s)),
      prepareToApplySnapshot: jest.fn().mockResolvedValue(undefined),
      applySnapshot: jest.fn().mockResolvedValue(undefined),
      isRunning: false,
    } as any;

    service = new WorkspaceOverrideService(storageService, mockSnapService);
  });

  afterEach(() => {
    delete (globalThis as any).fin;
  });

  // ── createOverrideCallback ──────────────────────────────────

  describe('createOverrideCallback', () => {
    it('should return a function', () => {
      const callback = service.createOverrideCallback();
      expect(typeof callback).toBe('function');
    });

    it('should return a provider instance when called with a base class', async () => {
      const callback = service.createOverrideCallback();

      // Create a mock base class
      class MockBase {
        async handleAnalytics() { return; }
        async applyWorkspace() { return true; }
        async setSelectedScheme() { return; }
      }

      const provider = await callback(MockBase as any);
      expect(provider).toBeDefined();
    });
  });

  // ── setOnThemeChanged ───────────────────────────────────────

  describe('setOnThemeChanged', () => {
    it('should store the callback', () => {
      const callback = jest.fn();
      service.setOnThemeChanged(callback);

      // Verify indirectly: the callback should be invoked via the override
      expect(() => service.setOnThemeChanged(callback)).not.toThrow();
    });

    it('should invoke the callback when setSelectedScheme is called on the provider', async () => {
      const themeCallback = jest.fn().mockResolvedValue(undefined);
      service.setOnThemeChanged(themeCallback);

      const overrideCallback = service.createOverrideCallback();

      class MockBase {
        async setSelectedScheme() { return; }
      }

      const provider = await overrideCallback(MockBase as any);
      await (provider as any).setSelectedScheme('light');

      expect(themeCallback).toHaveBeenCalledWith('light');
    });

    it('should not invoke callback when setSelectedScheme is called without setting callback', async () => {
      const overrideCallback = service.createOverrideCallback();

      class MockBase {
        async setSelectedScheme() { return; }
      }

      const provider = await overrideCallback(MockBase as any);

      // Should not throw even without a callback
      await expect(
        (provider as any).setSelectedScheme('dark'),
      ).resolves.toBeUndefined();
    });
  });

  // ── Provider CRUD operations ────────────────────────────────

  describe('CustomWorkspacePlatformProvider', () => {
    let provider: any;

    class MockBase {
      async handleAnalytics() { return; }
      async applyWorkspace() { return true; }
      async setSelectedScheme() { return; }
    }

    beforeEach(async () => {
      const callback = service.createOverrideCallback();
      provider = await callback(MockBase as any);
    });

    // ── getSavedWorkspaces ──────────────────────────────────

    describe('getSavedWorkspaces', () => {
      it('should return all workspaces when no query', async () => {
        const workspaces = [makeWorkspace('1', 'WS1'), makeWorkspace('2', 'WS2')];
        storageService.getWorkspaces.mockResolvedValue(workspaces);

        const result = await provider.getSavedWorkspaces();
        expect(result).toEqual(workspaces);
      });

      it('should filter workspaces by title query', async () => {
        const workspaces = [
          makeWorkspace('1', 'Trading Desk'),
          makeWorkspace('2', 'Research'),
        ];
        storageService.getWorkspaces.mockResolvedValue(workspaces);

        const result = await provider.getSavedWorkspaces('trading');
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Trading Desk');
      });

      it('should filter workspaces by workspaceId query', async () => {
        const workspaces = [
          makeWorkspace('trading-desk', 'Desk'),
          makeWorkspace('research', 'Research'),
        ];
        storageService.getWorkspaces.mockResolvedValue(workspaces);

        const result = await provider.getSavedWorkspaces('trading');
        expect(result).toHaveLength(1);
        expect(result[0].workspaceId).toBe('trading-desk');
      });

      it('should return empty array when no match', async () => {
        const workspaces = [makeWorkspace('1', 'WS1')];
        storageService.getWorkspaces.mockResolvedValue(workspaces);

        const result = await provider.getSavedWorkspaces('nonexistent');
        expect(result).toEqual([]);
      });

      it('should be case-insensitive', async () => {
        const workspaces = [makeWorkspace('1', 'Trading Desk')];
        storageService.getWorkspaces.mockResolvedValue(workspaces);

        const result = await provider.getSavedWorkspaces('TRADING');
        expect(result).toHaveLength(1);
      });
    });

    // ── getSavedWorkspacesMetadata ───────────────────────────

    describe('getSavedWorkspacesMetadata', () => {
      it('should return only workspaceId and title', async () => {
        const workspaces = [makeWorkspace('1', 'WS1')];
        storageService.getWorkspaces.mockResolvedValue(workspaces);

        const result = await provider.getSavedWorkspacesMetadata();
        expect(result).toEqual([{ workspaceId: '1', title: 'WS1' }]);
      });

      it('should filter metadata by query', async () => {
        const workspaces = [
          makeWorkspace('1', 'Trading'),
          makeWorkspace('2', 'Research'),
        ];
        storageService.getWorkspaces.mockResolvedValue(workspaces);

        const result = await provider.getSavedWorkspacesMetadata('research');
        expect(result).toEqual([{ workspaceId: '2', title: 'Research' }]);
      });
    });

    // ── getSavedWorkspace ───────────────────────────────────

    describe('getSavedWorkspace', () => {
      it('should return workspace by id', async () => {
        const ws = makeWorkspace('ws-2', 'WS2');
        storageService.getWorkspace.mockResolvedValue(ws);

        const result = await provider.getSavedWorkspace('ws-2');
        expect(result).toEqual(ws);
        expect(storageService.getWorkspace).toHaveBeenCalledWith('ws-2');
      });

      it('should return undefined when workspace not found', async () => {
        storageService.getWorkspace.mockResolvedValue(undefined);

        const result = await provider.getSavedWorkspace('nonexistent');
        expect(result).toBeUndefined();
      });
    });

    // ── createSavedWorkspace ────────────────────────────────

    describe('createSavedWorkspace', () => {
      it('should upsert the workspace into storage', async () => {
        const ws = makeWorkspace('ws-1', 'New WS');
        await provider.createSavedWorkspace({ workspace: ws });

        expect(storageService.saveWorkspace).toHaveBeenCalledWith(ws);
        expect(storageService.setLastSavedWorkspaceId).toHaveBeenCalledWith(
          'ws-1',
        );
      });

      it('should set last saved workspace id', async () => {
        await provider.createSavedWorkspace({
          workspace: makeWorkspace('ws-99', 'WS'),
        });

        expect(storageService.setLastSavedWorkspaceId).toHaveBeenCalledWith(
          'ws-99',
        );
      });

      it('should propagate storage failures (a failed save must not report success)', async () => {
        storageService.saveWorkspace.mockRejectedValue(new Error('storage down'));

        await expect(
          provider.createSavedWorkspace({ workspace: makeWorkspace('ws-1', 'WS') }),
        ).rejects.toThrow('storage down');
        expect(storageService.setLastSavedWorkspaceId).not.toHaveBeenCalled();
      });

      it('should broadcast flush event and re-capture snapshot before saving', async () => {
        const freshSnapshot = { windows: [{ name: 'fresh' }] };
        mockGetSnapshot.mockResolvedValue(freshSnapshot);

        const ws = makeWorkspace('ws-1', 'WS') as any;
        ws.snapshot = { windows: [{ name: 'stale' }] };

        await provider.createSavedWorkspace({ workspace: ws });

        expect(mockPublish).toHaveBeenCalledWith(
          'workspace:flush-view-state',
          {},
        );
        expect(mockGetSnapshot).toHaveBeenCalled();
        expect(ws.snapshot).toEqual(freshSnapshot);
      });
    });

    // ── updateSavedWorkspace ────────────────────────────────

    describe('updateSavedWorkspace', () => {
      it('should upsert the workspace in storage', async () => {
        const updated = makeWorkspace('ws-1', 'Updated');
        await provider.updateSavedWorkspace({
          workspaceId: 'ws-1',
          workspace: updated,
        });

        expect(storageService.saveWorkspace).toHaveBeenCalledWith(updated);
        expect(storageService.setLastSavedWorkspaceId).toHaveBeenCalledWith(
          'ws-1',
        );
      });

      it('should create workspace if not found during update (upsert)', async () => {
        const ws = makeWorkspace('ws-new', 'New');
        await provider.updateSavedWorkspace({
          workspaceId: 'ws-new',
          workspace: ws,
        });

        expect(storageService.saveWorkspace).toHaveBeenCalledWith(ws);
      });

      it('should broadcast flush event and re-capture snapshot before saving', async () => {
        const freshSnapshot = { windows: [{ name: 'fresh' }] };
        mockGetSnapshot.mockResolvedValue(freshSnapshot);

        const updated = makeWorkspace('ws-1', 'Updated') as any;
        updated.snapshot = { windows: [{ name: 'stale' }] };

        await provider.updateSavedWorkspace({
          workspaceId: 'ws-1',
          workspace: updated,
        });

        expect(mockPublish).toHaveBeenCalledWith(
          'workspace:flush-view-state',
          {},
        );
        expect(updated.snapshot).toEqual(freshSnapshot);
      });
    });

    // ── deleteSavedWorkspace ────────────────────────────────

    describe('deleteSavedWorkspace', () => {
      it('should remove workspace from storage', async () => {
        await provider.deleteSavedWorkspace('ws-1');

        expect(storageService.deleteWorkspace).toHaveBeenCalledWith('ws-1');
      });

      it('should remove last saved id if deleted workspace was last saved', async () => {
        storageService.getLastSavedWorkspaceId.mockResolvedValue('ws-1');

        await provider.deleteSavedWorkspace('ws-1');

        expect(storageService.removeLastSavedWorkspaceId).toHaveBeenCalled();
      });

      it('should not remove last saved id if deleted workspace was not last saved', async () => {
        storageService.getLastSavedWorkspaceId.mockResolvedValue('ws-other');

        await provider.deleteSavedWorkspace('ws-1');

        expect(
          storageService.removeLastSavedWorkspaceId,
        ).not.toHaveBeenCalled();
      });
    });

    // ── page storage (new: unified backend + one-time migration) ──

    describe('page storage', () => {
      // The migration flag is read via the RAW storage client (uninitialized context →
      // localStorage), so simulate its state through a mocked localStorage.
      let lsStore: Record<string, string>;
      beforeEach(() => {
        lsStore = {};
        (globalThis as any).localStorage = {
          getItem: (key: string) => lsStore[key] ?? null,
          setItem: (key: string, value: string) => {
            lsStore[key] = value;
          },
          removeItem: (key: string) => {
            delete lsStore[key];
          },
        };
      });
      afterEach(() => {
        delete (globalThis as any).localStorage;
      });

      it('should return pages from unified storage once migration is marked done', async () => {
        const pages = [{ pageId: 'p1', title: 'Page 1' }];
        storageService.getPages.mockResolvedValue(pages as any);

        expect(await provider.getSavedPages()).toEqual(pages);
      });

      it('should filter pages by query on title or pageId (case-insensitive)', async () => {
        storageService.getPages.mockResolvedValue([
          { pageId: 'p1', title: 'Trading Grid' },
          { pageId: 'research-p2', title: 'Other' },
          { pageId: 'p3', title: 'News' },
        ] as any);
        lsStore['macro:pref:pages-migrated'] = 'true';

        expect(await provider.getSavedPages('TRADING')).toEqual([{ pageId: 'p1', title: 'Trading Grid' }]);
        expect(await provider.getSavedPages('research')).toEqual([{ pageId: 'research-p2', title: 'Other' }]);
      });

      it('should migrate legacy pages from the platform default storage exactly once', async () => {
        const legacy = [{ pageId: 'legacy-1', title: 'Legacy' }];
        (MockBase.prototype as any).getSavedPages = jest.fn().mockResolvedValue(legacy);
        storageService.getPages.mockResolvedValue([]);

        const result = await provider.getSavedPages();

        expect(result).toEqual(legacy);
        expect(storageService.savePage).toHaveBeenCalledWith(legacy[0]);
        expect(storageService.setPreference).toHaveBeenCalledWith('pages-migrated', true);

        // Second call with a still-empty backend must NOT re-import (per-boot guard).
        (storageService.savePage as jest.Mock).mockClear();
        await provider.getSavedPages();
        expect(storageService.savePage).not.toHaveBeenCalled();

        delete (MockBase.prototype as any).getSavedPages;
      });

      it('should not migrate when the backend already marked pages-migrated', async () => {
        (MockBase.prototype as any).getSavedPages = jest.fn();
        storageService.getPages.mockResolvedValue([]);
        lsStore['macro:pref:pages-migrated'] = 'true';

        expect(await provider.getSavedPages()).toEqual([]);
        expect((MockBase.prototype as any).getSavedPages).not.toHaveBeenCalled();
        expect(storageService.savePage).not.toHaveBeenCalled();

        delete (MockBase.prototype as any).getSavedPages;
      });

      it('should route page CRUD through unified storage and mark migration done on writes', async () => {
        const page = { pageId: 'p1', title: 'P' };
        await provider.createSavedPage({ page });
        expect(storageService.savePage).toHaveBeenCalledWith(page);
        // An explicit save marks the backend as past migration, so a later empty page
        // list (delete-all) can never resurrect stale legacy pages.
        expect(storageService.setPreference).toHaveBeenCalledWith('pages-migrated', true);

        await provider.updateSavedPage({ pageId: 'p1', page });
        expect(storageService.savePage).toHaveBeenCalledTimes(2);

        await provider.deleteSavedPage('p1');
        expect(storageService.deletePage).toHaveBeenCalledWith('p1');
      });
    });

    // ── dock customization storage (new) ──

    describe('dock storage', () => {
      it('should prefer the unified backend for dock provider config', async () => {
        const config = { id: 'dock-1', buttons: [] };
        storageService.getDockConfig.mockResolvedValue(config as any);

        expect(await provider.getDockProviderConfig('dock-1')).toEqual(config);
      });

      it('should fall back to platform default storage when the backend has none', async () => {
        const legacyConfig = { id: 'dock-1', buttons: [{ tooltip: 'legacy' }] };
        (MockBase.prototype as any).getDockProviderConfig = jest.fn().mockResolvedValue(legacyConfig);
        storageService.getDockConfig.mockResolvedValue(undefined);

        expect(await provider.getDockProviderConfig('dock-1')).toEqual(legacyConfig);

        delete (MockBase.prototype as any).getDockProviderConfig;
      });

      it('should save dock provider config to unified storage', async () => {
        const config = { id: 'dock-1', buttons: [] };
        await provider.saveDockProviderConfig(config);
        expect(storageService.saveDockConfig).toHaveBeenCalledWith(config);
      });
    });

    // ── applyWorkspace ──────────────────────────────────────

    describe('applyWorkspace', () => {
      it('should call super.applyWorkspace and return result', async () => {
        storageService.getLastSavedWorkspaceId.mockResolvedValue(null);

        const result = await provider.applyWorkspace({
          workspaceId: 'ws-1',
          title: 'WS1',
        });

        expect(result).toBe(true);
      });

      it('should log last saved workspace when available', async () => {
        const workspaces = [makeWorkspace('ws-last', 'Last Saved')];
        storageService.getWorkspaces.mockResolvedValue(workspaces);
        storageService.getLastSavedWorkspaceId.mockResolvedValue('ws-last');

        const result = await provider.applyWorkspace({
          workspaceId: 'ws-1',
          title: 'WS1',
        });

        expect(result).toBe(true);
        expect(storageService.getLastSavedWorkspaceId).toHaveBeenCalled();
      });
    });

    // ── handleAnalytics ─────────────────────────────────────

    describe('handleAnalytics', () => {
      it('should call super.handleAnalytics', async () => {
        const events = [{ type: 'test-event' }];
        await expect(
          provider.handleAnalytics(events),
        ).resolves.toBeUndefined();
      });
    });

    // ── setSelectedScheme ───────────────────────────────────

    describe('setSelectedScheme', () => {
      it('should call super.setSelectedScheme', async () => {
        await expect(
          provider.setSelectedScheme('dark'),
        ).resolves.toBeUndefined();
      });

      it('should invoke onThemeChanged callback when set', async () => {
        const callback = jest.fn().mockResolvedValue(undefined);
        service.setOnThemeChanged(callback);

        // Need a new provider to pick up the callback
        const newCallback = service.createOverrideCallback();
        const newProvider = await newCallback(MockBase as any);

        await (newProvider as any).setSelectedScheme('light');
        expect(callback).toHaveBeenCalledWith('light');
      });

      it('should broadcast theme-changed via IAB with isDark true for dark scheme', async () => {
        await provider.setSelectedScheme('dark');

        expect(mockPublish).toHaveBeenCalledWith(
          'workspace:theme-changed',
          { isDark: true },
        );
      });

      it('should broadcast theme-changed via IAB with isDark false for light scheme', async () => {
        await provider.setSelectedScheme('light');

        expect(mockPublish).toHaveBeenCalledWith(
          'workspace:theme-changed',
          { isDark: false },
        );
      });
    });
  });
});
