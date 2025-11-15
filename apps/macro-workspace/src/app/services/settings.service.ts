import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, tap } from 'rxjs';
import type { App } from '@openfin/workspace';
import type { CustomSettings, PlatformSettings } from './types';

export interface SettingsResponse {
  platformSettings: PlatformSettings;
  customSettings: CustomSettings;
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly http = inject(HttpClient);
  private readonly apps$ = new BehaviorSubject<App[]>([]);

  getManifestSettings() {
    // Fetch settings from REST API (serves settings.json from public folder)
    return this.http.get<SettingsResponse>('/settings.json').pipe(
      tap(({ customSettings }) => {
        this.apps$.next(customSettings?.apps ?? []);
      }),
    );
  }

  getApps(): App[] {
    return this.apps$.getValue();
  }
}
