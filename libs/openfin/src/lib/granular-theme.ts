import type { ThemePalette } from '@macro/macro-design';
import { ColorSchemeOptionType, type ThemeOptions } from '@openfin/workspace-platform';

/**
 * HERE Core UI "Granular Color Theming" (Workspace 24.0.19 / Notifications 2.15.0).
 *
 * Builds a token-based {@link ThemeOptions} from a macro {@link ThemePalette}, replacing the
 * legacy fully-enumerated `palettes` (CustomPaletteSet) approach. A single brand `seed` drives
 * the engine-generated color ramps; `overrides` pin individual role/component tokens (view tabs,
 * buttons, dialogs, notification chrome) to exact macro brand values for both color schemes.
 *
 * IMPORTANT: `@openfin/theme-engine` is bundled (not installed as types), so `seed`/`overrides`
 * are effectively `any` — a misspelled token key silently no-ops with no compile error. Every key
 * below was verified against the bundled engine (node_modules/@openfin/workspace-platform/index.js)
 * and the official docs (resources.here.io/docs/core/hc-ui/customize/granular-color-theming).
 * Seed uses FLAT dotted keys and per-scheme base/accent foundations, per the docs example +
 * the engine's internal `{brand.base.dark}` token references.
 */

/** Per-scheme override token map (flat dotted granular tokens -> macro brand colors). */
function buildOverrides(p: ThemePalette): Record<string, string> {
  const bg1 = p.background1 ?? p.backgroundPrimary;
  const bg2 = p.background2 ?? bg1;
  const bg3 = p.background3 ?? bg2;
  const bg4 = p.background4 ?? bg3;
  const bg5 = p.background5 ?? bg4;
  const bg6 = p.background6 ?? bg5;
  const accent = p.brandPrimary;
  const accentStrong = p.brandPrimaryHover ?? accent;
  const accentActive = p.brandPrimaryActive ?? accent;
  const onAccent = p.brandPrimaryText ?? '#FFFFFF';
  const secondary = p.brandSecondary;
  const secondaryHover = p.brandSecondaryHover ?? secondary;
  const secondaryActive = p.brandSecondaryActive ?? secondary;
  const onSecondary = p.brandSecondaryText ?? p.textDefault ?? '#E6E8EC';
  const text = p.textDefault ?? onSecondary;
  const textSoft = p.textHelp ?? text;
  const textSofter = p.textInactive ?? textSoft;
  const border = p.inputBorder ?? bg4;
  const focus = p.inputFocused ?? accent;
  const inputBg = p.inputBackground ?? bg1;
  const inputText = p.inputColor ?? text;
  const placeholder = p.inputPlaceholder ?? textSofter;

  return {
    // background levels
    'color.role.background.1': bg1,
    'color.role.background.2': bg2,
    'color.role.background.3': bg3,
    'color.role.background.4': bg4,
    'color.role.background.5': bg5,
    'color.role.background.6': bg6,
    // accent / brand
    'color.role.background.accent.base': accent,
    'color.role.background.accent.strong': accentStrong,
    // borders
    'color.role.border.base': border,
    // foreground / text
    'color.role.foreground.base': text,
    'color.role.foreground.soft': textSoft,
    'color.role.foreground.softer': textSofter,
    'color.role.foreground.onPrimary': onAccent,
    // links + focus ring
    'color.role.link.default': accent,
    'color.role.link.hover': accentStrong,
    'color.role.focusRing': focus,
    // semantic identifiers (also drive notification dots / status chips)
    'color.role.identifier.green': p.statusSuccess ?? accent,
    'color.role.identifier.red': p.statusCritical ?? accent,
    'color.role.identifier.yellow': p.statusWarning ?? accent,
    'color.role.identifier.blue': p.statusActive ?? accent,
    // buttons — primary = brand, default = neutral/secondary
    'color.shared.button.primary.background.default': accent,
    'color.shared.button.primary.background.hover': accentStrong,
    'color.shared.button.primary.background.pressed': accentActive,
    'color.shared.button.primary.text.default': onAccent,
    'color.shared.button.default.background.default': secondary,
    'color.shared.button.default.background.hover': secondaryHover,
    'color.shared.button.default.background.pressed': secondaryActive,
    'color.shared.button.default.text.default': onSecondary,
    // inputs / forms
    'color.shared.form.background.default': inputBg,
    'color.shared.form.border.default': border,
    'color.shared.form.border.focus': focus,
    'color.shared.form.placeholder.default': placeholder,
    'color.shared.form.value.default': inputText,
    'color.shared.form.value.filled': inputText,
    'color.shared.icon.accent': accent,
    // browser view tabs (engine namespace: color.enterprise.viewTab.*)
    'color.enterprise.viewTab.background.default': bg1,
    'color.enterprise.viewTab.background.hover': bg3,
    'color.enterprise.viewTab.background.active': bg4,
    'color.enterprise.viewTab.background.selected': bg4,
    'color.coreui.browserTopBar.toolbarIcon.background.hover': bg4,
    // notification card + center chrome (doc-sourced; provider-side)
    'color.shared.notification.background': bg2,
    'color.shared.notification.border': bg4,
    'color.shared.notification.text.base': text,
    'color.shared.notification.text.soft': textSoft,
    // dialogs / modals (doc-sourced)
    'color.shared.modal.background': bg2,
    'color.shared.modal.border': bg4,
  };
}

/**
 * Build the macro granular {@link ThemeOptions} for `WorkspacePlatform.init({ theme: [...] })`.
 * One theme covers both the workspace UI and the Notification Center.
 */
export function buildMacroGranularTheme(dark: ThemePalette, light: ThemePalette): ThemeOptions {
  return {
    label: 'Macro',
    default: ColorSchemeOptionType.Dark,
    // seed: FLAT dotted keys. base = per-scheme neutral foundation, accent = brand color.
    // `.dark`/`.light` = the value used in that color scheme.
    seed: {
      'brand.base.dark': dark.backgroundPrimary,
      'brand.base.light': light.background1 ?? light.backgroundPrimary,
      'brand.accent.dark': dark.brandPrimary,
      'brand.accent.light': light.brandPrimary,
    },
    overrides: {
      dark: buildOverrides(dark),
      light: buildOverrides(light),
    },
    // Notification indicator dots — keys match LEVEL_INDICATOR_COLORS in notifications.service.ts.
    // `foreground` defaults to #FFFFFF when omitted; set explicitly to keep contrast on bright dots.
    notificationIndicatorColors: {
      blue: {
        dark: { background: dark.statusActive ?? dark.brandPrimary, foreground: dark.brandPrimaryText ?? '#041A26' },
        light: { background: light.statusActive ?? light.brandPrimary, foreground: light.brandPrimaryText ?? '#FFFFFF' },
      },
      green: {
        dark: { background: dark.statusSuccess ?? '#34D97A', foreground: '#041A26' },
        light: { background: light.statusSuccess ?? '#0F7F45', foreground: '#FFFFFF' },
      },
      yellow: {
        dark: { background: dark.statusWarning ?? '#F5C13A', foreground: '#041A26' },
        light: { background: light.statusWarning ?? '#C79306', foreground: '#FFFFFF' },
      },
      red: {
        dark: { background: dark.statusCritical ?? '#FF6B64', foreground: '#041A26' },
        light: { background: light.statusCritical ?? '#B82C25', foreground: '#FFFFFF' },
      },
      magenta: {
        dark: { background: '#D6477F', foreground: '#FFFFFF' },
        light: { background: '#B3275C', foreground: '#FFFFFF' },
      },
    },
  };
}
