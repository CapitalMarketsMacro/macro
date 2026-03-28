import { useState } from 'react';
import { ThemePreview } from './components/ThemePreview';
import { ThemeEditor } from './components/ThemeEditor';

export interface Theme {
  name: string;
  description: string;
  light: ColorScheme;
  dark: ColorScheme;
}

export interface ColorScheme {
  background1: string;
  background2: string;
  background3: string;
  background4: string;
  background5: string;
  background6: string;
  brandSecondary: string;
  brandSecondaryActive: string;
  brandSecondaryHover: string;
  brandSecondaryFocused: string;
  brandSecondaryText: string;
  inputBackground: string;
  inputColor: string;
  inputPlaceholder: string;
  inputDisabled: string;
  inputFocused: string;
  inputBorder: string;
  textDefault: string;
  textHelp: string;
  textInactive: string;
  brandPrimary: string;
  brandPrimaryActive: string;
  brandPrimaryHover: string;
  brandPrimaryFocused: string;
  brandPrimaryText: string;
  statusSuccess: string;
  statusWarning: string;
  statusCritical: string;
  statusActive: string;
  contentBackground1: string;
  contentBackground2: string;
  contentBackground3: string;
  contentBackground4: string;
  contentBackground5: string;
  borderNeutral: string;
}

