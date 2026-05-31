/**
 * Named theme registry for Macro applications.
 *
 * The default theme is `macro` — the "Macro E-Trading / Macro Cerulean" theme
 * (matching the `MacroThemeCondensed` design kit). Its palettes are sourced from
 * {@link themeConfig} so there is a single source of truth for color values
 * across CSS tokens, the OpenFin workspace palette, and the AG Grid theme.
 */
import { themeConfig, type ThemeConfig, type ThemePalette } from './theme.config';

export type ThemeMode = 'dark' | 'light';

/** A named theme with dark + light palettes (OpenFin-compatible {@link ThemePalette} shape). */
export interface MacroThemeDefinition {
  /** Stable identifier, e.g. `'macro'`. */
  id: string;
  /** Human-readable label, e.g. `'Macro E-Trading'`. */
  label: string;
  /** Dark + light palettes. */
  palettes: ThemeConfig;
}

/**
 * The default `macro` theme — "Macro E-Trading" / "Macro Cerulean".
 * Brand `#2AA6E6` (dark) / `#1685C2` (light), slate neutrals, trading-optimized.
 */
export const MACRO_THEME: MacroThemeDefinition = {
  id: 'macro',
  label: 'Macro E-Trading',
  palettes: themeConfig,
};

/** Id of the theme used by default when none is specified. */
export const DEFAULT_THEME_ID = MACRO_THEME.id;

/** All themes known to the library, keyed by id. */
export const MACRO_THEMES: Readonly<Record<string, MacroThemeDefinition>> = {
  [MACRO_THEME.id]: MACRO_THEME,
};

/**
 * Resolve a theme definition by id, falling back to the default `macro` theme
 * when the id is unknown or omitted.
 */
export function getTheme(id: string = DEFAULT_THEME_ID): MacroThemeDefinition {
  return MACRO_THEMES[id] ?? MACRO_THEME;
}

/** Resolve the {@link ThemePalette} for a theme id in the given mode. */
export function getPalette(mode: ThemeMode, id: string = DEFAULT_THEME_ID): ThemePalette {
  const theme = getTheme(id);
  return mode === 'dark' ? theme.palettes.dark : theme.palettes.light;
}
