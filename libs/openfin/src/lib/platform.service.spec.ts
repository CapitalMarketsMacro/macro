import { firstValueFrom } from 'rxjs';
import { PlatformService } from './platform.service';
import { WorkspaceOverrideService } from './workspace-override.service';
import type { PlatformSettings } from './types';

// Mock @macro/logger
jest.mock('@macro/logger', () => ({
  Logger: {
    getLogger: () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }),
  },
}));

// Mock @macro/macro-design
jest.mock('@macro/macro-design', () => ({
  themeConfig: {
    dark: { brandPrimary: '#0A76D3', backgroundPrimary: '#1E1F23' },
    light: { brandPrimary: '#0A76D3', backgroundPrimary: '#FFFFFF' },
  },
}));

// Mock launch
jest.mock('./launch', () => ({
  launchApp: jest.fn().mockResolvedValue(undefined),
}));

// Mock @openfin/workspace-platform -- inline jest.fn() in factory
jest.mock('@openfin/workspace-platform', () => ({
  init: jest.fn(),
  getCurrentSync: jest.fn(),
  BrowserButtonType: {
    ShowHideTabs: 'ShowHideTabs',
    ColorLinking: 'ColorLinking',
    PresetLayouts: 'PresetLayouts',
    LockUnlockPage: 'LockUnlockPage',
    SaveMenu: 'SaveMenu',
    Custom: 'Custom',
  },
  ColorSchemeOptionType: {
    Dark: 'dark',
    Light: 'light',
  },
  CustomActionCallerType: {
    CustomButton: 'CustomButton',
    CustomDropdownItem: 'CustomDropdownItem',
  },
}));

// Import the mocked module to get references
import { init, getCurrentSync } from '@openfin/workspace-platform';

