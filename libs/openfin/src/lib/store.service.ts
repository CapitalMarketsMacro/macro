import {
  Storefront,
  StorefrontTemplate,
  type StoreButtonConfig,
  type StoreRegistration,
  type StorefrontNavigationSection,
} from '@openfin/workspace';
import { getCurrentSync, type StoreCustomButtonActionPayload } from '@openfin/workspace-platform';
import { from, tap } from 'rxjs';
import { launchApp } from './launch';
import type { PlatformSettings } from './types';
import type { SettingsService } from './settings.service';
import type { FavoritesService } from './favorites.service';
import { getAnalyticsNats } from './analytics-nats.service';

/**
 * Store service for managing the OpenFin Storefront
 * Framework-agnostic implementation
 */
export class StoreService {
  private storeRegistration: StoreRegistration | null = null;

  constructor(
    private readonly settingsService: SettingsService,
    private readonly favoritesService: FavoritesService
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

  register(platformSettings: PlatformSettings) {
    const apps = this.settingsService.getApps();
    const decoratedApps = (apps ?? []).map((app) => ({
      ...app,
      secondaryButtons: [
        {
          title: this.favoritesService.isFavorite(app.appId)
            ? '★ Unfavorite'
            : '☆ Favorite',
          action: { id: 'toggle-store-favorite' },
        },
      ] as StoreButtonConfig[],
    }));

    // Track Storefront window lifecycle and enforce theme on creation.
    // The Store window is created lazily — it doesn't exist until the user
    // opens it via Dock/Home. When it appears, re-apply the current scheme
    // so it renders dark (OpenFin defaults to light for new windows).
    try {
      const app = fin.Application.getCurrentSync();
      app.on('window-created', (event: any) => {
        if (event.name?.includes('storefront') || event.name?.includes('store')) {
          getAnalyticsNats().publish({
            source: 'Store', type: 'Storefront', action: 'Open',
            data: { windowName: event.name },
          }).catch(() => {});
          // Re-apply current scheme to the newly created Store window
          try {
            const platform = getCurrentSync();
            platform.Theme.getSelectedScheme().then((scheme) => {
              platform.Theme.setSelectedScheme(scheme);
            });
          } catch { /* ignore */ }
        }
      });
    } catch { /* not in OpenFin */ }

    return from(
      Storefront.register({
        ...platformSettings,
        // v24: Click app card to launch directly instead of showing details panel
        cardClickBehavior: 'perform-primary-button-action' as any,
        getNavigation: async (): Promise<
          [
            StorefrontNavigationSection?,
            StorefrontNavigationSection?,
            StorefrontNavigationSection?,
          ]
        > => {
          const favoriteIds = this.favoritesService.getFavoriteIds();
          const favoriteApps =
            favoriteIds.size > 0
              ? decoratedApps.filter((a) => favoriteIds.has(a.appId))
              : [];

          const appsSection: StorefrontNavigationSection = {
            id: 'apps',
            title: 'Apps',
            items: [
              {
                id: 'all-apps',
                title: 'All Apps',
                templateId: StorefrontTemplate.AppGrid,
                templateData: { apps: decoratedApps },
              },
            ],
          };

          if (favoriteApps.length > 0) {
            const favSection: StorefrontNavigationSection = {
              id: 'favorites',
              title: 'Favorites',
              items: [
                {
                  id: 'favorite-apps',
                  title: 'Favorite Apps',
                  templateId: StorefrontTemplate.AppGrid,
                  templateData: { apps: favoriteApps },
                },
              ],
            };
            return [favSection, appsSection];
          }

          return [appsSection];
        },
        getLandingPage: async () => ({
          topRow: {
            title: 'Featured',
            items: [
              {
                id: 'top-row-item-1',
                title: 'All Apps',
                description: 'Applications exposed through this workspace.',
                image: {
                  src: platformSettings.icon,
                },
                templateId: StorefrontTemplate.AppGrid,
                templateData: {
                  apps: decoratedApps,
                },
              },
            ],
          },
          middleRow: { title: '', apps: [] },
          bottomRow: { title: '', items: [] },
        }),
        getFooter: async () => ({
          logo: { src: platformSettings.icon, size: '32' },
          text: platformSettings.title,
          links: [],
        }),
        getApps: async () => decoratedApps,
        launchApp: async (app) => {
          getAnalyticsNats().publish({
            source: 'Store', type: 'App', action: 'Launch',
            value: app.title || app.appId,
            data: { appId: app.appId },
          }).catch(() => {});
          await launchApp(app);
        },
      }),
    ).pipe(
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
    // The Storefront window is created lazily on first show.
    // Re-apply the current scheme so the newly created window picks it up —
    // without this, the Store renders with OpenFin's default light theme.
    try {
      const platform = getCurrentSync();
      const scheme = await platform.Theme.getSelectedScheme();
      await platform.Theme.setSelectedScheme(scheme);
    } catch { /* ignore if not in OpenFin */ }
  }
}

