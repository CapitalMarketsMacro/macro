const mockWithParams = jest.fn();
const mockWithPart = jest.fn();

jest.mock('ag-grid-community', () => ({
  themeAlpine: {
    withPart: (...args: unknown[]) => mockWithPart(...args),
  },
  iconSetAlpine: 'iconSetAlpine',
  colorSchemeDarkBlue: 'colorSchemeDarkBlue',
  colorSchemeLight: 'colorSchemeLight',
}));

import { buildAgGridTheme, AG_GRID_FONTS } from './ag-grid-theme';

describe('ag-grid-theme', () => {
  beforeEach(() => {
    mockWithPart.mockClear();
    mockWithParams.mockClear();
    // Chain: themeAlpine.withPart() -> { withPart, withParams }
    mockWithPart.mockReturnValue({
      withPart: mockWithPart,
      withParams: mockWithParams,
    });
  });

  describe('AG_GRID_FONTS', () => {
    it('should have fontFamily set to "Noto Sans"', () => {
      expect(AG_GRID_FONTS.fontFamily).toBe('Noto Sans');
    });

    it('should have headerFontFamily set to "Roboto"', () => {
      expect(AG_GRID_FONTS.headerFontFamily).toBe('Roboto');
    });

    it('should have cellFontFamily set to "Ubuntu"', () => {
      expect(AG_GRID_FONTS.cellFontFamily).toBe('Ubuntu');
    });
  });

  describe('buildAgGridTheme', () => {
    it('should use colorSchemeDarkBlue when isDark is true', () => {
      buildAgGridTheme(true);
      expect(mockWithPart).toHaveBeenCalledWith('iconSetAlpine');
      expect(mockWithPart).toHaveBeenCalledWith('colorSchemeDarkBlue');
    });

    it('should use colorSchemeLight when isDark is false', () => {
      buildAgGridTheme(false);
      expect(mockWithPart).toHaveBeenCalledWith('iconSetAlpine');
      expect(mockWithPart).toHaveBeenCalledWith('colorSchemeLight');
    });

    it('should apply AG_GRID_FONTS via withParams', () => {
      buildAgGridTheme(true);
      expect(mockWithParams).toHaveBeenCalledWith(AG_GRID_FONTS);
    });

    it('should return the theme object from the chain', () => {
      const sentinel = { theme: 'built' };
      mockWithParams.mockReturnValue(sentinel);
      const result = buildAgGridTheme(false);
      expect(result).toBe(sentinel);
    });
  });
});
