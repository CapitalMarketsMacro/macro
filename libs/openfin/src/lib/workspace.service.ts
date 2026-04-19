import { BehaviorSubject, Observable, catchError, concatMap, delay, forkJoin, from, map, of, tap } from 'rxjs';
import type { CustomSettings, PlatformSettings } from './types';
import { PlatformService } from './platform.service';
import { SettingsService } from './settings.service';
import { DockService } from './dock.service';
import { Dock3Service } from './dock3.service';
import { HomeService } from './home.service';
import { StoreService } from './store.service';
import { NotificationsService } from './notifications.service';
import { WorkspaceStorageService } from './workspace-storage.service';
import { ThemePresetService } from './theme-preset.service';
import { SnapService } from './snap.service';
import { getCurrentSync } from '@openfin/workspace-platform';
import { Logger } from '@macro/logger';
import { getAnalyticsNats } from './analytics-nats.service';

const logger = Logger.getLogger('WorkspaceService');

/**
 * Workspace service for managing the OpenFin workspace platform initialization
 * Framework-agnostic implementation
 */
export class WorkspaceService {
  private readonly platformService: PlatformService;
  private readonly dockService: DockService;
  private readonly dock3Service: Dock3Service;
  private readonly homeService: HomeService;
  private readonly storeService: StoreService;
  private readonly settingsService: SettingsService;
  private readonly storageService: WorkspaceStorageService;
  private readonly themePresetService: ThemePresetService;
  private readonly notificationsService: NotificationsService;
  private readonly snapService: SnapService;

  private readonly status$ = new BehaviorSubject<string>('');

  constructor(
    platformService: PlatformService,
    dockService: DockService,
    dock3Service: Dock3Service,
    homeService: HomeService,
    storeService: StoreService,
    settingsService: SettingsService,
    storageService: WorkspaceStorageService,
    themePresetService: ThemePresetService,
    notificationsService: NotificationsService,
    snapService: SnapService,
  ) {
    this.platformService = platformService;
    this.dockService = dockService;
    this.dock3Service = dock3Service;
    this.homeService = homeService;
    this.storeService = storeService;
    this.settingsService = settingsService;
    this.storageService = storageService;
    this.themePresetService = themePresetService;
    this.notificationsService = notificationsService;
    this.snapService = snapService;
  }

  init() {
    if (!this.isOpenFin()) {
      this.status$.next('Not running inside OpenFin');
      return of(false);
    }

    this.status$.next('Workspace platform initializing...');
    const nats = getAnalyticsNats();
    nats.publish({ source: 'Platform', type: 'Lifecycle', action: 'Starting' }).catch(() => {});

    return forkJoin([
      from(this.settingsService.getManifestSettings()),
      from(this.themePresetService.loadActivePreset()),
    ]).pipe(
      tap(() => nats.publish({ source: 'Platform', type: 'Lifecycle', action: 'SettingsLoaded' }).catch(() => {})),
      concatMap(([settings, themePalettes]) =>
        this.platformService.initializeWorkspacePlatform(
          settings.platformSettings,
          themePalettes,
          this.storeService.getStoreCustomActions(),
        ).pipe(
          tap(() => nats.publish({ source: 'Platform', type: 'Lifecycle', action: 'PlatformCreated' }).catch(() => {})),
          concatMap(() => this.awaitPlatformReady()),
          tap(() => nats.publish({ source: 'Platform', type: 'Lifecycle', action: 'PlatformReady' }).catch(() => {})),
          concatMap(() => this.registerComponents(settings)),
          tap(() => nats.publish({ source: 'Platform', type: 'Lifecycle', action: 'ComponentsRegistered',
            data: { components: ['dock', 'home', 'store', 'notifications', 'snap'] } }).catch(() => {})),
          concatMap(() => this.showStartupComponents()),
          concatMap(() => this.restoreLastSavedWorkspace()),
          delay(500),
          concatMap(() => from(this.platformService.updateToolbarButtons())),
          tap(() => {
            this.status$.next('Platform initialized');
            nats.publish({ source: 'Platform', type: 'Lifecycle', action: 'Initialized' }).catch(() => {});
            // Set app log username after full platform init
            this.setAppLogUsername().catch(() => {
              logger.warn('Error Setting Log Name ')
            });
          }),
        ),
      ),
      map(() => true),
      catchError((error) => {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('Error initializing platform', { message, error });
        this.status$.next(`Error: ${message}`);
        nats.publish({ source: 'Platform', type: 'Lifecycle', action: 'Error', value: message }).catch(() => {});
        return of(false);
      }),
    );
  }

