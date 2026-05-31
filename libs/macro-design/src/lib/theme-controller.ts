/**
 * Framework-agnostic theme controller — the single source of truth for the
 * active theme (default `macro`) and dark/light mode across Macro apps.
 *
 * It owns the reactive state and the DOM side-effects (toggling the `.dark`
 * class that PrimeNG/PrimeReact/Tailwind/AG-Grid all key off, plus localStorage
 * persistence) and exposes a tiny `subscribe`/`getSnapshot` store interface so
 * thin framework adapters can wrap it:
 *  - Angular: `@macro/macro-design/angular` → `ThemeService` (signals)
 *  - React:   `@macro/macro-design/react`   → `useTheme()` (useSyncExternalStore)
 *
 * Behavior:
 *  - Initial mode comes from {@link getInitialIsDark} (localStorage → system).
 *  - Explicit user actions ({@link ThemeController.toggle}/{@link ThemeController.setDark})
 *    persist the choice to localStorage.
 *  - System (`prefers-color-scheme`) and OpenFin platform changes update the UI
 *    without persisting, so an unset user preference keeps tracking the source.
 */
import { applyDarkMode, getInitialIsDark, onSystemThemeChange } from './dark-mode';
import { onOpenFinThemeChange } from './openfin-theme-sync';
import { DEFAULT_THEME_ID, getTheme, type MacroThemeDefinition, type ThemeMode } from './themes';
import type { ThemePalette } from './theme.config';

export type { ThemeMode } from './themes';

/** Immutable snapshot of the current theme state. */
export interface ThemeState {
  readonly isDark: boolean;
  readonly mode: ThemeMode;
  readonly themeId: string;
  readonly theme: MacroThemeDefinition;
  readonly palette: ThemePalette;
}

export interface ThemeControllerOptions {
  /** Follow OS `prefers-color-scheme` when the user hasn't chosen. Default `true`. */
  syncSystem?: boolean;
  /** Follow OpenFin platform theme changes when inside the runtime. Default `true`. */
  syncOpenFin?: boolean;
  /** Theme id to start with. Default `'macro'`. */
  defaultThemeId?: string;
}

export class ThemeController {
  private isDark: boolean;
  private themeId: string;
  private started = false;
  private snapshot: ThemeState;

  private readonly listeners = new Set<() => void>();
  private readonly cleanups: Array<() => void> = [];
  private readonly options: Required<ThemeControllerOptions>;

  constructor(options: ThemeControllerOptions = {}) {
    this.options = {
      syncSystem: options.syncSystem ?? true,
      syncOpenFin: options.syncOpenFin ?? true,
      defaultThemeId: options.defaultThemeId ?? DEFAULT_THEME_ID,
    };
    this.themeId = this.options.defaultThemeId;
    this.isDark = getInitialIsDark();
    this.snapshot = this.computeSnapshot();
  }

  /**
   * Apply the current state to the DOM and attach system/OpenFin listeners.
   * Idempotent — safe to call from every consumer; only the first call does work.
   */
  start(): void {
    if (this.started) return;
    this.started = true;

    // Reflect the initial mode without persisting, so an unset user preference
    // keeps tracking the system/OpenFin source.
    this.applyClass();

    if (this.options.syncSystem) {
      this.cleanups.push(onSystemThemeChange((dark) => this.set(dark, false)));
    }
    if (this.options.syncOpenFin) {
      this.cleanups.push(onOpenFinThemeChange((dark) => this.set(dark, false)));
    }
  }

  /** Detach all listeners. Safe to call multiple times. */
  stop(): void {
    while (this.cleanups.length) {
      this.cleanups.pop()?.();
    }
    this.started = false;
  }

  /** Current immutable snapshot. Reference is stable until state changes. */
  readonly getSnapshot = (): ThemeState => this.snapshot;

  /** Subscribe to state changes. Returns an unsubscribe function. */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Set dark/light explicitly (persists the user's choice). */
  setDark(isDark: boolean): void {
    this.set(isDark, true);
  }

  /** Flip between dark and light (persists the user's choice). */
  toggle(): void {
    this.set(!this.isDark, true);
  }

  /** Switch the active named theme (default `macro`). */
  setTheme(themeId: string): void {
    if (this.themeId === themeId) return;
    this.themeId = themeId;
    this.snapshot = this.computeSnapshot();
    this.emit();
  }

  get currentIsDark(): boolean {
    return this.isDark;
  }

  get currentThemeId(): string {
    return this.themeId;
  }

  private set(isDark: boolean, persist: boolean): void {
    const changed = this.isDark !== isDark;
    this.isDark = isDark;

    if (persist) {
      applyDarkMode(isDark); // toggles `.dark` + writes localStorage
    } else {
      this.applyClass();
    }

    if (changed) {
      this.snapshot = this.computeSnapshot();
      this.emit();
    }
  }

  private applyClass(): void {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('dark', this.isDark);
  }

  private computeSnapshot(): ThemeState {
    const theme = getTheme(this.themeId);
    return {
      isDark: this.isDark,
      mode: this.isDark ? 'dark' : 'light',
      themeId: this.themeId,
      theme,
      palette: this.isDark ? theme.palettes.dark : theme.palettes.light,
    };
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }
}

/** Shared singleton used by the Angular service and React hook. */
export const themeController = new ThemeController();
