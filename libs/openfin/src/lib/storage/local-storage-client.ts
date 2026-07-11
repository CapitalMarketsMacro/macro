import type { Page, Workspace } from '@openfin/workspace-platform';
import type { DockProviderConfigWithIdentity } from '@openfin/workspace';
import { Logger } from '@macro/logger';
import {
  WELL_KNOWN_PREFERENCES,
  type WorkspaceStorageClient,
} from './storage-types';

const logger = Logger.getLogger('LocalStorageWorkspaceStorageClient');

const WORKSPACES_KEY = 'workspace-platform-workspaces';
const PAGES_KEY = 'workspace-platform-pages';
const DOCK_KEY_PREFIX = 'workspace-platform-dock';
const FAVORITES_KEY_PREFIX = 'workspace-store-favorites';
const PREFERENCE_KEY_PREFIX = 'macro:pref';

/**
 * Well-known preferences map onto the exact keys the platform used before the unified
 * storage API existed, so a user's saved workspaces pointer, theme preset and view
 * titles all survive the upgrade in "local" mode.
 */
const LEGACY_PREFERENCE_KEYS: Record<string, string> = {
  [WELL_KNOWN_PREFERENCES.lastSavedWorkspace]: 'workspace-platform-last-saved',
  [WELL_KNOWN_PREFERENCES.themePreset]: 'workspace-theme-preset',
  [WELL_KNOWN_PREFERENCES.viewTitles]: 'macro:view-titles',
};

/**
 * "local" mode implementation of the unified {@link WorkspaceStorageClient}: browser
 * localStorage on this machine, using the same keys as the pre-API services. All
 * methods no-op gracefully outside a browser (Node-environment tests), matching the
 * repo convention.
 */
export class LocalStorageWorkspaceStorageClient
  implements WorkspaceStorageClient
{
  constructor(
    private readonly getUserId: () => Promise<string> = async () => 'anonymous',
  ) {}

  // ── workspaces ──

  async getWorkspaces(): Promise<Workspace[]> {
    return this.readArray<Workspace>(WORKSPACES_KEY);
  }

  async getWorkspace(workspaceId: string): Promise<Workspace | undefined> {
    return (await this.getWorkspaces()).find(
      (w) => w.workspaceId === workspaceId,
    );
  }

  async saveWorkspace(workspace: Workspace): Promise<void> {
    const workspaces = await this.getWorkspaces();
    const index = workspaces.findIndex(
      (w) => w.workspaceId === workspace.workspaceId,
    );
    if (index >= 0) {
      workspaces[index] = workspace;
    } else {
      workspaces.push(workspace);
    }
    this.writeJson(WORKSPACES_KEY, workspaces);
  }

  async deleteWorkspace(workspaceId: string): Promise<void> {
    const workspaces = await this.getWorkspaces();
    const filtered = workspaces.filter((w) => w.workspaceId !== workspaceId);
    if (filtered.length !== workspaces.length) {
      this.writeJson(WORKSPACES_KEY, filtered);
    }
  }

  // ── pages ──

  async getPages(): Promise<Page[]> {
    return this.readArray<Page>(PAGES_KEY);
  }

  async getPage(pageId: string): Promise<Page | undefined> {
    return (await this.getPages()).find((p) => p.pageId === pageId);
  }

  async savePage(page: Page): Promise<void> {
    const pages = await this.getPages();
    const index = pages.findIndex((p) => p.pageId === page.pageId);
    if (index >= 0) {
      pages[index] = page;
    } else {
      pages.push(page);
    }
    this.writeJson(PAGES_KEY, pages);
  }

  async deletePage(pageId: string): Promise<void> {
    const pages = await this.getPages();
    const filtered = pages.filter((p) => p.pageId !== pageId);
    if (filtered.length !== pages.length) {
      this.writeJson(PAGES_KEY, filtered);
    }
  }

  // ── dock ──

  async getDockConfig(
    dockProviderId: string,
  ): Promise<DockProviderConfigWithIdentity | undefined> {
    const raw = this.readRaw(`${DOCK_KEY_PREFIX}:${dockProviderId}`);
    if (raw === null) return undefined;
    try {
      return JSON.parse(raw) as DockProviderConfigWithIdentity;
    } catch {
      return undefined;
    }
  }

  async saveDockConfig(config: DockProviderConfigWithIdentity): Promise<void> {
    this.writeJson(`${DOCK_KEY_PREFIX}:${config.id}`, config);
  }

  // ── favorites (per user, legacy key format `workspace-store-favorites:<userId>`) ──

  async getFavorites(): Promise<string[]> {
    return this.readArray<string>(await this.favoritesKey());
  }

  async saveFavorites(appIds: string[]): Promise<void> {
    this.writeJson(await this.favoritesKey(), appIds);
  }

  // ── preferences ──

  async getPreference<T>(key: string): Promise<T | undefined> {
    const raw = this.readRaw(this.preferenceKey(key));
    if (raw === null) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // Legacy bare-string values (last-saved id, theme preset id) predate JSON wrapping.
      return raw as unknown as T;
    }
  }

  async setPreference<T>(key: string, value: T): Promise<void> {
    this.writeJson(this.preferenceKey(key), value);
  }

  async deletePreference(key: string): Promise<void> {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.removeItem(this.preferenceKey(key));
    } catch (error) {
      logger.error('Failed to delete preference', { key, error });
    }
  }

  // ── internals ──

  private async favoritesKey(): Promise<string> {
    let userId = 'anonymous';
    try {
      userId = await this.getUserId();
    } catch {
      // fall through to anonymous
    }
    return `${FAVORITES_KEY_PREFIX}:${userId}`;
  }

  private preferenceKey(key: string): string {
    return LEGACY_PREFERENCE_KEYS[key] ?? `${PREFERENCE_KEY_PREFIX}:${key}`;
  }

  private readRaw(key: string): string | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      return localStorage.getItem(key);
    } catch (error) {
      logger.error('Failed to read from localStorage', { key, error });
      return null;
    }
  }

  private readArray<T>(key: string): T[] {
    const raw = this.readRaw(key);
    if (raw === null) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch (error) {
      logger.error('Failed to parse stored array', { key, error });
      return [];
    }
  }

  private writeJson(key: string, value: unknown): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      logger.error('Failed to write to localStorage', { key, error });
      throw error instanceof Error ? error : new Error(String(error));
    }
  }
}