  /**
   * Restore last saved workspace using the v24 built-in API.
   * Returns 'success', 'not-saved-workspace', or 'user-declined'.
   */
  private restoreLastSavedWorkspace(): Observable<void> {
    return new Observable<void>((observer) => {
      this.restoreLastSavedWorkspaceAsync()
        .then(() => {
          observer.next();
          observer.complete();
        })
        .catch((error) => {
          logger.error('Error in restoreLastSavedWorkspace', error);
          this.status$.next('Error restoring workspace');
          observer.next();
          observer.complete();
        });
    });
  }

  private async restoreLastSavedWorkspaceAsync(): Promise<void> {
    const nats = getAnalyticsNats();
    this.status$.next('Restoring last saved workspace...');

    const workspacePlatform = getCurrentSync();
    try {
      // v24: Use built-in restoreLastSavedWorkspace() instead of manual lookup + apply
      const result = await workspacePlatform.restoreLastSavedWorkspace({
        skipPrompt: true,
        applySnapshotOptions: {
          closeExistingWindows: true,
        },
      });

      switch (result) {
        case 'success':
          this.status$.next('Restored last saved workspace');
          nats.publish({ source: 'Platform', type: 'Workspace', action: 'Restored' }).catch(() => {});
          break;
        case 'not-saved-workspace':
          this.status$.next('No saved workspace found');
          nats.publish({ source: 'Platform', type: 'Workspace', action: 'NoSavedWorkspace' }).catch(() => {});
          break;
        case 'user-declined':
          this.status$.next('Workspace restore declined');
          nats.publish({ source: 'Platform', type: 'Workspace', action: 'RestoreDeclined' }).catch(() => {});
          break;
        default:
          this.status$.next('Workspace restore completed');
          break;
      }
    } catch (error) {
      logger.error('Error restoring workspace', error);
      this.status$.next('Error restoring workspace');
      nats.publish({ source: 'Platform', type: 'Workspace', action: 'RestoreError',
        value: String(error) }).catch(() => {});
    }
  }

  private awaitPlatformReady() {
    return new Observable<void>((observer) => {
      const platform = fin.Platform.getCurrentSync();
      platform.once('platform-api-ready', () => {
        this.status$.next('Platform API ready...');
        observer.next();
        observer.complete();
      });
    });
  }

  private registerComponents({
    platformSettings,
    customSettings,
  }: {
    platformSettings: PlatformSettings;
    customSettings?: CustomSettings;
  }) {
    this.status$.next('Registering workspace components...');
    // Register Home, Store, Notifications, Snap first — the Dock's workspace
    // buttons (home, store, notifications) only render if those providers are
    // already registered. Then init Dock3 so it discovers all providers.
    return forkJoin([
      this.homeService.register(platformSettings),
      this.storeService.register(platformSettings),
      from(this.notificationsService.register(platformSettings)),
      from(this.snapService.init(platformSettings.id, customSettings?.snapProvider)),
    ]).pipe(
      concatMap(() =>
        from(
          this.dock3Service.init(
            platformSettings,
            customSettings?.apps,
            customSettings?.dock3
          )
        )
      ),
    );
  }

  private showStartupComponents() {
    // Dock3 auto-shows on init; also show Home and Store at startup
    return forkJoin([
      from(this.homeService.show()),
      from(this.storeService.show()),
    ]).pipe(map(() => undefined));
  }

  private async setAppLogUsername(retries = 5, delayMs = 2000): Promise<void> {
    if (!this.isOpenFin()) return;
    const username = await fin.System.getEnvironmentVariable('USERNAME');
    if (!username) {
      logger.warn('USERNAME environment variable is empty, skipping setAppLogUsername');
      return;
    }
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const app = await fin.Application.getCurrent();
        await app.setAppLogUsername(username);
        logger.info('App log username set', { username, attempt });
        return;
      } catch (err) {
        logger.warn(`setAppLogUsername attempt ${attempt}/${retries} failed`, err);
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
    }
    logger.error('setAppLogUsername failed after all retries');
  }

  private isOpenFin() {
    return typeof fin !== 'undefined' && !!fin.me?.isOpenFin;
  }

  quit() {
    if (this.isOpenFin()) {
      const nats = getAnalyticsNats();
      nats.publish({
        source: 'Platform', type: 'Lifecycle', action: 'Quitting',
      }).catch(() => {});
      Promise.all([
        this.dock3Service.shutdown(),
        this.notificationsService.deregister(),
        this.snapService.stop(),
      ]).finally(async () => {
        await nats.publish({ source: 'Platform', type: 'Lifecycle', action: 'Quit' }).catch(() => {});
        await nats.disconnect().catch(() => {});
        fin.Platform.getCurrentSync().quit();
      });
    }
  }

  getStatus$(): Observable<string> {
    return this.status$.asObservable();
  }
}

