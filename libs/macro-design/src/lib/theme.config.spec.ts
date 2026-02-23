import { themeConfig } from './theme.config';
import type { ThemePalette } from './theme.config';

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;

describe('theme.config', () => {
  const requiredKeys: (keyof ThemePalette)[] = [
    'brandPrimary',
    'brandSecondary',
    'backgroundPrimary',
  ];

  describe('dark palette', () => {
    it('should have all required keys', () => {
      for (const key of requiredKeys) {
        expect(themeConfig.dark[key]).toBeDefined();
      }
    });

    it('should have valid hex colors for all defined values', () => {
      for (const [key, value] of Object.entries(themeConfig.dark)) {
        if (value !== undefined) {
          expect(value).toMatch(HEX_REGEX);
        }
      }
    });

    it('should have brandPrimary set', () => {
      expect(themeConfig.dark.brandPrimary).toBe('#0A76D3');
    });

    it('should have backgroundPrimary set', () => {
      expect(themeConfig.dark.backgroundPrimary).toBe('#1E1F23');
    });

    it('should have textDefault set', () => {
      expect(themeConfig.dark.textDefault).toBe('#FFFFFF');
    });

    it('should have status colors defined', () => {
      expect(themeConfig.dark.statusSuccess).toBeDefined();
      expect(themeConfig.dark.statusWarning).toBeDefined();
      expect(themeConfig.dark.statusCritical).toBeDefined();
      expect(themeConfig.dark.statusActive).toBeDefined();
    });
  });

  describe('light palette', () => {
    it('should have all required keys', () => {
      for (const key of requiredKeys) {
        expect(themeConfig.light[key]).toBeDefined();
      }
    });

    it('should have valid hex colors for all defined values', () => {
      for (const [key, value] of Object.entries(themeConfig.light)) {
        if (value !== undefined) {
          expect(value).toMatch(HEX_REGEX);
        }
      }
    });

    it('should have backgroundPrimary set to white', () => {
      expect(themeConfig.light.backgroundPrimary).toBe('#FFFFFF');
    });

    it('should have textDefault set to dark color', () => {
      expect(themeConfig.light.textDefault).toBe('#111827');
    });

    it('should have status colors defined', () => {
      expect(themeConfig.light.statusSuccess).toBeDefined();
      expect(themeConfig.light.statusWarning).toBeDefined();
      expect(themeConfig.light.statusCritical).toBeDefined();
      expect(themeConfig.light.statusActive).toBeDefined();
    });
  });

  describe('dark vs light comparison', () => {
    it('should have different backgroundPrimary values', () => {
      expect(themeConfig.dark.backgroundPrimary).not.toBe(themeConfig.light.backgroundPrimary);
    });

    it('should have different textDefault values', () => {
      expect(themeConfig.dark.textDefault).not.toBe(themeConfig.light.textDefault);
    });

    it('should share the same brandPrimary', () => {
      expect(themeConfig.dark.brandPrimary).toBe(themeConfig.light.brandPrimary);
    });
  });
});
