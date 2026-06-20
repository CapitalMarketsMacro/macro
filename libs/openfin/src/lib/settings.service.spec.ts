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
  };

  it('should create an instance', () => {
    expect(new SettingsService(makeMockHttp(defaultResponse))).toBeDefined();
  });

  describe('getManifestSettings', () => {
    it('fetches /local/settings.json by default', async () => {
      const http = makeMockHttp(defaultResponse);
      await new SettingsService(http).getManifestSettings();
      expect(http.get).toHaveBeenCalledWith('/local/settings.json');
    });

    it('returns the platform settings response', async () => {
      const result = await new SettingsService(makeMockHttp(defaultResponse)).getManifestSettings();
      expect(result.platformSettings).toEqual(defaultResponse.platformSettings);
    });

    it('rejects when the HTTP client throws', async () => {
      const service = new SettingsService(makeMockHttp(undefined, new Error('Network error')));
      await expect(service.getManifestSettings()).rejects.toThrow('Network error');
    });
  });
});
