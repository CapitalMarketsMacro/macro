import { getInitialIsDark, applyDarkMode, onSystemThemeChange } from './dark-mode';

describe('dark-mode', () => {
  let originalLocalStorage: Storage;
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalLocalStorage = window.localStorage;
    originalMatchMedia = window.matchMedia;
    localStorage.clear();
  });

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', { value: originalMatchMedia, writable: true });
    localStorage.clear();
  });

  describe('getInitialIsDark', () => {
    it('should return true when localStorage theme is "dark"', () => {
      localStorage.setItem('theme', 'dark');
      expect(getInitialIsDark()).toBe(true);
    });

    it('should return false when localStorage theme is "light"', () => {
      localStorage.setItem('theme', 'light');
      expect(getInitialIsDark()).toBe(false);
    });

    it('should fall back to matchMedia when no localStorage value', () => {
      Object.defineProperty(window, 'matchMedia', {
        value: jest.fn().mockReturnValue({ matches: true }),
        writable: true,
      });
      expect(getInitialIsDark()).toBe(true);
    });

    it('should return false when matchMedia prefers light', () => {
      Object.defineProperty(window, 'matchMedia', {
        value: jest.fn().mockReturnValue({ matches: false }),
        writable: true,
      });
      expect(getInitialIsDark()).toBe(false);
    });
  });

  describe('applyDarkMode', () => {
    it('should add "dark" class when isDark is true', () => {
      applyDarkMode(true);
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(localStorage.getItem('theme')).toBe('dark');
    });

    it('should remove "dark" class when isDark is false', () => {
      document.documentElement.classList.add('dark');
      applyDarkMode(false);
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      expect(localStorage.getItem('theme')).toBe('light');
    });

    it('should persist "dark" to localStorage', () => {
      applyDarkMode(true);
      expect(localStorage.getItem('theme')).toBe('dark');
    });

    it('should persist "light" to localStorage', () => {
      applyDarkMode(false);
      expect(localStorage.getItem('theme')).toBe('light');
    });
  });

  describe('onSystemThemeChange', () => {
    it('should register a change listener on matchMedia', () => {
      const addSpy = jest.fn();
      const removeSpy = jest.fn();
      Object.defineProperty(window, 'matchMedia', {
        value: jest.fn().mockReturnValue({
          addEventListener: addSpy,
          removeEventListener: removeSpy,
        }),
        writable: true,
      });

      const cb = jest.fn();
      const cleanup = onSystemThemeChange(cb);

      expect(addSpy).toHaveBeenCalledWith('change', expect.any(Function));
      expect(typeof cleanup).toBe('function');
    });

    it('should invoke callback when system theme changes and no localStorage override', () => {
      let handler: (e: Partial<MediaQueryListEvent>) => void = () => {};
      Object.defineProperty(window, 'matchMedia', {
        value: jest.fn().mockReturnValue({
          addEventListener: (_: string, h: any) => { handler = h; },
          removeEventListener: jest.fn(),
        }),
        writable: true,
      });

      const cb = jest.fn();
      onSystemThemeChange(cb);

      // No localStorage override — should call cb
      handler({ matches: true } as Partial<MediaQueryListEvent>);
      expect(cb).toHaveBeenCalledWith(true);

      handler({ matches: false } as Partial<MediaQueryListEvent>);
      expect(cb).toHaveBeenCalledWith(false);
    });

    it('should NOT invoke callback when localStorage theme is set', () => {
      let handler: (e: Partial<MediaQueryListEvent>) => void = () => {};
      Object.defineProperty(window, 'matchMedia', {
        value: jest.fn().mockReturnValue({
          addEventListener: (_: string, h: any) => { handler = h; },
          removeEventListener: jest.fn(),
        }),
        writable: true,
      });

      localStorage.setItem('theme', 'dark');

      const cb = jest.fn();
      onSystemThemeChange(cb);

      handler({ matches: true } as Partial<MediaQueryListEvent>);
      expect(cb).not.toHaveBeenCalled();
    });

    it('should remove listener on cleanup', () => {
      const removeSpy = jest.fn();
      Object.defineProperty(window, 'matchMedia', {
        value: jest.fn().mockReturnValue({
          addEventListener: jest.fn(),
          removeEventListener: removeSpy,
        }),
        writable: true,
      });

      const cleanup = onSystemThemeChange(jest.fn());
      cleanup();

      expect(removeSpy).toHaveBeenCalledWith('change', expect.any(Function));
    });
  });
});
