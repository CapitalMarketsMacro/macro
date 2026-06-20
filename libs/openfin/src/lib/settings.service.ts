import type { SettingsResponse } from './types';

/**
 * Settings service — loads the platform manifest settings (`settings.json` →
 * `platformSettings`). The app registry, dock, and snap configs now live in their own
 * files/services (AppsService, DockConfigService, SnapConfigService).
 */
export class SettingsService {
  private settings: SettingsResponse | null = null;
  private readonly httpClient: {
    get: <T>(url: string) => Promise<T>;
  };

  constructor(httpClient: { get: <T>(url: string) => Promise<T> }) {
    this.httpClient = httpClient;
  }

  async getManifestSettings(): Promise<SettingsResponse> {
    const settingsPath = this.resolveSettingsPath();
    this.settings = await this.httpClient.get<SettingsResponse>(settingsPath);
    return this.settings;
  }

  /**
   * Resolve the settings.json path based on how the platform was launched
   * (`?env=openshift` -> /openshift/, else /local/).
   */
  private resolveSettingsPath(): string {
    if (typeof window !== 'undefined') {
      const env = new URLSearchParams(window.location.search).get('env');
      if (env === 'openshift') return '/openshift/settings.json';
      if (env === 'local') return '/local/settings.json';
    }
    return '/local/settings.json';
  }
}
