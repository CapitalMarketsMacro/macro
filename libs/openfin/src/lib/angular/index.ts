import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DOCUMENT } from '@angular/common';
import { signal } from '@angular/core';
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
export class FavoritesService extends BaseFavoritesService {}

@Injectable({ providedIn: 'root' })
export class StoreService extends BaseStoreService {
  constructor() {
    const settingsService = inject(SettingsService);
    const favoritesService = inject(FavoritesService);
    super(settingsService, favoritesService);
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
    super();
  }
}

@Injectable({ providedIn: 'root' })
export class HomeService extends BaseHomeService {
  constructor() {
    const settingsService = inject(SettingsService);
    super(settingsService);
  }
}

@Injectable({ providedIn: 'root' })
export class NotificationsService extends BaseNotificationsService {}

@Injectable({ providedIn: 'root' })
export class WorkspaceStorageService extends BaseWorkspaceStorageService {}

@Injectable({ providedIn: 'root' })
export class ThemePresetService extends BaseThemePresetService {}

@Injectable({ providedIn: 'root' })
export class SnapService extends BaseSnapService {}

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
    super(workspaceOverrideService);
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
    super(platformService, dockService, dock3Service, homeService, storeService, settingsService, storageService, themePresetService, notificationsService, snapService);
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

