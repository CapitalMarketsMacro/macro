import { firstValueFrom } from 'rxjs';
import { WorkspaceService } from './workspace.service';
import type { PlatformService } from './platform.service';
import type { DockService } from './dock.service';
import type { Dock3Service } from './dock3.service';
import type { HomeService } from './home.service';
import type { StoreService } from './store.service';
import type { SettingsService } from './settings.service';
import type { WorkspaceStorageService } from './workspace-storage.service';
import type { NotificationsService } from './notifications.service';

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

// Mock @openfin/workspace-platform -- inline jest.fn() in factory
jest.mock('@openfin/workspace-platform', () => ({
  getCurrentSync: jest.fn(),
}));

describe('WorkspaceService', () => {
  let service: WorkspaceService;
  let mockPlatformService: jest.Mocked<PlatformService>;
  let mockDockService: jest.Mocked<DockService>;
  let mockDock3Service: jest.Mocked<Dock3Service>;
  let mockHomeService: jest.Mocked<HomeService>;
  let mockStoreService: jest.Mocked<StoreService>;
  let mockSettingsService: jest.Mocked<SettingsService>;
  let mockStorageService: jest.Mocked<WorkspaceStorageService>;
  let mockNotificationsService: jest.Mocked<NotificationsService>;

  /** Helper to install / remove mock fin on globalThis. */
  function setFin(available: boolean) {
    if (available) {
      (globalThis as any).fin = {
        me: { isOpenFin: true },
        Platform: {
          getCurrentSync: jest.fn().mockReturnValue({
            once: jest.fn(),
            quit: jest.fn(),
          }),
        },
      };
    } else {
      delete (globalThis as any).fin;
    }
  }

  beforeEach(() => {
    delete (globalThis as any).fin;

    mockPlatformService = {
      initializeWorkspacePlatform: jest.fn(),
      updateToolbarButtons: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<PlatformService>;

    mockDockService = {
      register: jest.fn(),
      show: jest.fn(),
    } as unknown as jest.Mocked<DockService>;

    mockDock3Service = {
      init: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<Dock3Service>;

    mockHomeService = {
      register: jest.fn(),
      show: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<HomeService>;

    mockStoreService = {
      register: jest.fn(),
      show: jest.fn(),
    } as unknown as jest.Mocked<StoreService>;

    mockSettingsService = {
      getManifestSettings: jest.fn(),
      getApps: jest.fn().mockReturnValue([]),
      getApps$: jest.fn(),
    } as unknown as jest.Mocked<SettingsService>;

    mockStorageService = {
      getWorkspaces: jest.fn().mockResolvedValue([]),
      saveWorkspaces: jest.fn().mockResolvedValue(undefined),
      getLastSavedWorkspaceId: jest.fn().mockResolvedValue(null),
      setLastSavedWorkspaceId: jest.fn().mockResolvedValue(undefined),
      removeLastSavedWorkspaceId: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<WorkspaceStorageService>;

    mockNotificationsService = {
      register: jest.fn().mockResolvedValue(undefined),
      deregister: jest.fn().mockResolvedValue(undefined),
      create: jest.fn(),
      observeNotificationActions: jest.fn(),
    } as unknown as jest.Mocked<NotificationsService>;

    service = new WorkspaceService(
      mockPlatformService,
      mockDockService,
      mockDock3Service,
      mockHomeService,
      mockStoreService,
      mockSettingsService,
      mockStorageService,
      {} as any, // themePresetService
      mockNotificationsService,
    );
  });

  afterEach(() => {
    delete (globalThis as any).fin;
  });

  // ── isOpenFin guard ─────────────────────────────────────────

  describe('init (isOpenFin guard)', () => {
    it('should return false immediately when not running in OpenFin', async () => {
      // fin is not set
      const result = await firstValueFrom(service.init());
      expect(result).toBe(false);
    });

    it('should emit status "Not running inside OpenFin" when not in OpenFin', async () => {
      const statuses: string[] = [];
      service.getStatus$().subscribe((s) => statuses.push(s));

      await firstValueFrom(service.init());

      expect(statuses).toContain('Not running inside OpenFin');
    });

    it('should return false when fin.me.isOpenFin is false', async () => {
      (globalThis as any).fin = { me: { isOpenFin: false } };

      const result = await firstValueFrom(service.init());
      expect(result).toBe(false);
    });
  });

  // ── getStatus$ ──────────────────────────────────────────────

  describe('getStatus$', () => {
    it('should emit empty string initially', async () => {
      const value = await firstValueFrom(service.getStatus$());
      expect(value).toBe('');
    });

    it('should be an observable', () => {
      const status$ = service.getStatus$();
      expect(status$).toBeDefined();
      expect(typeof status$.subscribe).toBe('function');
    });
  });

  // ── quit ────────────────────────────────────────────────────

  describe('quit', () => {
    it('should be a no-op when not in OpenFin', () => {
      expect(() => service.quit()).not.toThrow();
    });

    it('should call dock3Service.shutdown, notifications.deregister, and platform.quit when in OpenFin', async () => {
      const mockQuit = jest.fn();
      (globalThis as any).fin = {
        me: { isOpenFin: true },
        Platform: {
          getCurrentSync: jest.fn().mockReturnValue({
            quit: mockQuit,
          }),
        },
      };

      service.quit();

      // Wait for the shutdown promise to resolve
      await new Promise((r) => setTimeout(r, 0));

      expect(mockDock3Service.shutdown).toHaveBeenCalledTimes(1);
      expect(mockNotificationsService.deregister).toHaveBeenCalledTimes(1);
      expect(mockQuit).toHaveBeenCalledTimes(1);
    });

    it('should call shutdown and deregister before quitting the platform', async () => {
      const callOrder: string[] = [];
      const mockQuit = jest.fn(() => callOrder.push('quit'));
      (globalThis as any).fin = {
        me: { isOpenFin: true },
        Platform: {
          getCurrentSync: jest.fn().mockReturnValue({
            quit: mockQuit,
          }),
        },
      };
      mockDock3Service.shutdown.mockImplementation(async () => {
        callOrder.push('shutdown');
      });
      mockNotificationsService.deregister.mockImplementation(async () => {
        callOrder.push('deregister');
      });

      service.quit();

      // Wait for the promise chain (.finally) to resolve
      await new Promise((r) => setTimeout(r, 0));

      // Both shutdown and deregister should complete before quit
      expect(callOrder).toContain('shutdown');
      expect(callOrder).toContain('deregister');
      expect(callOrder[callOrder.length - 1]).toBe('quit');
    });
  });
});
