import {
  Storefront,
  StorefrontTemplate,
  type StoreButtonConfig,
  type StoreRegistration,
  type StorefrontLandingPage,
  type StorefrontNavigationSection,
} from '@openfin/workspace';
import {
  getCurrentSync,
  type StoreCustomButtonActionPayload,
} from '@openfin/workspace-platform';
import { from, tap } from 'rxjs';
import { Logger } from '@macro/logger';
import type {
  MacroApp,
  PlatformSettings,
  StorefrontNavItemConfig,
  StorefrontRowConfig,
} from './types';
import type { AppsService } from './apps.service';
import type { FavoritesService } from './favorites.service';
import type { StorefrontConfigService } from './storefront-config.service';
import type { EntitlementsService } from './entitlements.service';
import type { LaunchService } from './launch.service';
import type { WorkspaceStorageService } from './workspace-storage.service';
import type { Dock3Service } from './dock3.service';
import { getAnalyticsNats } from './analytics-nats.service';
import { toTaskbarIcon } from './icon-utils';

import { WELL_KNOWN_PREFERENCES } from './storage/storage-types';
import { getWorkspaceStorage } from './storage/storage-context';

const logger = Logger.getLogger('StoreService');

/** Preference (per user) holding the appIds pinned to the dock from the store. */
const DOCK_PINNED_APPS_PREF = WELL_KNOWN_PREFERENCES.dockPinnedApps;

/** OpenFin Storefront hard limits (verified in @openfin/workspace store.d.ts). */
const MAX_NAV_SECTIONS = 3;
const MAX_NAV_ITEMS = 5;

/**
 * Store service for the OpenFin Storefront — framework-agnostic.
 *
 * Navigation (business-area categories), landing page, and footer are driven by
 * `storefront-config.json` (via {@link StorefrontConfigService}). All apps are visible,
 * but launching is gated by {@link EntitlementsService}/{@link LaunchService}; favorites
 * are per-user and persistent.
 */
export class StoreService {
  private storeRegistration: StoreRegistration | null = null;
  /** Sync cache of dock-pinned appIds (hydrated from the storage backend at register). */
  private pinnedAppIds = new Set<string>();
  /**
   * Pins are persisted as the FULL array, so a toggle from a never-hydrated cache
   * would wipe the user's stored pins — toggles are gated on a successful hydration
   * (same pattern as ClientFavoritesStore) and serialized so overlapping clicks
   * compose instead of last-write-wins.
   */
  private pinsHydrated = false;
  private pinQueue: Promise<void> = Promise.resolve();
  /**
   * primaryButton per appId, captured from card-button action payloads.
   * updateAppCardButtons REQUIRES the primaryButton, so a card can only be
   * proactively resynced (dock-side star/unpin while the store is open) once
   * the user has clicked ANY of its buttons; unknown cards self-heal on the
   * next store re-render or via the intent no-op on click.
   */
  private readonly cardPrimaryButtons = new Map<string, StoreButtonConfig>();

  constructor(
    private readonly appsService: AppsService,
    private readonly favoritesService: FavoritesService,
    private readonly storefrontConfigService: StorefrontConfigService,
    private readonly entitlementsService: EntitlementsService,
    private readonly launchService: LaunchService,
    /** Optional: enable the "Add to Dock" card button (persists via the storage API). */
    private readonly storageService?: WorkspaceStorageService,
    private readonly dock3Service?: Dock3Service,
  ) {
    // Pins are owned HERE; the dock delegates un-starring a pin-backed
    // content-menu entry back to this service so the cache, storage, and
    // dock bar stay coherent through one serialized path.
    this.dock3Service?.setPinRemovalHandler((appId) =>
      this.unpinFromDock(appId),
    );
    // Dock-side changes (star/un-star, right-click removals) resync any open
    // store cards whose primaryButton we have captured.
    this.dock3Service?.onDockCompositionChanged(() => {
      void this.resyncKnownCards();
    });
  }

  /** Capture a card's primaryButton so dock-side changes can resync it later. */
  private rememberPrimaryButton(payload: StoreCustomButtonActionPayload): void {
    if (payload?.appId && payload.primaryButton) {
      this.cardPrimaryButtons.set(payload.appId, payload.primaryButton);
    }
  }

  /** Push fresh secondary buttons to every card we know the primaryButton for. */
  private async resyncKnownCards(): Promise<void> {
    if (!this.storeRegistration) return;
    for (const [appId, primaryButton] of this.cardPrimaryButtons) {
      try {
        await this.storeRegistration.updateAppCardButtons({
          appId,
          primaryButton,
          secondaryButtons: this.secondaryButtonsFor(appId),
        });
      } catch (error) {
        logger.warn('Card resync failed (non-fatal)', { appId, error });
      }
    }
  }

