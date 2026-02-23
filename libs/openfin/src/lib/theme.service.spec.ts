import { firstValueFrom, take, toArray } from 'rxjs';
import { ThemeService } from './theme.service';

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

const mockDarkPalette = {
  brandPrimary: '#0A76D3',
  brandSecondary: '#383A40',
  backgroundPrimary: '#1E1F23',
};
const mockLightPalette = {
  brandPrimary: '#0A76D3',
  brandSecondary: '#E5E7EB',
  backgroundPrimary: '#FFFFFF',
};

// Mock @macro/macro-design -- use inline literals (not const references) to avoid TDZ
jest.mock('@macro/macro-design', () => ({
  themeConfig: {
    dark: {
      brandPrimary: '#0A76D3',
      brandSecondary: '#383A40',
      backgroundPrimary: '#1E1F23',
    },
    light: {
      brandPrimary: '#0A76D3',
      brandSecondary: '#E5E7EB',
      backgroundPrimary: '#FFFFFF',
    },
  },
}));

// Mock @openfin/workspace-platform -- return new jest.fn() inside factory
jest.mock('@openfin/workspace-platform', () => {
  const getSelectedScheme = jest.fn();
  const setSelectedScheme = jest.fn();
  const getCurrentSync = jest.fn(() => ({
    Theme: { getSelectedScheme, setSelectedScheme },
  }));
  return {
    __esModule: true,
    getCurrentSync,
    ColorSchemeOptionType: { Dark: 'dark', Light: 'light' },
  };
});

// Re-import to get references to the mocked functions
import { getCurrentSync } from '@openfin/workspace-platform';

