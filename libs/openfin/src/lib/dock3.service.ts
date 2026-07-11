import {
  Dock,
  getCurrentSync,
  type Dock3Config,
  type Dock3Provider,
  type LaunchDockEntryPayload,
} from '@openfin/workspace-platform';
import type { App } from '@openfin/workspace';
import { Logger } from '@macro/logger';
import type { LaunchService } from './launch.service';
import type { AppsService } from './apps.service';
import type { DockConfigService } from './dock-config.service';
import type { WorkspaceStorageService } from './workspace-storage.service';
import { getAnalyticsNats } from './analytics-nats.service';
import { toTaskbarIcon } from './icon-utils';
import {
  WELL_KNOWN_PREFERENCES,
  type LobDockApp,
} from './storage/storage-types';
import type {
  PlatformSettings,
  Dock3Settings,
  Dock3FavoriteEntry,
  Dock3ContentEntry,
  Dock3Icon,
} from './types';

const logger = Logger.getLogger('Dock3Service');

/** More-menu custom actions (Dock 3.0 `moreMenuCustomOption`). */
const MORE_MENU_ACTION_ANALYTICS = 'launch-analytics-dashboard';
const MORE_MENU_ACTION_PROCESS_MANAGER = 'launch-process-manager';
const PROCESS_MANAGER_MANIFEST =
  'http://cdn.openfin.co/release/apps/openfin/processmanager/app.json';

/** Dock favorite item entry (matches OpenFin DockEntry 'item' variant) */
type DockItemEntry = {
  type: 'item';
  id: string;
  icon: Dock3Icon;
  label: string;
  itemData?: any;
};

/**
 * Dock favorite folder entry — renders as a DROPDOWN in the dock bar. Its children
 * come from the content-menu folder with the same id (Dock 3.0 folder merging).
 */
type DockFolderEntry = {
  type: 'folder';
  id: string;
  label: string;
  icon?: Dock3Icon;
};

type DockFavoriteNode = DockItemEntry | DockFolderEntry;

/** Content menu folder entry */
type ContentMenuFolder = {
  type: 'folder';
  id: string;
  label: string;
  children: ContentMenuNode[];
};

/** Content menu item entry */
type ContentMenuItem = {
  type: 'item';
  id: string;
  icon: Dock3Icon;
  label: string;
  itemData: any;
};

type ContentMenuNode = ContentMenuFolder | ContentMenuItem;

/**
 * Dock3 service for managing the OpenFin Dock3 (next-gen dock with favorites + content menu)
 * Framework-agnostic implementation
 */
export class Dock3Service {
  private provider: Dock3Provider | null = null;
  /** The live config object (loadConfig returns it; refreshPinnedApps mutates it). */
  private activeConfig: Dock3Config | null = null;
  private registryApps: App[] = [];

  constructor(
    private readonly launchService: LaunchService,
    private readonly appsService: AppsService,
    private readonly dockConfigService: DockConfigService,
    /** Optional: enables LOB dock apps published through the unified storage API. */
    private readonly storageService?: WorkspaceStorageService,
  ) {}

