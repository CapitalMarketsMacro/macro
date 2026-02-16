import {
  BrowserButtonType,
  ColorSchemeOptionType,
  CustomActionCallerType,
  getCurrentSync,
  init,
  type CustomBrowserButtonConfig,
  type ToolbarButton,
} from '@openfin/workspace-platform';
import { from, map, type Observable } from 'rxjs';
import type { App } from '@openfin/workspace';
import { launchApp } from './launch';
import type { PlatformSettings } from './types';
import { WorkspaceOverrideService } from './workspace-override.service';
import { themeConfig } from '@macro/macro-design';
import { Logger } from '@macro/logger';

const logger = Logger.getLogger('PlatformService');

/**
 * Platform service for initializing the OpenFin workspace platform
 * Framework-agnostic implementation
 */
export class PlatformService {
  private readonly workspaceOverrideService: WorkspaceOverrideService;

  // Sun icon (shown when in dark theme - click to switch to light) - white color
  private readonly sunIcon =
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iNCIvPjxwYXRoIGQ9Ik0xMiAydjIiLz48cGF0aCBkPSJNMTIgMjB2MiIvPjxwYXRoIGQ9Im00LjkzIDQuOTMgMS40MSAxLjQxIi8+PHBhdGggZD0ibTE3LjY2IDE3LjY2IDEuNDEgMS40MSIvPjxwYXRoIGQ9Ik0yIDEyaDIiLz48cGF0aCBkPSJNMjAgMTJoMiIvPjxwYXRoIGQ9Im02LjM0IDE3LjY2LTEuNDEgMS40MSIvPjxwYXRoIGQ9Im0xOS4wNyA0LjkzLTEuNDEgMS40MSIvPjwvc3ZnPg==';

  // Moon icon (shown when in light theme - click to switch to dark)
  private readonly moonIcon =
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik0xMiAzYTYgNiAwIDAgMCA5IDkgOSA5IDAgMSAxLTktOVoiLz48L3N2Zz4=';

  constructor(workspaceOverrideService: WorkspaceOverrideService) {
    this.workspaceOverrideService = workspaceOverrideService;
  }

  private getToolbarButtons(currentScheme: ColorSchemeOptionType): ToolbarButton[] {
    const themeIcon =
      currentScheme === ColorSchemeOptionType.Dark ? this.sunIcon : this.moonIcon;
    const themeTooltip =
      currentScheme === ColorSchemeOptionType.Dark
        ? 'Switch to Light Theme'
        : 'Switch to Dark Theme';

    return [
      {
        type: BrowserButtonType.ShowHideTabs,
      },
      {
        type: BrowserButtonType.ColorLinking,
      },
      {
        type: BrowserButtonType.PresetLayouts,
      },
      {
        type: BrowserButtonType.LockUnlockPage,
      },
      {
        type: BrowserButtonType.SaveMenu,
      },
      {
        type: BrowserButtonType.Custom,
        tooltip: themeTooltip,
        iconUrl: themeIcon,
        action: {
          id: 'toggle-theme',
        },
      } as CustomBrowserButtonConfig,
    ] as ToolbarButton[];
  }

  private async updateThemeButtonIcon(): Promise<void> {
    try {
      const workspacePlatform = getCurrentSync();
      const currentScheme = await workspacePlatform.Theme.getSelectedScheme();
      const windows = await workspacePlatform.Browser.getAllWindows();

      for (const window of windows) {
        await window.replaceToolbarOptions({
          buttons: this.getToolbarButtons(currentScheme),
        });
      }
    } catch (error) {
      logger.error('Error updating theme button icon', error);
    }
  }

  initializeWorkspacePlatform(platformSettings: PlatformSettings): Observable<void> {
    return from(
      init({
        browser: {
          overrideCallback: this.workspaceOverrideService.createOverrideCallback(),
          defaultWindowOptions: {
            icon: platformSettings.icon,
            workspacePlatform: {
              pages: [],
              favicon: platformSettings.icon,
              toolbarOptions: {
                buttons: this.getToolbarButtons(ColorSchemeOptionType.Dark),
              },
            },
          },
        },
        theme: [
          {
            label: 'Default',
            default: 'dark',
            palettes: {
              dark: themeConfig.dark,
              light: themeConfig.light,
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
          'toggle-theme': async (event): Promise<void> => {
            if (event.callerType === CustomActionCallerType.CustomButton) {
              const workspacePlatform = getCurrentSync();
              const currentScheme = await workspacePlatform.Theme.getSelectedScheme();
              const newScheme =
                currentScheme === ColorSchemeOptionType.Dark
                  ? ColorSchemeOptionType.Light
                  : ColorSchemeOptionType.Dark;
              await workspacePlatform.Theme.setSelectedScheme(newScheme);
              // Update the button icon after theme change
              await this.updateThemeButtonIcon();
              // Theme service will automatically sync via polling
            }
          },
        },
      }),
    ).pipe(map(() => undefined));
  }
}

