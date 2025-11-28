import { Storefront, StorefrontTemplate } from '@openfin/workspace';
import { from } from 'rxjs';
import { launchApp } from './launch';
import type { PlatformSettings } from './types';
import type { SettingsService } from './settings.service';

/**
 * Store service for managing the OpenFin Storefront
 * Framework-agnostic implementation
 */
export class StoreService {
  constructor(private readonly settingsService: SettingsService) {}

  register(platformSettings: PlatformSettings) {
    const apps = this.settingsService.getApps();

    return from(
      Storefront.register({
        ...platformSettings,
        getNavigation: async () => [
          {
            id: 'apps',
            title: 'Apps',
            items: [
              {
                id: 'all-apps',
                title: 'All Apps',
                templateId: StorefrontTemplate.AppGrid,
                templateData: {
                  apps: apps ?? [],
                },
              },
            ],
          },
        ],
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
                  apps: apps ?? [],
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
        getApps: async () => apps ?? [],
        launchApp: async (app) => {
          await launchApp(app);
        },
      }),
    );
  }

  show() {
    return Storefront.show();
  }
}

