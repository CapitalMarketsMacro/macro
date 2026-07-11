import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DOCUMENT } from '@angular/common';
import { signal } from '@angular/core';
import { Logger } from '@macro/logger';
import { SettingsService as BaseSettingsService } from '../settings.service';
import { ContextService as BaseContextService } from '../context.service';
import { ChannelService as BaseChannelService } from '../channel.service';
import { StoreService as BaseStoreService } from '../store.service';
import { FavoritesService as BaseFavoritesService } from '../favorites.service';
import { DockService as BaseDockService } from '../dock.service';
import { Dock3Service as BaseDock3Service } from '../dock3.service';
import { HomeService as BaseHomeService } from '../home.service';
import { NotificationsService as BaseNotificationsService } from '../notifications.service';
import { WorkspaceStorageService as BaseWorkspaceStorageService } from '../workspace-storage.service';
import { WorkspaceOverrideService as BaseWorkspaceOverrideService } from '../workspace-override.service';
import { PlatformService as BasePlatformService } from '../platform.service';
import { WorkspaceService as BaseWorkspaceService } from '../workspace.service';
import { ThemeService as BaseThemeService } from '../theme.service';
import { ViewStateService as BaseViewStateService } from '../view-state.service';
import { ThemePresetService as BaseThemePresetService } from '../theme-preset.service';
import { SnapService as BaseSnapService } from '../snap.service';
import { AuthService as BaseAuthService } from '../auth.service';
import { EntitlementsService as BaseEntitlementsService } from '../entitlements.service';
import { LaunchService as BaseLaunchService } from '../launch.service';
import { StorefrontConfigService as BaseStorefrontConfigService } from '../storefront-config.service';
import { AppsService as BaseAppsService } from '../apps.service';
import { DockConfigService as BaseDockConfigService } from '../dock-config.service';
import { SnapConfigService as BaseSnapConfigService } from '../snap-config.service';
import { resolveEnvConfigPath } from '../config-path';
import { ClientFavoritesStore, onWorkspaceStorageInitialized, resolveConfigUrl } from '../storage/storage-context';

/**
 * Angular wrapper services for @macro/openfin
 * These provide Angular dependency injection while using the framework-agnostic base services
 */

