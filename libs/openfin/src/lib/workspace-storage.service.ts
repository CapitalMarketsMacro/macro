import type { Page, Workspace } from '@openfin/workspace-platform';
import type { DockProviderConfigWithIdentity } from '@openfin/workspace';
import { Logger } from '@macro/logger';
import { getWorkspaceStorage } from './storage/storage-context';
import { WELL_KNOWN_PREFERENCES, type LobDockApp, type LobStoreApp } from './storage/storage-types';

/**
 * Facade over the active {@link WorkspaceStorageClient} — the single seam every
 * platform service persists through. The backend (this machine's localStorage, or the
 * per-environment Workspace Storage REST service) is selected at boot by
 * `initWorkspaceStorage()` from the settings.json `storage` block; callers never know
 * which one is active.
 *
 * Error posture: reads degrade (log + empty result) so a storage outage can never
 * brick platform boot; writes THROW so a failed save is never silently reported as
 * success — the platform surfaces the failure to the user.
 */
export class WorkspaceStorageService {
  private readonly logger = Logger.getLogger('WorkspaceStorageService');

  // ── workspaces ──

  async getWorkspaces(): Promise<Workspace[]> {
    try {
      return await getWorkspaceStorage().getWorkspaces();
    } catch (error) {
      this.logger.error('Failed to get workspaces from storage', { error });
      return [];
    }
  }

  async getWorkspace(workspaceId: string): Promise<Workspace | undefined> {
    try {
      return await getWorkspaceStorage().getWorkspace(workspaceId);
    } catch (error) {
      this.logger.error('Failed to get workspace from storage', { workspaceId, error });
      return undefined;
    }
  }

  async saveWorkspace(workspace: Workspace): Promise<void> {
    await getWorkspaceStorage().saveWorkspace(workspace);
  }

  async deleteWorkspace(workspaceId: string): Promise<void> {
    await getWorkspaceStorage().deleteWorkspace(workspaceId);
  }

  // ── pages ──

  async getPages(): Promise<Page[]> {
    try {
      return await getWorkspaceStorage().getPages();
    } catch (error) {
      this.logger.error('Failed to get pages from storage', { error });
      return [];
    }
  }

  async getPage(pageId: string): Promise<Page | undefined> {
    try {
      return await getWorkspaceStorage().getPage(pageId);
    } catch (error) {
      this.logger.error('Failed to get page from storage', { pageId, error });
      return undefined;
    }
  }

  async savePage(page: Page): Promise<void> {
    await getWorkspaceStorage().savePage(page);
  }

  async deletePage(pageId: string): Promise<void> {
    await getWorkspaceStorage().deletePage(pageId);
  }

  // ── dock customization ──

  async getDockConfig(dockProviderId: string): Promise<DockProviderConfigWithIdentity | undefined> {
    try {
      return await getWorkspaceStorage().getDockConfig(dockProviderId);
    } catch (error) {
      this.logger.error('Failed to get dock config from storage', { dockProviderId, error });
      return undefined;
    }
  }

  async saveDockConfig(config: DockProviderConfigWithIdentity): Promise<void> {
    await getWorkspaceStorage().saveDockConfig(config);
  }

  // ── LOB dock apps (shared across users; reads degrade like all reads) ──

  async getLobDockApps(): Promise<LobDockApp[]> {
    try {
      return await getWorkspaceStorage().getLobDockApps();
    } catch (error) {
      this.logger.error('Failed to get LOB dock apps from storage', { error });
      return [];
    }
  }

  async getLobStoreApps(): Promise<LobStoreApp[]> {
    try {
      return await getWorkspaceStorage().getLobStoreApps();
    } catch (error) {
      this.logger.error('Failed to get LOB store apps from storage', { error });
      return [];
    }
  }

  // ── preferences ──

  async getPreference<T>(key: string): Promise<T | undefined> {
    try {
      return await getWorkspaceStorage().getPreference<T>(key);
    } catch (error) {
      this.logger.error('Failed to get preference from storage', { key, error });
      return undefined;
    }
  }

  async setPreference<T>(key: string, value: T): Promise<void> {
    await getWorkspaceStorage().setPreference(key, value);
  }

  // ── last-saved workspace pointer (a well-known preference; failures degrade) ──

  async getLastSavedWorkspaceId(): Promise<string | null> {
    return (await this.getPreference<string>(WELL_KNOWN_PREFERENCES.lastSavedWorkspace)) ?? null;
  }

  async setLastSavedWorkspaceId(id: string): Promise<void> {
    try {
      await getWorkspaceStorage().setPreference(WELL_KNOWN_PREFERENCES.lastSavedWorkspace, id);
    } catch (error) {
      this.logger.error('Failed to save last-saved workspace id', { id, error });
    }
  }

  async removeLastSavedWorkspaceId(): Promise<void> {
    try {
      await getWorkspaceStorage().deletePreference(WELL_KNOWN_PREFERENCES.lastSavedWorkspace);
    } catch (error) {
      this.logger.error('Failed to clear last-saved workspace id', { error });
    }
  }
}