  async init(
    platformSettings: PlatformSettings,
    appsOverride?: App[],
    dockOverride?: Dock3Settings,
  ): Promise<void> {
    // Production passes no overrides → config comes from the injected services.
    // Overrides exist for tests/advanced callers that supply config directly.
    // The LOB fetch runs concurrently — it is an optional decoration and must not
    // serially extend the dock's registration window when the storage host is slow.
    const [apps, dock3Settings, lobApps, pinnedIdsRaw] = await Promise.all([
      appsOverride ? Promise.resolve(appsOverride) : this.appsService.load(),
      dockOverride
        ? Promise.resolve(dockOverride)
        : this.dockConfigService.getDockConfig(),
      this.loadLobApps(),
      this.loadPinnedAppIds(),
    ]);
    const favorites = this.buildFavorites(
      dock3Settings?.favorites,
      apps,
      platformSettings.icon,
    );
    const contentMenu = this.buildContentMenu(
      dock3Settings?.contentMenu,
      apps,
      platformSettings.icon,
    );

    // LOB custom apps from the unified Workspace Storage API — merged after the
    // config-driven entries. Fail-soft at every level: a storage outage, a poisoned
    // record, or a merge bug means fewer/no LOB entries — NEVER a broken dock.
    try {
      this.appendLobApps(lobApps, favorites, contentMenu);
    } catch (error) {
      logger.error(
        'LOB dock app merge failed — dock renders config-driven entries only',
        error,
      );
    }

    // Store-pinned apps ("Add to Dock" on Storefront cards) — appended last, from the
    // per-user `dock-pinned-apps` preference (fetched concurrently above).
    this.registryApps = apps ?? [];
    try {
      favorites.push(...this.buildPinnedFavorites(pinnedIdsRaw));
    } catch (error) {
      logger.warn(
        'Could not append dock-pinned apps — dock renders without pins',
        error,
      );
    }

    const config: Dock3Config = {
      title: platformSettings.title,
      // Dock window options don't allow `taskbarIcon` (DockAllowedWindowOptions),
      // so the Dock window's taskbar icon comes from this provider icon. Point it
      // at the raster favicon.ico — an SVG can't be rasterized for the taskbar.
      icon: toTaskbarIcon(platformSettings.icon),
      favorites: favorites as Dock3Config['favorites'],
      contentMenu: contentMenu as Dock3Config['contentMenu'],
      defaultDockButtons: [
        'home',
        'store',
        'notifications',
        'switchWorkspace',
        'contentMenu',
      ],
      uiConfig: {
        contentMenu: {
          enableBookmarking: true,
        },
        hideDragHandle: false,
        // Dock 3.0: the provider icon doubles as a content-menu dropdown button
        // instead of being a plain drag region.
        providerIconContentMenu: true,
        moreMenu: {
          quitPlatform: {
            hidePlatformTitle: false,
            skipDialog: false,
          },
          moreMenuCustomOption: {
            label: 'Macro Tools',
            options: [
              {
                tooltip: 'Analytics Dashboard',
                action: MORE_MENU_ACTION_ANALYTICS,
              },
              {
                tooltip: 'Process Manager',
                action: MORE_MENU_ACTION_PROCESS_MANAGER,
              },
            ],
          },
        },
      },
    };

    this.activeConfig = config;

    logger.info('Initializing Dock3', {
      favoritesCount: favorites.length,
      contentMenuCount: contentMenu.length,
      lobAppsCount: lobApps.length,
    });

    // Capture for use inside the Dock provider override below (where `this`
    // is the provider instance, not this Dock3Service).
    const launchService = this.launchService;
    const launchMoreMenuAction = (action: string) =>
      this.launchMoreMenuAction(action, apps);

    this.provider = await Dock.init({
      config,
      windowOptions: {
        taskbarIconGroup: 'macro-workspace',
        experimental: {
          snapZone: {
            enabled: true,
            threshold: 40,
            locationPreference: ['bottom', 'top'],
          },
        },
        contextMenuOptions: {
          enabled: true,
          template: ['snapToTop', 'snapToBottom'],
        },
      },
      override: (Base) =>
        class extends Base {
          // Always use fresh config from settings.json instead of stale IndexedDB cache.
          // This ensures icon URL changes and config updates take effect immediately.
          override async loadConfig(): Promise<Dock3Config> {
            return config;
          }

          override async moreMenuCustomOptionClicked(payload: {
            action: string;
            customData?: any;
          }) {
            getAnalyticsNats()
              .publish({
                source: 'Dock',
                type: 'MoreMenu',
                action: 'Click',
                value: payload.action,
              })
              .catch(() => {});
            await launchMoreMenuAction(payload.action);
          }

          override async launchEntry(payload: LaunchDockEntryPayload) {
            const { entry } = payload;
            if (entry.type !== 'item') return;
            getAnalyticsNats()
              .publish({
                source: 'Dock',
                type: 'App',
                action: 'Launch',
                value: entry.label || entry.id,
                data: {
                  entryId: entry.id,
                  appId: (entry.itemData as any)?.appId,
                },
              })
              .catch(() => {});

            const appId = entry.itemData?.appId as string | undefined;
            const url = entry.itemData?.url as string | undefined;

            if (appId && apps) {
              const app = apps.find((a) => a.appId === appId);
              if (app?.manifest) {
                // Route through the shared launcher so the entry honours its
                // manifestType — view → createView, manifest → boot the
                // platform, snapshot → applySnapshot, external → launch process.
                // Previously this always called createView, so platform apps
                // could only ever open as a single embedded view.
                logger.info('Dock3 launching app', {
                  appId,
                  manifestType: app.manifestType,
                  manifest: app.manifest,
                });
                await launchService.launch(app);
                return;
              }
            }

            if (url) {
              logger.info('Dock3 launching URL', { url });
              const platform = getCurrentSync();
              await platform.createView({ url } as any);
              return;
            }

            logger.warn('Dock3 entry has no appId or url', { entry });
          }
        },
    });

    await this.provider.ready;

    // Brand the dock window's taskbar icon. The dock window runs under the
    // OpenFin Workspace application (uuid "openfin-workspace"), so it ignores
    // our platform icon, and DockAllowedWindowOptions exposes no `taskbarIcon`.
    // Its taskbar entry falls back to the window `icon` (the stock OpenFin logo
    // by default); `icon` is runtime-mutable, so override it with the raster
    // brand mark — an SVG can't be rasterized for the taskbar.
    try {
      await this.provider.getWindowSync().updateOptions({
        icon: toTaskbarIcon(platformSettings.icon),
      });
    } catch (err) {
      logger.warn('Could not set dock window icon', err);
    }

    logger.info('Dock3 initialized');
  }