  /**
   * Load the user's dock pins into the sync cache. Reads via the RAW storage client
   * (which throws) rather than the degrading facade — an outage must be
   * distinguishable from "no pins", or the next toggle's full-array write would
   * wipe the user's stored pins. On failure, toggles stay disabled until a
   * successful (re-)hydration.
   */
  private async hydrateDockPins(): Promise<void> {
    if (!this.storageService) return;
    try {
      const ids = await getWorkspaceStorage().getPreference<string[]>(
        DOCK_PINNED_APPS_PREF,
      );
      this.pinnedAppIds = new Set(Array.isArray(ids) ? ids : []);
      this.pinsHydrated = true;
    } catch (error) {
      logger.warn(
        'Could not hydrate dock pins — Add to Dock disabled until storage recovers',
        error,
      );
    }
  }

  /** The card's secondary buttons — favorite toggle + dock pin toggle, always both. */
  private secondaryButtonsFor(appId: string): StoreButtonConfig[] {
    const isFav = this.favoritesService.isFavorite(appId);
    const buttons: StoreButtonConfig[] = [
      {
        title: isFav ? '★ Unfavorite' : '☆ Favorite',
        action: { id: 'toggle-store-favorite' },
      },
    ];
    if (this.storageService) {
      // Intent-carrying action ids: a STALE card (e.g. after a dock-side unpin
      // the open store can't be re-rendered) must no-op instead of inverting.
      // "On the dock" is the UNIFIED state — pin or content-menu ⭐ bookmark.
      buttons.push(
        this.isOnDock(appId)
          ? { title: '📌 Remove from Dock', action: { id: 'dock-pin-remove' } }
          : { title: '📌 Add to Dock', action: { id: 'dock-pin-add' } },
      );
    }
    return buttons;
  }

  getStoreCustomActions(): Record<string, (payload: any) => Promise<void>> {
    return {
      'toggle-store-favorite': async (event) => {
        const payload = event as StoreCustomButtonActionPayload;
        this.rememberPrimaryButton(payload);
        this.favoritesService.toggleFavorite(payload.appId);
        // Flip the card's own buttons immediately. This is the only STABLE live
        // update OpenFin supports — re-registering the provider to live-refresh the
        // left-nav Favorites section corrupts the store window's platform connection
        // ("Target is not a Workspace Platform"), so we don't do it. The Favorites
        // nav section refreshes when the user navigates or reopens the store (OpenFin
        // re-calls getNavigation() then). Guarded so a failed update never throws.
        await this.updateCardButtons(payload);
      },
      'dock-pin-add': async (event) => {
        const payload = event as StoreCustomButtonActionPayload;
        this.rememberPrimaryButton(payload);
        // Serialize: overlapping toggles must compose, not last-write-wins.
        this.pinQueue = this.pinQueue.then(() =>
          this.setDockPin(payload, true),
        );
        await this.pinQueue;
      },
      'dock-pin-remove': async (event) => {
        const payload = event as StoreCustomButtonActionPayload;
        this.rememberPrimaryButton(payload);
        this.pinQueue = this.pinQueue.then(() =>
          this.setDockPin(payload, false),
        );
        await this.pinQueue;
      },
    };
  }

  /**
   * Remove a dock pin on behalf of the DOCK (un-starring a pin-backed content-menu
   * entry). Same serialized queue + hydration gate as card toggles. The dock bar
   * refresh is triggered from here too; an open Storefront card shows the stale
   * pin state until the store re-renders (next open/navigation) — same limitation
   * as the favorites nav section.
   */
  unpinFromDock(appId: string): Promise<void> {
    this.pinQueue = this.pinQueue.then(async () => {
      if (!this.storageService) return;
      if (!this.pinsHydrated) {
        await this.hydrateDockPins();
        if (!this.pinsHydrated) {
          logger.error(
            'Dock pins unavailable (storage unreachable) — dock unpin ignored',
          );
          return;
        }
      }
      if (!this.pinnedAppIds.has(appId)) return;
      const pinned = new Set(this.pinnedAppIds);
      pinned.delete(appId);
      try {
        // Persist FIRST (writes throw) — the dock only changes when durable.
        await this.storageService.setPreference(DOCK_PINNED_APPS_PREF, [
          ...pinned,
        ]);
      } catch (error) {
        // On the save-config path the dock UI has ALREADY removed the pin
        // button locally — restore it so the bar matches the (unchanged)
        // preference instead of silently desyncing until restart.
        logger.error(
          'Dock unpin was not persisted — restoring the pin on the bar',
          error,
        );
        try {
          await this.dock3Service?.refreshPinnedApps([...this.pinnedAppIds]);
        } catch {
          /* bar restore is best-effort */
        }
        return;
      }
      this.pinnedAppIds = pinned;
      getAnalyticsNats()
        .publish({
          source: 'Dock',
          type: 'DockPin',
          action: 'Unpin',
          value: appId,
        })
        .catch(() => {});
      try {
        await this.dock3Service?.refreshPinnedApps([...pinned]);
      } catch (error) {
        logger.warn(
          'Live dock refresh failed — unpin applies on next platform start',
          error,
        );
      }
    });
    return this.pinQueue;
  }

