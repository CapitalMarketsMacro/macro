import type { App } from '@openfin/workspace';
import { BehaviorSubject } from 'rxjs';
import { Logger } from '@macro/logger';
import type { AppsConfig } from './types';

const logger = Logger.getLogger('AppsService');

/**
 * Loads the app registry (`apps.json`) — the single source of the launchable app list.
 * Split out of SettingsService so apps are their own config/service (like the
 * storefront/entitlements configs). Keeps a sync in-memory cache so consumers can read
 * the apps synchronously after {@link load}; follows the SettingsService httpClient +
 * env-path pattern.
 */
export class AppsService {
  private readonly apps$ = new BehaviorSubject<App[]>([]);
  private loaded = false;
  private loading: Promise<App[]> | null = null;

  constructor(
    private readonly httpClient: { get: <T>(url: string) => Promise<T> },
    private readonly resolvePath: () => string,
  ) {}

  /** Fetch + cache the app list (idempotent). */
  async load(): Promise<App[]> {
    if (this.loaded) return this.apps$.getValue();
    if (!this.loading) {
      this.loading = this.httpClient
        .get<AppsConfig>(this.resolvePath())
        .then((cfg) => {
          const apps = cfg?.apps ?? [];
          this.apps$.next(apps);
          this.loaded = true;
          return apps;
        })
        .catch((error) => {
          logger.error('Failed to load apps.json', error);
          this.loaded = true;
          return [];
        });
    }
    return this.loading;
  }

  /** Ensure the registry is loaded (alias of {@link load} for call sites that ignore the result). */
  async ensureLoaded(): Promise<void> {
    await this.load();
  }

  getApps(): App[] {
    return this.apps$.getValue();
  }

  getApps$() {
    return this.apps$.asObservable();
  }
}
