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
  /** The dock UI renders the filled star from THIS flag (verified in the v24.0.19 dock bundle), not from favorites membership. */
  bookmarked?: boolean;
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
  /** Favorite ids the platform put on the bar at init (config + `lob:` + `pin:`). */
  private configOwnedFavoriteIds = new Set<string>();
  /** True once the bookmark preference was READ successfully — guards full-set writes. */
  private bookmarksHydrated = false;
  /** Last known-persisted bookmark ids — skips redundant writes on unrelated saves. */
  private lastSavedBookmarkIds: string[] = [];
  /** Persisted ids that did not resolve at boot (feed hiccup / removed entry) — unioned back into every write so a transient outage never erases them. */
  private unresolvedBookmarkIds: string[] = [];
  /** Serializes bookmark writes — overlapping star clicks must compose, not last-write-wins (same pattern as StoreService.pinQueue). */
  private bookmarkSaveQueue: Promise<void> = Promise.resolve();
  /** Registered by StoreService (the pin owner): un-starring a pin-backed content-menu entry delegates the unpin there. */
  private pinRemovalHandler?: (appId: string) => Promise<void>;
  /** Notified (fire-and-forget) after any dock composition change so the Storefront can resync its open cards. */
  private compositionChangedListener?: () => void;
  /** appIds currently pinned per the preference — the SEMANTIC pin state. A pin whose bar button is suppressed (bookmark covers the same app) is still in here. */
  private currentPinnedAppIds = new Set<string>();

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
    const [apps, dock3Settings, lobApps, pinnedIdsRaw, bookmarkIdsRaw] =
      await Promise.all([
        appsOverride ? Promise.resolve(appsOverride) : this.appsService.load(),
        dockOverride
          ? Promise.resolve(dockOverride)
          : this.dockConfigService.getDockConfig(),
        this.loadLobApps(),
        this.loadPinnedAppIds(),
        this.loadBookmarkIds(),
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
      const pinnedFavs = this.buildPinnedFavorites(pinnedIdsRaw);
      favorites.push(...pinnedFavs);
      this.currentPinnedAppIds = new Set(
        pinnedFavs.map((fav) => fav.itemData.appId as string),
      );
    } catch (error) {
      logger.warn(
        'Could not append dock-pinned apps — dock renders without pins',
        error,
      );
    }

    // Everything on the bar so far is platform-owned (config, `lob:`, `pin:`).
    // Anything beyond this set in a dock-saved config is a user bookmark
    // (content-menu star), which is what saveConfig persists below.
    this.configOwnedFavoriteIds = new Set(favorites.map((fav) => fav.id));

    // Restore the user's content-menu bookmarks as bar favorites. The favorite
    // KEEPS the content-menu entry id (un-starring must remove this entry), and
    // the matching content-menu item gets `bookmarked: true` — the dock UI
    // renders the filled star from that flag.
    try {
      const restored = this.buildBookmarkFavorites(
        bookmarkIdsRaw,
        contentMenu,
        favorites,
      );
      favorites.push(...restored);
      // Persisted ids that did not resolve (LOB feed hiccup, entry removed from
      // config) are carried, not pruned: persistBookmarks unions them back into
      // every write, and they restore on a later boot once their source recovers.
      const onBar = new Set(favorites.map((fav) => fav.id));
      this.unresolvedBookmarkIds = bookmarkIdsRaw.filter(
        (id) => !onBar.has(id),
      );
      // "Star means on the dock" — ONE button per app: suppress a pin's bar
      // button when a bookmark favorite already covers the same appId (the pin
      // stays in the preference; the star stays filled either way).
      this.dedupePinButtons(favorites);
    } catch (error) {
      logger.warn(
        'Could not restore dock bookmarks — dock renders without them',
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
    // Fill the star on every content-menu entry whose app is on the bar —
    // whether a restored bookmark or a Storefront pin put it there.
    this.applyStarState(config);

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
    const handleDockConfigSaved = (saved: Dock3Config) =>
      this.handleDockConfigSaved(saved);
    const handleBookmarkToggle = (entry: {
      id?: string;
      itemData?: { appId?: string };
    }) => this.handleBookmarkToggle(entry);
    const getLiveConfig = () => this.activeConfig ?? config;

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
          // Called ONCE by Dock.init before the dock window exists — never on a
          // dock-window reload (the window re-reads its baked creation options,
          // refreshed only through updateConfig). Serve the platform-built
          // config — never the dock's IndexedDB cache — and adopt it as the
          // provider's internal state (the documented override pattern).
          override async loadConfig(): Promise<Dock3Config> {
            const live = getLiveConfig();
            this.config = live;
            return live;
          }

          /**
           * The dock UI pushes the FULL post-edit config here on every user edit
           * (content-menu bookmark toggles, re-ordering). Keep the provider's
           * internal state via the protected `config` setter — the documented
           * pattern when `super.saveConfig` (an IndexedDB write our loadConfig
           * never reads) is skipped — then hand it to the service, which persists
           * the bookmark delta through the unified Workspace Storage API.
           */
          override async saveConfig({ config: saved }: { config: Dock3Config }) {
            this.config = saved;
            await handleDockConfigSaved(saved);
          }

          /**
           * Star click on a content-menu entry. The dock UI sends ONLY this
           * message and mutates nothing itself — the provider must toggle the
           * favorite + `bookmarked` flag and push the config back through
           * updateConfig, or the bar and the star stay stale until restart.
           */
          override async bookmarkContentMenuEntry(payload: {
            entry?: { id?: string; label?: string; itemData?: { appId?: string } };
          }) {
            getAnalyticsNats()
              .publish({
                source: 'Dock',
                type: 'Bookmark',
                action: 'Toggle',
                value: payload?.entry?.label || payload?.entry?.id,
                data: { entryId: payload?.entry?.id },
              })
              .catch(() => {});
            if (payload?.entry) {
              await handleBookmarkToggle(payload.entry);
            }
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

  /** Register the pin owner's removal path (called by StoreService at construction). */
  setPinRemovalHandler(handler: (appId: string) => Promise<void>): void {
    this.pinRemovalHandler = handler;
  }

  /** Register a listener fired after any dock composition change (bookmark or pin). */
  onDockCompositionChanged(listener: () => void): void {
    this.compositionChangedListener = listener;
  }

  /** Fire-and-forget composition-change notification (listener errors are swallowed). */
  private notifyCompositionChanged(): void {
    try {
      this.compositionChangedListener?.();
    } catch (error) {
      logger.warn('Dock composition listener failed', error);
    }
  }

  /**
   * appIds currently on the dock via a BOOKMARK favorite. Lets the Storefront
   * render its 📌 button from the unified "on the dock" state instead of pins
   * only — a star-bookmarked app must show "Remove from Dock" on its card.
   */
  getBookmarkedAppIds(): Set<string> {
    const config = this.activeConfig;
    if (!config) return new Set();
    return new Set(
      ((config.favorites ?? []) as DockFavoriteNode[])
        .filter(
          (fav): fav is DockItemEntry =>
            fav.type === 'item' &&
            !this.configOwnedFavoriteIds.has(fav.id) &&
            !fav.id.startsWith('pin:'),
        )
        .map((fav) => (fav.itemData as { appId?: string } | undefined)?.appId)
        .filter((id): id is string => !!id),
    );
  }

  /**
   * Remove any bookmark favorite carrying this appId ("Remove from Dock" on a
   * store card whose app is star-bookmarked). Repaints the bar/star and
   * persists — serialized with the other bookmark work.
   */
  removeBookmarksForApp(appId: string): Promise<void> {
    this.bookmarkSaveQueue = this.bookmarkSaveQueue.then(() =>
      this.applyBookmarkMutation((config) => {
        const favorites = (config.favorites ?? []) as DockFavoriteNode[];
        for (let i = favorites.length - 1; i >= 0; i--) {
          const fav = favorites[i];
          if (
            fav.type !== 'item' ||
            this.configOwnedFavoriteIds.has(fav.id) ||
            fav.id.startsWith('pin:')
          ) {
            continue;
          }
          const favAppId = (fav.itemData as { appId?: string } | undefined)
            ?.appId;
          if (favAppId === appId) favorites.splice(i, 1);
        }
      }).catch((error) =>
        logger.error('Bookmark removal for app failed', { appId, error }),
      ),
    );
    return this.bookmarkSaveQueue;
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
    const pinnedFavs = this.buildPinnedFavorites(pinnedAppIds);
    this.currentPinnedAppIds = new Set(
      pinnedFavs.map((fav) => fav.itemData.appId as string),
    );
    const favorites = [...nonPinned, ...pinnedFavs] as DockFavoriteNode[];
    // ONE button per app: a pin whose app is already on the bar via a bookmark
    // gets its bar button suppressed (the pin itself stays in the preference).
    this.dedupePinButtons(favorites);
    this.activeConfig.favorites = favorites as Dock3Config['favorites'];
    // Pin changes move stars too (a pinned app's content-menu entry shows filled).
    this.applyStarState(this.activeConfig);
    await this.provider.updateConfig(this.activeConfig);
    this.notifyCompositionChanged();
    logger.info('Dock pins refreshed', { pinned: pinnedAppIds.length });
  }

  /** Bookmarked content-menu entry ids from the per-user preference (fail-soft read). */
  private async loadBookmarkIds(): Promise<string[]> {
    // Reset first so a re-init (or a failed re-read) never inherits stale
    // hydration state from a previous attempt.
    this.bookmarksHydrated = false;
    this.lastSavedBookmarkIds = [];
    this.unresolvedBookmarkIds = [];
    if (!this.storageService) return [];
    try {
      const ids = await this.storageService.getPreference<string[]>(
        WELL_KNOWN_PREFERENCES.dockBookmarks,
      );
      const sane = Array.isArray(ids)
        ? ids.filter((id): id is string => typeof id === 'string' && !!id)
        : [];
      this.bookmarksHydrated = true;
      this.lastSavedBookmarkIds = sane;
      return sane;
    } catch (error) {
      // Reads degrade — but bookmarksHydrated stays false so a later saveConfig
      // cannot clobber the stored set with a partial view of it.
      logger.warn(
        'Could not load dock bookmarks — dock renders without them',
        error,
      );
      return [];
    }
  }

  /**
   * Suppress `pin:` bar buttons whose appId is already covered by a bookmark
   * favorite — "star means on the dock", so one app never gets two buttons.
   * Mutates the array in place. The pin stays in the preference and in
   * `currentPinnedAppIds`; only its redundant button is dropped.
   */
  private dedupePinButtons(favorites: DockFavoriteNode[]): void {
    const bookmarkAppIds = new Set(
      favorites
        .filter(
          (fav): fav is DockItemEntry =>
            fav.type === 'item' &&
            !this.configOwnedFavoriteIds.has(fav.id) &&
            !fav.id.startsWith('pin:'),
        )
        .map((fav) => (fav.itemData as { appId?: string } | undefined)?.appId)
        .filter((id): id is string => !!id),
    );
    if (!bookmarkAppIds.size) return;
    for (let i = favorites.length - 1; i >= 0; i--) {
      const fav = favorites[i];
      if (fav.type !== 'item' || !fav.id.startsWith('pin:')) continue;
      const appId = (fav.itemData as { appId?: string } | undefined)?.appId;
      if (appId && bookmarkAppIds.has(appId)) favorites.splice(i, 1);
    }
  }

  /** appIds pinned onto the bar via the Storefront (the `pin:` favorites). */
  private pinnedAppIdsOf(config: Dock3Config): Set<string> {
    return new Set(
      ((config.favorites ?? []) as DockFavoriteNode[])
        .filter(
          (fav): fav is DockItemEntry =>
            fav.type === 'item' && fav.id.startsWith('pin:'),
        )
        .map((fav) => (fav.itemData as { appId?: string } | undefined)?.appId)
        .filter((id): id is string => !!id),
    );
  }

  /**
   * Derive the star state for every content-menu item: filled when its app is on
   * the dock bar via a user bookmark OR a Storefront pin — "on the dock" is what
   * the star means to the user, regardless of which affordance put it there.
   * (The dock UI renders the star from `bookmarked` ONLY — never from favorites
   * membership — so this must run after every favorites change.)
   * Returns true when any flag changed (caller then repaints via updateConfig).
   */
  private applyStarState(config: Dock3Config): boolean {
    const bookmarkIds = new Set(this.extractBookmarkIds(config));
    // Semantic pin state, not bar-button presence: a pin suppressed by the
    // one-button-per-app dedupe still keeps its app's star filled.
    const pinnedAppIds = this.currentPinnedAppIds;
    let changed = false;
    const walk = (nodes: ContentMenuNode[]): void => {
      for (const node of nodes) {
        if (node.type === 'item') {
          const appId = (node.itemData as { appId?: string } | undefined)
            ?.appId;
          const starred =
            bookmarkIds.has(node.id) || (!!appId && pinnedAppIds.has(appId));
          if (starred !== !!node.bookmarked) changed = true;
          if (starred) node.bookmarked = true;
          else delete node.bookmarked;
        } else {
          walk(node.children);
        }
      }
    };
    walk((config.contentMenu ?? []) as ContentMenuNode[]);
    return changed;
  }

  /** Resolve persisted bookmark ids against the content menu (unknown/duplicate ids skipped). */
  private buildBookmarkFavorites(
    bookmarkIds: string[],
    contentMenu: ContentMenuNode[],
    existing: DockFavoriteNode[],
  ): DockItemEntry[] {
    const items: DockItemEntry[] = [];
    const taken = new Set(existing.map((fav) => fav.id));
    for (const id of bookmarkIds) {
      if (taken.has(id)) continue;
      taken.add(id);
      const entry = this.findContentMenuItem(contentMenu, id);
      if (!entry) {
        logger.warn('Skipping dock bookmark for unknown content-menu id', {
          id,
        });
        continue;
      }
      items.push({
        type: 'item',
        id: entry.id,
        label: entry.label,
        icon: entry.icon,
        itemData: entry.itemData,
      });
    }
    return items;
  }

  private findContentMenuItem(
    nodes: ContentMenuNode[],
    id: string,
  ): ContentMenuItem | undefined {
    for (const node of nodes) {
      if (node.type === 'item') {
        if (node.id === id) return node;
      } else {
        const found = this.findContentMenuItem(node.children, id);
        if (found) return found;
      }
    }
    return undefined;
  }

  /**
   * A star click on a content-menu entry. The Dock 3.0 UI does NOTHING itself —
   * it fires `bookmark-content-menu-entry` and waits for the provider to toggle
   * the favorite + the `bookmarked` flag and push the new config back through
   * `updateConfig` (which repaints the bar AND the open menu; `save-config`
   * alone never repaints). Serialized with the save-config pipeline.
   */
  private handleBookmarkToggle(entry: {
    id?: string;
    itemData?: { appId?: string };
  }): Promise<void> {
    this.bookmarkSaveQueue = this.bookmarkSaveQueue.then(() =>
      this.toggleBookmark(entry).catch((error) => {
        logger.error('Dock bookmark toggle failed', error);
      }),
    );
    return this.bookmarkSaveQueue;
  }

  private async toggleBookmark(entry: {
    id?: string;
    itemData?: { appId?: string };
  }): Promise<void> {
    const initial = this.activeConfig;
    const entryId = entry?.id;
    if (!initial || !this.provider || !entryId) return;

    // Resolve the INTENT once from the state at click time; the mutations below
    // are idempotent so they can be re-applied if a save-config adoption races.
    const hasBookmark = this.findBookmarkFavoriteIdx(initial, entryId) >= 0;
    const appId = entry.itemData?.appId;
    const isPinned = !!appId && this.currentPinnedAppIds.has(appId);

    if (!hasBookmark && !isPinned) {
      // STAR: promote the content-menu entry onto the bar, KEEPING its id.
      const item = this.findContentMenuItem(
        (initial.contentMenu ?? []) as ContentMenuNode[],
        entryId,
      );
      if (!item) {
        logger.warn('Star click for unknown content-menu id ignored', {
          id: entryId,
        });
        return;
      }
      await this.applyBookmarkMutation((config) => {
        const favorites = (config.favorites ?? []) as DockFavoriteNode[];
        if (!favorites.some((fav) => fav.id === entryId)) {
          favorites.push({
            type: 'item',
            id: item.id,
            label: item.label,
            icon: item.icon,
            itemData: item.itemData,
          });
        }
        config.favorites = favorites as Dock3Config['favorites'];
      });
      return;
    }

    // UN-STAR: the star means "on the dock", so ONE click must take the app off
    // the dock entirely — drop the bookmark favorite (if any) AND, when the app
    // is also pinned, delegate the unpin to the pin owner (StoreService updates
    // the preference and refreshes the bar/stars via refreshPinnedApps).
    if (hasBookmark) {
      await this.applyBookmarkMutation((config) => {
        const favorites = (config.favorites ?? []) as DockFavoriteNode[];
        const idx = this.findBookmarkFavoriteIdx(config, entryId);
        if (idx >= 0) favorites.splice(idx, 1);
      });
    }
    if (isPinned && appId) {
      if (this.pinRemovalHandler) {
        await this.pinRemovalHandler(appId);
      } else {
        logger.warn(
          'Un-star of a pinned app ignored — no pin removal handler registered',
          { appId },
        );
      }
    }
  }

  private findBookmarkFavoriteIdx(config: Dock3Config, entryId: string): number {
    return ((config.favorites ?? []) as DockFavoriteNode[]).findIndex(
      (fav) =>
        fav.type === 'item' &&
        fav.id === entryId &&
        !this.configOwnedFavoriteIds.has(fav.id) &&
        !fav.id.startsWith('pin:'),
    );
  }

  /**
   * Apply an idempotent favorites mutation to the LIVE config, repaint, persist.
   * If a save-config adoption replaces activeConfig mid-flight (the echoed
   * config predates this mutation), re-apply onto the new object — bounded —
   * then persist from whatever is live, so the bar, the config, and the
   * preference always converge.
   */
  private async applyBookmarkMutation(
    mutate: (config: Dock3Config) => void,
  ): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const config = this.activeConfig;
      if (!config || !this.provider) return;
      mutate(config);
      this.applyStarState(config);
      try {
        await this.provider.updateConfig(config);
      } catch (error) {
        logger.warn('Dock repaint after bookmark toggle failed', error);
      }
      if (this.activeConfig === config) break;
    }
    if (this.activeConfig) await this.persistBookmarks(this.activeConfig);
    this.notifyCompositionChanged();
  }

  /**
   * A dock-saved config arrived. Per the Dock 3.0 UI, `save-config` fires ONLY
   * for right-click favorite removal and drag re-ordering (star clicks come in
   * via `bookmark-content-menu-entry` instead). Adopt it as the live config
   * SYNCHRONOUSLY — so pin refreshes compose with the edit instead of
   * clobbering it — then, serialized: delegate any removed `pin:` favorites to
   * the pin owner, re-derive the stars (the UI never clears `bookmarked` when a
   * favorite is removed from the bar), and persist the bookmark ids.
   */
  private handleDockConfigSaved(saved: Dock3Config): Promise<void> {
    // Snapshot the pin diff SYNCHRONOUSLY: by dequeue time both config objects
    // may have been mutated in place (refreshPinnedApps), and a diff over the
    // live references could miss a removal — resurrecting a pin the user
    // just right-click-removed.
    const previousPins = this.activeConfig
      ? this.pinnedAppIdsOf(this.activeConfig)
      : null;
    const savedPins = this.pinnedAppIdsOf(saved);
    this.activeConfig = saved;
    this.bookmarkSaveQueue = this.bookmarkSaveQueue.then(() =>
      this.processSavedConfig(previousPins, savedPins).catch((error) => {
        logger.error('Unexpected dock bookmark persistence failure', error);
      }),
    );
    return this.bookmarkSaveQueue;
  }

  private async processSavedConfig(
    previousPins: Set<string> | null,
    savedPins: Set<string>,
  ): Promise<void> {
    // Right-click removal of a `pin:` favorite = unpin. Delegate to the pin
    // owner so the preference, the store cache, and the bar stay coherent.
    if (previousPins) {
      for (const appId of previousPins) {
        if (!savedPins.has(appId)) {
          if (this.pinRemovalHandler) {
            await this.pinRemovalHandler(appId).catch((error) =>
              logger.error('Delegated dock unpin failed', { appId, error }),
            );
          } else {
            logger.warn(
              'Pin favorite removed from the bar but no pin removal handler registered — it will reappear',
              { appId },
            );
          }
        }
      }
    }
    // Operate on the LIVE config at dequeue time — a stale queued entry then
    // becomes a benign no-op instead of pushing an outdated layout to the UI.
    // (The UI repaints its favorites locally on these edits but NEVER touches
    // `bookmarked` flags, so they must be re-derived here.)
    const current = this.activeConfig;
    if (!current) return;
    if (this.applyStarState(current) && this.provider) {
      try {
        await this.provider.updateConfig(current);
      } catch (error) {
        logger.warn('Dock repaint after config save failed', error);
      }
    }
    await this.persistBookmarks(current);
    this.notifyCompositionChanged();
  }

  /**
   * Persist the bookmark set derived from a dock-saved config. A failed write
   * is loudly logged, never thrown into the dock's channel handler (the dock UI
   * already applied the change visually and cannot roll it back).
   */
  private async persistBookmarks(saved: Dock3Config): Promise<void> {
    if (!this.storageService) return;
    if (!this.bookmarksHydrated) {
      // One retry per gesture (mirrors StoreService.toggleDockPin): a transient
      // boot outage must not kill bookmark persistence for the whole session.
      const recovered = await this.loadBookmarkIds();
      if (!this.bookmarksHydrated) {
        logger.error(
          'Dock bookmarks are unreadable — not persisting this change to avoid clobbering the stored set',
        );
        return;
      }
      // Nothing recovered is on the bar (the boot restore ran before storage
      // came back), so carry the whole stored set forward as unresolved — the
      // user cannot have un-starred entries that were never shown.
      this.unresolvedBookmarkIds = recovered;
    }
    const live = this.extractBookmarkIds(saved);
    // Union back ids that did not resolve at boot: pruning them here would turn
    // a transient feed/config outage into permanent bookmark loss. Truly-dead
    // ids linger harmlessly (skipped with a warn at each boot).
    const bookmarkIds = [
      ...live,
      ...this.unresolvedBookmarkIds.filter((id) => !live.includes(id)),
    ];
    if (
      bookmarkIds.length === this.lastSavedBookmarkIds.length &&
      bookmarkIds.every((id, i) => id === this.lastSavedBookmarkIds[i])
    ) {
      return; // save was a re-order of platform-owned entries — bookmark set unchanged
    }
    try {
      await this.storageService.setPreference(
        WELL_KNOWN_PREFERENCES.dockBookmarks,
        bookmarkIds,
      );
      this.lastSavedBookmarkIds = bookmarkIds;
      logger.info('Dock bookmarks persisted', { count: bookmarkIds.length });
    } catch (error) {
      logger.error(
        'Dock bookmark change was not persisted — it will not survive a platform restart',
        error,
      );
    }
  }

  /**
   * User bookmarks = item favorites the platform did not put on the bar itself.
   * `pin:` needs a prefix guard on top of the init snapshot because pins are added
   * LIVE via refreshPinnedApps; LOB bar entries are static per session, so the
   * snapshot covers them — and `lob:`-prefixed CONTENT-MENU items (lob:catalog:…)
   * must stay bookmarkable, so there is deliberately no `lob:` exclusion here.
   */
  private extractBookmarkIds(saved: Dock3Config): string[] {
    return ((saved.favorites ?? []) as DockFavoriteNode[])
      .filter((fav): fav is DockItemEntry => fav.type === 'item')
      .map((fav) => fav.id)
      .filter(
        (id) => !this.configOwnedFavoriteIds.has(id) && !id.startsWith('pin:'),
      );
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