  /** Re-render a card's secondary buttons after a toggle (non-fatal on failure). */
  private async updateCardButtons(
    payload: StoreCustomButtonActionPayload,
  ): Promise<void> {
    if (!this.storeRegistration) return;
    try {
      await this.storeRegistration.updateAppCardButtons({
        appId: payload.appId,
        primaryButton: payload.primaryButton,
        secondaryButtons: this.secondaryButtonsFor(payload.appId),
      });
    } catch (error) {
      logger.warn('updateAppCardButtons failed (non-fatal)', error);
    }
  }

  /** The unified "on the dock" state: a Storefront pin OR a content-menu ⭐ bookmark. */
  private isOnDock(appId: string): boolean {
    return (
      this.pinnedAppIds.has(appId) ||
      !!this.dock3Service?.getBookmarkedAppIds().has(appId)
    );
  }

  /**
   * 📌 button on a store card: puts the app on the dock / takes it off entirely.
   * "Remove from Dock" removes BOTH affordances (star bookmark and pin) — the
   * card, like the star, reflects the unified "on the dock" state. Pins persist
   * through the unified storage API, so in REST mode they follow the user.
   */
  private async setDockPin(
    payload: StoreCustomButtonActionPayload,
    shouldPin: boolean,
  ): Promise<void> {
    if (!this.storageService) return;
    if (!this.pinsHydrated) {
      // Boot-time hydration failed — retry now; refuse the toggle if still unknown,
      // otherwise the full-array write below would clobber the stored pins.
      await this.hydrateDockPins();
      if (!this.pinsHydrated) {
        logger.error(
          'Dock pins unavailable (storage unreachable) — toggle ignored',
        );
        return;
      }
    }
    const appId = payload.appId;
    const bookmarked = !!this.dock3Service?.getBookmarkedAppIds().has(appId);
    const isPinned = this.pinnedAppIds.has(appId);

    if (shouldPin) {
      if (isPinned || bookmarked) {
        // Stale card, or the app is already on the dock via a star bookmark:
        // the intent is satisfied — just resync the card's buttons.
        await this.updateCardButtons(payload);
        return;
      }
      const pinned = new Set(this.pinnedAppIds);
      pinned.add(appId);
      try {
        // Persist FIRST (writes throw) — the UI only flips when the pin is durable.
        await this.storageService.setPreference(DOCK_PINNED_APPS_PREF, [
          ...pinned,
        ]);
      } catch (error) {
        logger.error(
          'Dock pin was not persisted — leaving the dock unchanged',
          error,
        );
        return;
      }
      this.pinnedAppIds = pinned;
      getAnalyticsNats()
        .publish({
          source: 'Store',
          type: 'DockPin',
          action: 'Pin',
          value: appId,
        })
        .catch(() => {});
      await this.updateCardButtons(payload);
      try {
        await this.dock3Service?.refreshPinnedApps([...pinned]);
      } catch (error) {
        logger.warn(
          'Live dock refresh failed — pin applies on next platform start',
          error,
        );
      }
      return;
    }

    // Remove from Dock — take the app off entirely, whichever affordance(s)
    // put it there.
    if (!isPinned && !bookmarked) {
      await this.updateCardButtons(payload); // stale card — resync only
      return;
    }
    if (bookmarked) {
      // Dock3 removes the bookmark favorite, repaints the bar/star, persists.
      await this.dock3Service?.removeBookmarksForApp(appId);
    }
    if (isPinned) {
      const pinned = new Set(this.pinnedAppIds);
      pinned.delete(appId);
      try {
        await this.storageService.setPreference(DOCK_PINNED_APPS_PREF, [
          ...pinned,
        ]);
      } catch (error) {
        logger.error(
          'Dock unpin was not persisted — pin left in place',
          error,
        );
        await this.updateCardButtons(payload);
        return;
      }
      this.pinnedAppIds = pinned;
      getAnalyticsNats()
        .publish({
          source: 'Store',
          type: 'DockPin',
          action: 'Unpin',
          value: appId,
        })
        .catch(() => {});
      try {
        await this.dock3Service?.refreshPinnedApps([...pinned]);
      } catch (error) {
        logger.warn(
          'Live dock refresh failed — unpin applies on next platform start',
          error,
        );
      }
    }
    await this.updateCardButtons(payload);
  }

