import { Injectable } from '@angular/core';
import { BehaviorSubject, from, map, tap } from 'rxjs';
import type { App } from '@openfin/workspace';
import type { CustomSettings, ManifestWithCustomSettings, PlatformSettings } from './types';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly apps$ = new BehaviorSubject<App[]>([]);

  getManifestSettings() {
    const app = fin.Application.getCurrentSync();
    return from(app.getManifest()).pipe(
      map((manifest: ManifestWithCustomSettings) => ({
        platformSettings: {
          id: manifest.platform?.uuid ?? fin.me.identity.uuid,
          title: manifest.shortcut?.name ?? '',
          icon: manifest.platform?.icon ?? '',
        } satisfies PlatformSettings,
        customSettings: manifest.customSettings,
      })),
      tap(({ customSettings }) => {
        this.apps$.next(customSettings?.apps ?? []);
      }),
    );
  }

  getApps(): App[] {
    return this.apps$.getValue();
  }
}
