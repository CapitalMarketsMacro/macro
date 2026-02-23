import { firstValueFrom } from 'rxjs';
import { HomeService } from './home.service';
import type { PlatformSettings } from './types';
import type { SettingsService } from './settings.service';
import type { App } from '@openfin/workspace';

// Mock @macro/logger (used by launch.ts dependency)
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
  Home: {
    register: jest.fn(),
    show: jest.fn(),
  },
  CLITemplate: {
    SimpleText: 'SimpleText',
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
import { Home } from '@openfin/workspace';

describe('HomeService', () => {
  let service: HomeService;
  let mockSettingsService: SettingsService;

  const platformSettings: PlatformSettings = {
    id: 'macro-workspace',
    title: 'Macro Workspace',
    icon: 'icon.png',
  };

  const makeApp = (
    appId: string,
    title: string,
    manifestType: string,
    description = '',
    icons?: { src: string }[],
  ): App =>
    ({
      appId,
      title,
      manifestType,
      description,
      icons: icons ?? [],
    }) as unknown as App;

  beforeEach(() => {
    (Home.register as jest.Mock).mockReset();
    (Home.show as jest.Mock).mockReset();

    mockSettingsService = {
      getApps: jest.fn().mockReturnValue([]),
      getManifestSettings: jest.fn(),
      getApps$: jest.fn(),
    } as unknown as SettingsService;

    service = new HomeService(mockSettingsService);
  });

  // ── register ────────────────────────────────────────────────

  describe('register', () => {
    it('should return an observable', () => {
      (Home.register as jest.Mock).mockResolvedValue(undefined);

      const result$ = service.register(platformSettings);
      expect(result$).toBeDefined();
      expect(typeof result$.subscribe).toBe('function');
    });

    it('should call Home.register with a provider that includes platform settings', async () => {
      (Home.register as jest.Mock).mockResolvedValue(undefined);

      await firstValueFrom(service.register(platformSettings));

      expect(Home.register).toHaveBeenCalledTimes(1);
      const provider = (Home.register as jest.Mock).mock.calls[0][0];
      expect(provider.id).toBe('macro-workspace');
      expect(provider.title).toBe('Macro Workspace');
      expect(provider.icon).toBe('icon.png');
    });

    it('should provide onUserInput handler', async () => {
      (Home.register as jest.Mock).mockResolvedValue(undefined);

      await firstValueFrom(service.register(platformSettings));

      const provider = (Home.register as jest.Mock).mock.calls[0][0];
      expect(provider.onUserInput).toBeDefined();
      expect(typeof provider.onUserInput).toBe('function');
    });

    it('should provide onResultDispatch handler', async () => {
      (Home.register as jest.Mock).mockResolvedValue(undefined);

      await firstValueFrom(service.register(platformSettings));

      const provider = (Home.register as jest.Mock).mock.calls[0][0];
      expect(provider.onResultDispatch).toBeDefined();
      expect(typeof provider.onResultDispatch).toBe('function');
    });

    it('should filter apps by query in onUserInput', async () => {
      const apps = [
        makeApp('fx-blotter', 'FX Blotter', 'view', 'FX rates'),
        makeApp('tsy-viewer', 'Treasury Viewer', 'view', 'Treasury'),
      ];
      (mockSettingsService.getApps as jest.Mock).mockReturnValue(apps);
      (Home.register as jest.Mock).mockResolvedValue(undefined);

      await firstValueFrom(service.register(platformSettings));

      const provider = (Home.register as jest.Mock).mock.calls[0][0];
      const mockResponse = { respond: jest.fn() };
      const result = await provider.onUserInput({ query: 'FX' }, mockResponse);

      expect(result.results).toHaveLength(1);
      expect(result.results[0].title).toBe('FX Blotter');
    });

    it('should call response.respond([]) in onUserInput', async () => {
      (Home.register as jest.Mock).mockResolvedValue(undefined);

      await firstValueFrom(service.register(platformSettings));

      const provider = (Home.register as jest.Mock).mock.calls[0][0];
      const mockResponse = { respond: jest.fn() };
      await provider.onUserInput({ query: '' }, mockResponse);

      expect(mockResponse.respond).toHaveBeenCalledWith([]);
    });

    it('should call launchApp on onResultDispatch when data is provided', async () => {
      const { launchApp } = require('./launch');
      (Home.register as jest.Mock).mockResolvedValue(undefined);

      await firstValueFrom(service.register(platformSettings));

      const provider = (Home.register as jest.Mock).mock.calls[0][0];
      const appData = { appId: 'test', title: 'Test' };
      await provider.onResultDispatch({ data: appData });

      expect(launchApp).toHaveBeenCalledWith(appData);
    });

    it('should not call launchApp when data is falsy', async () => {
      const { launchApp } = require('./launch');
      (launchApp as jest.Mock).mockClear();
      (Home.register as jest.Mock).mockResolvedValue(undefined);

      await firstValueFrom(service.register(platformSettings));

      const provider = (Home.register as jest.Mock).mock.calls[0][0];
      await provider.onResultDispatch({ data: null });

      expect(launchApp).not.toHaveBeenCalled();
    });
  });

  // ── show ────────────────────────────────────────────────────

  describe('show', () => {
    it('should call Home.show()', () => {
      (Home.show as jest.Mock).mockResolvedValue(undefined);

      service.show();

      expect(Home.show).toHaveBeenCalledTimes(1);
    });

    it('should return the result of Home.show()', () => {
      const expected = Promise.resolve('shown');
      (Home.show as jest.Mock).mockReturnValue(expected);

      const result = service.show();

      expect(result).toBe(expected);
    });
  });

  // ── mapAppEntriesToSearchEntries ────────────────────────────

  describe('mapAppEntriesToSearchEntries', () => {
    it('should return empty array for empty input', () => {
      const result = service.mapAppEntriesToSearchEntries([]);
      expect(result).toEqual([]);
    });

    it('should return empty array for undefined input', () => {
      const result = service.mapAppEntriesToSearchEntries();
      expect(result).toEqual([]);
    });

    it('should map a view app correctly', () => {
      const apps = [makeApp('app-1', 'FX Blotter', 'view', 'FX trading')];
      const result = service.mapAppEntriesToSearchEntries(apps);

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('app-1');
      expect(result[0].title).toBe('FX Blotter');
      expect(result[0].description).toBe('FX trading');
      expect(result[0].label).toBe('View');
      expect(result[0].template).toBe('SimpleText');
      expect(result[0].templateContent).toBe('FX trading');
      expect(result[0].data).toEqual(apps[0]);
      expect(result[0].actions).toEqual([
        { name: 'Launch View', hotkey: 'enter' },
      ]);
    });

    it('should map a snapshot app correctly', () => {
      const apps = [makeApp('app-1', 'Snapshot', 'snapshot', 'Desk layout')];
      const result = service.mapAppEntriesToSearchEntries(apps);

      expect(result[0].label).toBe('Snapshot');
      expect(result[0].actions).toEqual([
        { name: 'Launch Snapshot', hotkey: 'enter' },
      ]);
    });

    it('should map an external app correctly', () => {
      const apps = [makeApp('app-1', 'Bloomberg', 'external', 'Terminal')];
      const result = service.mapAppEntriesToSearchEntries(apps);

      expect(result[0].label).toBe('Native App');
      expect(result[0].actions).toEqual([
        { name: 'Launch Native App', hotkey: 'enter' },
      ]);
    });

    it('should map an unknown manifest type as generic App', () => {
      const apps = [makeApp('app-1', 'Legacy', 'manifest', 'Old format')];
      const result = service.mapAppEntriesToSearchEntries(apps);

      expect(result[0].label).toBe('App');
      expect(result[0].actions).toEqual([
        { name: 'Launch App', hotkey: 'enter' },
      ]);
    });

    it('should set icon from app.icons[0].src when available', () => {
      const apps = [
        makeApp('app-1', 'App', 'view', '', [{ src: 'app-icon.png' }]),
      ];
      const result = service.mapAppEntriesToSearchEntries(apps);

      expect(result[0].icon).toBe('app-icon.png');
    });

    it('should not set icon when app has empty icons array', () => {
      const apps = [makeApp('app-1', 'App', 'view', '', [])];
      const result = service.mapAppEntriesToSearchEntries(apps);

      expect(result[0].icon).toBeUndefined();
    });

    it('should not set icon when app has no icons property', () => {
      const apps = [
        {
          appId: 'app-1',
          title: 'App',
          manifestType: 'view',
          description: '',
        } as unknown as App,
      ];
      const result = service.mapAppEntriesToSearchEntries(apps);

      expect(result[0].icon).toBeUndefined();
    });

    it('should map multiple apps', () => {
      const apps = [
        makeApp('a1', 'One', 'view'),
        makeApp('a2', 'Two', 'snapshot'),
        makeApp('a3', 'Three', 'external'),
      ];
      const result = service.mapAppEntriesToSearchEntries(apps);

      expect(result).toHaveLength(3);
      expect(result.map((r) => r.label)).toEqual([
        'View',
        'Snapshot',
        'Native App',
      ]);
    });
  });
});
