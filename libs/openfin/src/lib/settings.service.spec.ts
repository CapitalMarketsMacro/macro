import { firstValueFrom, take, toArray } from 'rxjs';
import { SettingsService } from './settings.service';
import type { SettingsResponse } from './types';

describe('SettingsService', () => {
  const makeMockHttp = (response?: SettingsResponse, error?: Error) => ({
    get: jest.fn().mockImplementation(() =>
      error ? Promise.reject(error) : Promise.resolve(response),
    ),
  });

  const defaultResponse: SettingsResponse = {
    platformSettings: { id: 'macro-workspace', title: 'Macro Workspace', icon: 'icon.png' },
    customSettings: {
      apps: [
        { appId: 'app-1', title: 'App One' } as any,
        { appId: 'app-2', title: 'App Two' } as any,
      ],
    },
  };

  // ── constructor ─────────────────────────────────────────────

  it('should create an instance', () => {
    const service = new SettingsService(makeMockHttp(defaultResponse));
    expect(service).toBeDefined();
  });

  // ── getApps (initial state) ─────────────────────────────────

  it('should return empty array initially from getApps()', () => {
    const service = new SettingsService(makeMockHttp(defaultResponse));
    expect(service.getApps()).toEqual([]);
  });

  // ── getManifestSettings ─────────────────────────────────────

  describe('getManifestSettings', () => {
    it('should fetch settings from /settings.json', async () => {
      const http = makeMockHttp(defaultResponse);
      const service = new SettingsService(http);

      await service.getManifestSettings();

      expect(http.get).toHaveBeenCalledWith('/settings.json');
    });

    it('should return the full response from the HTTP client', async () => {
      const service = new SettingsService(makeMockHttp(defaultResponse));

      const result = await service.getManifestSettings();

      expect(result).toEqual(defaultResponse);
    });

    it('should store apps from the response', async () => {
      const service = new SettingsService(makeMockHttp(defaultResponse));

      await service.getManifestSettings();

      expect(service.getApps()).toEqual(defaultResponse.customSettings.apps);
    });

    it('should store empty array when customSettings.apps is undefined', async () => {
      const noAppsResponse: SettingsResponse = {
        platformSettings: { id: 'macro-workspace', title: 'Macro Workspace', icon: '' },
        customSettings: {},
      };
      const service = new SettingsService(makeMockHttp(noAppsResponse));

      await service.getManifestSettings();

      expect(service.getApps()).toEqual([]);
    });

    it('should reject when the HTTP client throws', async () => {
      const service = new SettingsService(
        makeMockHttp(undefined, new Error('Network error')),
      );

      await expect(service.getManifestSettings()).rejects.toThrow('Network error');
    });
  });

  // ── getApps ─────────────────────────────────────────────────

  describe('getApps', () => {
    it('should return apps after getManifestSettings is called', async () => {
      const service = new SettingsService(makeMockHttp(defaultResponse));

      await service.getManifestSettings();
      const apps = service.getApps();

      expect(apps).toHaveLength(2);
      expect(apps[0]).toEqual({ appId: 'app-1', title: 'App One' });
    });
  });

  // ── getApps$ ────────────────────────────────────────────────

  describe('getApps$', () => {
    it('should emit empty array initially', async () => {
      const service = new SettingsService(makeMockHttp(defaultResponse));

      const first = await firstValueFrom(service.getApps$());

      expect(first).toEqual([]);
    });

    it('should emit apps after getManifestSettings resolves', async () => {
      const service = new SettingsService(makeMockHttp(defaultResponse));

      // Collect the first 2 emissions: initial [] then populated array
      const emissions$ = service.getApps$().pipe(take(2), toArray());
      const emissionsPromise = firstValueFrom(emissions$);

      await service.getManifestSettings();
      const emissions = await emissionsPromise;

      expect(emissions).toHaveLength(2);
      expect(emissions[0]).toEqual([]);
      expect(emissions[1]).toEqual(defaultResponse.customSettings.apps);
    });
  });
});
