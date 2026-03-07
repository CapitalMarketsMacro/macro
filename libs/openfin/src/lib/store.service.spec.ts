import { firstValueFrom } from 'rxjs';
import { StoreService } from './store.service';
import type { PlatformSettings } from './types';
import type { SettingsService } from './settings.service';
import type { FavoritesService } from './favorites.service';

// Mock @macro/logger (required by launch.ts)
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

// Mock launch
jest.mock('./launch', () => ({
  launchApp: jest.fn().mockResolvedValue(undefined),
}));

// Mock @openfin/workspace -- inline jest.fn() in factory to avoid TDZ
jest.mock('@openfin/workspace', () => ({
  Storefront: {
    register: jest.fn(),
    show: jest.fn(),
  },
  StorefrontTemplate: {
    AppGrid: 'AppGrid',
  },
}));

// Mock @openfin/workspace-platform (required by launch.ts + store custom actions)
jest.mock('@openfin/workspace-platform', () => ({
  getCurrentSync: jest.fn(),
  AppManifestType: {
    Snapshot: 'snapshot',
    View: 'view',
    External: 'external',
  },
  CustomActionCallerType: {
    StoreCustomButton: 'StoreCustomButton',
  },
}));

// Import the mocked module to get references
import { Storefront } from '@openfin/workspace';