describe('ThemeService', () => {
  let mockDocument: Document;

  // Access the mocked inner fns through getCurrentSync
  function getMockThemeFns() {
    const platform = (getCurrentSync as jest.Mock)();
    return {
      getSelectedScheme: platform.Theme.getSelectedScheme as jest.Mock,
      setSelectedScheme: platform.Theme.setSelectedScheme as jest.Mock,
    };
  }

  /** Helper to install / remove mock fin on globalThis. */
  function setFin(available: boolean) {
    if (available) {
      (globalThis as any).fin = { me: { isOpenFin: true } };
    } else {
      delete (globalThis as any).fin;
    }
  }

  beforeEach(() => {
    delete (globalThis as any).fin;
    const { getSelectedScheme, setSelectedScheme } = getMockThemeFns();
    getSelectedScheme.mockReset();
    setSelectedScheme.mockReset();
    (getCurrentSync as jest.Mock).mockClear();

    // Create a minimal mock document with documentElement
    const classList = new Set<string>();
    const styleProperties = new Map<string, string>();

    mockDocument = {
      documentElement: {
        classList: {
          add: jest.fn((cls: string) => classList.add(cls)),
          remove: jest.fn((cls: string) => classList.delete(cls)),
          contains: (cls: string) => classList.has(cls),
        },
        style: {
          setProperty: jest.fn((key: string, value: string) =>
            styleProperties.set(key, value),
          ),
        },
      },
    } as unknown as Document;
  });

  afterEach(() => {
    delete (globalThis as any).fin;
  });

  // ── constructor / initializeTheme ───────────────────────────

  describe('initializeTheme', () => {
    it('should not call getCurrentSync when fin is undefined', () => {
      new ThemeService(mockDocument);
      expect(getCurrentSync).not.toHaveBeenCalled();
    });

    it('should fetch scheme from OpenFin and apply dark theme', async () => {
      setFin(true);
      getMockThemeFns().getSelectedScheme.mockResolvedValue('dark');

      const service = new ThemeService(mockDocument);

      // Wait for async initializeTheme to complete
      await new Promise((r) => setTimeout(r, 0));

      expect(getCurrentSync).toHaveBeenCalled();
      expect(service.getCurrentTheme()).toBe('dark');
    });

    it('should fetch scheme from OpenFin and apply light theme', async () => {
      setFin(true);
      getMockThemeFns().getSelectedScheme.mockResolvedValue('light');

      const service = new ThemeService(mockDocument);
      await new Promise((r) => setTimeout(r, 0));

      expect(service.getCurrentTheme()).toBe('light');
    });

    it('should apply dark theme when initializeTheme errors', async () => {
      setFin(true);
      getMockThemeFns().getSelectedScheme.mockRejectedValue(
        new Error('Platform not ready'),
      );

      const service = new ThemeService(mockDocument);
      await new Promise((r) => setTimeout(r, 0));

      expect(service.getCurrentTheme()).toBe('dark');
    });
  });

  // ── applyTheme ──────────────────────────────────────────────

  describe('applyTheme', () => {
    it('should apply dark theme: add dark and theme-dark classes, remove theme-light', () => {
      const service = new ThemeService(mockDocument);
      service.applyTheme('dark');

      const el = mockDocument.documentElement;
      expect(el.classList.add).toHaveBeenCalledWith('dark');
      expect(el.classList.add).toHaveBeenCalledWith('theme-dark');
      expect(el.classList.remove).toHaveBeenCalledWith('theme-light');
    });

    it('should apply light theme: remove dark class, add theme-light, remove theme-dark', () => {
      const service = new ThemeService(mockDocument);
      service.applyTheme('light');

      const el = mockDocument.documentElement;
      expect(el.classList.remove).toHaveBeenCalledWith('dark');
      expect(el.classList.add).toHaveBeenCalledWith('theme-light');
      expect(el.classList.remove).toHaveBeenCalledWith('theme-dark');
    });

    it('should set CSS variables for each palette entry with kebab-case', () => {
      const service = new ThemeService(mockDocument);
      service.applyTheme('dark');

      const setProperty = mockDocument.documentElement.style
        .setProperty as jest.Mock;
      expect(setProperty).toHaveBeenCalledWith('--brand-primary', '#0A76D3');
      expect(setProperty).toHaveBeenCalledWith(
        '--theme-brand-primary',
        '#0A76D3',
      );
    });

    it('should set CSS variables using light palette when theme is light', () => {
      const service = new ThemeService(mockDocument);
      service.applyTheme('light');

      const setProperty = mockDocument.documentElement.style
        .setProperty as jest.Mock;
      expect(setProperty).toHaveBeenCalledWith(
        '--background-primary',
        '#FFFFFF',
      );
      expect(setProperty).toHaveBeenCalledWith(
        '--theme-background-primary',
        '#FFFFFF',
      );
    });

    it('should call onThemeChange callback when provided', () => {
      const callback = jest.fn();
      const service = new ThemeService(mockDocument, callback);
      service.applyTheme('dark');

      expect(callback).toHaveBeenCalledWith('dark', mockDarkPalette);
    });

    it('should call onThemeChange callback with light palette', () => {
      const callback = jest.fn();
      const service = new ThemeService(mockDocument, callback);
      service.applyTheme('light');

      expect(callback).toHaveBeenCalledWith('light', mockLightPalette);
    });

    it('should not throw when no onThemeChange callback is provided', () => {
      const service = new ThemeService(mockDocument);
      expect(() => service.applyTheme('dark')).not.toThrow();
    });
  });

  // ── getCurrentTheme / getCurrentPalette ─────────────────────

  describe('getCurrentTheme', () => {
    it('should return dark initially (default)', () => {
      const service = new ThemeService(mockDocument);
      expect(service.getCurrentTheme()).toBe('dark');
    });

    it('should return light after applying light theme', () => {
      const service = new ThemeService(mockDocument);
      service.applyTheme('light');
      expect(service.getCurrentTheme()).toBe('light');
    });
  });

  describe('getCurrentPalette', () => {
    it('should return dark palette initially', () => {
      const service = new ThemeService(mockDocument);
      expect(service.getCurrentPalette()).toEqual(mockDarkPalette);
    });

    it('should return light palette after applying light theme', () => {
      const service = new ThemeService(mockDocument);
      service.applyTheme('light');
      expect(service.getCurrentPalette()).toEqual(mockLightPalette);
    });
  });

  // ── getTheme$ / getPalette$ ─────────────────────────────────

  describe('getTheme$', () => {
    it('should emit dark as the initial value', async () => {
      const service = new ThemeService(mockDocument);
      const value = await firstValueFrom(service.getTheme$());
      expect(value).toBe('dark');
    });

    it('should emit theme changes in order', async () => {
      const service = new ThemeService(mockDocument);
      const emissions$ = service.getTheme$().pipe(take(3), toArray());
      const emissionsPromise = firstValueFrom(emissions$);

      service.applyTheme('light');
      service.applyTheme('dark');

      const emissions = await emissionsPromise;
      expect(emissions).toEqual(['dark', 'light', 'dark']);
    });
  });

  describe('getPalette$', () => {
    it('should emit dark palette as the initial value', async () => {
      const service = new ThemeService(mockDocument);
      const value = await firstValueFrom(service.getPalette$());
      expect(value).toEqual(mockDarkPalette);
    });

    it('should emit palette changes', async () => {
      const service = new ThemeService(mockDocument);
      const emissions$ = service.getPalette$().pipe(take(2), toArray());
      const emissionsPromise = firstValueFrom(emissions$);

      service.applyTheme('light');

      const emissions = await emissionsPromise;
      expect(emissions).toEqual([mockDarkPalette, mockLightPalette]);
    });
  });

  // ── toggleTheme ─────────────────────────────────────────────

  describe('toggleTheme', () => {
    it('should toggle from dark to light when fin is undefined (DOM toggle)', async () => {
      const service = new ThemeService(mockDocument);
      expect(service.getCurrentTheme()).toBe('dark');

      await service.toggleTheme();

      expect(service.getCurrentTheme()).toBe('light');
    });

    it('should toggle from light to dark when fin is undefined', async () => {
      const service = new ThemeService(mockDocument);
      service.applyTheme('light');

      await service.toggleTheme();

      expect(service.getCurrentTheme()).toBe('dark');
    });

    it('should call OpenFin setSelectedScheme when fin is available', async () => {
      setFin(true);
      const { getSelectedScheme, setSelectedScheme } = getMockThemeFns();
      getSelectedScheme.mockResolvedValue('dark');
      setSelectedScheme.mockResolvedValue(undefined);

      const service = new ThemeService(mockDocument);

      await service.toggleTheme();

      expect(setSelectedScheme).toHaveBeenCalledWith('light');
    });

    it('should toggle from light to dark via OpenFin', async () => {
      setFin(true);
      const { getSelectedScheme, setSelectedScheme } = getMockThemeFns();
      getSelectedScheme.mockResolvedValue('light');
      setSelectedScheme.mockResolvedValue(undefined);

      const service = new ThemeService(mockDocument);

      await service.toggleTheme();

      expect(setSelectedScheme).toHaveBeenCalledWith('dark');
    });

    it('should not throw when OpenFin toggle errors', async () => {
      setFin(true);
      getMockThemeFns().getSelectedScheme.mockRejectedValue(
        new Error('Platform error'),
      );

      const service = new ThemeService(mockDocument);

      await expect(service.toggleTheme()).resolves.toBeUndefined();
    });
  });

  // ── syncWithOpenFinTheme ────────────────────────────────────

  describe('syncWithOpenFinTheme', () => {
    it('should be a no-op when fin is undefined', async () => {
      const service = new ThemeService(mockDocument);
      await service.syncWithOpenFinTheme();
      expect(getCurrentSync).not.toHaveBeenCalled();
    });

    it('should perform initial sync when fin is available', async () => {
      setFin(true);
      getMockThemeFns().getSelectedScheme.mockResolvedValue('light');

      const service = new ThemeService(mockDocument);
      await service.syncWithOpenFinTheme();

      expect(service.getCurrentTheme()).toBe('light');
    });

    it('should not throw on error during sync', async () => {
      setFin(true);
      getMockThemeFns().getSelectedScheme.mockRejectedValue(
        new Error('fail'),
      );

      const service = new ThemeService(mockDocument);
      await expect(service.syncWithOpenFinTheme()).resolves.toBeUndefined();
    });
  });

  // ── stopSyncing ─────────────────────────────────────────────

  describe('stopSyncing', () => {
    it('should be a no-op when no sync is running', () => {
      const service = new ThemeService(mockDocument);
      expect(() => service.stopSyncing()).not.toThrow();
    });
  });
});
