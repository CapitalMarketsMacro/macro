import {
  Storefront,
  StorefrontTemplate,
  type StoreButtonConfig,
  type StoreRegistration,
  type StorefrontLandingPage,
  type StorefrontNavigationSection,
} from '@openfin/workspace';
import { getCurrentSync, type StoreCustomButtonActionPayload } from '@openfin/workspace-platform';
import { from, tap } from 'rxjs';
import { Logger } from '@macro/logger';
import type { MacroApp, PlatformSettings, StorefrontRowConfig } from './types';
import type { SettingsService } from './settings.service';
import type { FavoritesService } from './favorites.service';
import type { StorefrontConfigService } from './storefront-config.service';
import type { EntitlementsService } from './entitlements.service';
import type { LaunchService } from './launch.service';
import { getAnalyticsNats } from './analytics-nats.service';
import { toTaskbarIcon } from './icon-utils';

const logger = Logger.getLogger('StoreService');

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

  constructor(
    private readonly settingsService: SettingsService,
    private readonly favoritesService: FavoritesService,
    private readonly storefrontConfigService: StorefrontConfigService,
    private readonly entitlementsService: EntitlementsService,
    private readonly launchService: LaunchService,
  ) {}

  getStoreCustomActions(): Record<string, (payload: any) => Promise<void>> {
    return {
      'toggle-store-favorite': async (event) => {
        const payload = event as StoreCustomButtonActionPayload;
        this.favoritesService.toggleFavorite(payload.appId);
        const isFav = this.favoritesService.isFavorite(payload.appId);
        if (this.storeRegistration) {
          await this.storeRegistration.updateAppCardButtons({
            appId: payload.appId,
            primaryButton: payload.primaryButton,
            secondaryButtons: [
              {
                title: isFav ? '★ Unfavorite' : '☆ Favorite',
                action: { id: 'toggle-store-favorite' },
              },
            ],
          });
        }
      },
    };
  }

  /** Decorate apps with the favorite toggle button + an entitlement hint (visible to all). */
  private async buildDecoratedApps(): Promise<MacroApp[]> {
    await this.entitlementsService.ensureLoaded();
    const apps = (this.settingsService.getApps() ?? []) as MacroApp[];
    return apps.map((app) => {
      const entitled = this.entitlementsService.canLaunch(app.appId);
      const required = this.entitlementsService.getRequiredEntitlements(app.appId);
      const isFav = this.favoritesService.isFavorite(app.appId);
      return {
        ...app,
        // Hover hint for apps the user can see but not launch.
        tooltip: entitled
          ? (app.tooltip ?? app.title)
          : `🔒 Requires entitlement: ${required.join(', ')}`,
        secondaryButtons: [
          {
            title: isFav ? '★ Unfavorite' : '☆ Favorite',
            action: { id: 'toggle-store-favorite' },
          },
        ] as StoreButtonConfig[],
      };
    });
  }

  private filterByCategory(apps: MacroApp[], category: string): MacroApp[] {
    return category === '*' ? apps : apps.filter((a) => a.category === category);
  }

  private async buildNavigation(): Promise<
    [StorefrontNavigationSection?, StorefrontNavigationSection?, StorefrontNavigationSection?]
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
      const items = (sectionCfg.items ?? []).slice(0, MAX_NAV_ITEMS).map((item) => ({
        id: item.id,
        title: item.title,
        templateId: StorefrontTemplate.AppGrid,
        templateData: { apps: this.filterByCategory(apps, item.category) },
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
    if (row.appIds?.length) return apps.filter((a) => row.appIds!.includes(a.appId));
    if (row.category) return this.filterByCategory(apps, row.category);
    return [];
  }

  private async buildLandingPage(platformSettings: PlatformSettings): Promise<StorefrontLandingPage> {
    const cfg = await this.storefrontConfigService.getLandingPageConfig();
    const apps = await this.buildDecoratedApps();

    const topApps = (this.resolveRow(apps, cfg?.topRow).length
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
        apps: this.resolveRow(apps, cfg?.middleRow).slice(0, 6) as StorefrontLandingPage['middleRow']['apps'],
      },
      bottomRow: {
        title: cfg?.bottomRow?.title ?? '',
        items: this.resolveRow(apps, cfg?.bottomRow).slice(0, 3) as StorefrontLandingPage['bottomRow']['items'],
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
      logo: { src: cfg?.logo?.src ?? platformSettings.icon, size: cfg?.logo?.size ?? '32' },
      text: cfg?.text ?? platformSettings.title,
      links: (cfg?.links ?? []).slice(0, 3) as any,
    };
  }

  register(platformSettings: PlatformSettings) {
    // Track Storefront window lifecycle and enforce theme on creation.
    // The Store window is created lazily — it doesn't exist until the user opens it.
    // When it appears, re-apply the current scheme so it renders with the platform theme.
    try {
      const app = fin.Application.getCurrentSync();
      app.on('window-created', (event: any) => {
        if (event.name?.includes('storefront') || event.name?.includes('store')) {
          getAnalyticsNats().publish({
            source: 'Store', type: 'Storefront', action: 'Open',
            data: { windowName: event.name },
          }).catch(() => {});
          try {
            const platform = getCurrentSync();
            platform.Theme.getSelectedScheme().then((scheme) => {
              platform.Theme.setSelectedScheme(scheme);
            });
          } catch { /* ignore */ }
        }
      });
    } catch { /* not in OpenFin */ }

    const registration = (async () => {
      const cardClickBehavior = await this.storefrontConfigService.getCardClickBehavior();
      return Storefront.register({
        ...platformSettings,
        // Taskbar icon for the Storefront window — raster favicon.ico, not the SVG.
        icon: toTaskbarIcon(platformSettings.icon),
        cardClickBehavior,
        getNavigation: () => this.buildNavigation(),
        getLandingPage: () => this.buildLandingPage(platformSettings),
        getFooter: () => this.buildFooter(platformSettings),
        getApps: () => this.buildDecoratedApps(),
        launchApp: async (app) => {
          getAnalyticsNats().publish({
            source: 'Store', type: 'App', action: 'Launch',
            value: app.title || app.appId,
            data: { appId: app.appId },
          }).catch(() => {});
          // Entitlement gate: blocks + notifies if the user isn't entitled.
          await this.launchService.launch(app);
        },
      });
    })();

    return from(registration).pipe(
      tap((reg) => {
        this.storeRegistration = reg;
      }),
    );
  }

  async show() {
    getAnalyticsNats().publish({
      source: 'Store', type: 'Storefront', action: 'Show',
    }).catch(() => {});
    await Storefront.show();
    // The Storefront window is created lazily on first show — re-apply the current
    // scheme so the newly created window picks up the platform theme.
    try {
      const platform = getCurrentSync();
      const scheme = await platform.Theme.getSelectedScheme();
      await platform.Theme.setSelectedScheme(scheme);
    } catch { /* ignore if not in OpenFin */ }
  }
}
