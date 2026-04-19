/**
 * Central theme configuration for dark and light themes
 * Used by View1, View2, and the workspace platform
 */
export interface ThemePalette {
  // Brand colors
  brandPrimary: string;
  brandPrimaryActive?: string;
  brandPrimaryHover?: string;
  brandPrimaryFocused?: string;
  brandPrimaryText?: string;
  brandSecondary: string;
  brandSecondaryActive?: string;
  brandSecondaryHover?: string;
  brandSecondaryFocused?: string;
  brandSecondaryText?: string;
  // Background layers
  backgroundPrimary: string;
  background1?: string;
  background2?: string;
  background3?: string;
  background4?: string;
  background5?: string;
  background6?: string;
  // Text colors
  textDefault?: string;
  textHelp?: string;
  textInactive?: string;
  // Input colors
  inputBackground?: string;
  inputColor?: string;
  inputPlaceholder?: string;
  inputDisabled?: string;
  inputFocused?: string;
  inputBorder?: string;
  // Status colors
  statusSuccess?: string;
  statusWarning?: string;
  statusCritical?: string;
  statusActive?: string;
}

export interface ThemeConfig {
  dark: ThemePalette;
  light: ThemePalette;
}

/** Macro E-Trading theme — "Macro Cerulean" brand, slate neutrals, trading-optimized. */
export const themeConfig: ThemeConfig = {
  dark: {
    brandPrimary: '#2AA6E6',
    brandPrimaryActive: '#1685C2',
    brandPrimaryHover: '#55B2EE',
    brandPrimaryFocused: '#2AA6E6',
    brandPrimaryText: '#041A26',
    brandSecondary: '#2A2F39',
    brandSecondaryActive: '#1E222A',
    brandSecondaryHover: '#363C48',
    brandSecondaryFocused: '#2A2F39',
    brandSecondaryText: '#E6E8EC',
    backgroundPrimary: '#0B0D12',
    background1: '#12141A',
    background2: '#181B22',
    background3: '#1E222A',
    background4: '#2A2F39',
    background5: '#363C48',
    background6: '#4A5060',
    textDefault: '#E6E8EC',
    textHelp: '#A8AFBD',
    textInactive: '#6F7687',
    inputBackground: '#12141A',
    inputColor: '#E6E8EC',
    inputPlaceholder: '#4A5060',
    inputDisabled: '#363C48',
    inputFocused: '#2AA6E6',
    inputBorder: '#363C48',
    statusSuccess: '#34D97A',
    statusWarning: '#F5C13A',
    statusCritical: '#FF6B64',
    statusActive: '#2AA6E6',
  },
  light: {
    brandPrimary: '#1685C2',
    brandPrimaryActive: '#0F6497',
    brandPrimaryHover: '#2AA6E6',
    brandPrimaryFocused: '#1685C2',
    brandPrimaryText: '#FFFFFF',
    brandSecondary: '#D6DAE2',
    brandSecondaryActive: '#CDD2DB',
    brandSecondaryHover: '#ECEEF2',
    brandSecondaryFocused: '#D6DAE2',
    brandSecondaryText: '#12141A',
    backgroundPrimary: '#ECEEF2',
    background1: '#FFFFFF',
    background2: '#F6F7F9',
    background3: '#FFFFFF',
    background4: '#ECEEF2',
    background5: '#D6DAE2',
    background6: '#AEB4C1',
    textDefault: '#12141A',
    textHelp: '#3B414C',
    textInactive: '#7B8392',
    inputBackground: '#FFFFFF',
    inputColor: '#12141A',
    inputPlaceholder: '#AEB4C1',
    inputDisabled: '#D6DAE2',
    inputFocused: '#1685C2',
    inputBorder: '#CDD2DB',
    statusSuccess: '#0F7F45',
    statusWarning: '#C79306',
    statusCritical: '#B82C25',
    statusActive: '#1685C2',
  },
};
