import { ThemeController } from './theme-controller';
import { themeConfig } from './theme.config';

describe('ThemeController', () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    // jsdom does not implement matchMedia — provide a light-preference default.
    Object.defineProperty(window, 'matchMedia', {
      value: jest.fn().mockReturnValue({
        matches: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }),
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', { value: originalMatchMedia, writable: true });
    delete (globalThis as unknown as { fin?: unknown }).fin;
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  /** Construct with external sync disabled for deterministic unit tests. */
  function makeController(opts: Record<string, unknown> = {}) {
    return new ThemeController({ syncSystem: false, syncOpenFin: false, ...opts });
  }

  it('defaults to the `macro` theme', () => {
    const c = makeController();
    expect(c.currentThemeId).toBe('macro');
    expect(c.getSnapshot().theme.id).toBe('macro');
  });

  it('initializes dark mode from localStorage', () => {
    localStorage.setItem('theme', 'dark');
    const c = makeController();
    expect(c.currentIsDark).toBe(true);
    expect(c.getSnapshot().mode).toBe('dark');
    expect(c.getSnapshot().palette).toBe(themeConfig.dark);
  });

  it('initializes light mode from localStorage', () => {
    localStorage.setItem('theme', 'light');
    const c = makeController();
    expect(c.currentIsDark).toBe(false);
    expect(c.getSnapshot().palette).toBe(themeConfig.light);
  });

  it('falls back to system preference when localStorage is empty', () => {
    Object.defineProperty(window, 'matchMedia', {
      value: jest.fn().mockReturnValue({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() }),
      writable: true,
    });
    const c = makeController();
    expect(c.currentIsDark).toBe(true);
  });

  it('applies the `.dark` class on start (without persisting)', () => {
    localStorage.setItem('theme', 'dark');
    const c = makeController();
    c.start();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('toggle() flips mode, persists, and notifies subscribers', () => {
    localStorage.setItem('theme', 'light');
    const c = makeController();
    c.start();
    const listener = jest.fn();
    c.subscribe(listener);

    c.toggle();

    expect(c.currentIsDark).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(c.getSnapshot().palette).toBe(themeConfig.dark);
  });

  it('setDark(false) removes the class and persists light', () => {
    localStorage.setItem('theme', 'dark');
    const c = makeController();
    c.start();

    c.setDark(false);

    expect(c.currentIsDark).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('returns a stable snapshot reference when state does not change', () => {
    localStorage.setItem('theme', 'dark');
    const c = makeController();
    const a = c.getSnapshot();
    c.setDark(true); // no change
    expect(c.getSnapshot()).toBe(a);
  });

  it('produces a new snapshot reference on change', () => {
    localStorage.setItem('theme', 'dark');
    const c = makeController();
    const a = c.getSnapshot();
    c.setDark(false);
    expect(c.getSnapshot()).not.toBe(a);
  });

  it('does not notify a removed subscriber', () => {
    const c = makeController();
    const listener = jest.fn();
    const unsubscribe = c.subscribe(listener);
    unsubscribe();
    c.toggle();
    expect(listener).not.toHaveBeenCalled();
  });

  it('reacts to system theme changes without persisting', () => {
    let handler: ((e: { matches: boolean }) => void) | undefined;
    Object.defineProperty(window, 'matchMedia', {
      value: jest.fn().mockReturnValue({
        matches: false,
        addEventListener: (_: string, h: (e: { matches: boolean }) => void) => {
          handler = h;
        },
        removeEventListener: jest.fn(),
      }),
      writable: true,
    });

    const c = new ThemeController({ syncSystem: true, syncOpenFin: false });
    c.start();
    const listener = jest.fn();
    c.subscribe(listener);

    handler?.({ matches: true });

    expect(c.currentIsDark).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    // System changes must not write an explicit user preference.
    expect(localStorage.getItem('theme')).toBeNull();
  });

  it('reacts to OpenFin platform theme changes without overwriting the user choice', () => {
    let iabHandler: ((payload: { isDark: boolean }) => void) | undefined;
    (globalThis as unknown as { fin?: unknown }).fin = {
      InterApplicationBus: {
        subscribe: (_s: unknown, _t: string, h: (payload: { isDark: boolean }) => void) => {
          iabHandler = h;
        },
        unsubscribe: jest.fn(),
      },
    };

    localStorage.setItem('theme', 'light');
    const c = new ThemeController({ syncSystem: false, syncOpenFin: true });
    c.start();
    const listener = jest.fn();
    c.subscribe(listener);

    iabHandler?.({ isDark: true });

    expect(c.currentIsDark).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    // OpenFin-driven changes don't overwrite the persisted user choice.
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('setTheme switches the active theme id and notifies', () => {
    const c = makeController();
    const listener = jest.fn();
    c.subscribe(listener);

    c.setTheme('macro'); // same as default → no-op
    expect(listener).not.toHaveBeenCalled();

    c.setTheme('custom');
    expect(c.currentThemeId).toBe('custom');
    expect(listener).toHaveBeenCalledTimes(1);
    // Unknown ids fall back to the macro palettes.
    expect(c.getSnapshot().theme.id).toBe('macro');
  });

  it('stop() detaches listeners and is idempotent', () => {
    const c = makeController({ syncSystem: true, syncOpenFin: true });
    c.start();
    expect(() => {
      c.stop();
      c.stop();
    }).not.toThrow();
  });
});
