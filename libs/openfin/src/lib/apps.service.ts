import type { App } from '@openfin/workspace';
import { BehaviorSubject } from 'rxjs';
import { Logger } from '@macro/logger';
import type { AppsConfig } from './types';
import type { WorkspaceStorageService } from './workspace-storage.service';
import type { LobStoreApp } from './storage/storage-types';

const logger = Logger.getLogger('AppsService');

/**
 * Loads the app registry (`apps.json`) — the single source of the launchable app list.
 * Split out of SettingsService so apps are their own config/service (like the
 * storefront/entitlements configs). Keeps a sync in-memory cache so consumers can read
 * the apps synchronously after {@link load}; follows the SettingsService httpClient +
 * env-path pattern.
 *
 * When constructed with a {@link WorkspaceStorageService}, LOB store apps published
 * through the unified storage API (`/store-apps`) are merged in at load — they surface
 * in the Storefront (details page included), Home search, and every launch path, with
 * the registry winning on `appId` collisions. Fail-soft: a storage outage just means
 * no LOB apps this session.
 */
export class AppsService {
  private readonly apps$ = new BehaviorSubject<App[]>([]);
  private loaded = false;
  private loading: Promise<App[]> | null = null;

  constructor(
    private readonly httpClient: { get: <T>(url: string) => Promise<T> },
    private readonly resolvePath: () => string,
    /** Optional: enables LOB store apps published through the unified storage API. */
    private readonly storageService?: WorkspaceStorageService,
  ) {}

  /** Fetch + cache the app list (idempotent). */
  async load(): Promise<App[]> {
    if (this.loaded) return this.apps$.getValue();
    if (!this.loading) {
      this.loading = Promise.all([this.loadRegistry(), this.loadLobStoreApps()])
        .then(([registry, lobApps]) => {
          const apps = this.merge(registry, lobApps);
          this.apps$.next(apps);
          this.loaded = true;
          return apps;
        })
        .catch((error) => {
          // Terminal catch: load() must NEVER stick as a rejected cached promise —
          // a malformed payload degrades to an empty registry, not a dead platform.
          logger.error('App registry load failed', error);
          this.loaded = true;
          this.apps$.next([]);
          return [] as App[];
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

  private async loadRegistry(): Promise<App[]> {
    try {
      const cfg = await this.httpClient.get<AppsConfig>(this.resolvePath());
      return Array.isArray(cfg?.apps) ? cfg.apps : [];
    } catch (error) {
      logger.error('Failed to load apps.json', error);
      return [];
    }
  }

  private async loadLobStoreApps(): Promise<LobStoreApp[]> {
    if (!this.storageService) return [];
    try {
      const apps = await this.storageService.getLobStoreApps();
      return apps
        .map((app, index) => ({ app, index }))
        .sort((a, b) => {
          const ao = a.app.sortOrder ?? Number.MAX_SAFE_INTEGER;
          const bo = b.app.sortOrder ?? Number.MAX_SAFE_INTEGER;
          return ao !== bo ? ao - bo : a.index - b.index;
        })
        .map(({ app }) => app);
    } catch (error) {
      logger.warn('Could not load LOB store apps — registry apps only', error);
      return [];
    }
  }

  /**
   * Registry first; LOB store apps appended unless their appId collides with a
   * registry app (registry wins — publishers can't shadow platform apps). Malformed
   * entries are skipped per app so one bad row never hides the rest.
   */
  private merge(registry: App[], lobApps: LobStoreApp[]): App[] {
    if (!lobApps.length) return registry;
    const known = new Set(registry.map((a) => a.appId));
    const merged = [...registry];
    for (const app of lobApps) {
      try {
        if (
          !app ||
          typeof app.appId !== 'string' ||
          !app.appId ||
          typeof app.title !== 'string' ||
          !app.title ||
          typeof app.manifest !== 'string' ||
          !app.manifest ||
          (app.manifestType !== 'view' && app.manifestType !== 'manifest') ||
          !Array.isArray(app.icons) ||
          app.icons.length === 0 ||
          typeof app.icons[0]?.src !== 'string'
        ) {
          logger.warn('Skipping malformed LOB store app', { app });
          continue;
        }
        if (known.has(app.appId)) {
          logger.warn(
            'Skipping LOB store app shadowing an existing appId (registry wins)',
            { appId: app.appId },
          );
          continue;
        }
        known.add(app.appId);
        merged.push(this.toApp(app));
      } catch (error) {
        logger.warn('Skipping LOB store app that failed to map', {
          appId: (app as { appId?: string })?.appId,
          error,
        });
      }
    }
    return merged;
  }

  /** Map a published LOB store app onto the OpenFin App shape the whole platform consumes. */
  private toApp(app: LobStoreApp): App {
    return {
      appId: app.appId,
      name: app.appId,
      title: app.title,
      description: app.description,
      manifest: app.manifest,
      manifestType: app.manifestType,
      icons: app.icons,
      images: app.images ?? [],
      // The details page requires a publisher; fall back to the owning LOB.
      publisher: app.publisher || app.lob || 'Line of Business',
      contactEmail: app.contactEmail,
      supportEmail: app.supportEmail,
      intents: [],
      // Force the `lob` tag so the "LOB Apps" storefront nav item finds them.
      tags: [...new Set([...(app.tags ?? []), 'lob'])],
      ...(app.category ? { category: app.category } : {}),
    } as unknown as App;
  }
}