  async shutdown(): Promise<void> {
    if (this.provider) {
      await this.provider.shutdown();
      this.provider = null;
      this.activeConfig = null;
      logger.info('Dock3 shut down');
    }
  }

  /** Pinned appIds from the per-user preference (fail-soft — dock renders without pins). */
  private async loadPinnedAppIds(): Promise<string[]> {
    if (!this.storageService) return [];
    try {
      const ids = await this.storageService.getPreference<string[]>(
        WELL_KNOWN_PREFERENCES.dockPinnedApps,
      );
      return Array.isArray(ids) ? ids : [];
    } catch (error) {
      logger.warn(
        'Could not load dock-pinned apps — dock renders without pins',
        error,
      );
      return [];
    }
  }

  /**
   * Live-apply a changed dock-pin set ("Add to Dock" on Storefront cards): replaces
   * only the `pin:`-prefixed favorites on the ACTIVE config — preserving any
   * in-session dock edits — and pushes it through the provider's `updateConfig`.
   * The active config object is mutated too, so the `loadConfig` override keeps
   * returning the pinned state on internal dock reloads.
   */
  async refreshPinnedApps(pinnedAppIds: string[]): Promise<void> {
    if (!this.provider || !this.activeConfig) {
      logger.warn(
        'refreshPinnedApps called before dock init — pins apply on next start',
      );
      return;
    }
    const nonPinned = (this.activeConfig.favorites ?? []).filter(
      (fav) => !String((fav as { id?: string }).id ?? '').startsWith('pin:'),
    );
    const favorites = [
      ...nonPinned,
      ...this.buildPinnedFavorites(pinnedAppIds),
    ];
    this.activeConfig.favorites = favorites as Dock3Config['favorites'];
    await this.provider.updateConfig(this.activeConfig);
    logger.info('Dock pins refreshed', { pinned: pinnedAppIds.length });
  }

  /** Map pinned appIds onto dock favorite items (unknown/duplicate ids skipped). */
  private buildPinnedFavorites(pinnedAppIds: string[]): DockItemEntry[] {
    const items: DockItemEntry[] = [];
    const seen = new Set<string>();
    for (const appId of pinnedAppIds) {
      if (typeof appId !== 'string' || !appId || seen.has(appId)) continue;
      seen.add(appId);
      const app = this.registryApps.find((a) => a.appId === appId);
      if (!app) {
        logger.warn('Skipping dock pin for unknown appId', { appId });
        continue;
      }
      items.push({
        type: 'item',
        id: `pin:${appId}`,
        label: app.title ?? appId,
        icon: app.icons?.[0]?.src ?? '',
        itemData: { appId },
      });
    }
    return items;
  }