  /** Build the StorefrontProvider definition. */
  private async buildProvider(platformSettings: PlatformSettings) {
    const cardClickBehavior =
      await this.storefrontConfigService.getCardClickBehavior();
    return {
      ...platformSettings,
      // Taskbar icon for the Storefront window — raster favicon.ico, not the SVG.
      icon: toTaskbarIcon(platformSettings.icon),
      cardClickBehavior,
      getNavigation: () => this.buildNavigation(),
      getLandingPage: () => this.buildLandingPage(platformSettings),
      getFooter: () => this.buildFooter(platformSettings),
      getApps: () => this.buildDecoratedApps(),
      launchApp: async (app: MacroApp) => {
        getAnalyticsNats()
          .publish({
            source: 'Store',
            type: 'App',
            action: 'Launch',
            value: app.title || app.appId,
            data: { appId: app.appId },
          })
          .catch(() => {});
        // Entitlement gate: blocks + notifies if the user isn't entitled.
        await this.launchService.launch(app);
      },
    };
  }

  /** Decorate apps with the favorite toggle button + an entitlement hint (visible to all). */
  private async buildDecoratedApps(): Promise<MacroApp[]> {
    await this.entitlementsService.ensureLoaded();
    await this.appsService.ensureLoaded();
    const apps = (this.appsService.getApps() ?? []) as MacroApp[];
    return apps.map((app) => {
      const entitled = this.entitlementsService.canLaunch(app.appId);
      const required = this.entitlementsService.getRequiredEntitlements(
        app.appId,
      );
      return {
        ...app,
        // Hover hint for apps the user can see but not launch.
        tooltip: entitled
          ? (app.tooltip ?? app.title)
          : `🔒 Requires entitlement: ${required.join(', ')}`,
        secondaryButtons: this.secondaryButtonsFor(app.appId),
      };
    });
  }

  private filterByCategory(apps: MacroApp[], category: string): MacroApp[] {
    return category === '*'
      ? apps
      : apps.filter((a) => a.category === category);
  }

  /**
   * Nav-item filter: an app matches on `category` OR any of the item's `tags`
   * (case-insensitive) — LOB apps published via /store-apps can use either, so a
   * business-area item like FX shows category "FX" apps plus apps tagged "fx".
   */
  private filterForItem(
    apps: MacroApp[],
    item: StorefrontNavItemConfig,
  ): MacroApp[] {
    const byCategory = item.category
      ? this.filterByCategory(apps, item.category)
      : [];
    if (!item.tags?.length) return byCategory;
    const wanted = new Set(item.tags.map((t) => t.toLowerCase()));
    const matched = new Set(byCategory.map((a) => a.appId));
    const byTag = apps.filter(
      (a) =>
        !matched.has(a.appId) &&
        (a.tags ?? []).some((t) => wanted.has(String(t).toLowerCase())),
    );
    return [...byCategory, ...byTag];
  }

  private async buildNavigation(): Promise<
    [
      StorefrontNavigationSection?,
      StorefrontNavigationSection?,
      StorefrontNavigationSection?,
    ]
  > {
    const navConfig = await this.storefrontConfigService.getNavigationConfig();
    const apps = await this.buildDecoratedApps();
    const sections: StorefrontNavigationSection[] = [];

    // Dynamic Favorites section first (auto-managed; only when non-empty).
    const favoriteIds = this.favoritesService.getFavoriteIds();
    if (favoriteIds.size > 0) {
      const favApps = apps.filter((a) => favoriteIds.has(a.appId));
      if (favApps.length > 0) {
        const title = navConfig.favoritesTitle ?? 'Favorites';
        sections.push({
          id: 'favorites',
          title,
          items: [
            {
              id: 'favorite-apps',
              title,
              templateId: StorefrontTemplate.AppGrid,
              templateData: { apps: favApps },
            },
          ],
        });
      }
    }

    // Configured business-area sections.
    for (const sectionCfg of navConfig.sections ?? []) {
      const items = (sectionCfg.items ?? [])
        .slice(0, MAX_NAV_ITEMS)
        .map((item) => ({
          id: item.id,
          title: item.title,
          templateId: StorefrontTemplate.AppGrid,
          templateData: { apps: this.filterForItem(apps, item) },
        }));
      if (items.length > 0) {
        sections.push({
          id: sectionCfg.id,
          title: sectionCfg.title,
          items: items as StorefrontNavigationSection['items'],
        });
      }
    }

    if (sections.length > MAX_NAV_SECTIONS) {
      logger.warn(
        `Storefront navigation has ${sections.length} sections; OpenFin allows max ${MAX_NAV_SECTIONS}. Extra sections dropped — adjust storefront-config.json.`,
      );
    }
    return sections.slice(0, MAX_NAV_SECTIONS) as [
      StorefrontNavigationSection?,
      StorefrontNavigationSection?,
      StorefrontNavigationSection?,
    ];
  }

