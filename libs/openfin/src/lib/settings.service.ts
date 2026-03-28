import type { App } from '@openfin/workspace';
import { BehaviorSubject } from 'rxjs';
import type { SettingsResponse } from './types';

/**
 * Settings service for managing platform settings and apps
 * Framework-agnostic implementation
 */
export class SettingsService {
  private readonly apps$ = new BehaviorSubject<App[]>([]);
  private readonly httpClient: {
    get: <T>(url: string) => Promise<T>;
  };

  constructor(httpClient: { get: <T>(url: string) => Promise<T> }) {
    this.httpClient = httpClient;
  }

  async getManifestSettings(): Promise<SettingsResponse> {
    const settingsPath = this.resolveSettingsPath();
    const response = await this.httpClient.get<SettingsResponse>(settingsPath);
    this.apps$.next(response.customSettings?.apps ?? []);
    return response;
  }

  /**
   * Resolve the settings.json path based on how the platform was launched.
   * Reads the manifest URL to determine if running from /local/ or /openshift/.
   */
  private resolveSettingsPath(): string {
    if (typeof fin !== 'undefined') {
      try {
        const manifest = fin.Application.getCurrentSync().getInfo;
        // Try reading the manifest URL from the application info
      } catch { /* ignore */ }
    }
    // Check for env query param: ?env=openshift
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const env = params.get('env');
      if (env === 'openshift') return '/openshift/settings.json';
      if (env === 'local') return '/local/settings.json';
    }
    // Default to local for dev
    return '/local/settings.json';
  }

  getApps(): App[] {
    return this.apps$.getValue();
  }

  getApps$() {
    return this.apps$.asObservable();
  }
}

