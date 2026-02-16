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

export const themeConfig: ThemeConfig = {
  dark: {
    // Brand colors
    brandPrimary: '#0A76D3',
    brandPrimaryActive: '#095AA0',
    brandPrimaryHover: '#0C8AE8',
    brandPrimaryFocused: '#0A76D3',
    brandPrimaryText: '#FFFFFF',
    brandSecondary: '#383A40',
    brandSecondaryActive: '#2F3136',
    brandSecondaryHover: '#42454B',
    brandSecondaryFocused: '#383A40',
    brandSecondaryText: '#FFFFFF',
    // Background layers
    backgroundPrimary: '#1E1F23',
    background1: '#111214',
    background2: '#1E1F23',
    background3: '#24262B',
    background4: '#2F3136',
    background5: '#383A40',
    background6: '#53565F',
    // Text colors
    textDefault: '#FFFFFF',
    textHelp: '#C9CBD2',
    textInactive: '#7D808A',
    // Input colors
    inputBackground: '#2F3136',
    inputColor: '#FFFFFF',
    inputPlaceholder: '#7D808A',
    inputDisabled: '#53565F',
    inputFocused: '#0A76D3',
    inputBorder: '#53565F',
    // Status colors
    statusSuccess: '#35C759',
    statusWarning: '#FF9500',
    statusCritical: '#FF3B30',
    statusActive: '#0A76D3',
  },
  light: {
    // Brand colors
    brandPrimary: '#0A76D3',
    brandPrimaryActive: '#095AA0',
    brandPrimaryHover: '#0C8AE8',
    brandPrimaryFocused: '#0A76D3',
    brandPrimaryText: '#FFFFFF',
    brandSecondary: '#E5E7EB',
    brandSecondaryActive: '#D1D5DB',
    brandSecondaryHover: '#F3F4F6',
    brandSecondaryFocused: '#E5E7EB',
    brandSecondaryText: '#111827',
    // Background layers
    backgroundPrimary: '#FFFFFF',
    background1: '#FFFFFF',
    background2: '#FAFBFE',
    background3: '#F3F5F8',
    background4: '#ECEEF1',
    background5: '#E5E7EB',
    background6: '#D1D5DB',
    // Text colors
    textDefault: '#111827',
    textHelp: '#374151',
    textInactive: '#6B7280',
    // Input colors
    inputBackground: '#FFFFFF',
    inputColor: '#111827',
    inputPlaceholder: '#6B7280',
    inputDisabled: '#D1D5DB',
    inputFocused: '#0A76D3',
    inputBorder: '#D1D5DB',
    // Status colors
    statusSuccess: '#10B981',
    statusWarning: '#F59E0B',
    statusCritical: '#EF4444',
    statusActive: '#0A76D3',
  },
};
