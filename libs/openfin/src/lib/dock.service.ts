import { Dock, type App, type DockButtonNames } from '@openfin/workspace';
import { from } from 'rxjs';
import type { PlatformSettings } from './types';

/**
 * Dock service for managing the OpenFin Dock
 * Framework-agnostic implementation
 */
export class DockService {
  register(platformSettings: PlatformSettings, apps?: App[]) {
    return from(
      Dock.register({
        ...platformSettings,
        workspaceComponents: ['home', 'store', 'notifications', 'switchWorkspace'],
        disableUserRearrangement: false,
        buttons: [
          {
            type: 'DropdownButton' as DockButtonNames.DropdownButton,
            tooltip: 'Apps',
            id: 'apps',
            iconUrl: platformSettings.icon,
            options: (apps ?? []).map((app) => ({
              tooltip: app.title,
              iconUrl: app.icons?.[0]?.src ?? platformSettings.icon,
              action: {
                id: 'launch-app',
                customData: app,
              },
            })),
          },
        ],
      }),
    );
  }

  show() {
    return Dock.show();
  }
}

