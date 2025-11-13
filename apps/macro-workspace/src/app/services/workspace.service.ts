import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, concatMap, forkJoin, map, of, tap } from 'rxjs';
import type { CustomSettings, PlatformSettings } from './types';
import { PlatformService } from './platform.service';
import { SettingsService } from './settings.service';
import { DockService } from './dock.service';
import { HomeService } from './home.service';
import { StoreService } from './store.service';

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  private readonly platformService = inject(PlatformService);
  private readonly dockService = inject(DockService);
  private readonly homeService = inject(HomeService);
  private readonly storeService = inject(StoreService);
  private readonly settingsService = inject(SettingsService);

  private readonly status$ = new BehaviorSubject<string>('');

  init() {
    if (!this.isOpenFin()) {
      this.status$.next('Not running inside OpenFin');
      return of(false);
    }

    this.status$.next('Workspace platform initializing...');

    return this.settingsService.getManifestSettings().pipe(
      concatMap((settings) =>
        this.platformService.initializeWorkspacePlatform(settings.platformSettings).pipe(
          concatMap(() => this.awaitPlatformReady()),
          concatMap(() => this.registerComponents(settings)),
          concatMap(() => this.showStartupComponents()),
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
