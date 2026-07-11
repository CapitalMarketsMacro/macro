import { resolveEnvConfigPath } from './config-path';
import type { SettingsResponse } from './types';

/**
 * Settings service — loads the platform manifest settings (`settings.json` →
 * `platformSettings` + `browserSettings` + `storage`). The app registry, dock, and
 * snap configs live in their own files/services (AppsService, DockConfigService,
 * SnapConfigService). settings.json is bootstrap config: it always loads from the
 * static per-env folder (`?env=` → /local/ or /openshift/), never from the storage
 * API — it is the file that DEFINES the storage environments.
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
    if (!this.settings) {
      this.settings = await this.httpClient.get<SettingsResponse>(resolveEnvConfigPath('settings.json'));
    }
    return this.settings;
  }
}
