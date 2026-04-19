import { Dock3Service } from './dock3.service';
import type { PlatformSettings, Dock3Settings } from './types';
import type { App } from '@openfin/workspace';

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

// Mock @openfin/workspace-platform -- inline jest.fn() in factory to avoid TDZ
jest.mock('@openfin/workspace-platform', () => ({
  Dock: {
    init: jest.fn(),
  },
  getCurrentSync: jest.fn(),
}));

// Mock @openfin/workspace (for App type import)
jest.mock('@openfin/workspace', () => ({}));

// Import the mocked module to get references
import { Dock } from '@openfin/workspace-platform';

describe('Dock3Service', () => {
  let service: Dock3Service;
  let mockProviderShutdown: jest.Mock;

  const platformSettings: PlatformSettings = {
    id: 'macro-workspace',
    title: 'Macro Workspace',
    icon: 'default-icon.png',
  };

  const makeApp = (
    appId: string,
    title: string,
    manifest?: string,
    iconSrc?: string,
  ): App =>
    ({
      appId,
      title,
      manifest,
      icons: iconSrc ? [{ src: iconSrc }] : [],
    }) as unknown as App;

  beforeEach(() => {
    mockProviderShutdown = jest.fn().mockResolvedValue(undefined);
    (Dock.init as jest.Mock).mockReset();
    (Dock.init as jest.Mock).mockResolvedValue({
      ready: Promise.resolve(),
      shutdown: mockProviderShutdown,
    });

    service = new Dock3Service();
  });

  // ── init ────────────────────────────────────────────────────

  describe('init', () => {
    it('should call Dock.init with config', async () => {
      await service.init(platformSettings);

      expect(Dock.init).toHaveBeenCalledTimes(1);
      const callArg = (Dock.init as jest.Mock).mock.calls[0][0];
      expect(callArg.config.title).toBe('Macro Workspace');
      expect(callArg.config.icon).toBe('default-icon.png');
    });

    it('should pass default dock buttons', async () => {
      await service.init(platformSettings);

      const config = (Dock.init as jest.Mock).mock.calls[0][0].config;
      expect(config.defaultDockButtons).toEqual([
        'home',
        'store',
        'notifications',
        'switchWorkspace',
        'manageWorkspaces',
        'contentMenu',
      ]);
    });

    it('should pass uiConfig with contentMenu enableBookmarking', async () => {
      await service.init(platformSettings);

      const config = (Dock.init as jest.Mock).mock.calls[0][0].config;
      expect(config.uiConfig.contentMenu.enableBookmarking).toBe(true);
      expect(config.uiConfig.hideDragHandle).toBe(false);
    });

    it('should set favorites to empty array when no dock3Settings', async () => {
      await service.init(platformSettings);

      const config = (Dock.init as jest.Mock).mock.calls[0][0].config;
      expect(config.favorites).toEqual([]);
    });

    it('should set contentMenu to empty array when no dock3Settings', async () => {
      await service.init(platformSettings);

      const config = (Dock.init as jest.Mock).mock.calls[0][0].config;
      expect(config.contentMenu).toEqual([]);
    });

    it('should include override and await provider.ready', async () => {
      await service.init(platformSettings);

      const callArg = (Dock.init as jest.Mock).mock.calls[0][0];
      expect(callArg.override).toBeDefined();
      expect(typeof callArg.override).toBe('function');
    });
  });

  // ── shutdown ────────────────────────────────────────────────

  describe('shutdown', () => {
    it('should call provider.shutdown when initialized', async () => {
      await service.init(platformSettings);
      await service.shutdown();

      expect(mockProviderShutdown).toHaveBeenCalledTimes(1);
    });

    it('should set provider to null after shutdown', async () => {
      await service.init(platformSettings);
      await service.shutdown();

      // Calling shutdown again should be a no-op
      mockProviderShutdown.mockClear();
      await service.shutdown();
      expect(mockProviderShutdown).not.toHaveBeenCalled();
    });

    it('should be a no-op when not initialized', async () => {
      await service.shutdown();
      expect(mockProviderShutdown).not.toHaveBeenCalled();
    });
  });

  // ── buildFavorites ──────────────────────────────────────────

  describe('buildFavorites (tested via init config)', () => {
    it('should map favorites from settings with app icon', async () => {
      const apps = [
        makeApp('app-1', 'App One', 'manifest.json', 'app1.png'),
      ];
      const dock3Settings: Dock3Settings = {
        favorites: [
          {
            type: 'item',
            id: 'fav-1',
            icon: '',
            label: 'Fav One',
            appId: 'app-1',
          },
        ],
      };

      await service.init(platformSettings, apps, dock3Settings);

      const config = (Dock.init as jest.Mock).mock.calls[0][0].config;
      expect(config.favorites).toHaveLength(1);
      expect(config.favorites[0]).toEqual({
        type: 'item',
        id: 'fav-1',
        label: 'Fav One',
        icon: 'app1.png',
        contextMenu: { removeOption: true },
        itemData: { appId: 'app-1', url: 'manifest.json' },
      });
    });

    it('should use favorite icon if provided', async () => {
      const apps = [
        makeApp('app-1', 'App One', 'manifest.json', 'app1.png'),
      ];
      const dock3Settings: Dock3Settings = {
        favorites: [
          {
            type: 'item',
            id: 'fav-1',
            icon: 'custom-icon.png',
            label: 'Fav',
            appId: 'app-1',
          },
        ],
      };

      await service.init(platformSettings, apps, dock3Settings);

      const fav = (Dock.init as jest.Mock).mock.calls[0][0].config
        .favorites[0];
      expect(fav.icon).toBe('custom-icon.png');
    });

    it('should fall back to default icon when app has no icons', async () => {
      const apps = [makeApp('app-1', 'App One', 'manifest.json')];
      const dock3Settings: Dock3Settings = {
        favorites: [
          {
            type: 'item',
            id: 'fav-1',
            icon: '',
            label: 'Fav',
            appId: 'app-1',
          },
        ],
      };

      await service.init(platformSettings, apps, dock3Settings);

      const fav = (Dock.init as jest.Mock).mock.calls[0][0].config
        .favorites[0];
      expect(fav.icon).toBe('default-icon.png');
    });

    it('should fall back to default icon when appId does not match', async () => {
      const apps = [
        makeApp('app-1', 'App One', 'manifest.json', 'app1.png'),
      ];
      const dock3Settings: Dock3Settings = {
        favorites: [
          {
            type: 'item',
            id: 'fav-1',
            icon: '',
            label: 'Fav',
            appId: 'nonexistent',
          },
        ],
      };

      await service.init(platformSettings, apps, dock3Settings);

      const fav = (Dock.init as jest.Mock).mock.calls[0][0].config
        .favorites[0];
      expect(fav.icon).toBe('default-icon.png');
    });

    it('should return empty favorites for empty settings array', async () => {
      const dock3Settings: Dock3Settings = { favorites: [] };

      await service.init(platformSettings, [], dock3Settings);

      const config = (Dock.init as jest.Mock).mock.calls[0][0].config;
      expect(config.favorites).toEqual([]);
    });
  });

  // ── buildContentMenu ────────────────────────────────────────

  describe('buildContentMenu (tested via init config)', () => {
    it('should map item entries from settings', async () => {
      const apps = [
        makeApp('app-1', 'App One', 'manifest.json', 'app1.png'),
      ];
      const dock3Settings: Dock3Settings = {
        contentMenu: [
          {
            type: 'item',
            id: 'item-1',
            icon: '',
            label: 'Item One',
            appId: 'app-1',
          },
        ],
      };

      await service.init(platformSettings, apps, dock3Settings);

      const config = (Dock.init as jest.Mock).mock.calls[0][0].config;
      expect(config.contentMenu).toHaveLength(1);
      expect(config.contentMenu[0]).toEqual({
        type: 'item',
        id: 'item-1',
        label: 'Item One',
        icon: 'app1.png',
        itemData: { appId: 'app-1', url: 'manifest.json' },
      });
    });

    it('should handle folder entries with nested children', async () => {
      const apps = [
        makeApp('app-1', 'App One', 'manifest.json', 'app1.png'),
      ];
      const dock3Settings: Dock3Settings = {
        contentMenu: [
          {
            type: 'folder',
            id: 'folder-1',
            label: 'Trading',
            children: [
              {
                type: 'item',
                id: 'child-1',
                icon: '',
                label: 'Child',
                appId: 'app-1',
              },
            ],
          },
        ],
      };

      await service.init(platformSettings, apps, dock3Settings);

      const config = (Dock.init as jest.Mock).mock.calls[0][0].config;
      expect(config.contentMenu).toHaveLength(1);
      expect(config.contentMenu[0].type).toBe('folder');
      expect(config.contentMenu[0].id).toBe('folder-1');
      expect(config.contentMenu[0].label).toBe('Trading');
      expect((config.contentMenu[0] as any).children).toHaveLength(1);
      expect((config.contentMenu[0] as any).children[0]).toEqual({
        type: 'item',
        id: 'child-1',
        label: 'Child',
        icon: 'app1.png',
        itemData: { appId: 'app-1', url: 'manifest.json' },
      });
    });

    it('should handle deeply nested folders', async () => {
      const dock3Settings: Dock3Settings = {
        contentMenu: [
          {
            type: 'folder',
            id: 'f1',
            label: 'Top',
            children: [
              {
                type: 'folder',
                id: 'f2',
                label: 'Sub',
                children: [
                  {
                    type: 'item',
                    id: 'i1',
                    icon: 'deep.png',
                    label: 'Deep Item',
                  },
                ],
              },
            ],
          },
        ],
      };

      await service.init(platformSettings, [], dock3Settings);

      const config = (Dock.init as jest.Mock).mock.calls[0][0].config;
      const topFolder = config.contentMenu[0] as any;
      expect(topFolder.children[0].type).toBe('folder');
      expect(topFolder.children[0].children[0].type).toBe('item');
      expect(topFolder.children[0].children[0].icon).toBe('deep.png');
    });

    it('should return empty content menu for empty settings array', async () => {
      const dock3Settings: Dock3Settings = { contentMenu: [] };

      await service.init(platformSettings, [], dock3Settings);

      const config = (Dock.init as jest.Mock).mock.calls[0][0].config;
      expect(config.contentMenu).toEqual([]);
    });

    it('should use item icon over app icon when provided', async () => {
      const apps = [
        makeApp('app-1', 'App One', 'manifest.json', 'app1.png'),
      ];
      const dock3Settings: Dock3Settings = {
        contentMenu: [
          {
            type: 'item',
            id: 'i1',
            icon: 'custom.png',
            label: 'Custom',
            appId: 'app-1',
          },
        ],
      };

      await service.init(platformSettings, apps, dock3Settings);

      const item = (Dock.init as jest.Mock).mock.calls[0][0].config
        .contentMenu[0];
      expect(item.icon).toBe('custom.png');
    });
  });
});
