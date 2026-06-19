import { themeConfig } from '@macro/macro-design';
import { buildMacroGranularTheme } from './granular-theme';

describe('buildMacroGranularTheme', () => {
  const theme = buildMacroGranularTheme(themeConfig.dark, themeConfig.light) as any;

  it('produces a single granular ThemeOptions (seed/overrides, NOT legacy palettes)', () => {
    expect(theme.label).toBe('Macro');
    expect(theme.default).toBe('dark');
    expect(theme.seed).toBeDefined();
    expect(theme.overrides).toBeDefined();
    // Granular and legacy palettes cannot coexist in one theme entry.
    expect(theme.palettes).toBeUndefined();
  });

  it('seed uses FLAT dotted brand keys mapped to the macro brand colors', () => {
    expect(theme.seed).toEqual({
      'brand.base.dark': themeConfig.dark.backgroundPrimary,
      'brand.base.light': themeConfig.light.background1,
      'brand.accent.dark': themeConfig.dark.brandPrimary,
      'brand.accent.light': themeConfig.light.brandPrimary,
    });
  });

  it('base.light is a LIGHT neutral and base.dark a DARK neutral (per-scheme foundation)', () => {
    // Guards the design-fix: light-scheme base must not be a dark value.
    expect(theme.seed['brand.base.light']).toBe('#FFFFFF');
    expect(theme.seed['brand.base.dark']).toBe('#0B0D12');
  });

  it('provides overrides for both color schemes with dotted token keys', () => {
    expect(theme.overrides.dark).toBeDefined();
    expect(theme.overrides.light).toBeDefined();
    for (const scheme of [theme.overrides.dark, theme.overrides.light]) {
      // background, accent, view-tab, button, notification token families present
      expect(scheme['color.role.background.1']).toMatch(/^#/);
      expect(scheme['color.role.background.accent.base']).toMatch(/^#/);
      expect(scheme['color.enterprise.viewTab.background.selected']).toMatch(/^#/);
      expect(scheme['color.shared.button.primary.background.default']).toMatch(/^#/);
      expect(scheme['color.shared.notification.background']).toMatch(/^#/);
      // every key is dotted and every value a hex string
      for (const [k, v] of Object.entries(scheme)) {
        expect(k).toContain('.');
        expect(v).toMatch(/^#[0-9A-Fa-f]{3,8}$/);
      }
    }
  });

  it('maps macro accent + status colors into the dark override scheme', () => {
    expect(theme.overrides.dark['color.role.background.accent.base']).toBe(themeConfig.dark.brandPrimary);
    expect(theme.overrides.dark['color.role.identifier.green']).toBe(themeConfig.dark.statusSuccess);
    expect(theme.overrides.dark['color.role.identifier.red']).toBe(themeConfig.dark.statusCritical);
  });

  it('defines notificationIndicatorColors for the indicator names the app emits', () => {
    const keys = Object.keys(theme.notificationIndicatorColors);
    expect(keys).toEqual(expect.arrayContaining(['blue', 'green', 'yellow', 'red', 'magenta']));
    for (const name of keys) {
      const entry = theme.notificationIndicatorColors[name];
      expect(entry.dark.background).toMatch(/^#/);
      expect(entry.light.background).toMatch(/^#/);
    }
    // blue indicator tracks the brand/active status color
    expect(theme.notificationIndicatorColors.blue.dark.background).toBe(themeConfig.dark.statusActive);
  });

  it('tolerates a sparse palette (optional fields fall back, never undefined)', () => {
    const sparse = { brandPrimary: '#123456', brandSecondary: '#222222', backgroundPrimary: '#000000' };
    const t = buildMacroGranularTheme(sparse as any, sparse as any) as any;
    for (const scheme of [t.overrides.dark, t.overrides.light]) {
      for (const v of Object.values(scheme)) expect(v).toMatch(/^#[0-9A-Fa-f]{3,8}$/);
    }
  });
});
