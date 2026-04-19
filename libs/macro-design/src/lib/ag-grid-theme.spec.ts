const mockWithParams = jest.fn();
const mockWithPart = jest.fn();

jest.mock('ag-grid-community', () => ({
  themeQuartz: {
    withPart: (...args: unknown[]) => mockWithPart(...args),
  },
  iconSetMaterial: 'iconSetMaterial',
  colorSchemeDarkBlue: 'colorSchemeDarkBlue',
  colorSchemeLight: 'colorSchemeLight',
}));

import { buildAgGridTheme, AG_GRID_FONTS } from './ag-grid-theme';

describe('ag-grid-theme', () => {
  beforeEach(() => {
    mockWithPart.mockClear();
    mockWithParams.mockClear();
    // Chain: themeQuartz.withPart() -> { withPart, withParams }
    mockWithPart.mockReturnValue({
      withPart: mockWithPart,
      withParams: (...args: unknown[]) => {
        mockWithParams(...args);
        return { withParams: mockWithParams };
      },
    });
  });

  describe('AG_GRID_FONTS', () => {
    it('should have fontFamily set to IBM Plex Mono', () => {
      expect(AG_GRID_FONTS.fontFamily).toContain('IBM Plex Mono');
    });

    it('should have headerFontFamily set to Roboto', () => {
      expect(AG_GRID_FONTS.headerFontFamily).toContain('Roboto');
    });

    it('should have trading-appropriate row height', () => {
      expect(AG_GRID_FONTS.rowHeight).toBe(22);
    });

    it('should have compact header height', () => {
      expect(AG_GRID_FONTS.headerHeight).toBe(28);
    });
  });

  describe('buildAgGridTheme', () => {
    it('should use Material icons and colorSchemeDarkBlue when isDark', () => {
      buildAgGridTheme(true);
      expect(mockWithPart).toHaveBeenCalledWith('iconSetMaterial');
      expect(mockWithPart).toHaveBeenCalledWith('colorSchemeDarkBlue');
    });

    it('should use Material icons and colorSchemeLight when not isDark', () => {
      buildAgGridTheme(false);
      expect(mockWithPart).toHaveBeenCalledWith('iconSetMaterial');
      expect(mockWithPart).toHaveBeenCalledWith('colorSchemeLight');
    });

    it('should apply AG_GRID_FONTS via withParams', () => {
      buildAgGridTheme(true);
      expect(mockWithParams).toHaveBeenCalledWith(AG_GRID_FONTS);
    });
  });
});
