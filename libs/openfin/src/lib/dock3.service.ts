import {
  Dock,
  getCurrentSync,
  type Dock3Config,
  type Dock3Provider,
  type LaunchDockEntryPayload,
} from '@openfin/workspace-platform';
import type { App } from '@openfin/workspace';
import { Logger } from '@macro/logger';
import { getAnalyticsNats } from './analytics-nats.service';
import type {
  PlatformSettings,
  Dock3Settings,
  Dock3FavoriteEntry,
  Dock3ContentEntry,
} from './types';

const logger = Logger.getLogger('Dock3Service');

/** Dock favorite/content-menu item entry (matches OpenFin DockEntry 'item' variant) */
type DockItemEntry = {
  type: 'item';
  id: string;
  icon: string;
  label: string;
  itemData?: any;
};

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
  icon: string;
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

  async init(
    platformSettings: PlatformSettings,
    apps?: App[],
    dock3Settings?: Dock3Settings
  ): Promise<void> {
    const favorites = this.buildFavorites(
      dock3Settings?.favorites,
      apps,
      platformSettings.icon
    );
    const contentMenu = this.buildContentMenu(
      dock3Settings?.contentMenu,
      apps,
      platformSettings.icon
    );

    const config: Dock3Config = {
      title: platformSettings.title,
      icon: platformSettings.icon,
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
        moreMenu: {
          moreMenuCustomOption: {
            label: 'Tools',
            options: [
              { tooltip: 'Analytics Dashboard', iconUrl: platformSettings.icon } as any,
            ],
          },
        },
      },
    };

    logger.info('Initializing Dock3', {
      favoritesCount: favorites.length,
      contentMenuCount: contentMenu.length,
    });

    this.provider = await Dock.init({
      config,
      windowOptions: {
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
      } as any,
      override: (Base) =>
        class extends Base {
          // Always use fresh config from settings.json instead of stale IndexedDB cache.
          // This ensures icon URL changes and config updates take effect immediately.
          override async loadConfig(): Promise<Dock3Config> {
            return config;
          }

          override async moreMenuCustomOptionClicked(payload: any) {
            const { label, customData } = payload;
            logger.info('Dock3 more menu custom option clicked', { label });
            getAnalyticsNats().publish({
              source: 'Dock', type: 'MoreMenu', action: 'CustomOption',
              value: label,
            }).catch(() => {});
            if (customData?.manifest) {
              const platform = getCurrentSync();
              await platform.createView({ manifestUrl: customData.manifest });
            }
          }

          override async launchEntry(payload: LaunchDockEntryPayload) {
            const { entry } = payload;
            if (entry.type !== 'item') return;
            getAnalyticsNats().publish({
              source: 'Dock', type: 'App', action: 'Launch',
              value: entry.label || entry.id,
              data: { entryId: entry.id, appId: (entry.itemData as any)?.appId },
            }).catch(() => {});

            const appId = entry.itemData?.appId as string | undefined;
            const url = entry.itemData?.url as string | undefined;

            if (appId && apps) {
              const app = apps.find((a) => a.appId === appId);
              if (app?.manifest) {
                logger.info('Dock3 launching app', { appId, manifest: app.manifest });
                const platform = getCurrentSync();
                await platform.createView({ manifestUrl: app.manifest });
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
    logger.info('Dock3 initialized');
  }

  async shutdown(): Promise<void> {
    if (this.provider) {
      await this.provider.shutdown();
      this.provider = null;
      logger.info('Dock3 shut down');
    }
  }

  private buildFavorites(
    settingsFavorites: Dock3FavoriteEntry[] | undefined,
    apps: App[] | undefined,
    defaultIcon: string
  ): DockItemEntry[] {
    if (!settingsFavorites?.length) return [];

    return settingsFavorites.map((fav) => {
      const app = fav.appId ? apps?.find((a) => a.appId === fav.appId) : undefined;
      return {
        type: 'item' as const,
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
    defaultIcon: string
  ): ContentMenuNode[] {
    if (!settingsMenu?.length) return [];

    return settingsMenu.map((entry) => this.mapContentEntry(entry, apps, defaultIcon));
  }

  private mapContentEntry(
    entry: Dock3ContentEntry,
    apps: App[] | undefined,
    defaultIcon: string
  ): ContentMenuNode {
    if (entry.type === 'folder') {
      return {
        type: 'folder' as const,
        id: entry.id,
        label: entry.label,
        children: entry.children.map((child) =>
          this.mapContentEntry(child, apps, defaultIcon)
        ),
      };
    }

    const app = entry.appId ? apps?.find((a) => a.appId === entry.appId) : undefined;
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
