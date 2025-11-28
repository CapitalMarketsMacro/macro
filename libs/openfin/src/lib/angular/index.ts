import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DOCUMENT } from '@angular/common';
import { signal } from '@angular/core';
import { SettingsService as BaseSettingsService } from '../settings.service';
import { ContextService as BaseContextService } from '../context.service';
import { ChannelService as BaseChannelService } from '../channel.service';
import { StoreService as BaseStoreService } from '../store.service';
import { DockService as BaseDockService } from '../dock.service';
import { HomeService as BaseHomeService } from '../home.service';
import { NotificationsService as BaseNotificationsService } from '../notifications.service';
import { WorkspaceOverrideService as BaseWorkspaceOverrideService } from '../workspace-override.service';
import { PlatformService as BasePlatformService } from '../platform.service';
import { WorkspaceService as BaseWorkspaceService } from '../workspace.service';
import { ThemeService as BaseThemeService } from '../theme.service';

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
export class StoreService extends BaseStoreService {
  constructor() {
    const settingsService = inject(SettingsService);
    super(settingsService);
  }
}

@Injectable({ providedIn: 'root' })
export class DockService extends BaseDockService {
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
export class NotificationsService extends BaseNotificationsService {
  constructor() {
    const settingsService = inject(SettingsService);
    super(settingsService);
  }
}

@Injectable({ providedIn: 'root' })
export class WorkspaceOverrideService extends BaseWorkspaceOverrideService {
  constructor() {
    super();
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
    const homeService = inject(HomeService);
    const storeService = inject(StoreService);
    const settingsService = inject(SettingsService);
    super(platformService, dockService, homeService, storeService, settingsService);
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

