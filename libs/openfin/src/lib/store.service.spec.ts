import { firstValueFrom } from 'rxjs';
import { StoreService } from './store.service';
import type { PlatformSettings } from './types';
import type { AppsService } from './apps.service';
import type { FavoritesService } from './favorites.service';
import type { StorefrontConfigService } from './storefront-config.service';
import type { EntitlementsService } from './entitlements.service';
import type { LaunchService } from './launch.service';

jest.mock('@macro/logger', () => ({
  Logger: { getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }) },
}));

jest.mock('@openfin/workspace', () => ({
  Storefront: { register: jest.fn(), show: jest.fn(), deregister: jest.fn().mockResolvedValue(undefined) },
  StorefrontTemplate: { AppGrid: 'AppGrid', LandingPage: 'landingPage' },
}));

jest.mock('@openfin/workspace-platform', () => ({
  getCurrentSync: jest.fn(),
}));

import { Storefront } from '@openfin/workspace';

describe('StoreService', () => {
  let service: StoreService;
  let mockAppsService: AppsService;
  let mockFavoritesService: FavoritesService;
  let mockStorefrontConfigService: StorefrontConfigService;
  let mockEntitlementsService: EntitlementsService;
  let mockLaunchService: LaunchService;
  let mockStoreRegistration: { updateAppCardButtons: jest.Mock };

  const platformSettings: PlatformSettings = { id: 'macro-workspace', title: 'Macro Workspace', icon: 'icon.png' };

  const mockApps = [
    { appId: 'app-1', title: 'App One', category: 'FX' },
    { appId: 'app-2', title: 'App Two', category: 'Rates' },
  ] as any[];

  const navConfig = {
    favoritesTitle: 'Favorites',
    sections: [
      { id: 'markets', title: 'Markets', items: [{ id: 'fx', title: 'FX', category: 'FX' }] },
      { id: 'library', title: 'All Apps', items: [{ id: 'all-apps', title: 'All Apps', category: '*' }] },
    ],
  };

  /** Build the expected decorated-app shape (favorite button + entitlement tooltip). */
  const decorate = (
    apps: any[],
    opts: { favIds?: Set<string>; canLaunch?: (id: string) => boolean; required?: (id: string) => string[] } = {},
  ) => {
    const { favIds = new Set<string>(), canLaunch = () => true, required = () => [] } = opts;
    return apps.map((app) => ({
      ...app,
      tooltip: canLaunch(app.appId) ? (app.tooltip ?? app.title) : `🔒 Requires entitlement: ${required(app.appId).join(', ')}`,
      secondaryButtons: [
        { title: favIds.has(app.appId) ? '★ Unfavorite' : '☆ Favorite', action: { id: 'toggle-store-favorite' } },
      ],
    }));
  };

  beforeEach(() => {
    (Storefront.register as jest.Mock).mockReset();
    (Storefront.show as jest.Mock).mockReset();
    ((Storefront as any).deregister as jest.Mock).mockClear();

    mockStoreRegistration = { updateAppCardButtons: jest.fn().mockResolvedValue(undefined) };
    (Storefront.register as jest.Mock).mockResolvedValue(mockStoreRegistration);

    mockAppsService = { getApps: jest.fn().mockReturnValue(mockApps), ensureLoaded: jest.fn().mockResolvedValue(undefined) } as unknown as AppsService;

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
      getCardClickBehavior: jest.fn().mockResolvedValue('perform-primary-button-action'),
    } as unknown as StorefrontConfigService;

    mockEntitlementsService = {
      ensureLoaded: jest.fn().mockResolvedValue(undefined),
      canLaunch: jest.fn().mockReturnValue(true),
      getRequiredEntitlements: jest.fn().mockReturnValue([]),
    } as unknown as EntitlementsService;

    mockLaunchService = { launch: jest.fn().mockResolvedValue(true) } as unknown as LaunchService;

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
      expect(nav[0].items[0].templateData.apps).toEqual(decorate([mockApps[0]]));
      // All Apps (*) contains everything
      expect(nav[1].items[0].templateData.apps).toEqual(decorate(mockApps));
    });

    it('prepends a dynamic Favorites section when favorites exist', async () => {
      (mockFavoritesService.getFavoriteIds as jest.Mock).mockReturnValue(new Set(['app-2']));
      (mockFavoritesService.isFavorite as jest.Mock).mockImplementation((id: string) => id === 'app-2');
      await firstValueFrom(service.register(platformSettings));
      const provider = (Storefront.register as jest.Mock).mock.calls[0][0];
      const nav = await provider.getNavigation();

      expect(nav[0].id).toBe('favorites');
      expect(nav[0].title).toBe('Favorites');
      expect(nav[0].items[0].templateData.apps).toEqual(decorate([mockApps[1]], { favIds: new Set(['app-2']) }));
    });

    it('caps navigation at the OpenFin max of 3 sections', async () => {
      (mockFavoritesService.getFavoriteIds as jest.Mock).mockReturnValue(new Set(['app-1']));
      (mockStorefrontConfigService.getNavigationConfig as jest.Mock).mockResolvedValue({
        favoritesTitle: 'Favorites',
        sections: [
          { id: 's1', title: 'S1', items: [{ id: 'i1', title: 'I1', category: '*' }] },
          { id: 's2', title: 'S2', items: [{ id: 'i2', title: 'I2', category: '*' }] },
          { id: 's3', title: 'S3', items: [{ id: 'i3', title: 'I3', category: '*' }] },
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
      (mockEntitlementsService.canLaunch as jest.Mock).mockImplementation((id: string) => id !== 'app-2');
      (mockEntitlementsService.getRequiredEntitlements as jest.Mock).mockImplementation((id: string) =>
        id === 'app-2' ? ['rates-trader'] : [],
      );
      await firstValueFrom(service.register(platformSettings));
      const provider = (Storefront.register as jest.Mock).mock.calls[0][0];
      const apps = await provider.getApps();
      expect(apps.find((a: any) => a.appId === 'app-1').tooltip).toBe('App One');
      expect(apps.find((a: any) => a.appId === 'app-2').tooltip).toBe('🔒 Requires entitlement: rates-trader');
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
      expect(footer.links).toEqual([{ title: 'Support', url: 'mailto:support@example.com' }]);
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
    ])('toggling to %s persists it and flips the card button — without re-registering', async (_label, becomesFav, expectedTitle) => {
      (mockFavoritesService.isFavorite as jest.Mock).mockReturnValue(becomesFav);
      await firstValueFrom(service.register(platformSettings));
      (Storefront.register as jest.Mock).mockClear();
      const primaryButton = { title: 'Open', action: { id: 'launch-app' } };

      await service.getStoreCustomActions()['toggle-store-favorite']({ appId: 'app-1', primaryButton });

      expect(mockFavoritesService.toggleFavorite).toHaveBeenCalledWith('app-1');
      expect(mockStoreRegistration.updateAppCardButtons).toHaveBeenCalledWith({
        appId: 'app-1',
        primaryButton,
        secondaryButtons: [{ title: expectedTitle, action: { id: 'toggle-store-favorite' } }],
      });
      // No re-register / deregister — that would destabilize the platform.
      expect((Storefront as any).deregister).not.toHaveBeenCalled();
      expect(Storefront.register).not.toHaveBeenCalled();
    });

    it('does not throw if updateAppCardButtons rejects (non-fatal)', async () => {
      await firstValueFrom(service.register(platformSettings));
      mockStoreRegistration.updateAppCardButtons.mockRejectedValueOnce(new Error('boom'));
      await expect(
        service.getStoreCustomActions()['toggle-store-favorite']({ appId: 'app-1', primaryButton: undefined as any }),
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
});
