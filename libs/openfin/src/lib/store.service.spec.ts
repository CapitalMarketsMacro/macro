import { firstValueFrom } from 'rxjs';
import { StoreService } from './store.service';
import type { PlatformSettings } from './types';
import type { AppsService } from './apps.service';
import type { FavoritesService } from './favorites.service';
import type { StorefrontConfigService } from './storefront-config.service';
import type { EntitlementsService } from './entitlements.service';
import type { LaunchService } from './launch.service';

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

jest.mock('@openfin/workspace', () => ({
  Storefront: {
    register: jest.fn(),
    show: jest.fn(),
    deregister: jest.fn().mockResolvedValue(undefined),
  },
  StorefrontTemplate: { AppGrid: 'AppGrid', LandingPage: 'landingPage' },
}));

jest.mock('@openfin/workspace-platform', () => ({
  getCurrentSync: jest.fn(),
}));

import { Storefront } from '@openfin/workspace';
import {
  initWorkspaceStorage,
  resetWorkspaceStorageForTests,
} from './storage/storage-context';

describe('StoreService', () => {
  let service: StoreService;
  let mockAppsService: AppsService;
  let mockFavoritesService: FavoritesService;
  let mockStorefrontConfigService: StorefrontConfigService;
  let mockEntitlementsService: EntitlementsService;
  let mockLaunchService: LaunchService;
  let mockStoreRegistration: { updateAppCardButtons: jest.Mock };

  const platformSettings: PlatformSettings = {
    id: 'macro-workspace',
    title: 'Macro Workspace',
    icon: 'icon.png',
  };

  const mockApps = [
    { appId: 'app-1', title: 'App One', category: 'FX' },
    { appId: 'app-2', title: 'App Two', category: 'Rates' },
  ] as any[];

  const navConfig = {
    favoritesTitle: 'Favorites',
    sections: [
      {
        id: 'markets',
        title: 'Markets',
        items: [{ id: 'fx', title: 'FX', category: 'FX' }],
      },
      {
        id: 'library',
        title: 'All Apps',
        items: [{ id: 'all-apps', title: 'All Apps', category: '*' }],
      },
    ],
  };

  /** Build the expected decorated-app shape (favorite button + entitlement tooltip). */
  const decorate = (
    apps: any[],
    opts: {
      favIds?: Set<string>;
      canLaunch?: (id: string) => boolean;
      required?: (id: string) => string[];
    } = {},
  ) => {
    const {
      favIds = new Set<string>(),
      canLaunch = () => true,
      required = () => [],
    } = opts;
    return apps.map((app) => ({
      ...app,
      tooltip: canLaunch(app.appId)
        ? (app.tooltip ?? app.title)
        : `🔒 Requires entitlement: ${required(app.appId).join(', ')}`,
      secondaryButtons: [
        {
          title: favIds.has(app.appId) ? '★ Unfavorite' : '☆ Favorite',
          action: { id: 'toggle-store-favorite' },
        },
      ],
    }));
  };

  beforeEach(() => {
    (Storefront.register as jest.Mock).mockReset();
    (Storefront.show as jest.Mock).mockReset();
    ((Storefront as any).deregister as jest.Mock).mockClear();

    mockStoreRegistration = {
      updateAppCardButtons: jest.fn().mockResolvedValue(undefined),
    };
    (Storefront.register as jest.Mock).mockResolvedValue(mockStoreRegistration);

    mockAppsService = {
      getApps: jest.fn().mockReturnValue(mockApps),
      ensureLoaded: jest.fn().mockResolvedValue(undefined),
    } as unknown as AppsService;

    mockFavoritesService = {
      getFavoriteIds: jest.fn().mockReturnValue(new Set()),
      isFavorite: jest.fn().mockReturnValue(false),
      toggleFavorite: jest.fn(),
    } as unknown as FavoritesService;

    mockStorefrontConfigService = {
      getNavigationConfig: jest.fn().mockResolvedValue(navConfig),
      getLandingPageConfig: jest.fn().mockResolvedValue({
        topRow: { title: 'Featured', category: '*' },
        middleRow: { title: 'Markets', category: 'FX' },
        bottomRow: { title: '', appIds: [] },
      }),
      getFooterConfig: jest.fn().mockResolvedValue({
        text: 'Macro Workspace — Capital Markets',
        links: [{ title: 'Support', url: 'mailto:support@example.com' }],
      }),
      getCardClickBehavior: jest
        .fn()
        .mockResolvedValue('perform-primary-button-action'),
    } as unknown as StorefrontConfigService;

    mockEntitlementsService = {
      ensureLoaded: jest.fn().mockResolvedValue(undefined),
      canLaunch: jest.fn().mockReturnValue(true),
      getRequiredEntitlements: jest.fn().mockReturnValue([]),
    } as unknown as EntitlementsService;

    mockLaunchService = {
      launch: jest.fn().mockResolvedValue(true),
    } as unknown as LaunchService;

    service = new StoreService(
      mockAppsService,
      mockFavoritesService,
      mockStorefrontConfigService,
      mockEntitlementsService,
      mockLaunchService,
    );
  });

  describe('register', () => {
    it('registers with platform settings + config-driven cardClickBehavior', async () => {
      await firstValueFrom(service.register(platformSettings));
      expect(Storefront.register).toHaveBeenCalledTimes(1);
      const provider = (Storefront.register as jest.Mock).mock.calls[0][0];
      expect(provider.id).toBe('macro-workspace');
      expect(provider.icon).toBe('favicon.ico');
      expect(provider.cardClickBehavior).toBe('perform-primary-button-action');
    });

    it('builds navigation from config: configured business-area sections, filtered by category', async () => {
      await firstValueFrom(service.register(platformSettings));
      const provider = (Storefront.register as jest.Mock).mock.calls[0][0];
      const nav = await provider.getNavigation();

      expect(nav.map((s: any) => s.id)).toEqual(['markets', 'library']);
      // FX item only contains FX-category apps
      expect(nav[0].items[0].templateData.apps).toEqual(
        decorate([mockApps[0]]),
      );
      // All Apps (*) contains everything
      expect(nav[1].items[0].templateData.apps).toEqual(decorate(mockApps));
    });

    it('prepends a dynamic Favorites section when favorites exist', async () => {
      (mockFavoritesService.getFavoriteIds as jest.Mock).mockReturnValue(
        new Set(['app-2']),
      );
      (mockFavoritesService.isFavorite as jest.Mock).mockImplementation(
        (id: string) => id === 'app-2',
      );
      await firstValueFrom(service.register(platformSettings));
      const provider = (Storefront.register as jest.Mock).mock.calls[0][0];
      const nav = await provider.getNavigation();

      expect(nav[0].id).toBe('favorites');
      expect(nav[0].title).toBe('Favorites');
      expect(nav[0].items[0].templateData.apps).toEqual(
        decorate([mockApps[1]], { favIds: new Set(['app-2']) }),
      );
    });

    it('caps navigation at the OpenFin max of 3 sections', async () => {
      (mockFavoritesService.getFavoriteIds as jest.Mock).mockReturnValue(
        new Set(['app-1']),
      );
      (
        mockStorefrontConfigService.getNavigationConfig as jest.Mock
      ).mockResolvedValue({
        favoritesTitle: 'Favorites',
        sections: [
          {
            id: 's1',
            title: 'S1',
            items: [{ id: 'i1', title: 'I1', category: '*' }],
          },
          {
            id: 's2',
            title: 'S2',
            items: [{ id: 'i2', title: 'I2', category: '*' }],
          },
          {
            id: 's3',
            title: 'S3',
            items: [{ id: 'i3', title: 'I3', category: '*' }],
          },
        ],
      });
      await firstValueFrom(service.register(platformSettings));
      const provider = (Storefront.register as jest.Mock).mock.calls[0][0];
      const nav = await provider.getNavigation();
      expect(nav.length).toBeLessThanOrEqual(3);
    });

    it('getApps returns decorated apps (favorite button + entitlement tooltip)', async () => {
      await firstValueFrom(service.register(platformSettings));
      const provider = (Storefront.register as jest.Mock).mock.calls[0][0];
      expect(await provider.getApps()).toEqual(decorate(mockApps));
    });

    it('marks non-entitled apps with a locked tooltip (still visible)', async () => {
      (mockEntitlementsService.canLaunch as jest.Mock).mockImplementation(
        (id: string) => id !== 'app-2',
      );
      (
        mockEntitlementsService.getRequiredEntitlements as jest.Mock
      ).mockImplementation((id: string) =>
        id === 'app-2' ? ['rates-trader'] : [],
      );
      await firstValueFrom(service.register(platformSettings));
      const provider = (Storefront.register as jest.Mock).mock.calls[0][0];
      const apps = await provider.getApps();
      expect(apps.find((a: any) => a.appId === 'app-1').tooltip).toBe(
        'App One',
      );
      expect(apps.find((a: any) => a.appId === 'app-2').tooltip).toBe(
        '🔒 Requires entitlement: rates-trader',
      );
    });

    it('routes the storefront launch through the entitlement-gating LaunchService', async () => {
      await firstValueFrom(service.register(platformSettings));
      const provider = (Storefront.register as jest.Mock).mock.calls[0][0];
      const app = { appId: 'app-1', title: 'App One' };
      await provider.launchApp(app);
      expect(mockLaunchService.launch).toHaveBeenCalledWith(app);
    });

    it('builds the footer from config', async () => {
      await firstValueFrom(service.register(platformSettings));
      const provider = (Storefront.register as jest.Mock).mock.calls[0][0];
      const footer = await provider.getFooter();
      expect(footer.text).toBe('Macro Workspace — Capital Markets');
      expect(footer.links).toEqual([
        { title: 'Support', url: 'mailto:support@example.com' },
      ]);
      expect(footer.logo.src).toBe('icon.png'); // falls back to platform icon
    });

    it('builds the landing page rows from config', async () => {
      await firstValueFrom(service.register(platformSettings));
      const provider = (Storefront.register as jest.Mock).mock.calls[0][0];
      const landing = await provider.getLandingPage();
      expect(landing.topRow.title).toBe('Featured');
      expect(landing.middleRow.title).toBe('Markets');
      // middleRow (category FX) -> only app-1
      expect(landing.middleRow.apps).toEqual(decorate([mockApps[0]]));
    });

    it('handles empty/undefined apps from settings', async () => {
      (mockAppsService.getApps as jest.Mock).mockReturnValue(undefined);
      await firstValueFrom(service.register(platformSettings));
      const provider = (Storefront.register as jest.Mock).mock.calls[0][0];
      expect(await provider.getApps()).toEqual([]);
    });
  });

  describe('getStoreCustomActions', () => {
    it('exposes the toggle-store-favorite action', () => {
      const actions = service.getStoreCustomActions();
      expect(typeof actions['toggle-store-favorite']).toBe('function');
    });

    // Stable behavior: toggle persists the favorite + flips the card's own button
    // (updateAppCardButtons). We do NOT re-register the provider on toggle — that
    // corrupts the store's platform connection. So deregister is never called here.
    it.each([
      ['favorite', true, '★ Unfavorite'],
      ['unfavorite', false, '☆ Favorite'],
    ])(
      'toggling to %s persists it and flips the card button — without re-registering',
      async (_label, becomesFav, expectedTitle) => {
        (mockFavoritesService.isFavorite as jest.Mock).mockReturnValue(
          becomesFav,
        );
        await firstValueFrom(service.register(platformSettings));
        (Storefront.register as jest.Mock).mockClear();
        const primaryButton = { title: 'Open', action: { id: 'launch-app' } };

        await service
          .getStoreCustomActions()
          ['toggle-store-favorite']({ appId: 'app-1', primaryButton });

        expect(mockFavoritesService.toggleFavorite).toHaveBeenCalledWith(
          'app-1',
        );
        expect(mockStoreRegistration.updateAppCardButtons).toHaveBeenCalledWith(
          {
            appId: 'app-1',
            primaryButton,
            secondaryButtons: [
              { title: expectedTitle, action: { id: 'toggle-store-favorite' } },
            ],
          },
        );
        // No re-register / deregister — that would destabilize the platform.
        expect((Storefront as any).deregister).not.toHaveBeenCalled();
        expect(Storefront.register).not.toHaveBeenCalled();
      },
    );

    it('does not throw if updateAppCardButtons rejects (non-fatal)', async () => {
      await firstValueFrom(service.register(platformSettings));
      mockStoreRegistration.updateAppCardButtons.mockRejectedValueOnce(
        new Error('boom'),
      );
      await expect(
        service
          .getStoreCustomActions()
          [
            'toggle-store-favorite'
          ]({ appId: 'app-1', primaryButton: undefined as any }),
      ).resolves.toBeUndefined();
      expect(mockFavoritesService.toggleFavorite).toHaveBeenCalledWith('app-1');
    });

    it('records the favorite even before the storefront is registered', async () => {
      await service.getStoreCustomActions()['toggle-store-favorite']({
        appId: 'app-1',
        primaryButton: { title: 'Open', action: { id: 'launch-app' } },
      });
      expect(mockFavoritesService.toggleFavorite).toHaveBeenCalledWith('app-1');
      expect(mockStoreRegistration.updateAppCardButtons).not.toHaveBeenCalled();
    });
  });

  describe('show', () => {
    it('calls Storefront.show()', async () => {
      (Storefront.show as jest.Mock).mockResolvedValue(undefined);
      await service.show();
      expect(Storefront.show).toHaveBeenCalledTimes(1);
    });
  });

  // ── tag-filtered navigation items (Showcase / LOB Apps) ──

  describe('tag-filtered navigation', () => {
    it('matches apps by category OR any item tag (case-insensitive union, no dupes)', async () => {
      const tagApps = [
        { appId: 'a', title: 'A', category: 'Showcase', tags: ['showcase'] },
        { appId: 'b', title: 'B', category: 'FX', tags: ['lob'] }, // LOB app using category
        { appId: 'c', title: 'C', category: 'LOB', tags: ['FX', 'lob'] }, // LOB app using a tag (mixed case)
        { appId: 'd', title: 'D', category: 'Rates' },
      ] as any[];
      (mockAppsService.getApps as jest.Mock).mockReturnValue(tagApps);
      (
        mockStorefrontConfigService.getNavigationConfig as jest.Mock
      ).mockResolvedValue({
        sections: [
          {
            id: 'capital-markets',
            title: 'Capital Markets',
            items: [
              { id: 'fx', title: 'FX', category: 'FX', tags: ['fx'] },
              { id: 'showcase', title: 'Showcase', category: 'Showcase' },
              { id: 'rates', title: 'Rates', tags: ['rates'] },
            ],
          },
        ],
      });

      await firstValueFrom(service.register(platformSettings));
      const provider = (Storefront.register as jest.Mock).mock.calls[0][0];
      const nav = await provider.getNavigation();
      const items = nav[0].items;
      // FX = category match (b) + case-insensitive tag match (c), no duplicates
      expect(items[0].templateData.apps.map((a: any) => a.appId)).toEqual([
        'b',
        'c',
      ]);
      // plain category item unchanged
      expect(items[1].templateData.apps.map((a: any) => a.appId)).toEqual([
        'a',
      ]);
      // tags-only item matches nothing when no app carries the tag
      expect(items[2].templateData.apps.map((a: any) => a.appId)).toEqual([]);
    });
  });

  // ── "Add to Dock" card button (storage + dock3 wired) ──

  describe('dock pin (Add to Dock)', () => {
    let mockStorage: { getPreference: jest.Mock; setPreference: jest.Mock };
    let mockDock3: { refreshPinnedApps: jest.Mock; setPinRemovalHandler: jest.Mock; onDockCompositionChanged: jest.Mock; getBookmarkedAppIds: jest.Mock; removeBookmarksForApp: jest.Mock };
    let lsStore: Record<string, string>;

    beforeEach(() => {
      // Hydration reads via the RAW storage client (throwing path) — back it with a
      // mocked localStorage so the default local client serves the seeded pins.
      lsStore = { 'macro:pref:dock-pinned-apps': JSON.stringify(['app-2']) };
      (globalThis as any).localStorage = {
        getItem: (key: string) => lsStore[key] ?? null,
        setItem: (key: string, value: string) => {
          lsStore[key] = value;
        },
        removeItem: (key: string) => {
          delete lsStore[key];
        },
      };
      resetWorkspaceStorageForTests();
    });
    afterEach(() => {
      delete (globalThis as any).localStorage;
      resetWorkspaceStorageForTests();
    });

    const buildPinnedService = () => {
      mockStorage = {
        getPreference: jest.fn().mockResolvedValue(['app-2']),
        setPreference: jest.fn().mockResolvedValue(undefined),
      };
      mockDock3 = { refreshPinnedApps: jest.fn().mockResolvedValue(undefined), setPinRemovalHandler: jest.fn(), onDockCompositionChanged: jest.fn(), getBookmarkedAppIds: jest.fn().mockReturnValue(new Set()), removeBookmarksForApp: jest.fn().mockResolvedValue(undefined) };
      return new StoreService(
        mockAppsService,
        mockFavoritesService,
        mockStorefrontConfigService,
        mockEntitlementsService,
        mockLaunchService,
        mockStorage as any,
        mockDock3 as any,
      );
    };

    it('decorates cards with BOTH secondary buttons and reflects hydrated pins', async () => {
      const pinned = buildPinnedService();
      await firstValueFrom(pinned.register(platformSettings));
      const provider = (Storefront.register as jest.Mock).mock.calls[0][0];
      const apps = await provider.getApps();

      expect(apps[0].secondaryButtons).toEqual([
        { title: '☆ Favorite', action: { id: 'toggle-store-favorite' } },
        { title: '📌 Add to Dock', action: { id: 'dock-pin-add' } },
      ]);
      expect(apps[1].secondaryButtons[1]).toEqual({
        title: '📌 Remove from Dock',
        action: { id: 'dock-pin-remove' },
      });
    });

    it('dock-pin-add persists first, then refreshes the dock live and flips the button', async () => {
      const pinned = buildPinnedService();
      await firstValueFrom(pinned.register(platformSettings));

      await pinned.getStoreCustomActions()['dock-pin-add']({
        appId: 'app-1',
        primaryButton: { title: 'Launch', action: { id: 'launch-app' } },
      });

      expect(mockStorage.setPreference).toHaveBeenCalledWith(
        'dock-pinned-apps',
        ['app-2', 'app-1'],
      );
      expect(mockDock3.refreshPinnedApps).toHaveBeenCalledWith([
        'app-2',
        'app-1',
      ]);
      expect(mockStoreRegistration.updateAppCardButtons).toHaveBeenCalledWith(
        expect.objectContaining({
          appId: 'app-1',
          secondaryButtons: [
            { title: '☆ Favorite', action: { id: 'toggle-store-favorite' } },
            { title: '📌 Remove from Dock', action: { id: 'dock-pin-remove' } },
          ],
        }),
      );
    });

    it('leaves the dock and buttons unchanged when the pin write fails (writes-throw posture)', async () => {
      const pinned = buildPinnedService();
      await firstValueFrom(pinned.register(platformSettings));
      mockStorage.setPreference.mockRejectedValue(new Error('storage down'));

      await pinned
        .getStoreCustomActions()
        ['dock-pin-add']({ appId: 'app-1' });

      expect(mockDock3.refreshPinnedApps).not.toHaveBeenCalled();
      expect(mockStoreRegistration.updateAppCardButtons).not.toHaveBeenCalled();
    });

    it('dock-pin-remove unpins', async () => {
      const pinned = buildPinnedService();
      await firstValueFrom(pinned.register(platformSettings));

      await pinned
        .getStoreCustomActions()
        ['dock-pin-remove']({ appId: 'app-2' });
      expect(mockStorage.setPreference).toHaveBeenCalledWith(
        'dock-pinned-apps',
        [],
      );
      expect(mockDock3.refreshPinnedApps).toHaveBeenCalledWith([]);
    });

    it('serializes overlapping toggles so both pins compose (no last-write-wins)', async () => {
      const pinned = buildPinnedService();
      await firstValueFrom(pinned.register(platformSettings));
      // Slow first persist: the second toggle must queue behind it and see its result.
      let releaseFirst: () => void = () => undefined;
      mockStorage.setPreference
        .mockImplementationOnce(
          () =>
            new Promise<void>((resolve) => (releaseFirst = () => resolve())),
        )
        .mockResolvedValue(undefined);

      const actions = pinned.getStoreCustomActions();
      const first = actions['dock-pin-add']({ appId: 'app-1' });
      const second = actions['dock-pin-add']({ appId: 'app-3' });
      // Let toggle 1 reach its pending persist (the queue runs on microtasks)
      // before releasing it — a sync release would hit the no-op placeholder.
      await new Promise((resolve) => setTimeout(resolve, 10));
      releaseFirst();
      await Promise.all([first, second]);

      expect(mockStorage.setPreference).toHaveBeenNthCalledWith(
        1,
        'dock-pinned-apps',
        ['app-2', 'app-1'],
      );
      expect(mockStorage.setPreference).toHaveBeenNthCalledWith(
        2,
        'dock-pinned-apps',
        ['app-2', 'app-1', 'app-3'],
      );
    });

    it('registers unpinFromDock with Dock3 and removes the pin when invoked', async () => {
      const pinned = buildPinnedService();
      await firstValueFrom(pinned.register(platformSettings));

      // The constructor handed Dock3 the removal path; drive it like the dock would.
      const handler = mockDock3.setPinRemovalHandler.mock.calls[0][0];
      await handler('app-2');

      expect(mockStorage.setPreference).toHaveBeenCalledWith(
        'dock-pinned-apps',
        [],
      );
      expect(mockDock3.refreshPinnedApps).toHaveBeenCalledWith([]);
    });

    it('unpinFromDock is a no-op for an app that is not pinned', async () => {
      const pinned = buildPinnedService();
      await firstValueFrom(pinned.register(platformSettings));

      await pinned.unpinFromDock('never-pinned');

      expect(mockStorage.setPreference).not.toHaveBeenCalled();
      expect(mockDock3.refreshPinnedApps).not.toHaveBeenCalled();
    });

    it('restores the pin on the bar when the unpin write fails (bar must match the preference)', async () => {
      const pinned = buildPinnedService();
      await firstValueFrom(pinned.register(platformSettings));
      mockStorage.setPreference.mockRejectedValue(new Error('storage down'));

      await pinned.unpinFromDock('app-2');

      // Preference unchanged -> the bar is refreshed BACK to the pinned state.
      expect(mockDock3.refreshPinnedApps).toHaveBeenCalledWith(['app-2']);
    });

    it('a stale card click no-ops and resyncs the buttons instead of inverting', async () => {
      const pinned = buildPinnedService();
      await firstValueFrom(pinned.register(platformSettings));
      // Dock-side unpin happened; the open card still shows "Remove from Dock".
      await pinned.unpinFromDock('app-2');
      mockStorage.setPreference.mockClear();
      mockDock3.refreshPinnedApps.mockClear();

      await pinned
        .getStoreCustomActions()
        ['dock-pin-remove']({ appId: 'app-2' });

      // Intent already satisfied: nothing written, nothing re-pinned — only a card resync.
      expect(mockStorage.setPreference).not.toHaveBeenCalled();
      expect(mockDock3.refreshPinnedApps).not.toHaveBeenCalled();
      expect(mockStoreRegistration.updateAppCardButtons).toHaveBeenCalledWith(
        expect.objectContaining({ appId: 'app-2' }),
      );
    });

    it('shows "Remove from Dock" for an app on the dock via a star bookmark (no pin)', async () => {
      const pinned = buildPinnedService();
      mockDock3.getBookmarkedAppIds.mockReturnValue(new Set(['app-1']));
      await firstValueFrom(pinned.register(platformSettings));
      const provider = (Storefront.register as jest.Mock).mock.calls[0][0];
      const apps = await provider.getApps();

      // app-1 is bookmark-covered -> card reflects the unified on-dock state.
      expect(apps[0].secondaryButtons[1]).toEqual({
        title: '📌 Remove from Dock',
        action: { id: 'dock-pin-remove' },
      });
    });

    it('"Remove from Dock" on a bookmark-only app removes the bookmark, not a pin', async () => {
      const pinned = buildPinnedService();
      mockDock3.getBookmarkedAppIds.mockReturnValue(new Set(['app-1']));
      await firstValueFrom(pinned.register(platformSettings));

      await pinned
        .getStoreCustomActions()
        ['dock-pin-remove']({ appId: 'app-1' });

      expect(mockDock3.removeBookmarksForApp).toHaveBeenCalledWith('app-1');
      expect(mockStorage.setPreference).not.toHaveBeenCalled(); // no pin existed
      expect(mockStoreRegistration.updateAppCardButtons).toHaveBeenCalled();
    });

    it('"Add to Dock" on a bookmark-covered app no-ops (already on the dock) and resyncs the card', async () => {
      const pinned = buildPinnedService();
      mockDock3.getBookmarkedAppIds.mockReturnValue(new Set(['app-1']));
      await firstValueFrom(pinned.register(platformSettings));

      await pinned.getStoreCustomActions()['dock-pin-add']({ appId: 'app-1' });

      expect(mockStorage.setPreference).not.toHaveBeenCalled();
      expect(mockDock3.refreshPinnedApps).not.toHaveBeenCalled();
      expect(mockStoreRegistration.updateAppCardButtons).toHaveBeenCalledWith(
        expect.objectContaining({ appId: 'app-1' }),
      );
    });

    it('"Remove from Dock" removes BOTH when the app is bookmarked AND pinned', async () => {
      const pinned = buildPinnedService();
      mockDock3.getBookmarkedAppIds.mockReturnValue(new Set(['app-2']));
      await firstValueFrom(pinned.register(platformSettings));

      await pinned
        .getStoreCustomActions()
        ['dock-pin-remove']({ appId: 'app-2' });

      expect(mockDock3.removeBookmarksForApp).toHaveBeenCalledWith('app-2');
      expect(mockStorage.setPreference).toHaveBeenCalledWith(
        'dock-pinned-apps',
        [],
      );
      expect(mockDock3.refreshPinnedApps).toHaveBeenCalledWith([]);
    });

    it('dock-side changes live-resync cards whose primaryButton was captured from a click', async () => {
      const pinned = buildPinnedService();
      await firstValueFrom(pinned.register(platformSettings));
      const primaryButton = { title: 'Launch', action: { id: 'launch-app' } };

      // The user clicked this card once — its primaryButton is now known.
      await pinned
        .getStoreCustomActions()
        ['dock-pin-add']({ appId: 'app-1', primaryButton });
      mockStoreRegistration.updateAppCardButtons.mockClear();

      // Dock-side change (e.g. un-star): Dock3 fires the composition listener.
      (mockStorage.setPreference as jest.Mock).mockClear();
      const listener = mockDock3.onDockCompositionChanged.mock.calls[0][0];
      listener();
      await new Promise((r) => setTimeout(r, 0)); // resync is fire-and-forget

      expect(mockStoreRegistration.updateAppCardButtons).toHaveBeenCalledWith(
        expect.objectContaining({ appId: 'app-1', primaryButton }),
      );
    });

    it('refuses toggles while pins are unhydrated (REST outage) so stored pins are never wiped', async () => {
      // Simulate a REST backend that is down: hydration throws, pinsHydrated stays false.
      const origFetch = globalThis.fetch;
      (globalThis as { fetch: unknown }).fetch = jest
        .fn()
        .mockRejectedValue(new Error('storage down'));
      initWorkspaceStorage(
        {
          defaultEnvironment: 'dev',
          environments: {
            dev: { mode: 'rest', baseUrl: 'http://storage.test/workspace/v1' },
          },
        },
        { search: '' },
      );
      try {
        const pinned = buildPinnedService();
        await firstValueFrom(pinned.register(platformSettings));

        await pinned
          .getStoreCustomActions()
          ['dock-pin-add']({ appId: 'app-1' });

        expect(mockStorage.setPreference).not.toHaveBeenCalled();
        expect(mockDock3.refreshPinnedApps).not.toHaveBeenCalled();
      } finally {
        (globalThis as { fetch: unknown }).fetch = origFetch;
      }
    });
  });
});
