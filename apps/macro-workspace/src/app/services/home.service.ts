import { inject, Injectable } from '@angular/core';
import {
  CLITemplate,
  Home,
  type App,
  type HomeDispatchedSearchResult,
  type HomeProvider,
  type HomeRegistration,
  type HomeSearchListenerRequest,
  type HomeSearchListenerResponse,
  type HomeSearchResult,
} from '@openfin/workspace';
import { from } from 'rxjs';
import { launchApp } from './launch';
import { SettingsService } from './settings.service';
import type { PlatformSettings } from './types';

@Injectable({ providedIn: 'root' })
export class HomeService {
  private readonly settingsService = inject(SettingsService);

  register(platformSettings: PlatformSettings) {
    const homeProvider: HomeProvider = {
      ...platformSettings,
      onUserInput: async (request: HomeSearchListenerRequest, response: HomeSearchListenerResponse) => {
        const query = request.query.toLowerCase();
        response.respond([]);
        return {
          results: this.mapAppEntriesToSearchEntries(this.settingsService.getApps()).filter((entry) =>
            entry.title.toLowerCase().includes(query),
          ),
        };
      },
      onResultDispatch: async (result: HomeDispatchedSearchResult) => {
        if (result.data) {
          await launchApp(result.data as App);
        }
      },
    };

    return from(Home.register(homeProvider));
  }

  show() {
    return Home.show();
  }

  mapAppEntriesToSearchEntries(apps: App[] = []): HomeSearchResult[] {
    return apps.map((app) => {
      const action = { name: 'Launch View', hotkey: 'enter' };
      const entry: Partial<HomeSearchResult> = {
        key: app.appId,
        title: app.title,
        description: app.description,
        shortDescription: app.description,
        template: CLITemplate.SimpleText,
        templateContent: app.description,
        data: app,
      };

      if (app.manifestType === 'view') {
        entry.label = 'View';
        entry.actions = [action];
      } else if (app.manifestType === 'snapshot') {
        entry.label = 'Snapshot';
        action.name = 'Launch Snapshot';
        entry.actions = [action];
      } else if (app.manifestType === 'external') {
        entry.label = 'Native App';
        action.name = 'Launch Native App';
        entry.actions = [action];
      } else {
        entry.label = 'App';
        action.name = 'Launch App';
        entry.actions = [action];
      }

      if (Array.isArray(app.icons) && app.icons.length > 0) {
        entry.icon = app.icons[0].src;
      }

      return entry as HomeSearchResult;
    });
  }
}
