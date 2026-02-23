import { firstValueFrom } from 'rxjs';
import { DockService } from './dock.service';
import type { PlatformSettings } from './types';

// Mock @openfin/workspace -- inline jest.fn() in factory to avoid TDZ
jest.mock('@openfin/workspace', () => ({
  Dock: {
    register: jest.fn(),
    show: jest.fn(),
  },
}));

// Import the mocked module to get references
import { Dock } from '@openfin/workspace';

describe('DockService', () => {
  let service: DockService;

  const platformSettings: PlatformSettings = {
    id: 'macro-workspace',
    title: 'Macro Workspace',
    icon: 'icon.png',
  };

  beforeEach(() => {
    (Dock.register as jest.Mock).mockReset();
    (Dock.show as jest.Mock).mockReset();
    service = new DockService();
  });

  // ── register ────────────────────────────────────────────────

  describe('register', () => {
    it('should return an observable', () => {
      (Dock.register as jest.Mock).mockResolvedValue(undefined);

      const result$ = service.register(platformSettings);
      expect(result$).toBeDefined();
      expect(typeof result$.subscribe).toBe('function');
    });

    it('should call Dock.register with platform settings and workspace components', async () => {
      (Dock.register as jest.Mock).mockResolvedValue(undefined);

      await firstValueFrom(service.register(platformSettings));

      expect(Dock.register).toHaveBeenCalledTimes(1);
      const callArg = (Dock.register as jest.Mock).mock.calls[0][0];
      expect(callArg.id).toBe('macro-workspace');
      expect(callArg.title).toBe('Macro Workspace');
      expect(callArg.icon).toBe('icon.png');
      expect(callArg.workspaceComponents).toEqual([
        'home',
        'store',
        'notifications',
        'switchWorkspace',
      ]);
      expect(callArg.disableUserRearrangement).toBe(false);
    });

    it('should build dropdown button with apps mapped to options', async () => {
      (Dock.register as jest.Mock).mockResolvedValue(undefined);

      const apps = [
        {
          appId: 'app-1',
          title: 'App One',
          icons: [{ src: 'app1-icon.png' }],
        },
        {
          appId: 'app-2',
          title: 'App Two',
          icons: [],
        },
      ] as any[];

      await firstValueFrom(service.register(platformSettings, apps));

      const callArg = (Dock.register as jest.Mock).mock.calls[0][0];
      expect(callArg.buttons).toHaveLength(1);
      expect(callArg.buttons[0].type).toBe('DropdownButton');
      expect(callArg.buttons[0].tooltip).toBe('Apps');
      expect(callArg.buttons[0].options).toHaveLength(2);
      expect(callArg.buttons[0].options[0].tooltip).toBe('App One');
      expect(callArg.buttons[0].options[0].iconUrl).toBe('app1-icon.png');
      expect(callArg.buttons[0].options[1].iconUrl).toBe('icon.png'); // fallback
    });

    it('should use platform icon when app has no icons', async () => {
      (Dock.register as jest.Mock).mockResolvedValue(undefined);

      const apps = [{ appId: 'app-1', title: 'App One' }] as any[];

      await firstValueFrom(service.register(platformSettings, apps));

      const callArg = (Dock.register as jest.Mock).mock.calls[0][0];
      expect(callArg.buttons[0].options[0].iconUrl).toBe('icon.png');
    });

    it('should handle empty apps array', async () => {
      (Dock.register as jest.Mock).mockResolvedValue(undefined);

      await firstValueFrom(service.register(platformSettings, []));

      const callArg = (Dock.register as jest.Mock).mock.calls[0][0];
      expect(callArg.buttons[0].options).toEqual([]);
    });

    it('should handle undefined apps', async () => {
      (Dock.register as jest.Mock).mockResolvedValue(undefined);

      await firstValueFrom(service.register(platformSettings));

      const callArg = (Dock.register as jest.Mock).mock.calls[0][0];
      expect(callArg.buttons[0].options).toEqual([]);
    });

    it('should include launch-app action on each option', async () => {
      (Dock.register as jest.Mock).mockResolvedValue(undefined);

      const apps = [
        { appId: 'app-1', title: 'App One', icons: [] },
      ] as any[];

      await firstValueFrom(service.register(platformSettings, apps));

      const option = (Dock.register as jest.Mock).mock.calls[0][0].buttons[0]
        .options[0];
      expect(option.action.id).toBe('launch-app');
      expect(option.action.customData).toEqual(apps[0]);
    });
  });

  // ── show ────────────────────────────────────────────────────

  describe('show', () => {
    it('should call Dock.show()', () => {
      (Dock.show as jest.Mock).mockResolvedValue(undefined);

      service.show();

      expect(Dock.show).toHaveBeenCalledTimes(1);
    });

    it('should return the result of Dock.show()', () => {
      const expected = Promise.resolve('shown');
      (Dock.show as jest.Mock).mockReturnValue(expected);

      const result = service.show();

      expect(result).toBe(expected);
    });
  });
});
