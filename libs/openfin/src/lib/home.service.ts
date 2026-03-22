import {
  CLITemplate,
  Home,
  type App,
  type HomeDispatchedSearchResult,
  type HomeProvider,
  type HomeSearchListenerRequest,
  type HomeSearchListenerResponse,
  type HomeSearchResult,
} from '@openfin/workspace';
import { from } from 'rxjs';
import { launchApp } from './launch';
import type { PlatformSettings } from './types';
import type { SettingsService } from './settings.service';
import { getAnalyticsNats } from './analytics-nats.service';

/**
 * Home service for managing the OpenFin Home
 * Framework-agnostic implementation
 */
export class HomeService {
  constructor(private readonly settingsService: SettingsService) {}

  register(platformSettings: PlatformSettings) {
    const homeProvider: HomeProvider = {
      ...platformSettings,
      onUserInput: async (request: HomeSearchListenerRequest, response: HomeSearchListenerResponse) => {
        const query = request.query.toLowerCase();
        if (query.length > 0) {
          getAnalyticsNats().publish({
            source: 'Home', type: 'Search', action: 'Query',
            value: query,
          }).catch(() => {});
        }
        response.respond([]);
        return {
          results: this.mapAppEntriesToSearchEntries(this.settingsService.getApps()).filter((entry) =>
            entry.title.toLowerCase().includes(query),
          ),
        };
      },
      onResultDispatch: async (result: HomeDispatchedSearchResult) => {
        if (result.data) {
          const app = result.data as App;
          getAnalyticsNats().publish({
            source: 'Home', type: 'App', action: 'Launch',
            value: app.title || app.appId,
            data: { appId: app.appId },
          }).catch(() => {});
          await launchApp(app);
        }
      },
    };

    // Track Home window lifecycle via platform events
    try {
      const app = fin.Application.getCurrentSync();
      app.on('window-created', (event: any) => {
        if (event.name?.includes('home') || event.name?.includes('Home')) {
          getAnalyticsNats().publish({
            source: 'Home', type: 'Home', action: 'Open',
            data: { windowName: event.name },
          }).catch(() => {});
        }
      });
    } catch { /* not in OpenFin */ }

    return from(Home.register(homeProvider));
  }

  show() {
    getAnalyticsNats().publish({
      source: 'Home', type: 'Home', action: 'Show',
    }).catch(() => {});
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

