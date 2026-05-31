// Theme configuration (OpenFin palette)
export { themeConfig } from './lib/theme.config';
export type { ThemePalette, ThemeConfig } from './lib/theme.config';

// Named theme registry — default theme is `macro`
export { MACRO_THEME, MACRO_THEMES, DEFAULT_THEME_ID, getTheme, getPalette } from './lib/themes';
export type { MacroThemeDefinition, ThemeMode } from './lib/themes';

// Framework-agnostic theme controller (wrapped by the angular/react adapters)
export { ThemeController, themeController } from './lib/theme-controller';
export type { ThemeState, ThemeControllerOptions } from './lib/theme-controller';

// AG Grid theme builder
export { buildAgGridTheme, AG_GRID_FONTS } from './lib/ag-grid-theme';

// Dark-mode utilities
export { getInitialIsDark, applyDarkMode, onSystemThemeChange } from './lib/dark-mode';
