/**
 * React adapter for the Macro theme system.
 *
 * Import from `@macro/macro-design/react`:
 * ```tsx
 * const { isDark, toggle } = useTheme();
 * <button onClick={toggle}>{isDark ? 'Light' : 'Dark'}</button>
 * ```
 *
 * Wraps the framework-agnostic {@link themeController} via `useSyncExternalStore`,
 * so all components/views share one source of truth and stay in sync with OS and
 * OpenFin platform theme changes.
 */
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { themeController, type ThemeState } from '../theme-controller';

export interface UseThemeResult extends ThemeState {
  /** Flip dark/light (persists the user's choice). */
  toggle: () => void;
  /** Set dark/light explicitly (persists the user's choice). */
  setDark: (isDark: boolean) => void;
  /** Switch the active named theme. */
  setTheme: (themeId: string) => void;
}

/**
 * Subscribe to the Macro theme controller. Returns the current theme state plus
 * imperative `toggle` / `setDark` / `setTheme` actions.
 */
export function useTheme(): UseThemeResult {
  useEffect(() => {
    themeController.start();
  }, []);

  const state = useSyncExternalStore(
    themeController.subscribe,
    themeController.getSnapshot,
    themeController.getSnapshot,
  );

  const toggle = useCallback(() => themeController.toggle(), []);
  const setDark = useCallback((isDark: boolean) => themeController.setDark(isDark), []);
  const setTheme = useCallback((themeId: string) => themeController.setTheme(themeId), []);

  return { ...state, toggle, setDark, setTheme };
}

export { themeController } from '../theme-controller';
export type { ThemeState, ThemeMode } from '../theme-controller';
export type { MacroThemeDefinition } from '../themes';
export type { ThemePalette } from '../theme.config';
