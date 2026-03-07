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
      saveWorkspaces: jest.fn().mockResolvedValue(undefined),
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

    service = new WorkspaceOverrideService(storageService);
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
        const workspaces = [
          makeWorkspace('ws-1', 'WS1'),
          makeWorkspace('ws-2', 'WS2'),
        ];
        storageService.getWorkspaces.mockResolvedValue(workspaces);

        const result = await provider.getSavedWorkspace('ws-2');
        expect(result).toEqual(workspaces[1]);
      });

      it('should return undefined when workspace not found', async () => {
        storageService.getWorkspaces.mockResolvedValue([]);

        const result = await provider.getSavedWorkspace('nonexistent');
        expect(result).toBeUndefined();
      });
    });

    // ── createSavedWorkspace ────────────────────────────────

    describe('createSavedWorkspace', () => {
      it('should add new workspace to storage', async () => {
        storageService.getWorkspaces.mockResolvedValue([]);

        const ws = makeWorkspace('ws-1', 'New WS');
        await provider.createSavedWorkspace({ workspace: ws });

        expect(storageService.saveWorkspaces).toHaveBeenCalledWith([ws]);
        expect(storageService.setLastSavedWorkspaceId).toHaveBeenCalledWith(
          'ws-1',
        );
      });

      it('should update existing workspace if id matches', async () => {
        const existing = makeWorkspace('ws-1', 'Old Title');
        storageService.getWorkspaces.mockResolvedValue([existing]);

        const updated = makeWorkspace('ws-1', 'New Title');
        await provider.createSavedWorkspace({ workspace: updated });

        expect(storageService.saveWorkspaces).toHaveBeenCalledWith([updated]);
      });

      it('should set last saved workspace id', async () => {
        storageService.getWorkspaces.mockResolvedValue([]);

        await provider.createSavedWorkspace({
          workspace: makeWorkspace('ws-99', 'WS'),
        });

        expect(storageService.setLastSavedWorkspaceId).toHaveBeenCalledWith(
          'ws-99',
        );
      });

      it('should broadcast flush event and re-capture snapshot before saving', async () => {
        storageService.getWorkspaces.mockResolvedValue([]);
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
      it('should update existing workspace in storage', async () => {
        const existing = makeWorkspace('ws-1', 'Old Title');
        storageService.getWorkspaces.mockResolvedValue([existing]);

        const updated = makeWorkspace('ws-1', 'Updated');
        await provider.updateSavedWorkspace({
          workspaceId: 'ws-1',
          workspace: updated,
        });

        expect(storageService.saveWorkspaces).toHaveBeenCalledWith([updated]);
        expect(storageService.setLastSavedWorkspaceId).toHaveBeenCalledWith(
          'ws-1',
        );
      });

      it('should create workspace if not found during update', async () => {
        storageService.getWorkspaces.mockResolvedValue([]);

        const ws = makeWorkspace('ws-new', 'New');
        await provider.updateSavedWorkspace({
          workspaceId: 'ws-new',
          workspace: ws,
        });

        expect(storageService.saveWorkspaces).toHaveBeenCalledWith([ws]);
      });

      it('should broadcast flush event and re-capture snapshot before saving', async () => {
        const existing = makeWorkspace('ws-1', 'WS');
        storageService.getWorkspaces.mockResolvedValue([existing]);
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
        const workspaces = [
          makeWorkspace('ws-1', 'WS1'),
          makeWorkspace('ws-2', 'WS2'),
        ];
        storageService.getWorkspaces.mockResolvedValue(workspaces);

        await provider.deleteSavedWorkspace('ws-1');

        expect(storageService.saveWorkspaces).toHaveBeenCalledWith([
          workspaces[1],
        ]);
      });

      it('should remove last saved id if deleted workspace was last saved', async () => {
        const workspaces = [makeWorkspace('ws-1', 'WS1')];
        storageService.getWorkspaces.mockResolvedValue(workspaces);
        storageService.getLastSavedWorkspaceId.mockResolvedValue('ws-1');

        await provider.deleteSavedWorkspace('ws-1');

        expect(storageService.removeLastSavedWorkspaceId).toHaveBeenCalled();
      });

      it('should not remove last saved id if deleted workspace was not last saved', async () => {
        const workspaces = [makeWorkspace('ws-1', 'WS1')];
        storageService.getWorkspaces.mockResolvedValue(workspaces);
        storageService.getLastSavedWorkspaceId.mockResolvedValue('ws-other');

        await provider.deleteSavedWorkspace('ws-1');

        expect(
          storageService.removeLastSavedWorkspaceId,
        ).not.toHaveBeenCalled();
      });

      it('should be a no-op (no save) when workspace not found', async () => {
        storageService.getWorkspaces.mockResolvedValue([]);

        await provider.deleteSavedWorkspace('nonexistent');

        expect(storageService.saveWorkspaces).not.toHaveBeenCalled();
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
