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
import type { ThemePresetPalettes } from './theme-preset.service';
import { themeConfig } from '@macro/macro-design';
import { Logger } from '@macro/logger';
import { getAnalyticsNats } from './analytics-nats.service';

const logger = Logger.getLogger('PlatformService');

/**
 * Platform service for initializing the OpenFin workspace platform
 * Framework-agnostic implementation
 */
export class PlatformService {
  private readonly workspaceOverrideService: WorkspaceOverrideService;

  // Custom button icons use blue (#3b82f6) stroke for visibility on both dark and light themes.
  // OpenFin's custom button API doesn't support theme-adaptive icons like built-in buttons.
  // Sun icon (shown in dark theme - click to switch to light)
  private readonly sunIcon =
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMzYjgyZjYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSI0Ii8+PHBhdGggZD0iTTEyIDJ2MiIvPjxwYXRoIGQ9Ik0xMiAyMHYyIi8+PHBhdGggZD0ibTQuOTMgNC45MyAxLjQxIDEuNDEiLz48cGF0aCBkPSJtMTcuNjYgMTcuNjYgMS40MSAxLjQxIi8+PHBhdGggZD0iTTIgMTJoMiIvPjxwYXRoIGQ9Ik0yMCAxMmgyIi8+PHBhdGggZD0ibTYuMzQgMTcuNjYtMS40MSAxLjQxIi8+PHBhdGggZD0ibTE5LjA3IDQuOTMtMS40MSAxLjQxIi8+PC9zdmc+';

  // Moon icon (shown in light theme - click to switch to dark)
  private readonly moonIcon =
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMzYjgyZjYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTIgM2E2IDYgMCAwIDAgOSA5IDkgOSAwIDEgMS05LTlaIi8+PC9zdmc+';

  // Page tabs visible icon (tabbed window - click to hide page tabs)
  private readonly pageTabsVisibleIcon =
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMzYjgyZjYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIzIiB5PSI0IiB3aWR0aD0iMTgiIGhlaWdodD0iMTYiIHJ4PSIyIi8+PHBhdGggZD0iTTMgOWgxOCIvPjxwYXRoIGQ9Ik05IDR2NSIvPjxwYXRoIGQ9Ik0xNSA0djUiLz48L3N2Zz4=';

  // Page tabs hidden icon (single panel - click to show page tabs)
  private readonly pageTabsHiddenIcon =
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMzYjgyZjYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIzIiB5PSI0IiB3aWR0aD0iMTgiIGhlaWdodD0iMTYiIHJ4PSIyIi8+PHBhdGggZD0iTTMgOWgxOCIvPjwvc3ZnPg==';

  // Upload logs icon
  private readonly uploadLogsIcon =
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMzYjgyZjYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMjEgMTV2NGEyIDIgMCAwIDEtMiAySDVhMiAyIDAgMCAxLTItMnYtNCIvPjxwb2x5bGluZSBwb2ludHM9IjE3IDggMTIgMyA3IDgiLz48bGluZSB4MT0iMTIiIHkxPSIzIiB4Mj0iMTIiIHkyPSIxNSIvPjwvc3ZnPg==';

  private pageTabsHidden = false;

  constructor(workspaceOverrideService: WorkspaceOverrideService) {
    this.workspaceOverrideService = workspaceOverrideService;
    // Update custom toolbar icons whenever the platform theme changes
    this.workspaceOverrideService.setOnThemeChanged((scheme) =>
      this.updateToolbarButtons(scheme),
    );
  }

