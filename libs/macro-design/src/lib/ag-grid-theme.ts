import {
  type Theme,
  colorSchemeDarkBlue,
  colorSchemeLight,
  iconSetAlpine,
  themeAlpine,
} from 'ag-grid-community';

/** Font families used across all AG Grid instances */
export const AG_GRID_FONTS = {
  fontFamily: 'Noto Sans',
  headerFontFamily: 'Roboto',
  cellFontFamily: 'Ubuntu',
} as const;

/**
 * Build an AG Grid theme for the given dark/light mode.
 * Returns a fully configured Theme with Alpine base, appropriate color scheme, and Macro fonts.
 */
export function buildAgGridTheme(isDark: boolean): Theme {
  return themeAlpine
    .withPart(iconSetAlpine)
    .withPart(isDark ? colorSchemeDarkBlue : colorSchemeLight)
    .withParams(AG_GRID_FONTS);
}
