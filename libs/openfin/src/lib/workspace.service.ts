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
import { getCurrentSync } from '@openfin/workspace-platform';
import { Logger } from '@macro/logger';

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
  }

  init() {
    if (!this.isOpenFin()) {
      this.status$.next('Not running inside OpenFin');
      return of(false);
    }

    this.status$.next('Workspace platform initializing...');

    return forkJoin([
      from(this.settingsService.getManifestSettings()),
      from(this.themePresetService.loadActivePreset()),
    ]).pipe(
      concatMap(([settings, themePalettes]) =>
        this.platformService.initializeWorkspacePlatform(
          settings.platformSettings,
          themePalettes,
          this.storeService.getStoreCustomActions(),
        ).pipe(
          concatMap(() => this.awaitPlatformReady()),
          concatMap(() => this.registerComponents(settings)),
          concatMap(() => this.showStartupComponents()),
          concatMap(() => this.restoreLastSavedWorkspace()),
          // Update toolbar buttons on all windows after restore (snapshots carry old toolbar config)
          delay(500),
          concatMap(() => from(this.platformService.updateToolbarButtons())),
          tap(() => this.status$.next('Platform initialized')),
        ),
      ),
      map(() => true),
      catchError((error) => {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('Error initializing platform', { message, error });
        this.status$.next(`Error: ${message}`);
        return of(false);
      }),
    );
  }

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
    const lastSavedId = await this.storageService.getLastSavedWorkspaceId();
    if (!lastSavedId) {
      this.status$.next('No saved workspace found');
      return;
    }

    this.status$.next('Restoring last saved workspace...');

    const workspaces = await this.storageService.getWorkspaces();
    const workspace = workspaces.find((w) => w.workspaceId === lastSavedId);

    if (!workspace) {
      this.status$.next('Last saved workspace not found');
      return;
    }

    const workspacePlatform = getCurrentSync();
    try {
      const result = await workspacePlatform.applyWorkspace(workspace, {
        skipPrompt: true,
        applySnapshotOptions: {
          closeExistingWindows: true,
        },
      });
      if (result) {
        this.status$.next(`Restored workspace: ${workspace.title}`);
      } else {
        this.status$.next('Failed to restore workspace');
      }
    } catch (error) {
      logger.error('Error restoring workspace', error);
      this.status$.next('Error restoring workspace');
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
    return forkJoin([
      from(
        this.dock3Service.init(
          platformSettings,
          customSettings?.apps,
          customSettings?.dock3
        )
      ),
      this.homeService.register(platformSettings),
      this.storeService.register(platformSettings),
      from(this.notificationsService.register(platformSettings)),
    ]);
  }

  private showStartupComponents() {
    // Dock3 auto-shows on init, only need to show Home
    return from(this.homeService.show());
  }

  private isOpenFin() {
    return typeof fin !== 'undefined' && !!fin.me?.isOpenFin;
  }

  quit() {
    if (this.isOpenFin()) {
      Promise.all([
        this.dock3Service.shutdown(),
        this.notificationsService.deregister(),
      ]).finally(() => {
        fin.Platform.getCurrentSync().quit();
      });
    }
  }

  getStatus$(): Observable<string> {
    return this.status$.asObservable();
  }
}