describe('StoreService', () => {
  let service: StoreService;
  let mockSettingsService: SettingsService;
  let mockFavoritesService: FavoritesService;
  let mockStoreRegistration: { updateAppCardButtons: jest.Mock };

  const platformSettings: PlatformSettings = {
    id: 'macro-workspace',
    title: 'Macro Workspace',
    icon: 'icon.png',
  };

  const mockApps = [
    { appId: 'app-1', title: 'App One' },
    { appId: 'app-2', title: 'App Two' },
  ] as any[];

  const favoriteButton = (title = '☆ Favorite') => ({
    title,
    action: { id: 'toggle-store-favorite' },
  });

  const withSecondaryButtons = (apps: any[], favIds = new Set<string>()) =>
    apps.map((app: any) => ({
      ...app,
      secondaryButtons: [
        favoriteButton(favIds.has(app.appId) ? '★ Unfavorite' : '☆ Favorite'),
      ],
    }));

  beforeEach(() => {
    (Storefront.register as jest.Mock).mockReset();
    (Storefront.show as jest.Mock).mockReset();

    mockStoreRegistration = {
      updateAppCardButtons: jest.fn().mockResolvedValue(undefined),
    };
    (Storefront.register as jest.Mock).mockResolvedValue(
      mockStoreRegistration
    );

    mockSettingsService = {
      getApps: jest.fn().mockReturnValue(mockApps),
      getManifestSettings: jest.fn(),
      getApps$: jest.fn(),
    } as unknown as SettingsService;

    mockFavoritesService = {
      getFavoriteIds: jest.fn().mockReturnValue(new Set()),
      getFavoriteIds$: jest.fn(),
      isFavorite: jest.fn().mockReturnValue(false),
      toggleFavorite: jest.fn(),
    } as unknown as FavoritesService;

    service = new StoreService(mockSettingsService, mockFavoritesService);
  });

  // ── register ────────────────────────────────────────────────

  describe('register', () => {
    it('should return an observable', () => {
      const result$ = service.register(platformSettings);
      expect(result$).toBeDefined();
      expect(typeof result$.subscribe).toBe('function');
    });

    it('should call Storefront.register with platform settings', async () => {
      await firstValueFrom(service.register(platformSettings));

      expect(Storefront.register).toHaveBeenCalledTimes(1);
      const provider = (Storefront.register as jest.Mock).mock.calls[0][0];
      expect(provider.id).toBe('macro-workspace');
      expect(provider.title).toBe('Macro Workspace');
      expect(provider.icon).toBe('icon.png');
    });

    it('should provide getNavigation callback', async () => {
      await firstValueFrom(service.register(platformSettings));

      const provider = (Storefront.register as jest.Mock).mock.calls[0][0];
      expect(typeof provider.getNavigation).toBe('function');
    });

    it('should return only Apps section when no favorites', async () => {
      await firstValueFrom(service.register(platformSettings));

      const provider = (Storefront.register as jest.Mock).mock.calls[0][0];
      const navigation = await provider.getNavigation();

      expect(navigation).toHaveLength(1);
      expect(navigation[0].id).toBe('apps');
      expect(navigation[0].title).toBe('Apps');
      expect(navigation[0].items[0].id).toBe('all-apps');
      expect(navigation[0].items[0].templateId).toBe('AppGrid');
      expect(navigation[0].items[0].templateData.apps).toEqual(
        withSecondaryButtons(mockApps)
      );
    });

    it('should include Favorites section when favorites exist', async () => {
      (mockFavoritesService.getFavoriteIds as jest.Mock).mockReturnValue(
        new Set(['app-1'])
      );

      await firstValueFrom(service.register(platformSettings));

      const provider = (Storefront.register as jest.Mock).mock.calls[0][0];
      const navigation = await provider.getNavigation();

      expect(navigation).toHaveLength(2);
      expect(navigation[0].id).toBe('favorites');
      expect(navigation[0].title).toBe('Favorites');
      expect(navigation[0].items[0].templateData.apps).toEqual(
        withSecondaryButtons([mockApps[0]])
      );
      expect(navigation[1].id).toBe('apps');
    });

    it('should filter favorite apps correctly by appId', async () => {
      (mockFavoritesService.getFavoriteIds as jest.Mock).mockReturnValue(
        new Set(['app-2'])
      );

      await firstValueFrom(service.register(platformSettings));

      const provider = (Storefront.register as jest.Mock).mock.calls[0][0];
      const navigation = await provider.getNavigation();

      expect(navigation[0].id).toBe('favorites');
      expect(navigation[0].items[0].templateData.apps).toEqual(
        withSecondaryButtons([mockApps[1]])
      );
    });

    it('should not include Favorites section when favorited appId is not in apps list', async () => {
      (mockFavoritesService.getFavoriteIds as jest.Mock).mockReturnValue(
        new Set(['non-existent-app'])
      );

      await firstValueFrom(service.register(platformSettings));

      const provider = (Storefront.register as jest.Mock).mock.calls[0][0];
      const navigation = await provider.getNavigation();

      expect(navigation).toHaveLength(1);
      expect(navigation[0].id).toBe('apps');
    });

    it('should provide getLandingPage callback with correct structure', async () => {
      await firstValueFrom(service.register(platformSettings));

      const provider = (Storefront.register as jest.Mock).mock.calls[0][0];
      const landing = await provider.getLandingPage();

      expect(landing.topRow.title).toBe('Featured');
      expect(landing.topRow.items).toHaveLength(1);
      expect(landing.topRow.items[0].templateData.apps).toEqual(
        withSecondaryButtons(mockApps)
      );
      expect(landing.topRow.items[0].image.src).toBe('icon.png');
      expect(landing.middleRow).toEqual({ title: '', apps: [] });
      expect(landing.bottomRow).toEqual({ title: '', items: [] });
    });

    it('should provide getFooter callback', async () => {
      await firstValueFrom(service.register(platformSettings));

      const provider = (Storefront.register as jest.Mock).mock.calls[0][0];
      const footer = await provider.getFooter();

      expect(footer.logo.src).toBe('icon.png');
      expect(footer.logo.size).toBe('32');
      expect(footer.text).toBe('Macro Workspace');
      expect(footer.links).toEqual([]);
    });

    it('should provide getApps callback that returns decorated apps', async () => {
      await firstValueFrom(service.register(platformSettings));

      const provider = (Storefront.register as jest.Mock).mock.calls[0][0];
      const apps = await provider.getApps();

      expect(apps).toEqual(withSecondaryButtons(mockApps));
    });

    it('should decorate apps with secondaryButtons', async () => {
      await firstValueFrom(service.register(platformSettings));

      const provider = (Storefront.register as jest.Mock).mock.calls[0][0];
      const apps = await provider.getApps();

      for (const app of apps) {
        expect(app.secondaryButtons).toEqual([
          {
            title: '☆ Favorite',
            action: { id: 'toggle-store-favorite' },
          },
        ]);
      }
    });

    it('should show ★ Unfavorite button for favorited apps', async () => {
      (mockFavoritesService.isFavorite as jest.Mock).mockImplementation(
        (id: string) => id === 'app-1'
      );

      await firstValueFrom(service.register(platformSettings));

      const provider = (Storefront.register as jest.Mock).mock.calls[0][0];
      const apps = await provider.getApps();

      expect(apps[0].secondaryButtons[0].title).toBe('★ Unfavorite');
      expect(apps[1].secondaryButtons[0].title).toBe('☆ Favorite');
    });

    it('should capture StoreRegistration from Storefront.register', async () => {
      await firstValueFrom(service.register(platformSettings));

      // Verify by calling the toggle action — it should use the captured registration
      const actions = service.getStoreCustomActions();
      await actions['toggle-store-favorite']({
        appId: 'app-1',
        primaryButton: { title: 'Open', action: { id: 'launch-app' } },
      });

      expect(mockStoreRegistration.updateAppCardButtons).toHaveBeenCalled();
    });

    it('should provide launchApp callback', async () => {
      const { launchApp } = require('./launch');

      await firstValueFrom(service.register(platformSettings));

      const provider = (Storefront.register as jest.Mock).mock.calls[0][0];
      const app = { appId: 'test' };
      await provider.launchApp(app);

      expect(launchApp).toHaveBeenCalledWith(app);
    });

    it('should handle empty apps from settings service', async () => {
      (mockSettingsService.getApps as jest.Mock).mockReturnValue([]);

      await firstValueFrom(service.register(platformSettings));

      const provider = (Storefront.register as jest.Mock).mock.calls[0][0];
      const apps = await provider.getApps();

      expect(apps).toEqual([]);
    });

    it('should handle undefined apps from settings service', async () => {
      (mockSettingsService.getApps as jest.Mock).mockReturnValue(undefined);

      await firstValueFrom(service.register(platformSettings));

      const provider = (Storefront.register as jest.Mock).mock.calls[0][0];
      const apps = await provider.getApps();
      const navigation = await provider.getNavigation();

      expect(apps).toEqual([]);
      // Last section is always Apps
      const appsSection = navigation[navigation.length - 1];
      expect(appsSection.items[0].templateData.apps).toEqual([]);
    });
  });

  // ── getStoreCustomActions ─────────────────────────────────────

  describe('getStoreCustomActions', () => {
    it('should return a map with toggle-store-favorite action', () => {
      const actions = service.getStoreCustomActions();
      expect(actions).toHaveProperty('toggle-store-favorite');
      expect(typeof actions['toggle-store-favorite']).toBe('function');
    });

    it('should call toggleFavorite when action is invoked', async () => {
      const actions = service.getStoreCustomActions();
      await actions['toggle-store-favorite']({
        appId: 'app-1',
        primaryButton: { title: 'Open', action: { id: 'launch-app' } },
      });

      expect(mockFavoritesService.toggleFavorite).toHaveBeenCalledWith(
        'app-1'
      );
    });

    it('should check isFavorite after toggling', async () => {
      const actions = service.getStoreCustomActions();
      await actions['toggle-store-favorite']({
        appId: 'app-1',
        primaryButton: { title: 'Open', action: { id: 'launch-app' } },
      });

      expect(mockFavoritesService.isFavorite).toHaveBeenCalledWith('app-1');
    });

    it('should not call updateAppCardButtons when storeRegistration is null', async () => {
      // Service has not called register(), so storeRegistration is null
      const actions = service.getStoreCustomActions();
      await actions['toggle-store-favorite']({
        appId: 'app-1',
        primaryButton: { title: 'Open', action: { id: 'launch-app' } },
      });

      expect(
        mockStoreRegistration.updateAppCardButtons
      ).not.toHaveBeenCalled();
    });

    it('should call updateAppCardButtons with ★ Unfavorite when newly favorited', async () => {
      // First register to capture storeRegistration
      await firstValueFrom(service.register(platformSettings));

      (mockFavoritesService.isFavorite as jest.Mock).mockReturnValue(true);

      const actions = service.getStoreCustomActions();
      const primaryButton = { title: 'Open', action: { id: 'launch-app' } };
      await actions['toggle-store-favorite']({
        appId: 'app-1',
        primaryButton,
      });

      expect(
        mockStoreRegistration.updateAppCardButtons
      ).toHaveBeenCalledWith({
        appId: 'app-1',
        primaryButton,
        secondaryButtons: [
          {
            title: '★ Unfavorite',
            action: { id: 'toggle-store-favorite' },
          },
        ],
      });
    });

    it('should call updateAppCardButtons with ☆ Favorite when unfavorited', async () => {
      await firstValueFrom(service.register(platformSettings));

      (mockFavoritesService.isFavorite as jest.Mock).mockReturnValue(false);

      const actions = service.getStoreCustomActions();
      const primaryButton = { title: 'Open', action: { id: 'launch-app' } };
      await actions['toggle-store-favorite']({
        appId: 'app-2',
        primaryButton,
      });

      expect(
        mockStoreRegistration.updateAppCardButtons
      ).toHaveBeenCalledWith({
        appId: 'app-2',
        primaryButton,
        secondaryButtons: [
          {
            title: '☆ Favorite',
            action: { id: 'toggle-store-favorite' },
          },
        ],
      });
    });
  });

  // ── show ────────────────────────────────────────────────────

  describe('show', () => {
    it('should call Storefront.show()', () => {
      (Storefront.show as jest.Mock).mockResolvedValue(undefined);

      service.show();

      expect(Storefront.show).toHaveBeenCalledTimes(1);
    });

    it('should return the result of Storefront.show()', () => {
      const expected = Promise.resolve('shown');
      (Storefront.show as jest.Mock).mockReturnValue(expected);

      const result = service.show();

      expect(result).toBe(expected);
    });
  });
});
