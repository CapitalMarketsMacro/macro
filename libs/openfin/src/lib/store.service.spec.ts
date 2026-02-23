import { firstValueFrom } from 'rxjs';
import { StoreService } from './store.service';
import type { PlatformSettings } from './types';
import type { SettingsService } from './settings.service';

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

// Mock @openfin/workspace-platform (required by launch.ts)
jest.mock('@openfin/workspace-platform', () => ({
  getCurrentSync: jest.fn(),
  AppManifestType: {
    Snapshot: 'snapshot',
    View: 'view',
    External: 'external',
  },
}));

// Import the mocked module to get references
import { Storefront } from '@openfin/workspace';

describe('StoreService', () => {
  let service: StoreService;
  let mockSettingsService: SettingsService;

  const platformSettings: PlatformSettings = {
    id: 'macro-workspace',
    title: 'Macro Workspace',
    icon: 'icon.png',
  };

  const mockApps = [
    { appId: 'app-1', title: 'App One' },
    { appId: 'app-2', title: 'App Two' },
  ] as any[];

  beforeEach(() => {
    (Storefront.register as jest.Mock).mockReset();
    (Storefront.show as jest.Mock).mockReset();

    mockSettingsService = {
      getApps: jest.fn().mockReturnValue(mockApps),
      getManifestSettings: jest.fn(),
      getApps$: jest.fn(),
    } as unknown as SettingsService;

    service = new StoreService(mockSettingsService);
  });

  // ── register ────────────────────────────────────────────────

  describe('register', () => {
    it('should return an observable', () => {
      (Storefront.register as jest.Mock).mockResolvedValue(undefined);

      const result$ = service.register(platformSettings);
      expect(result$).toBeDefined();
      expect(typeof result$.subscribe).toBe('function');
    });

    it('should call Storefront.register with platform settings', async () => {
      (Storefront.register as jest.Mock).mockResolvedValue(undefined);

      await firstValueFrom(service.register(platformSettings));

      expect(Storefront.register).toHaveBeenCalledTimes(1);
      const provider = (Storefront.register as jest.Mock).mock.calls[0][0];
      expect(provider.id).toBe('macro-workspace');
      expect(provider.title).toBe('Macro Workspace');
      expect(provider.icon).toBe('icon.png');
    });

    it('should provide getNavigation callback', async () => {
      (Storefront.register as jest.Mock).mockResolvedValue(undefined);

      await firstValueFrom(service.register(platformSettings));

      const provider = (Storefront.register as jest.Mock).mock.calls[0][0];
      expect(typeof provider.getNavigation).toBe('function');
    });

    it('should return apps in navigation', async () => {
      (Storefront.register as jest.Mock).mockResolvedValue(undefined);

      await firstValueFrom(service.register(platformSettings));

      const provider = (Storefront.register as jest.Mock).mock.calls[0][0];
      const navigation = await provider.getNavigation();

      expect(navigation).toHaveLength(1);
      expect(navigation[0].id).toBe('apps');
      expect(navigation[0].title).toBe('Apps');
      expect(navigation[0].items[0].id).toBe('all-apps');
      expect(navigation[0].items[0].templateId).toBe('AppGrid');
      expect(navigation[0].items[0].templateData.apps).toEqual(mockApps);
    });

    it('should provide getLandingPage callback with correct structure', async () => {
      (Storefront.register as jest.Mock).mockResolvedValue(undefined);

      await firstValueFrom(service.register(platformSettings));

      const provider = (Storefront.register as jest.Mock).mock.calls[0][0];
      const landing = await provider.getLandingPage();

      expect(landing.topRow.title).toBe('Featured');
      expect(landing.topRow.items).toHaveLength(1);
      expect(landing.topRow.items[0].templateData.apps).toEqual(mockApps);
      expect(landing.topRow.items[0].image.src).toBe('icon.png');
      expect(landing.middleRow).toEqual({ title: '', apps: [] });
      expect(landing.bottomRow).toEqual({ title: '', items: [] });
    });

    it('should provide getFooter callback', async () => {
      (Storefront.register as jest.Mock).mockResolvedValue(undefined);

      await firstValueFrom(service.register(platformSettings));

      const provider = (Storefront.register as jest.Mock).mock.calls[0][0];
      const footer = await provider.getFooter();

      expect(footer.logo.src).toBe('icon.png');
      expect(footer.logo.size).toBe('32');
      expect(footer.text).toBe('Macro Workspace');
      expect(footer.links).toEqual([]);
    });

    it('should provide getApps callback that returns apps', async () => {
      (Storefront.register as jest.Mock).mockResolvedValue(undefined);

      await firstValueFrom(service.register(platformSettings));

      const provider = (Storefront.register as jest.Mock).mock.calls[0][0];
      const apps = await provider.getApps();

      expect(apps).toEqual(mockApps);
    });

    it('should provide launchApp callback', async () => {
      const { launchApp } = require('./launch');
      (Storefront.register as jest.Mock).mockResolvedValue(undefined);

      await firstValueFrom(service.register(platformSettings));

      const provider = (Storefront.register as jest.Mock).mock.calls[0][0];
      const app = { appId: 'test' };
      await provider.launchApp(app);

      expect(launchApp).toHaveBeenCalledWith(app);
    });

    it('should handle empty apps from settings service', async () => {
      (mockSettingsService.getApps as jest.Mock).mockReturnValue([]);
      (Storefront.register as jest.Mock).mockResolvedValue(undefined);

      await firstValueFrom(service.register(platformSettings));

      const provider = (Storefront.register as jest.Mock).mock.calls[0][0];
      const apps = await provider.getApps();

      expect(apps).toEqual([]);
    });

    it('should handle undefined apps from settings service', async () => {
      (mockSettingsService.getApps as jest.Mock).mockReturnValue(undefined);
      (Storefront.register as jest.Mock).mockResolvedValue(undefined);

      await firstValueFrom(service.register(platformSettings));

      const provider = (Storefront.register as jest.Mock).mock.calls[0][0];
      const apps = await provider.getApps();
      const navigation = await provider.getNavigation();

      expect(apps).toEqual([]);
      expect(navigation[0].items[0].templateData.apps).toEqual([]);
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
