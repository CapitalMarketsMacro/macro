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

// Mock the shared launcher so we can assert Dock3 routes through it
jest.mock('./launch', () => ({
  launchApp: jest.fn().mockResolvedValue(undefined),
}));

// Mock analytics so launchEntry's publish() is a no-op
jest.mock('./analytics-nats.service', () => ({
  getAnalyticsNats: () => ({ publish: jest.fn().mockResolvedValue(undefined) }),
}));

// Import the mocked modules to get references
import { Dock, getCurrentSync } from '@openfin/workspace-platform';

describe('Dock3Service', () => {
  let service: Dock3Service;
  let mockLaunchService: { launch: jest.Mock };
  let mockAppsService: { load: jest.Mock; ensureLoaded: jest.Mock; getApps: jest.Mock };
  let mockDockConfigService: { getDockConfig: jest.Mock };
  let mockProviderShutdown: jest.Mock;
  let mockUpdateOptions: jest.Mock;

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
    mockUpdateOptions = jest.fn().mockResolvedValue(undefined);
    (Dock.init as jest.Mock).mockReset();
    (Dock.init as jest.Mock).mockResolvedValue({
      ready: Promise.resolve(),
      shutdown: mockProviderShutdown,
      getWindowSync: () => ({ updateOptions: mockUpdateOptions }),
    });

    mockLaunchService = { launch: jest.fn().mockResolvedValue(true) };
    mockAppsService = {
      load: jest.fn().mockResolvedValue([]),
      ensureLoaded: jest.fn().mockResolvedValue(undefined),
      getApps: jest.fn().mockReturnValue([]),
    };
    mockDockConfigService = { getDockConfig: jest.fn().mockResolvedValue({ favorites: [], contentMenu: [] }) };
    service = new Dock3Service(mockLaunchService as any, mockAppsService as any, mockDockConfigService as any);
  });

  // ── init ────────────────────────────────────────────────────

  describe('init', () => {
    it('should call Dock.init with config', async () => {
      await service.init(platformSettings);

      expect(Dock.init).toHaveBeenCalledTimes(1);
      const callArg = (Dock.init as jest.Mock).mock.calls[0][0];
      expect(callArg.config.title).toBe('Macro Workspace');
      // Provider icon is resolved to the raster favicon.ico for the taskbar.
      expect(callArg.config.icon).toBe('favicon.ico');
    });

    it('sets the dock window icon to the raster favicon for the taskbar', async () => {
      await service.init(platformSettings);

      // The dock window's taskbar entry falls back to its `icon` (no taskbarIcon
      // is allowed on the dock); we override it at runtime with the brand .ico.
      expect(mockUpdateOptions).toHaveBeenCalledWith({ icon: 'favicon.ico' });
    });

    it('should pass default dock buttons', async () => {
      await service.init(platformSettings);

      const config = (Dock.init as jest.Mock).mock.calls[0][0].config;
      expect(config.defaultDockButtons).toEqual([
        'home',
        'store',
        'notifications',
        'switchWorkspace',
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

  // ── launchEntry ─────────────────────────────────────────────

  describe('launchEntry (via Dock provider override)', () => {
    // Reproduce what Dock.init does internally: feed the override factory a
    // stub base class so we can drive launchEntry directly.
    async function getDockProvider(apps: App[]): Promise<any> {
      await service.init(platformSettings, apps);
      const initArg = (Dock.init as jest.Mock).mock.calls[0][0];
      const Subclass = initArg.override(class {});
      return new Subclass();
    }

    it('routes an appId entry through the entitlement-gating LaunchService', async () => {
      const app = makeApp('rates-desktop', 'Rates', 'http://host/app.platform.fin.json');
      (app as any).manifestType = 'manifest';
      const provider = await getDockProvider([app]);

      await provider.launchEntry({
        entry: { type: 'item', id: 'i', label: 'Rates', itemData: { appId: 'rates-desktop' } },
      });

      expect(mockLaunchService.launch).toHaveBeenCalledTimes(1);
      expect(mockLaunchService.launch).toHaveBeenCalledWith(app);
    });

    it('falls back to createView for a url-only entry (no appId)', async () => {
      const mockCreateView = jest.fn().mockResolvedValue(undefined);
      (getCurrentSync as jest.Mock).mockReturnValue({ createView: mockCreateView });
      const provider = await getDockProvider([]);

      await provider.launchEntry({
        entry: { type: 'item', id: 'i', label: 'Ad-hoc', itemData: { url: 'http://host/page' } },
      });

      expect(mockLaunchService.launch).not.toHaveBeenCalled();
      expect(mockCreateView).toHaveBeenCalledWith({ url: 'http://host/page' });
    });

    it('ignores non-item (folder) entries', async () => {
      const provider = await getDockProvider([]);

      await provider.launchEntry({
        entry: { type: 'folder', id: 'f', label: 'F', children: [] },
      });

      expect(mockLaunchService.launch).not.toHaveBeenCalled();
    });
  });

  // ── favorites folders (dock dropdowns via content-menu folder merging) ──

  describe('favorites folders', () => {
    it('passes a folder favorite through as a dock dropdown entry', async () => {
      const dock3Settings: Dock3Settings = {
        favorites: [
          { type: 'folder', id: 'showcase', label: 'Showcase', icon: 'http://x/showcase.svg' },
          { type: 'item', id: 'fav-a', label: 'A', icon: 'http://x/a.svg', appId: 'app-a' },
        ],
        contentMenu: [],
      };
      await service.init(platformSettings, [], dock3Settings);

      const config = (Dock.init as jest.Mock).mock.calls[0][0].config;
      expect(config.favorites[0]).toEqual({
        type: 'folder',
        id: 'showcase',
        label: 'Showcase',
        icon: 'http://x/showcase.svg',
      });
      expect(config.favorites[1].type).toBe('item');
    });
  });

  // ── Dock 3.0 uiConfig features ──

  describe('Dock 3.0 uiConfig', () => {
    it('enables providerIconContentMenu and the Macro Tools more-menu', async () => {
      await service.init(platformSettings);

      const config = (Dock.init as jest.Mock).mock.calls[0][0].config;
      expect(config.uiConfig.providerIconContentMenu).toBe(true);
      expect(config.uiConfig.moreMenu.moreMenuCustomOption.label).toBe('Macro Tools');
      expect(config.uiConfig.moreMenu.moreMenuCustomOption.options.map((o: any) => o.action)).toEqual([
        'launch-analytics-dashboard',
        'launch-process-manager',
      ]);
    });

    it('launches the process manager from the more-menu via fin', async () => {
      const startFromManifest = jest.fn().mockResolvedValue(undefined);
      (globalThis as any).fin = { Application: { startFromManifest } };
      try {
        await service.init(platformSettings);
        const overrideFactory = (Dock.init as jest.Mock).mock.calls[0][0].override;
        class MockBase {}
        const provider = new (overrideFactory(MockBase as any))();

        await provider.moreMenuCustomOptionClicked({ action: 'launch-process-manager' });
        expect(startFromManifest).toHaveBeenCalledWith('http://cdn.openfin.co/release/apps/openfin/processmanager/app.json');
      } finally {
        delete (globalThis as any).fin;
      }
    });

    it('logs and swallows more-menu failures (unknown action, launcher rejection)', async () => {
      const analytics = makeApp('macro-analytics-dashboard', 'Analytics', 'http://host/analytics.fin.json');
      mockLaunchService.launch.mockRejectedValue(new Error('launch failed'));
      await service.init(platformSettings, [analytics]);
      const overrideFactory = (Dock.init as jest.Mock).mock.calls[0][0].override;
      class MockBase {}
      const provider = new (overrideFactory(MockBase as any))();

      await expect(provider.moreMenuCustomOptionClicked({ action: 'launch-analytics-dashboard' })).resolves.toBeUndefined();
      await expect(provider.moreMenuCustomOptionClicked({ action: 'no-such-action' })).resolves.toBeUndefined();
    });

    it('passes theme-variant {light,dark} icons through favorites untouched', async () => {
      const icon = { light: 'http://x/l.svg', dark: 'http://x/d.svg' };
      const dock3Settings: Dock3Settings = {
        favorites: [{ type: 'item', id: 'fav-t', label: 'Themed', icon, appId: undefined }],
        contentMenu: [],
      };
      await service.init(platformSettings, [], dock3Settings);
      const config = (Dock.init as jest.Mock).mock.calls[0][0].config;
      expect(config.favorites[0].icon).toEqual(icon);
    });

    it('routes the analytics more-menu action through the launcher', async () => {
      const analytics = makeApp('macro-analytics-dashboard', 'Analytics', 'http://host/analytics.fin.json');
      await service.init(platformSettings, [analytics]);

      const overrideFactory = (Dock.init as jest.Mock).mock.calls[0][0].override;
      class MockBase {}
      const Provider = overrideFactory(MockBase as any);
      const provider = new Provider();

      await provider.moreMenuCustomOptionClicked({ action: 'launch-analytics-dashboard' });
      expect(mockLaunchService.launch).toHaveBeenCalledWith(analytics);
    });
  });

  // ── LOB dock apps from the unified storage API ──

  describe('LOB dock apps', () => {
    const initWithLobApps = async (lobApps: unknown[], reject = false) => {
      const mockStorage = {
        getLobDockApps: reject
          ? jest.fn().mockRejectedValue(new Error('storage down'))
          : jest.fn().mockResolvedValue(lobApps),
      };
      service = new Dock3Service(
        mockLaunchService as any,
        mockAppsService as any,
        mockDockConfigService as any,
        mockStorage as any,
      );
      await service.init(platformSettings);
      return (Dock.init as jest.Mock).mock.calls[0][0].config;
    };

    it('renders an icon LOB app as a dock favorite launching its url', async () => {
      const config = await initWithLobApps([
        { id: 'lob-rates-monitor', label: 'Rates Monitor', iconUrl: 'http://lob/rates.svg', type: 'icon', url: 'http://lob/rates-app', lob: 'Rates' },
      ]);

      expect(config.favorites).toContainEqual({
        type: 'item',
        id: 'lob:lob-rates-monitor',
        label: 'Rates Monitor',
        icon: 'http://lob/rates.svg',
        itemData: { url: 'http://lob/rates-app' },
      });
      // ...and it is cataloged under the LOB Apps content folder, grouped by lob.
      const lobFolder = config.contentMenu.find((e: any) => e.id === 'lob-apps');
      expect(lobFolder.children).toContainEqual({
        type: 'folder',
        id: 'lob:group:rates',
        label: 'Rates',
        children: [
          {
            type: 'item',
            id: 'lob:catalog:lob-rates-monitor',
            label: 'Rates Monitor',
            icon: 'http://lob/rates.svg',
            itemData: { url: 'http://lob/rates-app' },
          },
        ],
      });
    });

    it('renders a dropdown LOB app as a dock folder + same-id content-menu folder', async () => {
      const config = await initWithLobApps([
        {
          id: 'lob-credit-tools',
          label: 'Credit Tools',
          iconUrl: 'http://lob/credit.svg',
          type: 'dropdown',
          children: [
            { id: 'credit-curves', label: 'Curves', url: 'http://lob/curves' },
            { id: 'credit-runs', label: 'Runs', url: 'http://lob/runs', iconUrl: 'http://lob/runs.svg' },
          ],
        },
      ]);

      // LOB-derived ids are namespaced with `lob:` so publishers can never collide
      // with the platform's config-driven ids (showcase/prism/lob-apps/cm-*).
      expect(config.favorites).toContainEqual({
        type: 'folder',
        id: 'lob:lob-credit-tools',
        label: 'Credit Tools',
        icon: 'http://lob/credit.svg',
      });
      const folder = config.contentMenu.find((e: any) => e.id === 'lob:lob-credit-tools');
      expect(folder.children).toEqual([
        { type: 'item', id: 'lob:lob-credit-tools:credit-curves', label: 'Curves', icon: 'http://lob/credit.svg', itemData: { url: 'http://lob/curves' } },
        { type: 'item', id: 'lob:lob-credit-tools:credit-runs', label: 'Runs', icon: 'http://lob/runs.svg', itemData: { url: 'http://lob/runs' } },
      ]);
    });

    it('orders LOB entries by sortOrder ascending with undefined last', async () => {
      const config = await initWithLobApps([
        { id: 'no-order', label: 'Z', iconUrl: 'http://x/z.svg', type: 'icon', url: 'http://x/z' },
        { id: 'second', label: 'B', iconUrl: 'http://x/b.svg', type: 'icon', url: 'http://x/b', sortOrder: 2 },
        { id: 'first', label: 'A', iconUrl: 'http://x/a.svg', type: 'icon', url: 'http://x/a', sortOrder: 1 },
      ]);

      const lobIds = config.favorites.filter((f: any) => f.type === 'item').map((f: any) => f.id);
      expect(lobIds).toEqual(['lob:first', 'lob:second', 'lob:no-order']);
    });

    it('skips malformed entries (icon without url, dropdown without children)', async () => {
      const config = await initWithLobApps([
        { id: 'bad-icon', label: 'X', iconUrl: 'http://x/x.svg', type: 'icon' },
        { id: 'bad-dropdown', label: 'Y', iconUrl: 'http://x/y.svg', type: 'dropdown', children: [] },
        { id: 'good', label: 'G', iconUrl: 'http://x/g.svg', type: 'icon', url: 'http://x/g' },
      ]);

      const ids = config.favorites.map((f: any) => f.id);
      expect(ids).toContain('lob:good');
      expect(ids).not.toContain('lob:bad-icon');
      expect(ids).not.toContain('lob:bad-dropdown');
    });

    it('never lets a poisoned LOB record break the dock (non-string lob, bad children)', async () => {
      const config = await initWithLobApps([
        { id: 'poison', label: 'P', iconUrl: 'http://x/p.svg', type: 'icon', url: 'http://x/p', lob: 42 },
        { id: 'bad-kids', label: 'K', iconUrl: 'http://x/k.svg', type: 'dropdown', children: 'nope' },
        { id: 'ok', label: 'OK', iconUrl: 'http://x/ok.svg', type: 'icon', url: 'http://x/ok', lob: 'Rates' },
      ]);

      // Dock still built; poisoned lob groups as ungrouped instead of crashing.
      const ids = config.favorites.map((f: any) => f.id);
      expect(ids).toContain('lob:poison');
      expect(ids).toContain('lob:ok');
      expect(ids).not.toContain('lob:bad-kids');
      const lobFolder = config.contentMenu.find((e: any) => e.id === 'lob-apps');
      const topLevelIds = lobFolder.children.map((c: any) => c.id);
      expect(topLevelIds).toContain('lob:catalog:poison'); // ungrouped, not under a folder
    });

    it('skips duplicate LOB ids (first one wins)', async () => {
      const config = await initWithLobApps([
        { id: 'dup', label: 'First', iconUrl: 'http://x/1.svg', type: 'icon', url: 'http://x/1' },
        { id: 'dup', label: 'Second', iconUrl: 'http://x/2.svg', type: 'icon', url: 'http://x/2' },
      ]);
      const dups = config.favorites.filter((f: any) => f.id === 'lob:dup');
      expect(dups).toHaveLength(1);
      expect(dups[0].label).toBe('First');
    });

    it('renders the dock without LOB entries when storage fails (fail-soft)', async () => {
      const config = await initWithLobApps([], true);
      expect(config.favorites).toEqual([]);
      expect(config.contentMenu.find((e: any) => e.id === 'lob-apps')).toBeUndefined();
    });

    it('loads no LOB apps when constructed without a storage service (back-compat)', async () => {
      await service.init(platformSettings);
      const config = (Dock.init as jest.Mock).mock.calls[0][0].config;
      expect(config.favorites).toEqual([]);
    });
  });

  // ── store-pinned apps ("Add to Dock" on Storefront cards) ──

  describe('dock pins', () => {
    let mockUpdateConfig: jest.Mock;

    const buildPinnedService = (pinnedIds: unknown) => {
      mockUpdateConfig = jest.fn().mockResolvedValue(undefined);
      (Dock.init as jest.Mock).mockResolvedValue({
        ready: Promise.resolve(),
        shutdown: mockProviderShutdown,
        getWindowSync: () => ({ updateOptions: mockUpdateOptions }),
        updateConfig: mockUpdateConfig,
      });
      const mockStorage = {
        getLobDockApps: jest.fn().mockResolvedValue([]),
        getPreference: jest.fn().mockResolvedValue(pinnedIds),
        setPreference: jest.fn().mockResolvedValue(undefined),
      };
      return new Dock3Service(
        mockLaunchService as any,
        mockAppsService as any,
        mockDockConfigService as any,
        mockStorage as any,
      );
    };

    it('appends pinned apps as pin:-namespaced favorites at init (unknown ids skipped)', async () => {
      const apps = [makeApp('macro-angular-view', 'Macro Angular', 'm.json', 'icon.png')];
      const pinned = buildPinnedService(['macro-angular-view', 'ghost-app', 'macro-angular-view']);
      await pinned.init(platformSettings, apps);

      const config = (Dock.init as jest.Mock).mock.calls[0][0].config;
      expect(config.favorites).toEqual([
        {
          type: 'item',
          id: 'pin:macro-angular-view',
          label: 'Macro Angular',
          icon: 'icon.png',
          itemData: { appId: 'macro-angular-view' },
        },
      ]);
    });

    it('refreshPinnedApps live-updates the provider config and the loadConfig source', async () => {
      const apps = [
        makeApp('macro-angular-view', 'Macro Angular', 'm.json', 'icon.png'),
        makeApp('prism-blotter', 'Prism', 'p.json', 'prism.png'),
      ];
      const pinned = buildPinnedService([]);
      await pinned.init(platformSettings, apps);

      await pinned.refreshPinnedApps(['prism-blotter']);

      expect(mockUpdateConfig).toHaveBeenCalledTimes(1);
      const updated = mockUpdateConfig.mock.calls[0][0];
      expect(updated.favorites).toEqual([
        { type: 'item', id: 'pin:prism-blotter', label: 'Prism', icon: 'prism.png', itemData: { appId: 'prism-blotter' } },
      ]);
      // loadConfig returns the SAME (mutated) config object, so dock reloads keep pins.
      expect((Dock.init as jest.Mock).mock.calls[0][0].config.favorites).toEqual(updated.favorites);
    });

    it('is a warn-only no-op before init', async () => {
      const pinned = buildPinnedService([]);
      await expect(pinned.refreshPinnedApps(['x'])).resolves.toBeUndefined();
    });

    it('preserves session bookmarks when refreshing pins (activeConfig sync via saveConfig)', async () => {
      const apps = [makeApp('prism-blotter', 'Prism', 'p.json', 'prism.png')];
      const pinned = buildPinnedService([]);
      const dock3Settings: Dock3Settings = {
        favorites: [],
        contentMenu: [
          { type: 'item', id: 'cm-themes', icon: 'themes.png', label: 'Themes' },
        ],
      };
      await pinned.init(platformSettings, apps, dock3Settings);
      const initArg = (Dock.init as jest.Mock).mock.calls[0][0];
      const provider = new (initArg.override(class {}))();

      // The dock UI bookmarks cm-themes and pushes the new config via save-config.
      const bookmarked = {
        ...initArg.config,
        favorites: [
          ...initArg.config.favorites,
          { type: 'item', id: 'cm-themes', icon: 'themes.png', label: 'Themes', itemData: {} },
        ],
      };
      await provider.saveConfig({ config: bookmarked });

      await pinned.refreshPinnedApps(['prism-blotter']);
      const updated = mockUpdateConfig.mock.lastCall[0];
      const ids = updated.favorites.map((f: any) => f.id);
      expect(ids).toContain('cm-themes'); // session bookmark survived the pin refresh
      expect(ids).toContain('pin:prism-blotter');
    });

    it('dock still renders when the pin preference read fails', async () => {
      mockUpdateConfig = jest.fn();
      (Dock.init as jest.Mock).mockResolvedValue({
        ready: Promise.resolve(),
        shutdown: mockProviderShutdown,
        getWindowSync: () => ({ updateOptions: mockUpdateOptions }),
        updateConfig: mockUpdateConfig,
      });
      const mockStorage = {
        getLobDockApps: jest.fn().mockResolvedValue([]),
        getPreference: jest.fn().mockRejectedValue(new Error('down')),
      };
      const pinned = new Dock3Service(
        mockLaunchService as any,
        mockAppsService as any,
        mockDockConfigService as any,
        mockStorage as any,
      );
      await pinned.init(platformSettings);
      expect((Dock.init as jest.Mock).mock.calls[0][0].config.favorites).toEqual([]);
    });
  });

  // ── content-menu bookmarks (dock star) persisted via the storage API ──

  describe('dock bookmarks', () => {
    let mockSetPreference: jest.Mock;
    let mockGetPreference: jest.Mock;
    let mockUpdateConfig: jest.Mock;

    const contentMenuSettings: Dock3Settings = {
      favorites: [
        { type: 'item', id: 'fav-1', icon: 'f1.png', label: 'Config Fav' },
      ],
      contentMenu: [
        {
          type: 'folder',
          id: 'showcase',
          label: 'Showcase',
          children: [
            { type: 'item', id: 'cm-analytics', icon: 'a.png', label: 'Analytics' },
            { type: 'item', id: 'cm-themes', icon: 't.png', label: 'Themes' },
          ],
        },
      ],
    };

    /** Storage stub answering pins/bookmarks by preference key. */
    const buildBookmarkService = (opts: {
      bookmarks?: unknown;
      pins?: string[];
      bookmarksReject?: boolean;
      setPreferenceReject?: boolean;
    }) => {
      mockUpdateConfig = jest.fn().mockResolvedValue(undefined);
      (Dock.init as jest.Mock).mockResolvedValue({
        ready: Promise.resolve(),
        shutdown: mockProviderShutdown,
        getWindowSync: () => ({ updateOptions: mockUpdateOptions }),
        updateConfig: mockUpdateConfig,
      });
      mockSetPreference = opts.setPreferenceReject
        ? jest.fn().mockRejectedValue(new Error('write down'))
        : jest.fn().mockResolvedValue(undefined);
      mockGetPreference = jest.fn().mockImplementation(async (key: string) => {
        if (key === 'dock-bookmarks') {
          if (opts.bookmarksReject) throw new Error('read down');
          return opts.bookmarks ?? [];
        }
        return opts.pins ?? []; // dock-pinned-apps
      });
      const mockStorage = {
        getLobDockApps: jest.fn().mockResolvedValue([]),
        getPreference: mockGetPreference,
        setPreference: mockSetPreference,
      };
      return new Dock3Service(
        mockLaunchService as any,
        mockAppsService as any,
        mockDockConfigService as any,
        mockStorage as any,
      );
    };

    const getProvider = () => {
      const initArg = (Dock.init as jest.Mock).mock.calls[0][0];
      return { initArg, provider: new (initArg.override(class {}))() as any };
    };

    it('restores persisted bookmarks from the content menu, keeping the entry id', async () => {
      const svc = buildBookmarkService({ bookmarks: ['cm-themes', 'ghost-id', 'cm-themes'] });
      await svc.init(platformSettings, [], contentMenuSettings);

      const config = (Dock.init as jest.Mock).mock.calls[0][0].config;
      // Same id as the content-menu entry — Dock 3.0 keys the filled star by id.
      expect(config.favorites).toContainEqual({
        type: 'item',
        id: 'cm-themes',
        label: 'Themes',
        icon: 't.png',
        itemData: { appId: undefined, url: undefined },
      });
      // Unknown ids are skipped, duplicates collapse to one entry.
      expect(config.favorites.filter((f: any) => f.id === 'cm-themes')).toHaveLength(1);
      expect(config.favorites.map((f: any) => f.id)).not.toContain('ghost-id');
    });

    it('persists a new bookmark pushed through saveConfig (dock star click)', async () => {
      const svc = buildBookmarkService({ bookmarks: [] });
      await svc.init(platformSettings, [], contentMenuSettings);
      const { initArg, provider } = getProvider();

      const saved = {
        ...initArg.config,
        favorites: [
          ...initArg.config.favorites,
          { type: 'item', id: 'cm-analytics', icon: 'a.png', label: 'Analytics', itemData: {} },
        ],
      };
      await provider.saveConfig({ config: saved });

      expect(mockSetPreference).toHaveBeenCalledWith('dock-bookmarks', ['cm-analytics']);
      // Provider internal state adopted the saved config (protected setter pattern)...
      expect(provider.config).toBe(saved);
      // ...and loadConfig now serves it, so a dock-internal reload keeps the bookmark.
      await expect(provider.loadConfig()).resolves.toBe(saved);
    });

    it('persists removal when the user un-stars a restored bookmark', async () => {
      const svc = buildBookmarkService({ bookmarks: ['cm-themes'] });
      await svc.init(platformSettings, [], contentMenuSettings);
      const { initArg, provider } = getProvider();

      // Dock UI removed the bookmarked favorite (config favorites minus cm-themes).
      const saved = {
        ...initArg.config,
        favorites: initArg.config.favorites.filter((f: any) => f.id !== 'cm-themes'),
      };
      await provider.saveConfig({ config: saved });

      expect(mockSetPreference).toHaveBeenCalledWith('dock-bookmarks', []);
    });

    it('skips redundant writes when the bookmark set is unchanged (re-order saves)', async () => {
      const svc = buildBookmarkService({ bookmarks: ['cm-themes'] });
      await svc.init(platformSettings, [], contentMenuSettings);
      const { initArg, provider } = getProvider();

      // Same favorites, different order — bookmark set identical.
      await provider.saveConfig({
        config: { ...initArg.config, favorites: [...initArg.config.favorites].reverse() },
      });
      // Reversal reorders [fav-1, cm-themes] → bookmark list unchanged (['cm-themes']).
      expect(mockSetPreference).not.toHaveBeenCalled();
    });

    it('never persists pin: favorites as bookmarks (pins are added live after the snapshot)', async () => {
      const svc = buildBookmarkService({ bookmarks: [] });
      await svc.init(platformSettings, [], contentMenuSettings);
      const { initArg, provider } = getProvider();

      const saved = {
        ...initArg.config,
        favorites: [
          ...initArg.config.favorites,
          { type: 'item', id: 'pin:some-app', icon: 'p.png', label: 'Pin', itemData: {} },
          { type: 'item', id: 'cm-themes', icon: 't.png', label: 'Themes', itemData: {} },
        ],
      };
      await provider.saveConfig({ config: saved });

      expect(mockSetPreference).toHaveBeenCalledWith('dock-bookmarks', ['cm-themes']);
    });

    it('persists bookmarks on LOB content-menu items (lob:catalog ids stay bookmarkable)', async () => {
      mockSetPreference = jest.fn().mockResolvedValue(undefined);
      const mockStorage = {
        getLobDockApps: jest.fn().mockResolvedValue([
          { id: 'rates-monitor', label: 'Rates Monitor', iconUrl: 'r.png', type: 'icon', url: 'http://lob/rates', lob: 'Rates' },
        ]),
        getPreference: jest.fn().mockResolvedValue([]),
        setPreference: mockSetPreference,
      };
      const svc = new Dock3Service(
        mockLaunchService as any,
        mockAppsService as any,
        mockDockConfigService as any,
        mockStorage as any,
      );
      await svc.init(platformSettings);
      const { initArg, provider } = getProvider();

      // The LOB bar button (lob:rates-monitor) is platform-owned; the CATALOG
      // entry (lob:catalog:rates-monitor) is a content-menu item the user starred.
      const saved = {
        ...initArg.config,
        favorites: [
          ...initArg.config.favorites,
          { type: 'item', id: 'lob:catalog:rates-monitor', icon: 'r.png', label: 'Rates Monitor', itemData: { url: 'http://lob/rates' } },
        ],
      };
      await provider.saveConfig({ config: saved });

      expect(mockSetPreference).toHaveBeenCalledWith('dock-bookmarks', ['lob:catalog:rates-monitor']);
    });

    it('swallows a failed bookmark write (dock keeps working, loudly logged)', async () => {
      const svc = buildBookmarkService({ bookmarks: [], setPreferenceReject: true });
      await svc.init(platformSettings, [], contentMenuSettings);
      const { initArg, provider } = getProvider();

      const saved = {
        ...initArg.config,
        favorites: [
          ...initArg.config.favorites,
          { type: 'item', id: 'cm-themes', icon: 't.png', label: 'Themes', itemData: {} },
        ],
      };
      await expect(provider.saveConfig({ config: saved })).resolves.toBeUndefined();
    });

    it('refuses to write when the boot-time bookmark read failed (anti-clobber guard)', async () => {
      const svc = buildBookmarkService({ bookmarksReject: true });
      await svc.init(platformSettings, [], contentMenuSettings);
      const { initArg, provider } = getProvider();

      // Dock still rendered (fail-soft read)...
      expect(initArg.config.favorites.map((f: any) => f.id)).toEqual(['fav-1']);

      const saved = {
        ...initArg.config,
        favorites: [
          ...initArg.config.favorites,
          { type: 'item', id: 'cm-themes', icon: 't.png', label: 'Themes', itemData: {} },
        ],
      };
      await provider.saveConfig({ config: saved });
      // ...but a partial view must never overwrite the user's stored bookmark set.
      expect(mockSetPreference).not.toHaveBeenCalled();
    });

    it('stamps bookmarked:true on restored content-menu entries (the UI fills the star from that flag)', async () => {
      const svc = buildBookmarkService({ bookmarks: ['cm-themes'] });
      await svc.init(platformSettings, [], contentMenuSettings);

      const config = (Dock.init as jest.Mock).mock.calls[0][0].config;
      const showcase = config.contentMenu.find((e: any) => e.id === 'showcase');
      const themes = showcase.children.find((c: any) => c.id === 'cm-themes');
      const analytics = showcase.children.find((c: any) => c.id === 'cm-analytics');
      expect(themes.bookmarked).toBe(true);
      expect(analytics.bookmarked).toBeUndefined();
    });

    it('tracks the full star -> unstar -> re-star sequence (lastSaved bookkeeping)', async () => {
      const svc = buildBookmarkService({ bookmarks: [] });
      await svc.init(platformSettings, [], contentMenuSettings);
      const { initArg, provider } = getProvider();

      const withBookmark = {
        ...initArg.config,
        favorites: [
          ...initArg.config.favorites,
          { type: 'item', id: 'cm-themes', icon: 't.png', label: 'Themes', itemData: {} },
        ],
      };
      await provider.saveConfig({ config: withBookmark });
      await provider.saveConfig({ config: initArg.config }); // unstar
      await provider.saveConfig({ config: withBookmark }); // star again

      expect(mockSetPreference.mock.calls.map((c: any[]) => c[1])).toEqual([
        ['cm-themes'],
        [],
        ['cm-themes'],
      ]);
    });

    it('unions boot-unresolved ids into every write instead of erasing them', async () => {
      // 'ghost-id' was persisted but its content-menu entry is gone this session
      // (e.g. the LOB feed failed soft at boot). Starring something else must
      // NOT prune it from storage.
      const svc = buildBookmarkService({ bookmarks: ['cm-themes', 'ghost-id'] });
      await svc.init(platformSettings, [], contentMenuSettings);
      const { initArg, provider } = getProvider();

      const saved = {
        ...initArg.config,
        favorites: [
          ...initArg.config.favorites,
          { type: 'item', id: 'cm-analytics', icon: 'a.png', label: 'Analytics', itemData: {} },
        ],
      };
      await provider.saveConfig({ config: saved });

      const written = mockSetPreference.mock.calls[0][1];
      expect(written).toContain('ghost-id'); // preserved for a later boot
      expect(written).toContain('cm-analytics');
      expect(written).toContain('cm-themes');
    });

    it('re-hydrates on the next gesture after a failed boot read (transient outage self-heals)', async () => {
      let failuresLeft = 1;
      mockSetPreference = jest.fn().mockResolvedValue(undefined);
      const mockStorage = {
        getLobDockApps: jest.fn().mockResolvedValue([]),
        getPreference: jest.fn().mockImplementation(async (key: string) => {
          if (key !== 'dock-bookmarks') return [];
          if (failuresLeft > 0) {
            failuresLeft--;
            throw new Error('transient outage');
          }
          return ['cm-themes']; // the user's stored set, unreadable at boot
        }),
        setPreference: mockSetPreference,
      };
      const svc = new Dock3Service(
        mockLaunchService as any,
        mockAppsService as any,
        mockDockConfigService as any,
        mockStorage as any,
      );
      await svc.init(platformSettings, [], contentMenuSettings);
      const { initArg, provider } = getProvider();

      const saved = {
        ...initArg.config,
        favorites: [
          ...initArg.config.favorites,
          { type: 'item', id: 'cm-analytics', icon: 'a.png', label: 'Analytics', itemData: {} },
        ],
      };
      await provider.saveConfig({ config: saved });

      // The stored set recovered on retry is unioned with the new star — the
      // user cannot have un-starred entries that were never shown this session.
      const written = mockSetPreference.mock.calls[0][1];
      expect(written).toContain('cm-analytics');
      expect(written).toContain('cm-themes');
    });

    it('sanitizes a corrupted stored preference (non-array / mixed types)', async () => {
      const svc = buildBookmarkService({ bookmarks: [42, 'cm-themes', null, ''] });
      await svc.init(platformSettings, [], contentMenuSettings);

      const config = (Dock.init as jest.Mock).mock.calls[0][0].config;
      // Only the valid string id restores; garbage members are dropped.
      expect(config.favorites.map((f: any) => f.id)).toEqual(['fav-1', 'cm-themes']);

      // A non-array value hydrates as empty (writes may proceed and GC the corruption).
      (Dock.init as jest.Mock).mockClear();
      const svc2 = buildBookmarkService({ bookmarks: { weird: true } });
      await svc2.init(platformSettings, [], contentMenuSettings);
      const { initArg, provider } = getProvider();
      const saved = {
        ...initArg.config,
        favorites: [
          ...initArg.config.favorites,
          { type: 'item', id: 'cm-analytics', icon: 'a.png', label: 'Analytics', itemData: {} },
        ],
      };
      await provider.saveConfig({ config: saved });
      expect(mockSetPreference).toHaveBeenCalledWith('dock-bookmarks', ['cm-analytics']);
    });

    it('publishes a Dock/Bookmark analytics event on star clicks without throwing', async () => {
      const svc = buildBookmarkService({ bookmarks: [] });
      await svc.init(platformSettings, [], contentMenuSettings);
      const { provider } = getProvider();

      await expect(
        provider.bookmarkContentMenuEntry({ entry: { id: 'cm-themes', label: 'Themes' } }),
      ).resolves.toBeUndefined();
      await expect(provider.bookmarkContentMenuEntry({})).resolves.toBeUndefined();
    });
  });

  // ── star clicks (bookmark-content-menu-entry — the provider owns the whole toggle) ──

  describe('star toggle', () => {
    const menuItem = (cfg: any, id: string) =>
      cfg.contentMenu
        .flatMap((e: any) => (e.type === 'folder' ? e.children : [e]))
        .find((c: any) => c.id === id);

    let mockSetPreference: jest.Mock;
    let mockUpdateConfig: jest.Mock;

    const getProvider = () => {
      const initArg = (Dock.init as jest.Mock).mock.calls[0][0];
      return { initArg, provider: new (initArg.override(class {}))() as any };
    };

    const buildStarService = (opts: { bookmarks?: string[]; pins?: string[] }) => {
      mockUpdateConfig = jest.fn().mockResolvedValue(undefined);
      (Dock.init as jest.Mock).mockResolvedValue({
        ready: Promise.resolve(),
        shutdown: mockProviderShutdown,
        getWindowSync: () => ({ updateOptions: mockUpdateOptions }),
        updateConfig: mockUpdateConfig,
      });
      mockSetPreference = jest.fn().mockResolvedValue(undefined);
      const mockStorage = {
        getLobDockApps: jest.fn().mockResolvedValue([]),
        getPreference: jest
          .fn()
          .mockImplementation(async (key: string) =>
            key === 'dock-bookmarks' ? (opts.bookmarks ?? []) : (opts.pins ?? []),
          ),
        setPreference: mockSetPreference,
      };
      return new Dock3Service(
        mockLaunchService as any,
        mockAppsService as any,
        mockDockConfigService as any,
        mockStorage as any,
      );
    };

    const starSettings: Dock3Settings = {
      favorites: [],
      contentMenu: [
        {
          type: 'folder',
          id: 'showcase',
          label: 'Showcase',
          children: [
            { type: 'item', id: 'cm-themes', icon: 't.png', label: 'Themes' },
            { type: 'item', id: 'cm-app', icon: 'a.png', label: 'App One', appId: 'app-1' },
          ],
        },
      ],
    };

    it('star click promotes the entry onto the bar, fills the star, repaints, persists', async () => {
      const svc = buildStarService({});
      await svc.init(platformSettings, [], starSettings);
      const { initArg, provider } = getProvider();

      await provider.bookmarkContentMenuEntry({ entry: { id: 'cm-themes', label: 'Themes' } });

      const cfg = initArg.config;
      expect(cfg.favorites.map((f: any) => f.id)).toContain('cm-themes');
      expect(menuItem(cfg, 'cm-themes').bookmarked).toBe(true);
      expect(mockUpdateConfig).toHaveBeenCalledWith(cfg); // live repaint — no restart needed
      expect(mockSetPreference).toHaveBeenCalledWith('dock-bookmarks', ['cm-themes']);
    });

    it('second star click un-stars: favorite removed, star hollow, empty set persisted', async () => {
      const svc = buildStarService({});
      await svc.init(platformSettings, [], starSettings);
      const { initArg, provider } = getProvider();

      await provider.bookmarkContentMenuEntry({ entry: { id: 'cm-themes', label: 'Themes' } });
      await provider.bookmarkContentMenuEntry({ entry: { id: 'cm-themes', label: 'Themes' } });

      const cfg = initArg.config;
      expect(cfg.favorites.map((f: any) => f.id)).not.toContain('cm-themes');
      expect(menuItem(cfg, 'cm-themes').bookmarked).toBeUndefined();
      expect(mockSetPreference.mock.lastCall).toEqual(['dock-bookmarks', []]);
    });

    it('boot: a Storefront-pinned app renders its content-menu star filled', async () => {
      const apps = [makeApp('app-1', 'App One', 'm.json', 'a.png')];
      const svc = buildStarService({ pins: ['app-1'] });
      await svc.init(platformSettings, apps, starSettings);

      const cfg = (Dock.init as jest.Mock).mock.calls[0][0].config;
      expect(cfg.favorites.map((f: any) => f.id)).toContain('pin:app-1');
      expect(menuItem(cfg, 'cm-app').bookmarked).toBe(true);
      expect(menuItem(cfg, 'cm-themes').bookmarked).toBeUndefined();
    });

    it('un-starring a pin-backed entry delegates the unpin to the registered handler', async () => {
      const apps = [makeApp('app-1', 'App One', 'm.json', 'a.png')];
      const svc = buildStarService({ pins: ['app-1'] });
      const unpin = jest.fn().mockResolvedValue(undefined);
      svc.setPinRemovalHandler(unpin);
      await svc.init(platformSettings, apps, starSettings);
      const { initArg, provider } = getProvider();

      await provider.bookmarkContentMenuEntry({
        entry: { id: 'cm-app', label: 'App One', itemData: { appId: 'app-1' } },
      });

      expect(unpin).toHaveBeenCalledWith('app-1');
      // The pin favorite itself is untouched here — the handler owns its removal.
      expect(initArg.config.favorites.map((f: any) => f.id)).toContain('pin:app-1');
      expect(mockSetPreference).not.toHaveBeenCalled(); // bookmark set unchanged
    });

    it('starring then pinning the same app never shows two dock buttons (pin button suppressed)', async () => {
      const apps = [makeApp('app-1', 'App One', 'm.json', 'a.png')];
      const svc = buildStarService({});
      await svc.init(platformSettings, apps, starSettings);
      const { initArg, provider } = getProvider();

      // Star the app first (bookmark favorite id 'cm-app')...
      await provider.bookmarkContentMenuEntry({
        entry: { id: 'cm-app', label: 'App One', itemData: { appId: 'app-1' } },
      });
      // ...then "Add to Dock" from the Storefront (pin refresh).
      await svc.refreshPinnedApps(['app-1']);

      const ids = initArg.config.favorites.map((f: any) => f.id);
      expect(ids).toContain('cm-app');
      expect(ids).not.toContain('pin:app-1'); // suppressed — one app, one button
      expect(menuItem(initArg.config, 'cm-app').bookmarked).toBe(true);
    });

    it('one un-star click removes BOTH the bookmark and the pin for the same app', async () => {
      const apps = [makeApp('app-1', 'App One', 'm.json', 'a.png')];
      const svc = buildStarService({ bookmarks: ['cm-app'], pins: ['app-1'] });
      const unpin = jest.fn().mockResolvedValue(undefined);
      svc.setPinRemovalHandler(unpin);
      await svc.init(platformSettings, apps, starSettings);
      const { initArg, provider } = getProvider();
      // Boot state: bookmark on the bar, pin button suppressed, star filled.
      expect(initArg.config.favorites.map((f: any) => f.id)).not.toContain('pin:app-1');
      expect(menuItem(initArg.config, 'cm-app').bookmarked).toBe(true);

      await provider.bookmarkContentMenuEntry({
        entry: { id: 'cm-app', label: 'App One', itemData: { appId: 'app-1' } },
      });

      expect(initArg.config.favorites.map((f: any) => f.id)).not.toContain('cm-app');
      expect(unpin).toHaveBeenCalledWith('app-1'); // the suppressed pin is removed too
      expect(mockSetPreference).toHaveBeenCalledWith('dock-bookmarks', []);
    });

    it('right-click removal of a pin favorite (save-config) delegates the unpin', async () => {
      const apps = [makeApp('app-1', 'App One', 'm.json', 'a.png')];
      const svc = buildStarService({ pins: ['app-1'] });
      const unpin = jest.fn().mockResolvedValue(undefined);
      svc.setPinRemovalHandler(unpin);
      await svc.init(platformSettings, apps, starSettings);
      const { initArg, provider } = getProvider();

      const saved = {
        ...initArg.config,
        favorites: initArg.config.favorites.filter((f: any) => f.id !== 'pin:app-1'),
      };
      await provider.saveConfig({ config: saved });

      expect(unpin).toHaveBeenCalledWith('app-1');
    });

    it('getBookmarkedAppIds exposes appIds bookmarked onto the bar (pins excluded)', async () => {
      const apps = [makeApp('app-1', 'App One', 'm.json', 'a.png')];
      const svc = buildStarService({ bookmarks: ['cm-app'], pins: [] });
      await svc.init(platformSettings, apps, starSettings);

      expect([...svc.getBookmarkedAppIds()]).toEqual(['app-1']);
    });

    it('removeBookmarksForApp drops the bookmark by appId, hollows the star, persists', async () => {
      const apps = [makeApp('app-1', 'App One', 'm.json', 'a.png')];
      const svc = buildStarService({ bookmarks: ['cm-app'] });
      await svc.init(platformSettings, apps, starSettings);
      const { initArg } = getProvider();
      expect(menuItem(initArg.config, 'cm-app').bookmarked).toBe(true);

      await svc.removeBookmarksForApp('app-1');

      expect(initArg.config.favorites.map((f: any) => f.id)).not.toContain('cm-app');
      expect(menuItem(initArg.config, 'cm-app').bookmarked).toBeUndefined();
      expect(mockUpdateConfig).toHaveBeenCalled(); // live bar/star repaint
      expect(mockSetPreference).toHaveBeenCalledWith('dock-bookmarks', []);
    });

    it('right-click removal of a bookmark favorite clears its star and repaints (UI never clears the flag)', async () => {
      const svc = buildStarService({ bookmarks: ['cm-themes'] });
      await svc.init(platformSettings, [], starSettings);
      const { initArg, provider } = getProvider();
      expect(menuItem(initArg.config, 'cm-themes').bookmarked).toBe(true);

      const saved = {
        ...initArg.config,
        favorites: initArg.config.favorites.filter((f: any) => f.id !== 'cm-themes'),
      };
      await provider.saveConfig({ config: saved });

      expect(menuItem(saved, 'cm-themes').bookmarked).toBeUndefined();
      expect(mockUpdateConfig).toHaveBeenCalledWith(saved); // menu star repaint
      expect(mockSetPreference).toHaveBeenCalledWith('dock-bookmarks', []);
    });
  });
});