  private getToolbarButtons(
    currentScheme: ColorSchemeOptionType,
    pageTabsHidden: boolean,
  ): ToolbarButton[] {
    const isDark = currentScheme === ColorSchemeOptionType.Dark;

    const themeIcon = isDark ? this.sunIcon : this.moonIcon;
    const themeTooltip = isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme';

    const pageTabsIcon = pageTabsHidden ? this.pageTabsHiddenIcon : this.pageTabsVisibleIcon;
    const pageTabsTooltip = pageTabsHidden ? 'Show Page Tabs' : 'Hide Page Tabs';

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
        tooltip: pageTabsTooltip,
        iconUrl: pageTabsIcon,
        action: {
          id: 'toggle-page-tabs',
        },
      } as CustomBrowserButtonConfig,
      {
        type: BrowserButtonType.Custom,
        tooltip: themeTooltip,
        iconUrl: themeIcon,
        action: {
          id: 'toggle-theme',
        },
      } as CustomBrowserButtonConfig,
      {
        type: BrowserButtonType.Custom,
        tooltip: 'Upload Logs',
        iconUrl: this.uploadLogsIcon,
        action: {
          id: 'upload-logs',
        },
      } as CustomBrowserButtonConfig,
    ] as ToolbarButton[];
  }

  async updateToolbarButtons(scheme?: ColorSchemeOptionType): Promise<void> {
    try {
      const workspacePlatform = getCurrentSync();
      const currentScheme = scheme ?? await workspacePlatform.Theme.getSelectedScheme();
      const windows = await workspacePlatform.Browser.getAllWindows();

      for (const window of windows) {
        await window.replaceToolbarOptions({
          buttons: this.getToolbarButtons(currentScheme, this.pageTabsHidden),
        });
      }
    } catch (error) {
      logger.error('Error updating toolbar buttons', error);
    }
  }

  initializeWorkspacePlatform(
    platformSettings: PlatformSettings,
    themePalettes?: ThemePresetPalettes,
    additionalCustomActions?: Record<string, (payload: any) => Promise<void>>,
  ): Observable<void> {
    // JSON theme presets are loaded dynamically; fall back to compiled themeConfig
    const dark = themePalettes?.dark ?? themeConfig.dark;
    const light = themePalettes?.light ?? themeConfig.light;

    return from(
      init({
        browser: {
          overrideCallback: this.workspaceOverrideService.createOverrideCallback(),
          defaultWindowOptions: {
            icon: platformSettings.icon,
            taskbarIcon: platformSettings.icon.replace(/\/icons\/.*$/, '/favicon.ico'),
            workspacePlatform: {
              pages: [],
              favicon: platformSettings.icon,
              toolbarOptions: {
                buttons: this.getToolbarButtons(ColorSchemeOptionType.Dark, false),
              },
            },
          },
        },
        theme: [
          {
            label: 'Default',
            default: 'dark',
            palettes: {
              // Cast: JSON palettes include all required CustomPaletteSet properties
              dark: dark as typeof themeConfig.dark,
              light: light as typeof themeConfig.light,
            },
          },
        ],
        customActions: {
          ...additionalCustomActions,
          'launch-app': async (event): Promise<void> => {
            if (
              event.callerType === CustomActionCallerType.CustomButton ||
              event.callerType === CustomActionCallerType.CustomDropdownItem
            ) {
              const app = event.customData as App;
              getAnalyticsNats().publish({
                source: 'Platform',
                type: 'App',
                action: 'Launch',
                value: app.title || app.appId,
                data: { appId: app.appId, manifestType: app.manifestType, callerType: event.callerType },
              }).catch(() => {});
              await launchApp(app);
            }
          },
          'toggle-page-tabs': async (event): Promise<void> => {
            if (event.callerType === CustomActionCallerType.CustomButton) {
              this.pageTabsHidden = !this.pageTabsHidden;
              getAnalyticsNats().publish({
                source: 'Platform',
                type: 'Browser',
                action: this.pageTabsHidden ? 'HidePageTabs' : 'ShowPageTabs',
              }).catch(() => {});
              const workspacePlatform = getCurrentSync();
              const windows = await workspacePlatform.Browser.getAllWindows();
              for (const window of windows) {
                await window.openfinWindow.updateOptions({
                  workspacePlatform: {
                    disableMultiplePages: this.pageTabsHidden,
                  },
                } as never);
              }
              await this.updateToolbarButtons();
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
              getAnalyticsNats().publish({
                source: 'Platform',
                type: 'Theme',
                action: 'Toggle',
                value: newScheme === ColorSchemeOptionType.Dark ? 'dark' : 'light',
              }).catch(() => {});
              await workspacePlatform.Theme.setSelectedScheme(newScheme);
            }
          },
          'upload-logs': async (event): Promise<void> => {
            if (event.callerType === CustomActionCallerType.CustomButton) {
              try {
                getAnalyticsNats().publish({
                  source: 'Platform',
                  type: 'Logs',
                  action: 'Upload',
                }).catch(() => {});
                await fin.System.launchLogUploader({
                  endpoint: 'http://MontuNobleNumbat2404:8000',
                  logs: ['debug:self', 'app', 'rvm'],
                  ui: { show: true },
                } as any);
              } catch (err) {
                logger.error('Error launching log uploader', err);
              }
            }
          },
        },
      }),
    ).pipe(map(() => undefined));
  }
}

