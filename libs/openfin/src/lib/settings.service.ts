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
    const response = await this.httpClient.get<SettingsResponse>('/settings.json');
    this.apps$.next(response.customSettings?.apps ?? []);
    return response;
  }

  getApps(): App[] {
    return this.apps$.getValue();
  }

  getApps$() {
    return this.apps$.asObservable();
  }
}