  private resolveRow(apps: MacroApp[], row?: StorefrontRowConfig): MacroApp[] {
    if (!row) return [];
    if (row.appIds?.length)
      return apps.filter((a) => row.appIds!.includes(a.appId));
    if (row.category) return this.filterByCategory(apps, row.category);
    return [];
  }

  private async buildLandingPage(
    platformSettings: PlatformSettings,
  ): Promise<StorefrontLandingPage> {
    const cfg = await this.storefrontConfigService.getLandingPageConfig();
    const apps = await this.buildDecoratedApps();

    const topApps = (
      this.resolveRow(apps, cfg?.topRow).length
        ? this.resolveRow(apps, cfg?.topRow)
        : apps
    ).slice(0, 4);

    const landingPage: StorefrontLandingPage = {
      topRow: {
        title: cfg?.topRow?.title ?? 'Featured',
        items: topApps as StorefrontLandingPage['topRow']['items'],
      },
      middleRow: {
        title: cfg?.middleRow?.title ?? '',
        apps: this.resolveRow(apps, cfg?.middleRow).slice(
          0,
          6,
        ) as StorefrontLandingPage['middleRow']['apps'],
      },
      bottomRow: {
        title: cfg?.bottomRow?.title ?? '',
        items: this.resolveRow(apps, cfg?.bottomRow).slice(
          0,
          3,
        ) as StorefrontLandingPage['bottomRow']['items'],
      },
    };

    if (cfg?.hero) {
      landingPage.hero = {
        title: cfg.hero.title,
        description: cfg.hero.description,
        image: { src: cfg.hero.image?.src ?? platformSettings.icon },
        cta: {
          id: 'hero-cta',
          title: cfg.hero.title,
          templateId: StorefrontTemplate.AppGrid,
          templateData: { apps: topApps },
        },
      };
    }

    return landingPage;
  }

  private async buildFooter(platformSettings: PlatformSettings) {
    const cfg = await this.storefrontConfigService.getFooterConfig();
    return {
      logo: {
        src: cfg?.logo?.src ?? platformSettings.icon,
        size: cfg?.logo?.size ?? '32',
      },
      text: cfg?.text ?? platformSettings.title,
      links: (cfg?.links ?? []).slice(0, 3) as any,
    };
  }

  register(platformSettings: PlatformSettings) {
    // Track Storefront window lifecycle and enforce theme on creation (set up once).
    // The Store window is created lazily — it doesn't exist until the user opens it.
    // When it appears, re-apply the current scheme so it renders with the platform theme.
    try {
      const app = fin.Application.getCurrentSync();
      app.on('window-created', (event: any) => {
        if (
          event.name?.includes('storefront') ||
          event.name?.includes('store')
        ) {
          getAnalyticsNats()
            .publish({
              source: 'Store',
              type: 'Storefront',
              action: 'Open',
              data: { windowName: event.name },
            })
            .catch(() => {});
          try {
            const platform = getCurrentSync();
            platform.Theme.getSelectedScheme().then((scheme) => {
              platform.Theme.setSelectedScheme(scheme);
            });
          } catch {
            /* ignore */
          }
        }
      });
    } catch {
      /* not in OpenFin */
    }

    const registration = this.hydrateDockPins()
      .then(() => this.buildProvider(platformSettings))
      .then((provider) => Storefront.register(provider));

    return from(registration).pipe(
      tap((reg) => {
        this.storeRegistration = reg;
      }),
    );
  }

  async show() {
    getAnalyticsNats()
      .publish({
        source: 'Store',
        type: 'Storefront',
        action: 'Show',
      })
      .catch(() => {});
    await Storefront.show();
    // The Storefront window is created lazily on first show — re-apply the current
    // scheme so the newly created window picks up the platform theme.
    try {
      const platform = getCurrentSync();
      const scheme = await platform.Theme.getSelectedScheme();
      await platform.Theme.setSelectedScheme(scheme);
    } catch {
      /* ignore if not in OpenFin */
    }
  }
}