@Injectable({ providedIn: 'root' })
export class SettingsService extends BaseSettingsService {
  constructor() {
    const http = inject(HttpClient);
    super({
      get: <T>(url: string) => http.get<T>(url).toPromise() as Promise<T>,
    });
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService extends BaseAuthService {
  constructor() {
    const http = inject(HttpClient);
    super(
      { get: <T>(url: string) => http.get<T>(url).toPromise() as Promise<T> },
      () => resolveEnvConfigPath('entitlements.json'),
    );
  }
}

@Injectable({ providedIn: 'root' })
export class EntitlementsService extends BaseEntitlementsService {
  constructor() {
    super(inject(AuthService));
  }
}

// Content config (storefront/apps/dock/snap) resolves through the unified storage
// context: static per-env JSON in "local" storage mode, the storage service's
// /config/* endpoints in REST mode. The lambdas are evaluated lazily at load() time —
// after the storage environment has been initialized during platform boot.
// When the storage service is unreachable, the adapter falls back to the static file
// (always deployed with the app) so a storage outage degrades to baseline config
// instead of an empty store/dock — and because the config services memoize failures,
// an un-fallen-back error would otherwise stick for the whole session.
const configLogger = Logger.getLogger('ConfigHttp');
function configHttpWithStaticFallback(http: HttpClient, fileName: string): { get: <T>(url: string) => Promise<T> } {
  return {
    get: async <T>(url: string): Promise<T> => {
      try {
        return (await http.get<T>(url).toPromise()) as T;
      } catch (error) {
        const staticUrl = resolveEnvConfigPath(fileName);
        if (url === staticUrl) throw error;
        configLogger.warn(`Config fetch failed from ${url} — falling back to static ${staticUrl}`, error);
        return (await http.get<T>(staticUrl).toPromise()) as T;
      }
    },
  };
}

@Injectable({ providedIn: 'root' })
export class StorefrontConfigService extends BaseStorefrontConfigService {
  constructor() {
    super(configHttpWithStaticFallback(inject(HttpClient), 'storefront-config.json'), () => resolveConfigUrl('storefront-config.json'));
  }
}

@Injectable({ providedIn: 'root' })
export class AppsService extends BaseAppsService {
  constructor() {
    super(configHttpWithStaticFallback(inject(HttpClient), 'apps.json'), () => resolveConfigUrl('apps.json'));
  }
}

@Injectable({ providedIn: 'root' })
export class DockConfigService extends BaseDockConfigService {
  constructor() {
    super(configHttpWithStaticFallback(inject(HttpClient), 'dock-config.json'), () => resolveConfigUrl('dock-config.json'));
  }
}

@Injectable({ providedIn: 'root' })
export class SnapConfigService extends BaseSnapConfigService {
  constructor() {
    super(configHttpWithStaticFallback(inject(HttpClient), 'snap-config.json'), () => resolveConfigUrl('snap-config.json'));
  }
}

@Injectable({ providedIn: 'root' })
export class ContextService extends BaseContextService {
  constructor() {
    super();
  }
}

@Injectable({ providedIn: 'root' })
export class ChannelService extends BaseChannelService {
  constructor() {
    super();
  }
}

@Injectable({ providedIn: 'root' })
export class FavoritesService extends BaseFavoritesService {
  constructor() {
    // ClientFavoritesStore rides the unified storage backend (localStorage or the
    // per-environment REST service) and waits for environment selection during boot.
    super(new ClientFavoritesStore(), inject(AuthService));
    // Load the current user's persisted favorites at startup, and re-load whenever the
    // storage context (re)initializes — the DI-time hydrate can race environment
    // selection during a slow boot, and only a load against the real backend unlocks
    // write-through in ClientFavoritesStore.
    void this.hydrate();
    onWorkspaceStorageInitialized(() => void this.hydrate());
  }
}

@Injectable({ providedIn: 'root' })
export class StoreService extends BaseStoreService {
  constructor() {
    super(
      inject(AppsService),
      inject(FavoritesService),
      inject(StorefrontConfigService),
      inject(EntitlementsService),
      inject(LaunchService),
    );
  }
}

@Injectable({ providedIn: 'root' })
export class DockService extends BaseDockService {
  constructor() {
    super();
  }
}

@Injectable({ providedIn: 'root' })
export class Dock3Service extends BaseDock3Service {
  constructor() {
    // WorkspaceStorageService enables LOB dock apps published via the storage API.
    super(inject(LaunchService), inject(AppsService), inject(DockConfigService), inject(WorkspaceStorageService));
  }
}

@Injectable({ providedIn: 'root' })
export class HomeService extends BaseHomeService {
  constructor() {
    super(inject(AppsService), inject(LaunchService));
  }
}

@Injectable({ providedIn: 'root' })
export class NotificationsService extends BaseNotificationsService {}

@Injectable({ providedIn: 'root' })
export class LaunchService extends BaseLaunchService {
  constructor() {
    super(inject(EntitlementsService), inject(NotificationsService));
  }
}

@Injectable({ providedIn: 'root' })
export class WorkspaceStorageService extends BaseWorkspaceStorageService {}

@Injectable({ providedIn: 'root' })
export class ThemePresetService extends BaseThemePresetService {}

@Injectable({ providedIn: 'root' })
export class SnapService extends BaseSnapService {
  constructor() {
    super(inject(SnapConfigService));
  }
}

@Injectable({ providedIn: 'root' })
export class WorkspaceOverrideService extends BaseWorkspaceOverrideService {
  constructor() {
    const storageService = inject(WorkspaceStorageService);
    const snapService = inject(SnapService);
    super(storageService, snapService);
  }
}

@Injectable({ providedIn: 'root' })
export class PlatformService extends BasePlatformService {
  constructor() {
    const workspaceOverrideService = inject(WorkspaceOverrideService);
    super(workspaceOverrideService, inject(LaunchService));
  }
}

@Injectable({ providedIn: 'root' })
export class WorkspaceService extends BaseWorkspaceService {
  constructor() {
    const platformService = inject(PlatformService);
    const dockService = inject(DockService);
    const dock3Service = inject(Dock3Service);
    const homeService = inject(HomeService);
    const storeService = inject(StoreService);
    const settingsService = inject(SettingsService);
    const storageService = inject(WorkspaceStorageService);
    const themePresetService = inject(ThemePresetService);
    const notificationsService = inject(NotificationsService);
    const snapService = inject(SnapService);
    const authService = inject(AuthService);
    super(platformService, dockService, dock3Service, homeService, storeService, settingsService, storageService, themePresetService, notificationsService, snapService, authService);
  }
}

@Injectable({ providedIn: 'root' })
export class ThemeService extends BaseThemeService {
  readonly isDark = signal(true);
  readonly currentPalette = signal(this.getCurrentPalette());

  constructor() {
    const document = inject(DOCUMENT);
    super(document, (theme, palette) => {
      this.isDark.set(theme === 'dark');
      this.currentPalette.set(palette);
    });
  }
}

@Injectable({ providedIn: 'root' })
export class ViewStateService extends BaseViewStateService {}