describe('PlatformService', () => {
  let service: PlatformService;
  let mockOverrideService: WorkspaceOverrideService;

  const platformSettings: PlatformSettings = {
    id: 'macro-workspace',
    title: 'Macro Workspace',
    icon: 'icon.png',
  };

  beforeEach(() => {
    (init as jest.Mock).mockReset();
    (getCurrentSync as jest.Mock).mockReset();

    mockOverrideService = {
      createOverrideCallback: jest.fn().mockReturnValue(jest.fn()),
      setOnThemeChanged: jest.fn(),
    } as unknown as WorkspaceOverrideService;

    service = new PlatformService(mockOverrideService);
  });

  // ── constructor ─────────────────────────────────────────────

  describe('constructor', () => {
    it('should call setOnThemeChanged on the override service', () => {
      expect(mockOverrideService.setOnThemeChanged).toHaveBeenCalledTimes(1);
      expect(mockOverrideService.setOnThemeChanged).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });
  });

  // ── getToolbarButtons ───────────────────────────────────────

  describe('getToolbarButtons (via initializeWorkspacePlatform)', () => {
    it('should include 7 toolbar buttons in platform init', async () => {
      (init as jest.Mock).mockResolvedValue(undefined);

      await firstValueFrom(
        service.initializeWorkspacePlatform(platformSettings),
      );

      const callArg = (init as jest.Mock).mock.calls[0][0];
      const buttons =
        callArg.browser.defaultWindowOptions.workspacePlatform.toolbarOptions
          .buttons;
      expect(buttons).toHaveLength(7);
    });

    it('should include standard button types', async () => {
      (init as jest.Mock).mockResolvedValue(undefined);

      await firstValueFrom(
        service.initializeWorkspacePlatform(platformSettings),
      );

      const callArg = (init as jest.Mock).mock.calls[0][0];
      const buttons =
        callArg.browser.defaultWindowOptions.workspacePlatform.toolbarOptions
          .buttons;
      const types = buttons.map((b: any) => b.type);

      expect(types).toContain('ShowHideTabs');
      expect(types).toContain('ColorLinking');
      expect(types).toContain('PresetLayouts');
      expect(types).toContain('LockUnlockPage');
      expect(types).toContain('SaveMenu');
    });

    it('should include custom theme toggle button with sun icon for dark mode', async () => {
      (init as jest.Mock).mockResolvedValue(undefined);

      await firstValueFrom(
        service.initializeWorkspacePlatform(platformSettings),
      );

      const callArg = (init as jest.Mock).mock.calls[0][0];
      const buttons =
        callArg.browser.defaultWindowOptions.workspacePlatform.toolbarOptions
          .buttons;
      const themeButton = buttons.find(
        (b: any) => b.action?.id === 'toggle-theme',
      );

      expect(themeButton).toBeDefined();
      expect(themeButton.type).toBe('Custom');
      expect(themeButton.tooltip).toBe('Switch to Light Theme');
    });

    it('should include custom page tabs toggle button', async () => {
      (init as jest.Mock).mockResolvedValue(undefined);

      await firstValueFrom(
        service.initializeWorkspacePlatform(platformSettings),
      );

      const callArg = (init as jest.Mock).mock.calls[0][0];
      const buttons =
        callArg.browser.defaultWindowOptions.workspacePlatform.toolbarOptions
          .buttons;
      const pageTabsButton = buttons.find(
        (b: any) => b.action?.id === 'toggle-page-tabs',
      );

      expect(pageTabsButton).toBeDefined();
      expect(pageTabsButton.type).toBe('Custom');
      expect(pageTabsButton.tooltip).toBe('Hide Page Tabs');
    });
  });

  // ── initializeWorkspacePlatform ─────────────────────────────

  describe('initializeWorkspacePlatform', () => {
    it('should return an observable', () => {
      (init as jest.Mock).mockResolvedValue(undefined);

      const result$ = service.initializeWorkspacePlatform(platformSettings);
      expect(result$).toBeDefined();
      expect(typeof result$.subscribe).toBe('function');
    });

    it('should call init with correct theme configuration', async () => {
      (init as jest.Mock).mockResolvedValue(undefined);

      await firstValueFrom(
        service.initializeWorkspacePlatform(platformSettings),
      );

      expect(init).toHaveBeenCalledTimes(1);
      const callArg = (init as jest.Mock).mock.calls[0][0];
      expect(callArg.theme).toHaveLength(1);
      expect(callArg.theme[0].label).toBe('Default');
      expect(callArg.theme[0].default).toBe('dark');
      expect(callArg.theme[0].palettes.dark).toBeDefined();
      expect(callArg.theme[0].palettes.light).toBeDefined();
    });

    it('should pass overrideCallback from override service', async () => {
      (init as jest.Mock).mockResolvedValue(undefined);

      await firstValueFrom(
        service.initializeWorkspacePlatform(platformSettings),
      );

      expect(mockOverrideService.createOverrideCallback).toHaveBeenCalled();
      const callArg = (init as jest.Mock).mock.calls[0][0];
      expect(callArg.browser.overrideCallback).toBeDefined();
    });

    it('should set icon on default window options', async () => {
      (init as jest.Mock).mockResolvedValue(undefined);

      await firstValueFrom(
        service.initializeWorkspacePlatform(platformSettings),
      );

      const callArg = (init as jest.Mock).mock.calls[0][0];
      expect(callArg.browser.defaultWindowOptions.icon).toBe('icon.png');
      expect(
        callArg.browser.defaultWindowOptions.workspacePlatform.favicon,
      ).toBe('icon.png');
    });

    it('should emit undefined (mapped from init result)', async () => {
      (init as jest.Mock).mockResolvedValue('some-platform');

      const result = await firstValueFrom(
        service.initializeWorkspacePlatform(platformSettings),
      );

      expect(result).toBeUndefined();
    });

    it('should define launch-app, toggle-page-tabs, and toggle-theme custom actions', async () => {
      (init as jest.Mock).mockResolvedValue(undefined);

      await firstValueFrom(
        service.initializeWorkspacePlatform(platformSettings),
      );

      const callArg = (init as jest.Mock).mock.calls[0][0];
      expect(callArg.customActions['launch-app']).toBeDefined();
      expect(callArg.customActions['toggle-page-tabs']).toBeDefined();
      expect(callArg.customActions['toggle-theme']).toBeDefined();
    });
  });

  // ── updateToolbarButtons ────────────────────────────────────

  describe('updateToolbarButtons', () => {
    it('should call replaceToolbarOptions on all windows', async () => {
      const mockReplaceToolbarOptions = jest.fn().mockResolvedValue(undefined);
      const mockWindow = {
        replaceToolbarOptions: mockReplaceToolbarOptions,
      };
      (getCurrentSync as jest.Mock).mockReturnValue({
        Theme: {
          getSelectedScheme: jest.fn().mockResolvedValue('dark'),
        },
        Browser: {
          getAllWindows: jest.fn().mockResolvedValue([mockWindow]),
        },
      });

      await service.updateToolbarButtons();

      expect(mockReplaceToolbarOptions).toHaveBeenCalledTimes(1);
      expect(mockReplaceToolbarOptions).toHaveBeenCalledWith({
        buttons: expect.any(Array),
      });
    });

    it('should use provided scheme instead of fetching from platform', async () => {
      const mockReplaceToolbarOptions = jest.fn().mockResolvedValue(undefined);
      const mockGetSelectedScheme = jest.fn();
      (getCurrentSync as jest.Mock).mockReturnValue({
        Theme: {
          getSelectedScheme: mockGetSelectedScheme,
        },
        Browser: {
          getAllWindows: jest.fn().mockResolvedValue([
            { replaceToolbarOptions: mockReplaceToolbarOptions },
          ]),
        },
      });

      await service.updateToolbarButtons('light' as any);

      // Should NOT call getSelectedScheme since scheme was provided
      expect(mockGetSelectedScheme).not.toHaveBeenCalled();
      expect(mockReplaceToolbarOptions).toHaveBeenCalled();
    });

    it('should not throw when getCurrentSync fails', async () => {
      (getCurrentSync as jest.Mock).mockImplementation(() => {
        throw new Error('Not available');
      });

      await expect(service.updateToolbarButtons()).resolves.toBeUndefined();
    });

    it('should update multiple windows', async () => {
      const mockReplace1 = jest.fn().mockResolvedValue(undefined);
      const mockReplace2 = jest.fn().mockResolvedValue(undefined);
      (getCurrentSync as jest.Mock).mockReturnValue({
        Theme: {
          getSelectedScheme: jest.fn().mockResolvedValue('dark'),
        },
        Browser: {
          getAllWindows: jest.fn().mockResolvedValue([
            { replaceToolbarOptions: mockReplace1 },
            { replaceToolbarOptions: mockReplace2 },
          ]),
        },
      });

      await service.updateToolbarButtons();

      expect(mockReplace1).toHaveBeenCalledTimes(1);
      expect(mockReplace2).toHaveBeenCalledTimes(1);
    });
  });
});