  /** "Macro Tools" more-menu actions. */
  private async launchMoreMenuAction(
    action: string,
    apps: App[] | undefined,
  ): Promise<void> {
    try {
      if (action === MORE_MENU_ACTION_ANALYTICS) {
        const analytics = apps?.find(
          (a) => a.appId === 'macro-analytics-dashboard',
        );
        if (analytics) {
          await this.launchService.launch(analytics);
        } else {
          logger.warn('Analytics dashboard app not found in the registry');
        }
        return;
      }
      if (action === MORE_MENU_ACTION_PROCESS_MANAGER) {
        await fin.Application.startFromManifest(PROCESS_MANAGER_MANIFEST);
        return;
      }
      logger.warn('Unknown more-menu action', { action });
    } catch (err) {
      logger.error('More-menu action failed', { action, err });
    }
  }

  /** LOB apps sorted by sortOrder ascending, undefined last, stable for ties. */
  private async loadLobApps(): Promise<LobDockApp[]> {
    if (!this.storageService) return [];
    try {
      const apps = await this.storageService.getLobDockApps();
      return apps
        .map((app, index) => ({ app, index }))
        .sort((a, b) => {
          const ao = a.app.sortOrder ?? Number.MAX_SAFE_INTEGER;
          const bo = b.app.sortOrder ?? Number.MAX_SAFE_INTEGER;
          return ao !== bo ? ao - bo : a.index - b.index;
        })
        .map(({ app }) => app);
    } catch (error) {
      logger.warn(
        'Could not load LOB dock apps — dock renders without them',
        error,
      );
      return [];
    }
  }

  /**
   * Merge LOB apps into the dock: `icon` → a favorites button (+ listed under the
   * "LOB Apps" content folder, grouped by `lob`); `dropdown` → a favorites folder
   * whose children live in a top-level content-menu folder with the SAME id
   * (Dock 3.0 folder merging resolves the dropdown's children by id).
   *
   * All LOB-derived dock ids are NAMESPACED with `lob:` — publishers cannot know the
   * platform's config-driven ids ('showcase', 'prism', …), and Dock 3.0 keys folder
   * merging and bookmarking by entry id, so an un-namespaced collision would open the
   * wrong dropdown. Only the favorites-folder/content-folder PAIR has to share an id.
   * Malformed records are skipped per entry (warn) — never allowed to break the dock.
   */
  private appendLobApps(
    lobApps: LobDockApp[],
    favorites: DockFavoriteNode[],
    contentMenu: ContentMenuNode[],
  ): void {
    if (!lobApps.length) return;

    const iconApps: LobDockApp[] = [];
    const seenIds = new Set<string>();

    for (const app of lobApps) {
      try {
        if (
          !app ||
          typeof app.id !== 'string' ||
          !app.id ||
          typeof app.label !== 'string' ||
          typeof app.iconUrl !== 'string'
        ) {
          logger.warn('Skipping malformed LOB dock app', { app });
          continue;
        }
        if (seenIds.has(app.id)) {
          logger.warn('Skipping duplicate LOB dock app id', { id: app.id });
          continue;
        }
        seenIds.add(app.id);
        const entryId = `lob:${app.id}`;

        if (app.type === 'dropdown') {
          const children = (Array.isArray(app.children) ? app.children : [])
            .filter(
              (child) => child && typeof child.url === 'string' && child.url,
            )
            .map<ContentMenuItem>((child, index) => ({
              type: 'item',
              id: `${entryId}:${child.id ?? index}`,
              label: child.label,
              icon: child.iconUrl || app.iconUrl,
              itemData: { url: child.url },
            }));
          if (!children.length) {
            logger.warn('Skipping LOB dropdown app without children', {
              id: app.id,
            });
            continue;
          }
          favorites.push({
            type: 'folder',
            id: entryId,
            label: app.label,
            icon: app.iconUrl,
          });
          contentMenu.push({
            type: 'folder',
            id: entryId,
            label: app.label,
            children,
          });
          continue;
        }

        if (!app.url) {
          logger.warn('Skipping LOB icon app without a url', { id: app.id });
          continue;
        }
        favorites.push({
          type: 'item',
          id: entryId,
          label: app.label,
          icon: app.iconUrl,
          itemData: { url: app.url },
        });
        iconApps.push(app);
      } catch (error) {
        logger.warn('Skipping LOB dock app that failed to map', {
          id: (app as { id?: string })?.id,
          error,
        });
      }
    }

    // Content-menu catalog of the single-icon LOB apps, grouped by owning LOB.
    // Disjoint id prefixes for items vs group folders; non-string `lob` values are
    // treated as ungrouped (server validates, but local-mode data bypasses it).
    if (iconApps.length) {
      const byLob = new Map<string | undefined, LobDockApp[]>();
      for (const app of iconApps) {
        const lob =
          typeof app.lob === 'string' && app.lob.trim() ? app.lob : undefined;
        const group = byLob.get(lob) ?? [];
        group.push(app);
        byLob.set(lob, group);
      }
      const toItem = (app: LobDockApp): ContentMenuItem => ({
        type: 'item',
        id: `lob:catalog:${app.id}`,
        label: app.label,
        icon: app.iconUrl,
        itemData: { url: app.url },
      });
      const children: ContentMenuNode[] = [
        ...(byLob.get(undefined) ?? []).map(toItem),
      ];
      const usedSlugs = new Set<string>();
      for (const [lob, group] of byLob) {
        if (lob === undefined) continue;
        let slug = lob.toLowerCase().replace(/\s+/g, '-');
        while (usedSlugs.has(slug)) slug = `${slug}-2`;
        usedSlugs.add(slug);
        children.push({
          type: 'folder',
          id: `lob:group:${slug}`,
          label: lob,
          children: group.map(toItem),
        });
      }
      contentMenu.push({
        type: 'folder',
        id: 'lob-apps',
        label: 'LOB Apps',
        children,
      });
    }
  }

