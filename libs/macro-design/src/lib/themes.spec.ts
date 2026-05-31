import { DEFAULT_THEME_ID, MACRO_THEME, MACRO_THEMES, getPalette, getTheme } from './themes';
import { themeConfig } from './theme.config';

describe('themes registry', () => {
  it('defines `macro` as the default theme', () => {
    expect(DEFAULT_THEME_ID).toBe('macro');
    expect(MACRO_THEME.id).toBe('macro');
    expect(MACRO_THEME.label).toBe('Macro E-Trading');
  });

  it('sources the macro palettes from themeConfig (single source of truth)', () => {
    expect(MACRO_THEME.palettes).toBe(themeConfig);
    expect(MACRO_THEME.palettes.dark.brandPrimary).toBe('#2AA6E6');
    expect(MACRO_THEME.palettes.light.brandPrimary).toBe('#1685C2');
  });

  it('registers the macro theme by id', () => {
    expect(MACRO_THEMES['macro']).toBe(MACRO_THEME);
  });

  describe('getTheme', () => {
    it('returns the macro theme by default', () => {
      expect(getTheme()).toBe(MACRO_THEME);
    });

    it('resolves a known id', () => {
      expect(getTheme('macro')).toBe(MACRO_THEME);
    });

    it('falls back to the macro theme for an unknown id', () => {
      expect(getTheme('does-not-exist')).toBe(MACRO_THEME);
    });
  });

  describe('getPalette', () => {
    it('returns the dark palette', () => {
      expect(getPalette('dark')).toBe(themeConfig.dark);
    });

    it('returns the light palette', () => {
      expect(getPalette('light')).toBe(themeConfig.light);
    });
  });
});
