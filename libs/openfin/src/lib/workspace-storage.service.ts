import type { Workspace } from '@openfin/workspace-platform';
import { Logger } from '@macro/logger';

/**
 * Service that abstracts workspace persistence storage.
 * Default implementation uses localStorage. Can be replaced with a REST API
 * implementation without changing callers.
 */
export class WorkspaceStorageService {
  private readonly logger = Logger.getLogger('WorkspaceStorageService');
  private readonly STORAGE_KEY = 'workspace-platform-workspaces';
  private readonly LAST_SAVED_KEY = 'workspace-platform-last-saved';

  async getWorkspaces(): Promise<Workspace[]> {
    if (typeof localStorage === 'undefined') return []; // graceful no-op outside the browser
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      this.logger.error('Failed to get workspaces from storage', { error });
      return [];
    }
  }

  async saveWorkspaces(workspaces: Workspace[]): Promise<void> {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(workspaces));
    } catch (error) {
      this.logger.error('Failed to save workspaces to storage', { error });
    }
  }

  async getLastSavedWorkspaceId(): Promise<string | null> {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(this.LAST_SAVED_KEY);
  }

  async setLastSavedWorkspaceId(id: string): Promise<void> {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(this.LAST_SAVED_KEY, id);
  }

  async removeLastSavedWorkspaceId(): Promise<void> {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(this.LAST_SAVED_KEY);
  }
}