  private buildFavorites(
    settingsFavorites: Dock3FavoriteEntry[] | undefined,
    apps: App[] | undefined,
    defaultIcon: string,
  ): DockFavoriteNode[] {
    if (!settingsFavorites?.length) return [];

    return settingsFavorites.map((fav): DockFavoriteNode => {
      if (fav.type === 'folder') {
        // A favorites folder is a dock DROPDOWN — its children come from the
        // content-menu folder with the same id (Dock 3.0 folder merging).
        return { type: 'folder', id: fav.id, label: fav.label, icon: fav.icon };
      }
      const app = fav.appId
        ? apps?.find((a) => a.appId === fav.appId)
        : undefined;
      return {
        type: 'item',
        id: fav.id,
        label: fav.label,
        icon: fav.icon || app?.icons?.[0]?.src || defaultIcon,
        itemData: {
          appId: fav.appId,
          url: app?.manifest,
        },
      };
    });
  }

  private buildContentMenu(
    settingsMenu: Dock3ContentEntry[] | undefined,
    apps: App[] | undefined,
    defaultIcon: string,
  ): ContentMenuNode[] {
    if (!settingsMenu?.length) return [];

    return settingsMenu.map((entry) =>
      this.mapContentEntry(entry, apps, defaultIcon),
    );
  }

  private mapContentEntry(
    entry: Dock3ContentEntry,
    apps: App[] | undefined,
    defaultIcon: string,
  ): ContentMenuNode {
    if (entry.type === 'folder') {
      return {
        type: 'folder' as const,
        id: entry.id,
        label: entry.label,
        children: entry.children.map((child) =>
          this.mapContentEntry(child, apps, defaultIcon),
        ),
      };
    }

    const app = entry.appId
      ? apps?.find((a) => a.appId === entry.appId)
      : undefined;
    return {
      type: 'item' as const,
      id: entry.id,
      label: entry.label,
      icon: entry.icon || app?.icons?.[0]?.src || defaultIcon,
      itemData: {
        appId: entry.appId,
        url: app?.manifest,
      },
    };
  }
}
