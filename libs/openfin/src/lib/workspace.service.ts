import { BehaviorSubject, Observable, catchError, concatMap, delay, forkJoin, from, map, of, tap, timeout } from 'rxjs';
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
   * Restore last saved workspace using the built-in API.
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

    try {
      // NOTE: the platform's built-in restoreLastSavedWorkspace() restores the
      // *currently active* workspace, not the last one the user saved. On a fresh
      // launch the active workspace is reset to an unsaved default, so the built-in
      // always returns 'not-saved-workspace' at startup and nothing is restored.
      // Instead we track the last saved workspace id ourselves (WorkspaceStorageService,
      // updated in create/updateSavedWorkspace) and apply that workspace directly.
      const lastSavedId = await this.storageService.getLastSavedWorkspaceId();
      if (!lastSavedId) {
        this.status$.next('No saved workspace found');
        nats.publish({ source: 'Platform', type: 'Workspace', action: 'NoSavedWorkspace' }).catch(() => {});
        return;
      }

      const workspaces = await this.storageService.getWorkspaces();
      const workspace = workspaces.find((w) => w.workspaceId === lastSavedId);
      if (!workspace) {
        logger.warn('Last saved workspace id not found in storage; clearing reference', { lastSavedId });
        await this.storageService.removeLastSavedWorkspaceId();
        this.status$.next('No saved workspace found');
        nats.publish({ source: 'Platform', type: 'Workspace', action: 'NoSavedWorkspace' }).catch(() => {});
        return;
      }

      const workspacePlatform = getCurrentSync();
      await workspacePlatform.applyWorkspace(workspace, {
        skipPrompt: true,
        applySnapshotOptions: { closeExistingWindows: true },
      });

      this.status$.next('Restored last saved workspace');
      nats.publish({ source: 'Platform', type: 'Workspace', action: 'Restored',
        value: workspace.title, data: { workspaceId: workspace.workspaceId } }).catch(() => {});
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
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        this.status$.next('Platform API ready...');
        observer.next();
        observer.complete();
      };
      // `platform-api-ready` is a one-shot event that may have already fired by
      // the time we subscribe (WS 23.2.x resolves init() after it fires). Listen
      // for it, but fall back to a timeout so a missed event can never stall the
      // init pipeline before registerComponents() — which would silently keep
      // Dock/Store/Home from ever registering.
      platform.once('platform-api-ready', done);
      setTimeout(done, 1000);
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
    // Each component registration is independent. Guard every one so a single
    // slow/hanging registration (e.g. the native Snap helper failing to
    // connect) can never pin the platform on "Registering workspace
    // components..." forever. The warning names the offending component.
    return forkJoin([
      this.guarded(
        'dock',
        from(
          this.dock3Service.init(
            platformSettings,
            customSettings?.apps,
            customSettings?.dock3
          )
        )
      ),
      this.guarded('home', this.homeService.register(platformSettings)),
      this.guarded('store', this.storeService.register(platformSettings)),
      this.guarded('notifications', from(this.notificationsService.register(platformSettings))),
      this.guarded('snap', from(this.snapService.init(platformSettings.id, customSettings?.snapProvider))),
    ]);
  }

  /**
   * Wrap a component register/show operation so a hang or failure can never
   * stall the platform-init pipeline. In Workspace 23.2.x several component
   * promises resolve their UI (the window appears) but never settle; without a
   * timeout the init Observable waits forever and the provider never reaches
   * the "Platform initialized" (green) state. On timeout/error we log which
   * operation stalled and continue startup.
   */
  private guarded<T>(label: string, source: Observable<T>, ms = 12000): Observable<T | undefined> {
    return source.pipe(
      timeout({ first: ms }),
      catchError((err) => {
        logger.warn(
          `Component "${label}" did not finish within ${ms}ms — continuing platform startup`,
          err,
        );
        return of(undefined);
      }),
    );
  }

  private showStartupComponents(): Observable<void> {
    // Dock3 auto-shows on init; also open Home and Store at startup. This is a
    // UX nicety, NOT a readiness gate, so we fire the shows WITHOUT awaiting
    // them: in WS 23.2.x Storefront.show() (and potentially Home.show()) opens
    // the window but its promise never settles, so blocking here would stall
    // the init pipeline and the provider would never reach the "Platform
    // initialized" (green) state. The guards self-complete and log if a show
    // stalls, without gating startup.
    this.guarded('home.show', from(this.homeService.show())).subscribe();
    this.guarded('store.show', from(this.storeService.show())).subscribe();
    return of(undefined);
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