const themes: Theme[] = [
  {
    name: "Default OpenFin",
    description: "Original OpenFin Workspace theme with clean blue accents",
    light: {
      background1: "#FFFFFF",
      background2: "#FAFBFE",
      background3: "#F3F5F8",
      background4: "#ECEEF1",
      background5: "#DDDFE4",
      background6: "#C9CBD2",
      brandSecondary: "#DDDFE4",
      brandSecondaryActive: "#D7DADF",
      brandSecondaryHover: "#EBECEF",
      brandSecondaryFocused: "#1E1F23",
      brandSecondaryText: "#1E1F23",
      inputBackground: "#ECEEF1",
      inputColor: "#1E1F23",
      inputPlaceholder: "#383A40",
      inputDisabled: "#7D808A",
      inputFocused: "#C9CBD2",
      inputBorder: "#7D808A",
      textDefault: "#1E1F23",
      textHelp: "#2F3136",
      textInactive: "#7D808A",
      brandPrimary: "#0A76D3",
      brandPrimaryActive: "#0969BE",
      brandPrimaryHover: "#2B8FE3",
      brandPrimaryFocused: "#FFFFFF",
      brandPrimaryText: "#FFFFFF",
      statusSuccess: "#207735",
      statusWarning: "#F48F00",
      statusCritical: "#F31818",
      statusActive: "#0A76D3",
      contentBackground1: "#FFFFFF",
      contentBackground2: "#FAFBFE",
      contentBackground3: "#F3F5F8",
      contentBackground4: "#ECEEF1",
      contentBackground5: "#DDDFE4",
      borderNeutral: "#C0C1C2"
    },
    dark: {
      background1: "#111214",
      background2: "#1E1F23",
      background3: "#24262B",
      background4: "#2F3136",
      background5: "#383A40",
      background6: "#53565F",
      brandSecondary: "#383A40",
      brandSecondaryActive: "#33353B",
      brandSecondaryHover: "#44464E",
      brandSecondaryFocused: "#FFFFFF",
      brandSecondaryText: "#FFFFFF",
      inputBackground: "#53565F",
      inputColor: "#FFFFFF",
      inputPlaceholder: "#C9CBD2",
      inputDisabled: "#7D808A",
      inputFocused: "#C9CBD2",
      inputBorder: "#7D808A",
      textDefault: "#FFFFFF",
      textHelp: "#C9CBD2",
      textInactive: "#7D808A",
      brandPrimary: "#0A76D3",
      brandPrimaryActive: "#0969BE",
      brandPrimaryHover: "#2B8FE3",
      brandPrimaryFocused: "#FFFFFF",
      brandPrimaryText: "#FFFFFF",
      statusSuccess: "#207735",
      statusWarning: "#F48F00",
      statusCritical: "#F31818",
      statusActive: "#0A76D3",
      contentBackground1: "#111214",
      contentBackground2: "#1E1F23",
      contentBackground3: "#24262B",
      contentBackground4: "#2F3136",
      contentBackground5: "#383A40",
      borderNeutral: "#C0C1C2"
    }
  },
  {
    name: "Bloomberg Terminal",
    description: "High-contrast amber on black inspired by classic Bloomberg terminals - optimized for extended trading sessions",
    light: {
      background1: "#F5F1E8",
      background2: "#EBE5D6",
      background3: "#E1D9C4",
      background4: "#D7CDB2",
      background5: "#CCC1A0",
      background6: "#B8AD8E",
      brandSecondary: "#CCC1A0",
      brandSecondaryActive: "#C2B796",
      brandSecondaryHover: "#D6CBAA",
      brandSecondaryFocused: "#2A2416",
      brandSecondaryText: "#2A2416",
      inputBackground: "#D7CDB2",
      inputColor: "#2A2416",
      inputPlaceholder: "#5A4E32",
      inputDisabled: "#8C8060",
      inputFocused: "#B8AD8E",
      inputBorder: "#8C8060",
      textDefault: "#2A2416",
      textHelp: "#3E3520",
      textInactive: "#8C8060",
      brandPrimary: "#D67D00",
      brandPrimaryActive: "#C27200",
      brandPrimaryHover: "#E08A1A",
      brandPrimaryFocused: "#FFFFFF",
      brandPrimaryText: "#FFFFFF",
      statusSuccess: "#2D8F47",
      statusWarning: "#D67D00",
      statusCritical: "#D63F3F",
      statusActive: "#D67D00",
      contentBackground1: "#F5F1E8",
      contentBackground2: "#EBE5D6",
      contentBackground3: "#E1D9C4",
      contentBackground4: "#D7CDB2",
      contentBackground5: "#CCC1A0",
      borderNeutral: "#A89E82"
    },
    dark: {
      background1: "#000000",
      background2: "#0F0D08",
      background3: "#1A1710",
      background4: "#252018",
      background5: "#2F2920",
      background6: "#3D3528",
      brandSecondary: "#2F2920",
      brandSecondaryActive: "#252018",
      brandSecondaryHover: "#3D3528",
      brandSecondaryFocused: "#FFFFFF",
      brandSecondaryText: "#FF9500",
      inputBackground: "#2F2920",
      inputColor: "#FF9500",
      inputPlaceholder: "#A67C3D",
      inputDisabled: "#665533",
      inputFocused: "#FF9500",
      inputBorder: "#665533",
      textDefault: "#FF9500",
      textHelp: "#D6A56E",
      textInactive: "#8C7050",
      brandPrimary: "#FF9500",
      brandPrimaryActive: "#E68600",
      brandPrimaryHover: "#FFA31A",
      brandPrimaryFocused: "#000000",
      brandPrimaryText: "#000000",
      statusSuccess: "#3FD662",
      statusWarning: "#FFB84D",
      statusCritical: "#FF4D4D",
      statusActive: "#FF9500",
      contentBackground1: "#000000",
      contentBackground2: "#0F0D08",
      contentBackground3: "#1A1710",
      contentBackground4: "#252018",
      contentBackground5: "#2F2920",
      borderNeutral: "#665533"
    }
  },
  {
    name: "Midnight Trader",
    description: "Deep navy and cyan theme designed for 24/7 trading operations with reduced eye strain",
    light: {
      background1: "#F0F4F8",
      background2: "#E3EBF3",
      background3: "#D6E2ED",
      background4: "#C9D9E7",
      background5: "#BCD0E1",
      background6: "#A3BDCF",
      brandSecondary: "#BCD0E1",
      brandSecondaryActive: "#B2C6DB",
      brandSecondaryHover: "#C6DAEA",
      brandSecondaryFocused: "#0D1F2D",
      brandSecondaryText: "#0D1F2D",
      inputBackground: "#C9D9E7",
      inputColor: "#0D1F2D",
      inputPlaceholder: "#2C4A5E",
      inputDisabled: "#6B8396",
      inputFocused: "#A3BDCF",
      inputBorder: "#6B8396",
      textDefault: "#0D1F2D",
      textHelp: "#1A3344",
      textInactive: "#6B8396",
      brandPrimary: "#00B8D4",
      brandPrimaryActive: "#00A7C0",
      brandPrimaryHover: "#1AC5DE",
      brandPrimaryFocused: "#FFFFFF",
      brandPrimaryText: "#FFFFFF",
      statusSuccess: "#00C853",
      statusWarning: "#FFB300",
      statusCritical: "#FF3D00",
      statusActive: "#00B8D4",
      contentBackground1: "#F0F4F8",
      contentBackground2: "#E3EBF3",
      contentBackground3: "#D6E2ED",
      contentBackground4: "#C9D9E7",
      contentBackground5: "#BCD0E1",
      borderNeutral: "#8BA6B8"
    },
    dark: {
      background1: "#0A1929",
      background2: "#132F4C",
      background3: "#1A3F5C",
      background4: "#234E6B",
      background5: "#2D5D7B",
      background6: "#3D6F8F",
      brandSecondary: "#2D5D7B",
      brandSecondaryActive: "#234E6B",
      brandSecondaryHover: "#3D6F8F",
      brandSecondaryFocused: "#FFFFFF",
      brandSecondaryText: "#FFFFFF",
      inputBackground: "#234E6B",
      inputColor: "#FFFFFF",
      inputPlaceholder: "#B2CDDF",
      inputDisabled: "#5A7A8F",
      inputFocused: "#00B8D4",
      inputBorder: "#5A7A8F",
      textDefault: "#FFFFFF",
      textHelp: "#D6E8F5",
      textInactive: "#7A96A8",
      brandPrimary: "#00D4FF",
      brandPrimaryActive: "#00BFE8",
      brandPrimaryHover: "#33DDFF",
      brandPrimaryFocused: "#0A1929",
      brandPrimaryText: "#0A1929",
      statusSuccess: "#00E676",
      statusWarning: "#FFD54F",
      statusCritical: "#FF6E40",
      statusActive: "#00D4FF",
      contentBackground1: "#0A1929",
      contentBackground2: "#132F4C",
      contentBackground3: "#1A3F5C",
      contentBackground4: "#234E6B",
      contentBackground5: "#2D5D7B",
      borderNeutral: "#5A7A8F"
    }
  },
  {
    name: "Carbon Graphite",
    description: "Sophisticated charcoal and emerald theme with professional elegance for institutional trading",
    light: {
      background1: "#FAFAFA",
      background2: "#F1F3F4",
      background3: "#E8EAED",
      background4: "#DADCE0",
      background5: "#BDC1C6",
      background6: "#9AA0A6",
      brandSecondary: "#BDC1C6",
      brandSecondaryActive: "#B3B7BC",
      brandSecondaryHover: "#C7CBD0",
      brandSecondaryFocused: "#202124",
      brandSecondaryText: "#202124",
      inputBackground: "#DADCE0",
      inputColor: "#202124",
      inputPlaceholder: "#5F6368",
      inputDisabled: "#80868B",
      inputFocused: "#9AA0A6",
      inputBorder: "#80868B",
      textDefault: "#202124",
      textHelp: "#3C4043",
      textInactive: "#80868B",
      brandPrimary: "#0D9488",
      brandPrimaryActive: "#0B7C72",
      brandPrimaryHover: "#14B8A6",
      brandPrimaryFocused: "#FFFFFF",
      brandPrimaryText: "#FFFFFF",
      statusSuccess: "#0D9488",
      statusWarning: "#F59E0B",
      statusCritical: "#DC2626",
      statusActive: "#0D9488",
      contentBackground1: "#FAFAFA",
      contentBackground2: "#F1F3F4",
      contentBackground3: "#E8EAED",
      contentBackground4: "#DADCE0",
      contentBackground5: "#BDC1C6",
      borderNeutral: "#9AA0A6"
    },
    dark: {
      background1: "#161616",
      background2: "#262626",
      background3: "#343434",
      background4: "#3F3F3F",
      background5: "#525252",
      background6: "#6F6F6F",
      brandSecondary: "#525252",
      brandSecondaryActive: "#3F3F3F",
      brandSecondaryHover: "#6F6F6F",
      brandSecondaryFocused: "#FFFFFF",
      brandSecondaryText: "#F4F4F4",
      inputBackground: "#3F3F3F",
      inputColor: "#F4F4F4",
      inputPlaceholder: "#C6C6C6",
      inputDisabled: "#8D8D8D",
      inputFocused: "#14B8A6",
      inputBorder: "#8D8D8D",
      textDefault: "#F4F4F4",
      textHelp: "#E0E0E0",
      textInactive: "#A8A8A8",
      brandPrimary: "#14B8A6",
      brandPrimaryActive: "#0D9488",
      brandPrimaryHover: "#2DD4BF",
      brandPrimaryFocused: "#161616",
      brandPrimaryText: "#161616",
      statusSuccess: "#10B981",
      statusWarning: "#FBBF24",
      statusCritical: "#EF4444",
      statusActive: "#14B8A6",
      contentBackground1: "#161616",
      contentBackground2: "#262626",
      contentBackground3: "#343434",
      contentBackground4: "#3F3F3F",
      contentBackground5: "#525252",
      borderNeutral: "#8D8D8D"
    }
  },
  {
    name: "Royal Purple",
    description: "Premium deep purple theme for luxury finance applications with sophisticated violet accents",
    light: {
      background1: "#FAF8FC",
      background2: "#F3EEF8",
      background3: "#EBE3F4",
      background4: "#E3D8F0",
      background5: "#D1BFE3",
      background6: "#BBA5D5",
      brandSecondary: "#D1BFE3",
      brandSecondaryActive: "#C7B5D9",
      brandSecondaryHover: "#DBC9ED",
      brandSecondaryFocused: "#2D1B3D",
      brandSecondaryText: "#2D1B3D",
      inputBackground: "#E3D8F0",
      inputColor: "#2D1B3D",
      inputPlaceholder: "#5D4A6D",
      inputDisabled: "#8E7B9E",
      inputFocused: "#BBA5D5",
      inputBorder: "#8E7B9E",
      textDefault: "#2D1B3D",
      textHelp: "#42304E",
      textInactive: "#8E7B9E",
      brandPrimary: "#7C3AED",
      brandPrimaryActive: "#6D28D9",
      brandPrimaryHover: "#8B5CF6",
      brandPrimaryFocused: "#FFFFFF",
      brandPrimaryText: "#FFFFFF",
      statusSuccess: "#059669",
      statusWarning: "#D97706",
      statusCritical: "#DC2626",
      statusActive: "#7C3AED",
      contentBackground1: "#FAF8FC",
      contentBackground2: "#F3EEF8",
      contentBackground3: "#EBE3F4",
      contentBackground4: "#E3D8F0",
      contentBackground5: "#D1BFE3",
      borderNeutral: "#A38FB3"
    },
    dark: {
      background1: "#1A0F24",
      background2: "#2D1B3D",
      background3: "#3E2952",
      background4: "#4F3667",
      background5: "#60447C",
      background6: "#7A5A96",
      brandSecondary: "#60447C",
      brandSecondaryActive: "#4F3667",
      brandSecondaryHover: "#7A5A96",
      brandSecondaryFocused: "#FFFFFF",
      brandSecondaryText: "#F5F3FF",
      inputBackground: "#4F3667",
      inputColor: "#F5F3FF",
      inputPlaceholder: "#D8B4FE",
      inputDisabled: "#9D7FB8",
      inputFocused: "#A78BFA",
      inputBorder: "#9D7FB8",
      textDefault: "#F5F3FF",
      textHelp: "#E9D5FF",
      textInactive: "#B794C9",
      brandPrimary: "#A78BFA",
      brandPrimaryActive: "#8B5CF6",
      brandPrimaryHover: "#C4B5FD",
      brandPrimaryFocused: "#1A0F24",
      brandPrimaryText: "#1A0F24",
      statusSuccess: "#34D399",
      statusWarning: "#FBBF24",
      statusCritical: "#F87171",
      statusActive: "#A78BFA",
      contentBackground1: "#1A0F24",
      contentBackground2: "#2D1B3D",
      contentBackground3: "#3E2952",
      contentBackground4: "#4F3667",
      contentBackground5: "#60447C",
      borderNeutral: "#9D7FB8"
    }
  },
  {
    name: "FX Dealer Pro",
    description: "High-velocity FX and Rates trading theme with vivid bid/ask visualization and rapid quote updates",
    light: {
      background1: "#F8FAFB",
      background2: "#EFF3F6",
      background3: "#E5EBF0",
      background4: "#D9E2E9",
      background5: "#C8D5DE",
      background6: "#B0C1CD",
      brandSecondary: "#C8D5DE",
      brandSecondaryActive: "#BED1DB",
      brandSecondaryHover: "#D2DFE8",
      brandSecondaryFocused: "#0A1F1F",
      brandSecondaryText: "#0A1F1F",
      inputBackground: "#D9E2E9",
      inputColor: "#0A1F1F",
      inputPlaceholder: "#3D5A5A",
      inputDisabled: "#7A8F8F",
      inputFocused: "#B0C1CD",
      inputBorder: "#7A8F8F",
      textDefault: "#0A1F1F",
      textHelp: "#1E3535",
      textInactive: "#7A8F8F",
      brandPrimary: "#0891B2",
      brandPrimaryActive: "#0E7490",
      brandPrimaryHover: "#06B6D4",
      brandPrimaryFocused: "#FFFFFF",
      brandPrimaryText: "#FFFFFF",
      statusSuccess: "#10B981",
      statusWarning: "#F59E0B",
      statusCritical: "#EF4444",
      statusActive: "#06B6D4",
      contentBackground1: "#F8FAFB",
      contentBackground2: "#EFF3F6",
      contentBackground3: "#E5EBF0",
      contentBackground4: "#D9E2E9",
      contentBackground5: "#C8D5DE",
      borderNeutral: "#9AAEB8"
    },
    dark: {
      background1: "#0A1414",
      background2: "#0F1F1F",
      background3: "#162929",
      background4: "#1D3434",
      background5: "#243F3F",
      background6: "#2E5252",
      brandSecondary: "#243F3F",
      brandSecondaryActive: "#1D3434",
      brandSecondaryHover: "#2E5252",
      brandSecondaryFocused: "#FFFFFF",
      brandSecondaryText: "#ECFEFF",
      inputBackground: "#1D3434",
      inputColor: "#ECFEFF",
      inputPlaceholder: "#A5F3FC",
      inputDisabled: "#4A6666",
      inputFocused: "#06B6D4",
      inputBorder: "#4A6666",
      textDefault: "#ECFEFF",
      textHelp: "#CFFAFE",
      textInactive: "#67E8F9",
      brandPrimary: "#06B6D4",
      brandPrimaryActive: "#0891B2",
      brandPrimaryHover: "#22D3EE",
      brandPrimaryFocused: "#0A1414",
      brandPrimaryText: "#0A1414",
      statusSuccess: "#10B981",
      statusWarning: "#FBBF24",
      statusCritical: "#F87171",
      statusActive: "#22D3EE",
      contentBackground1: "#0A1414",
      contentBackground2: "#0F1F1F",
      contentBackground3: "#162929",
      contentBackground4: "#1D3434",
      contentBackground5: "#243F3F",
      borderNeutral: "#4A6666"
    }
  },
  {
    name: "Commodities Desk",
    description: "Energy, metals, and agriculture trading theme with warm earth tones and gold accents for commodities markets",
    light: {
      background1: "#FAF9F7",
      background2: "#F2EDE5",
      background3: "#E9E0D3",
      background4: "#DFD3C1",
      background5: "#D4C5AF",
      background6: "#C2B09A",
      brandSecondary: "#D4C5AF",
      brandSecondaryActive: "#CABBA5",
      brandSecondaryHover: "#DECFB9",
      brandSecondaryFocused: "#2B1F0F",
      brandSecondaryText: "#2B1F0F",
      inputBackground: "#DFD3C1",
      inputColor: "#2B1F0F",
      inputPlaceholder: "#5A4A2F",
      inputDisabled: "#8F7D5F",
      inputFocused: "#C2B09A",
      inputBorder: "#8F7D5F",
      textDefault: "#2B1F0F",
      textHelp: "#3F3319",
      textInactive: "#8F7D5F",
      brandPrimary: "#D97706",
      brandPrimaryActive: "#B45309",
      brandPrimaryHover: "#F59E0B",
      brandPrimaryFocused: "#FFFFFF",
      brandPrimaryText: "#FFFFFF",
      statusSuccess: "#15803D",
      statusWarning: "#EA580C",
      statusCritical: "#DC2626",
      statusActive: "#D97706",
      contentBackground1: "#FAF9F7",
      contentBackground2: "#F2EDE5",
      contentBackground3: "#E9E0D3",
      contentBackground4: "#DFD3C1",
      contentBackground5: "#D4C5AF",
      borderNeutral: "#A89578"
    },
    dark: {
      background1: "#1C1410",
      background2: "#2B1F15",
      background3: "#3A2A1C",
      background4: "#493523",
      background5: "#58402A",
      background6: "#6F5438",
      brandSecondary: "#58402A",
      brandSecondaryActive: "#493523",
      brandSecondaryHover: "#6F5438",
      brandSecondaryFocused: "#FFFFFF",
      brandSecondaryText: "#FEF3C7",
      inputBackground: "#493523",
      inputColor: "#FEF3C7",
      inputPlaceholder: "#FDE68A",
      inputDisabled: "#92765A",
      inputFocused: "#F59E0B",
      inputBorder: "#92765A",
      textDefault: "#FEF3C7",
      textHelp: "#FDE68A",
      textInactive: "#D4B68C",
      brandPrimary: "#F59E0B",
      brandPrimaryActive: "#D97706",
      brandPrimaryHover: "#FBBF24",
      brandPrimaryFocused: "#1C1410",
      brandPrimaryText: "#1C1410",
      statusSuccess: "#22C55E",
      statusWarning: "#FB923C",
      statusCritical: "#EF4444",
      statusActive: "#FBBF24",
      contentBackground1: "#1C1410",
      contentBackground2: "#2B1F15",
      contentBackground3: "#3A2A1C",
      contentBackground4: "#493523",
      contentBackground5: "#58402A",
      borderNeutral: "#92765A"
    }
  },
  {
    name: "Risk & Analytics",
    description: "Middle Office theme optimized for risk management, P&L analysis, and regulatory reporting with clear data hierarchy",
    light: {
      background1: "#FAFBFC",
      background2: "#F4F6F8",
      background3: "#EDF0F3",
      background4: "#E5E9ED",
      background5: "#D8DFE5",
      background6: "#C5D0DA",
      brandSecondary: "#D8DFE5",
      brandSecondaryActive: "#CED8DF",
      brandSecondaryHover: "#E2E6EB",
      brandSecondaryFocused: "#1A2332",
      brandSecondaryText: "#1A2332",
      inputBackground: "#E5E9ED",
      inputColor: "#1A2332",
      inputPlaceholder: "#475569",
      inputDisabled: "#94A3B8",
      inputFocused: "#C5D0DA",
      inputBorder: "#94A3B8",
      textDefault: "#1A2332",
      textHelp: "#334155",
      textInactive: "#94A3B8",
      brandPrimary: "#4F46E5",
      brandPrimaryActive: "#4338CA",
      brandPrimaryHover: "#6366F1",
      brandPrimaryFocused: "#FFFFFF",
      brandPrimaryText: "#FFFFFF",
      statusSuccess: "#16A34A",
      statusWarning: "#CA8A04",
      statusCritical: "#DC2626",
      statusActive: "#4F46E5",
      contentBackground1: "#FAFBFC",
      contentBackground2: "#F4F6F8",
      contentBackground3: "#EDF0F3",
      contentBackground4: "#E5E9ED",
      contentBackground5: "#D8DFE5",
      borderNeutral: "#B0BECB"
    },
    dark: {
      background1: "#0F1419",
      background2: "#1A2332",
      background3: "#243143",
      background4: "#2E3F54",
      background5: "#384D65",
      background6: "#4A637F",
      brandSecondary: "#384D65",
      brandSecondaryActive: "#2E3F54",
      brandSecondaryHover: "#4A637F",
      brandSecondaryFocused: "#FFFFFF",
      brandSecondaryText: "#EEF2FF",
      inputBackground: "#2E3F54",
      inputColor: "#EEF2FF",
      inputPlaceholder: "#C7D2FE",
      inputDisabled: "#64748B",
      inputFocused: "#818CF8",
      inputBorder: "#64748B",
      textDefault: "#EEF2FF",
      textHelp: "#E0E7FF",
      textInactive: "#94A3B8",
      brandPrimary: "#818CF8",
      brandPrimaryActive: "#6366F1",
      brandPrimaryHover: "#A5B4FC",
      brandPrimaryFocused: "#0F1419",
      brandPrimaryText: "#0F1419",
      statusSuccess: "#4ADE80",
      statusWarning: "#FCD34D",
      statusCritical: "#F87171",
      statusActive: "#818CF8",
      contentBackground1: "#0F1419",
      contentBackground2: "#1A2332",
      contentBackground3: "#243143",
      contentBackground4: "#2E3F54",
      contentBackground5: "#384D65",
      borderNeutral: "#64748B"
    }
  },
  {
    name: "Stagecoach Red",
    description: "Heritage-inspired red and gold theme suitable for retail banking dashboards and wealth management interfaces",
    light: {
      background1: "#FFFFFF",
      background2: "#F9F9F9",
      background3: "#F2F2F2",
      background4: "#E6E6E6",
      background5: "#D9D9D9",
      background6: "#CCCCCC",
      brandSecondary: "#D9D9D9",
      brandSecondaryActive: "#BFBFBF",
      brandSecondaryHover: "#E6E6E6",
      brandSecondaryFocused: "#2D2D2D",
      brandSecondaryText: "#2D2D2D",
      inputBackground: "#E6E6E6",
      inputColor: "#2D2D2D",
      inputPlaceholder: "#666666",
      inputDisabled: "#999999",
      inputFocused: "#CCCCCC",
      inputBorder: "#999999",
      textDefault: "#2D2D2D",
      textHelp: "#4D4D4D",
      textInactive: "#999999",
      brandPrimary: "#CD1409",
      brandPrimaryActive: "#B20F07",
      brandPrimaryHover: "#E61B0D",
      brandPrimaryFocused: "#FFFFFF",
      brandPrimaryText: "#FFFFFF",
      statusSuccess: "#107C10",
      statusWarning: "#D83B01",
      statusCritical: "#A80000",
      statusActive: "#CD1409",
      contentBackground1: "#FFFFFF",
      contentBackground2: "#F9F9F9",
      contentBackground3: "#F2F2F2",
      contentBackground4: "#E6E6E6",
      contentBackground5: "#D9D9D9",
      borderNeutral: "#CCCCCC"
    },
    dark: {
      background1: "#121212",
      background2: "#1E1E1E",
      background3: "#252525",
      background4: "#2D2D2D",
      background5: "#3A3A3A",
      background6: "#484848",
      brandSecondary: "#3A3A3A",
      brandSecondaryActive: "#2D2D2D",
      brandSecondaryHover: "#484848",
      brandSecondaryFocused: "#FFFFFF",
      brandSecondaryText: "#F3F3F3",
      inputBackground: "#2D2D2D",
      inputColor: "#F3F3F3",
      inputPlaceholder: "#B0B0B0",
      inputDisabled: "#666666",
      inputFocused: "#FF4D4D",
      inputBorder: "#666666",
      textDefault: "#F3F3F3",
      textHelp: "#E0E0E0",
      textInactive: "#999999",
      brandPrimary: "#FF4D4D",
      brandPrimaryActive: "#E60000",
      brandPrimaryHover: "#FF8080",
      brandPrimaryFocused: "#121212",
      brandPrimaryText: "#121212",
      statusSuccess: "#4CC94C",
      statusWarning: "#FFC425",
      statusCritical: "#FF4D4D",
      statusActive: "#FF4D4D",
      contentBackground1: "#121212",
      contentBackground2: "#1E1E1E",
      contentBackground3: "#252525",
      contentBackground4: "#2D2D2D",
      contentBackground5: "#3A3A3A",
      borderNeutral: "#666666"
    }
  },
  {
    name: "Executive Blue",
    description: "Authoritative deep blue and slate theme for institutional banking and high-net-worth client portals",
    light: {
      background1: "#FFFFFF",
      background2: "#F5F7FA",
      background3: "#EBF0F5",
      background4: "#DEE5EB",
      background5: "#CFD9E0",
      background6: "#BCCAD6",
      brandSecondary: "#CFD9E0",
      brandSecondaryActive: "#BCCAD6",
      brandSecondaryHover: "#DEE5EB",
      brandSecondaryFocused: "#0F2B46",
      brandSecondaryText: "#0F2B46",
      inputBackground: "#DEE5EB",
      inputColor: "#0F2B46",
      inputPlaceholder: "#526B80",
      inputDisabled: "#98AAB9",
      inputFocused: "#BCCAD6",
      inputBorder: "#98AAB9",
      textDefault: "#0F2B46",
      textHelp: "#243E56",
      textInactive: "#98AAB9",
      brandPrimary: "#005EB8",
      brandPrimaryActive: "#004C94",
      brandPrimaryHover: "#0070DB",
      brandPrimaryFocused: "#FFFFFF",
      brandPrimaryText: "#FFFFFF",
      statusSuccess: "#008A00",
      statusWarning: "#D67F00",
      statusCritical: "#D13438",
      statusActive: "#005EB8",
      contentBackground1: "#FFFFFF",
      contentBackground2: "#F5F7FA",
      contentBackground3: "#EBF0F5",
      contentBackground4: "#DEE5EB",
      contentBackground5: "#CFD9E0",
      borderNeutral: "#BCCAD6"
    },
    dark: {
      background1: "#0B1219",
      background2: "#151F2A",
      background3: "#1E2C3B",
      background4: "#293A4D",
      background5: "#354960",
      background6: "#455C75",
      brandSecondary: "#354960",
      brandSecondaryActive: "#293A4D",
      brandSecondaryHover: "#455C75",
      brandSecondaryFocused: "#FFFFFF",
      brandSecondaryText: "#E1E8ED",
      inputBackground: "#293A4D",
      inputColor: "#E1E8ED",
      inputPlaceholder: "#8BA3B8",
      inputDisabled: "#5C738A",
      inputFocused: "#4DA1FF",
      inputBorder: "#5C738A",
      textDefault: "#E1E8ED",
      textHelp: "#C4D4E0",
      textInactive: "#8BA3B8",
      brandPrimary: "#4DA1FF",
      brandPrimaryActive: "#2B8CFF",
      brandPrimaryHover: "#70B5FF",
      brandPrimaryFocused: "#0B1219",
      brandPrimaryText: "#0B1219",
      statusSuccess: "#6CC26C",
      statusWarning: "#FFB54D",
      statusCritical: "#FF6E6E",
      statusActive: "#4DA1FF",
      contentBackground1: "#0B1219",
      contentBackground2: "#151F2A",
      contentBackground3: "#1E2C3B",
      contentBackground4: "#293A4D",
      contentBackground5: "#354960",
      borderNeutral: "#5C738A"
    }
  },
  {
    name: "Neo Quantum",
    description: "Ultra-modern algorithmic trading interface featuring stark contrast, electric neon accents, and high-frequency data optimization",
    light: {
      background1: "#FFFFFF",
      background2: "#F6F7F9",
      background3: "#EDEEF2",
      background4: "#E1E3E8",
      background5: "#D0D3D9",
      background6: "#A9AEB8",
      brandSecondary: "#D0D3D9",
      brandSecondaryActive: "#C3C6CE",
      brandSecondaryHover: "#E1E3E8",
      brandSecondaryFocused: "#09090B",
      brandSecondaryText: "#09090B",
      inputBackground: "#EDEEF2",
      inputColor: "#09090B",
      inputPlaceholder: "#71717A",
      inputDisabled: "#A1A1AA",
      inputFocused: "#0055FF",
      inputBorder: "#D0D3D9",
      textDefault: "#09090B",
      textHelp: "#52525B",
      textInactive: "#A1A1AA",
      brandPrimary: "#0055FF",
      brandPrimaryActive: "#0044CC",
      brandPrimaryHover: "#3377FF",
      brandPrimaryFocused: "#FFFFFF",
      brandPrimaryText: "#FFFFFF",
      statusSuccess: "#006B2C",
      statusWarning: "#A36A00",
      statusCritical: "#B30029",
      statusActive: "#0055FF",
      contentBackground1: "#FFFFFF",
      contentBackground2: "#F6F7F9",
      contentBackground3: "#EDEEF2",
      contentBackground4: "#E1E3E8",
      contentBackground5: "#D0D3D9",
      borderNeutral: "#A9AEB8"
    },
    dark: {
      background1: "#000000",
      background2: "#0A0A0C",
      background3: "#121215",
      background4: "#1C1C21",
      background5: "#27272F",
      background6: "#3F3F4A",
      brandSecondary: "#27272F",
      brandSecondaryActive: "#1C1C21",
      brandSecondaryHover: "#3F3F4A",
      brandSecondaryFocused: "#FFFFFF",
      brandSecondaryText: "#FFFFFF",
      inputBackground: "#121215",
      inputColor: "#FFFFFF",
      inputPlaceholder: "#71717A",
      inputDisabled: "#3F3F4A",
      inputFocused: "#00E5FF",
      inputBorder: "#27272F",
      textDefault: "#FFFFFF",
      textHelp: "#A1A1AA",
      textInactive: "#52525B",
      brandPrimary: "#00E5FF",
      brandPrimaryActive: "#00B8CC",
      brandPrimaryHover: "#33EEFF",
      brandPrimaryFocused: "#000000",
      brandPrimaryText: "#000000",
      statusSuccess: "#00FF66",
      statusWarning: "#FFD600",
      statusCritical: "#FF0055",
      statusActive: "#00E5FF",
      contentBackground1: "#000000",
      contentBackground2: "#0A0A0C",
      contentBackground3: "#121215",
      contentBackground4: "#1C1C21",
      contentBackground5: "#27272F",
      borderNeutral: "#3F3F4A"
    }
  },
  {
    name: "Structured Credit Pro",
    description: "Optimized for SPG and CLO trading with deep slate backgrounds, precise cyan accents, and high-contrast data visualization.",
    light: {
      background1: "#FFFFFF",
      background2: "#F8FAFC",
      background3: "#F1F5F9",
      background4: "#E2E8F0",
      background5: "#CBD5E1",
      background6: "#94A3B8",
      brandSecondary: "#CBD5E1",
      brandSecondaryActive: "#94A3B8",
      brandSecondaryHover: "#E2E8F0",
      brandSecondaryFocused: "#0F172A",
      brandSecondaryText: "#0F172A",
      inputBackground: "#E2E8F0",
      inputColor: "#0F172A",
      inputPlaceholder: "#64748B",
      inputDisabled: "#94A3B8",
      inputFocused: "#0284C7",
      inputBorder: "#94A3B8",
      textDefault: "#0F172A",
      textHelp: "#334155",
      textInactive: "#94A3B8",
      brandPrimary: "#0284C7",
      brandPrimaryActive: "#0369A1",
      brandPrimaryHover: "#0EA5E9",
      brandPrimaryFocused: "#FFFFFF",
      brandPrimaryText: "#FFFFFF",
      statusSuccess: "#059669",
      statusWarning: "#D97706",
      statusCritical: "#E11D48",
      statusActive: "#0284C7",
      contentBackground1: "#FFFFFF",
      contentBackground2: "#F8FAFC",
      contentBackground3: "#F1F5F9",
      contentBackground4: "#E2E8F0",
      contentBackground5: "#CBD5E1",
      borderNeutral: "#94A3B8"
    },
    dark: {
      background1: "#0B0F19",
      background2: "#111827",
      background3: "#1E293B",
      background4: "#334155",
      background5: "#475569",
      background6: "#64748B",
      brandSecondary: "#334155",
      brandSecondaryActive: "#1E293B",
      brandSecondaryHover: "#475569",
      brandSecondaryFocused: "#FFFFFF",
      brandSecondaryText: "#F8FAFC",
      inputBackground: "#1E293B",
      inputColor: "#F8FAFC",
      inputPlaceholder: "#64748B",
      inputDisabled: "#475569",
      inputFocused: "#38BDF8",
      inputBorder: "#475569",
      textDefault: "#F8FAFC",
      textHelp: "#94A3B8",
      textInactive: "#64748B",
      brandPrimary: "#0EA5E9",
      brandPrimaryActive: "#0284C7",
      brandPrimaryHover: "#38BDF8",
      brandPrimaryFocused: "#0B0F19",
      brandPrimaryText: "#0B0F19",
      statusSuccess: "#10B981",
      statusWarning: "#F59E0B",
      statusCritical: "#F43F5E",
      statusActive: "#0EA5E9",
      contentBackground1: "#0B0F19",
      contentBackground2: "#111827",
      contentBackground3: "#1E293B",
      contentBackground4: "#334155",
      contentBackground5: "#475569",
      borderNeutral: "#475569"
    }
  },
  {
    name: "Ubuntu Desktop",
    description: "Inspired by Ubuntu's Yaru theme with Aubergine and Orange accents",
    light: {
      background1: "#FFFFFF",
      background2: "#F7F7F7",
      background3: "#F2F1F0",
      background4: "#EAEAEA",
      background5: "#D9D9D9",
      background6: "#C0C0C0",
      brandSecondary: "#77216F",
      brandSecondaryActive: "#5E2750",
      brandSecondaryHover: "#8C2A83",
      brandSecondaryFocused: "#E95420",
      brandSecondaryText: "#FFFFFF",
      inputBackground: "#FFFFFF",
      inputColor: "#111111",
      inputPlaceholder: "#767676",
      inputDisabled: "#D9D9D9",
      inputFocused: "#E95420",
      inputBorder: "#C0C0C0",
      textDefault: "#111111",
      textHelp: "#333333",
      textInactive: "#767676",
      brandPrimary: "#E95420",
      brandPrimaryActive: "#C74B1E",
      brandPrimaryHover: "#F06B3E",
      brandPrimaryFocused: "#77216F",
      brandPrimaryText: "#FFFFFF",
      statusSuccess: "#38B44A",
      statusWarning: "#EAB503",
      statusCritical: "#C7162B",
      statusActive: "#E95420",
      contentBackground1: "#FFFFFF",
      contentBackground2: "#F7F7F7",
      contentBackground3: "#F2F1F0",
      contentBackground4: "#EAEAEA",
      contentBackground5: "#D9D9D9",
      borderNeutral: "#C0C0C0"
    },
    dark: {
      background1: "#111111",
      background2: "#1E1E1E",
      background3: "#252525",
      background4: "#2D2D2D",
      background5: "#3A3A3A",
      background6: "#4A4A4A",
      brandSecondary: "#77216F",
      brandSecondaryActive: "#5E2750",
      brandSecondaryHover: "#8C2A83",
      brandSecondaryFocused: "#E95420",
      brandSecondaryText: "#FFFFFF",
      inputBackground: "#1E1E1E",
      inputColor: "#FFFFFF",
      inputPlaceholder: "#8A8A8A",
      inputDisabled: "#4A4A4A",
      inputFocused: "#E95420",
      inputBorder: "#4A4A4A",
      textDefault: "#FFFFFF",
      textHelp: "#CCCCCC",
      textInactive: "#8A8A8A",
      brandPrimary: "#E95420",
      brandPrimaryActive: "#C74B1E",
      brandPrimaryHover: "#F06B3E",
      brandPrimaryFocused: "#77216F",
      brandPrimaryText: "#FFFFFF",
      statusSuccess: "#38B44A",
      statusWarning: "#EAB503",
      statusCritical: "#E95420",
      statusActive: "#E95420",
      contentBackground1: "#111111",
      contentBackground2: "#1E1E1E",
      contentBackground3: "#252525",
      contentBackground4: "#2D2D2D",
      contentBackground5: "#3A3A3A",
      borderNeutral: "#4A4A4A"
    }
  }
];

