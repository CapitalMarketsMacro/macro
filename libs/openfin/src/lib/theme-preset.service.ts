import { Logger } from '@macro/logger';
import { themeConfig } from '@macro/macro-design';

const logger = Logger.getLogger('ThemePresetService');

export interface ThemePresetPalettes {
  light: Record<string, string>;
  dark: Record<string, string>;
}

export interface ThemePresetInfo {
  id: string;
  label: string;
  file: string;
}

const STORAGE_KEY = 'workspace-theme-preset';

const PRESETS: ThemePresetInfo[] = [
  { id: 'macro-etrading', label: 'Macro E-Trading', file: 'macro-etrading-theme.json' },
  { id: 'default', label: 'Default', file: 'default-theme.json' },
  { id: 'carbon-graphite', label: 'Carbon Graphite', file: 'carbon-graphite.json' },
  { id: 'midnight-trader', label: 'Midnight Trader', file: 'midnight-trader.json' },
  { id: 'executive-blue', label: 'Executive Blue', file: 'executive-blue-theme.json' },
  { id: 'stagecoach-red', label: 'Stagecoach Red', file: 'stagecoach-red-theme.json' },
];

/**
 * Manages workspace theme presets (color palettes for the OpenFin workspace chrome).
 *
 * Theme presets are loaded from JSON files in the app's public directory.
 * The active preset is stored in localStorage and applied at platform init.
 * Changing the preset requires a platform restart since OpenFin workspace
 * palettes are set once during init().
 */
export class ThemePresetService {
  getAvailablePresets(): ThemePresetInfo[] {
    return PRESETS;
  }

  getActivePresetId(): string {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? 'macro-etrading';
    } catch {
      return 'macro-etrading';
    }
  }

  setActivePresetId(id: string): void {
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch (error) {
      logger.error('Failed to save theme preset preference', error);
    }
  }

  async loadPreset(id: string): Promise<ThemePresetPalettes> {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) {
      logger.warn(`Unknown preset "${id}", using compiled themeConfig`);
      return this.getCompiledFallback();
    }
    try {
      const response = await fetch(`/${preset.file}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      logger.error(`Failed to load theme preset "${id}", using compiled themeConfig`, error);
      return this.getCompiledFallback();
    }
  }

  async loadActivePreset(): Promise<ThemePresetPalettes> {
    return this.loadPreset(this.getActivePresetId());
  }

  /** Compiled fallback — never fails, uses themeConfig from @macro/macro-design. */
  private getCompiledFallback(): ThemePresetPalettes {
    return {
      dark: themeConfig.dark as unknown as Record<string, string>,
      light: themeConfig.light as unknown as Record<string, string>,
    };
  }
}
