import { Logger } from '@macro/logger';
import { themeConfig } from '@macro/macro-design';
import { getWorkspaceStorage } from './storage/storage-context';
import { WELL_KNOWN_PREFERENCES } from './storage/storage-types';

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
 * The active preset id is a `theme-preset` preference on the unified storage backend
 * (localStorage in "local" mode — the same key as before — or the per-environment
 * storage service), read synchronously through a boot-time-hydrated cache because the
 * id is needed at platform init. Changing the preset requires a platform restart since
 * OpenFin workspace palettes are set once during init().
 */
export class ThemePresetService {
  private cachedPresetId: string | null = null;

  getAvailablePresets(): ThemePresetInfo[] {
    return PRESETS;
  }

  /**
   * Load the active preset id from the storage backend into the sync cache.
   * Called during platform boot after `initWorkspaceStorage()`; without it,
   * reads fall back to the legacy localStorage key (pre-API behavior).
   */
  async hydrate(): Promise<void> {
    try {
      const id = await getWorkspaceStorage().getPreference<string>(WELL_KNOWN_PREFERENCES.themePreset);
      if (id) this.cachedPresetId = id;
    } catch (error) {
      logger.warn('Failed to hydrate theme preset from storage — using local fallback', error);
    }
  }

  getActivePresetId(): string {
    if (this.cachedPresetId) return this.cachedPresetId;
    if (typeof localStorage === 'undefined') return 'macro-etrading'; // graceful no-op outside the browser
    try {
      return localStorage.getItem(STORAGE_KEY) ?? 'macro-etrading';
    } catch {
      return 'macro-etrading';
    }
  }

  /**
   * Persist the preset choice; await before restarting the platform. Rethrows when the
   * write fails (writes-throw posture) — restarting on an unpersisted choice would
   * silently revert the theme, so callers must surface the failure instead.
   */
  async setActivePresetId(id: string): Promise<void> {
    const previous = this.cachedPresetId;
    this.cachedPresetId = id;
    try {
      await getWorkspaceStorage().setPreference(WELL_KNOWN_PREFERENCES.themePreset, id);
    } catch (error) {
      this.cachedPresetId = previous;
      logger.error('Failed to save theme preset preference', error);
      throw error;
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