export default function App() {
  const [selectedTheme, setSelectedTheme] = useState<Theme>(themes[1]);
  const [mode, setMode] = useState<'dark' | 'light'>('dark');

  const downloadTheme = (theme: Theme) => {
    const json = JSON.stringify({ light: theme.light, dark: theme.dark }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${theme.name.toLowerCase().replace(/\s+/g, '-')}-theme.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            OpenFin Capital Markets Themes
          </h1>
          <p className="text-slate-400">
            Professional color themes for sophisticated Front Office trading applications
          </p>
        </div>

        {/* Theme Selector */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
          {themes.map((theme) => (
            <button
              key={theme.name}
              onClick={() => setSelectedTheme(theme)}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                selectedTheme.name === theme.name
                  ? 'border-blue-500 bg-slate-800/50 shadow-lg shadow-blue-500/20'
                  : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="flex gap-1">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: theme.dark.brandPrimary }}
                  />
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: theme.dark.background3 }}
                  />
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: theme.dark.statusSuccess }}
                  />
                </div>
              </div>
              <h3 className="font-semibold mb-1">{theme.name}</h3>
              <p className="text-xs text-slate-400 line-clamp-2">{theme.description}</p>
            </button>
          ))}
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setMode('dark')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                mode === 'dark'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Dark Mode
            </button>
            <button
              onClick={() => setMode('light')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                mode === 'light'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Light Mode
            </button>
          </div>
          <button
            onClick={() => downloadTheme(selectedTheme)}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 font-medium shadow-lg transition-all"
          >
            Download Theme JSON
          </button>
        </div>

        {/* Theme Preview */}
        <ThemePreview theme={selectedTheme} mode={mode} />

        {/* Color Editor */}
        <ThemeEditor theme={selectedTheme} mode={mode} />
      </div>
    </div>
  );
}