import { BehaviorSubject, Observable, catchError, concatMap, forkJoin, from, map, of, tap } from 'rxjs';
import type { CustomSettings, PlatformSettings } from './types';
import { PlatformService } from './platform.service';
import { SettingsService } from './settings.service';
import { DockService } from './dock.service';
import { HomeService } from './home.service';
import { StoreService } from './store.service';
import { getCurrentSync, type Workspace } from '@openfin/workspace-platform';

/**
 * Workspace service for managing the OpenFin workspace platform initialization
 * Framework-agnostic implementation
 */
export class WorkspaceService {
  private readonly platformService: PlatformService;
  private readonly dockService: DockService;
  private readonly homeService: HomeService;
  private readonly storeService: StoreService;
  private readonly settingsService: SettingsService;

  private readonly status$ = new BehaviorSubject<string>('');
  private readonly LAST_SAVED_KEY = 'workspace-platform-last-saved';

  constructor(
    platformService: PlatformService,
    dockService: DockService,
    homeService: HomeService,
    storeService: StoreService,
    settingsService: SettingsService
  ) {
    this.platformService = platformService;
    this.dockService = dockService;
    this.homeService = homeService;
    this.storeService = storeService;
    this.settingsService = settingsService;
  }

  init() {
    if (!this.isOpenFin()) {
      this.status$.next('Not running inside OpenFin');
      return of(false);
    }

    this.status$.next('Workspace platform initializing...');

    return from(this.settingsService.getManifestSettings()).pipe(
      concatMap((settings) =>
        this.platformService.initializeWorkspacePlatform(settings.platformSettings).pipe(
          concatMap(() => this.awaitPlatformReady()),
          concatMap(() => this.registerComponents(settings)),
          concatMap(() => this.showStartupComponents()),
          concatMap(() => this.restoreLastSavedWorkspace()),
          tap(() => this.status$.next('Platform initialized')),
        ),
      ),
      map(() => true),
      catchError((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Error initializing platform', message);
        this.status$.next(`Error: ${message}`);
        return of(false);
      }),
    );
  }

  private restoreLastSavedWorkspace(): Observable<void> {
    return new Observable<void>((observer) => {
      try {
        const lastSavedId = localStorage.getItem(this.LAST_SAVED_KEY);
        if (!lastSavedId) {
          this.status$.next('No saved workspace found');
          observer.next();
          observer.complete();
          return;
        }

        this.status$.next('Restoring last saved workspace...');
        const workspacePlatform = getCurrentSync();

        // Get the saved workspace from storage
        const stored = localStorage.getItem('workspace-platform-workspaces');
        if (!stored) {
          this.status$.next('No saved workspaces found');
          observer.next();
          observer.complete();
          return;
        }

        const workspaces: Workspace[] = JSON.parse(stored);
        const workspace = workspaces.find((w) => w.workspaceId === lastSavedId);

        if (!workspace) {
          this.status$.next('Last saved workspace not found');
          observer.next();
          observer.complete();
          return;
        }

        // Apply the workspace without prompting
        workspacePlatform
          .applyWorkspace(workspace, {
            skipPrompt: true,
            applySnapshotOptions: {
              closeExistingWindows: true,
            },
          })
          .then((result) => {
            if (result) {
              this.status$.next(`Restored workspace: ${workspace.title}`);
            } else {
              this.status$.next('Failed to restore workspace');
            }
            observer.next();
            observer.complete();
          })
          .catch((error) => {
            console.error('Error restoring workspace', error);
            this.status$.next('Error restoring workspace');
            observer.next();
            observer.complete();
          });
      } catch (error) {
        console.error('Error in restoreLastSavedWorkspace', error);
        this.status$.next('Error restoring workspace');
        observer.next();
        observer.complete();
      }
    });
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
      this.dockService.register(platformSettings, customSettings?.apps),
      this.homeService.register(platformSettings),
      this.storeService.register(platformSettings),
    ]);
  }

  private showStartupComponents() {
    return forkJoin([this.homeService.show(), this.dockService.show()]);
  }

  private isOpenFin() {
    return typeof fin !== 'undefined' && !!fin.me?.isOpenFin;
  }

  quit() {
    if (this.isOpenFin()) {
      fin.Platform.getCurrentSync().quit();
    }
  }

  getStatus$(): Observable<string> {
    return this.status$.asObservable();
  }
}

