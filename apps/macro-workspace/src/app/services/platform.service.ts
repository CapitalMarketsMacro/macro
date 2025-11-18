import { inject, Injectable } from '@angular/core';
import { CustomActionCallerType, init } from '@openfin/workspace-platform';
import { from } from 'rxjs';
import type { App } from '@openfin/workspace';
import { launchApp } from './launch';
import type { PlatformSettings } from './types';
import { WorkspaceOverrideService } from './workspace-override.service';

@Injectable({ providedIn: 'root' })
export class PlatformService {
  private readonly workspaceOverrideService = inject(WorkspaceOverrideService);

  initializeWorkspacePlatform(platformSettings: PlatformSettings) {
    return from(
      init({
        browser: {
          overrideCallback: this.workspaceOverrideService.createOverrideCallback(),
          defaultWindowOptions: {
            icon: platformSettings.icon,
            workspacePlatform: {
              pages: [],
              favicon: platformSettings.icon,
            },
          },
        },
        theme: [
          {
            label: 'Default',
            default: 'dark',
            palette: {
              brandPrimary: '#0A76D3',
              brandSecondary: '#383A40',
              backgroundPrimary: '#1E1F23',
            },
          },
        ],
        customActions: {
          'launch-app': async (event): Promise<void> => {
            if (
              event.callerType === CustomActionCallerType.CustomButton ||
              event.callerType === CustomActionCallerType.CustomDropdownItem
            ) {
              await launchApp(event.customData as App);
            }
          },
        },
      }),
    );
  }
}
