import { Injectable } from '@angular/core';
import type {
  AnalyticsEvent,
  ApplyWorkspacePayload,
  CreateSavedWorkspaceRequest,
  UpdateSavedWorkspaceRequest,
  Workspace,
  WorkspacePlatformOverrideCallback,
  WorkspacePlatformProvider,
} from '@openfin/workspace-platform';
import { Logger } from '@macro/logger';

@Injectable({ providedIn: 'root' })
export class WorkspaceOverrideService {
  private readonly logger = Logger.getLogger('WorkspaceOverrideService');
  private readonly STORAGE_KEY = 'workspace-platform-workspaces';
  private readonly LAST_SAVED_KEY = 'workspace-platform-last-saved';

  /**
   * Creates an override callback function for the Workspace Platform initialization.
   * This allows customizing the WorkspacePlatformProvider behavior by extending it.
   *
   * @returns A function that extends WorkspacePlatformProvider with custom overrides
   */
  createOverrideCallback(): WorkspacePlatformOverrideCallback {
    const logger = this.logger;
    const STORAGE_KEY = this.STORAGE_KEY;
    const LAST_SAVED_KEY = this.LAST_SAVED_KEY;

    // Helper functions for localStorage operations
    const getWorkspaces = (): Workspace[] => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
      } catch (error) {
        logger.error('Failed to get workspaces from localStorage', { error });
        return [];
      }
    };

    const saveWorkspaces = (workspaces: Workspace[]): void => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaces));
      } catch (error) {
        logger.error('Failed to save workspaces to localStorage', { error });
      }
    };

    const getLastSavedWorkspaceId = (): string | null => {
      return localStorage.getItem(LAST_SAVED_KEY);
    };

    const setLastSavedWorkspaceId = (workspaceId: string): void => {
      localStorage.setItem(LAST_SAVED_KEY, workspaceId);
    };

    return async (WorkspacePlatformProvider: any) => {
      class CustomWorkspacePlatformProvider extends WorkspacePlatformProvider {
        /**
         * Handles analytics events by logging them.
         * @param req Array of analytics events to handle
         */
        async handleAnalytics(req: AnalyticsEvent[]): Promise<void> {
          logger.info('Analytics events received', { events: req });
          return super.handleAnalytics(req);
        }

        /**
         * Get all saved workspaces from localStorage.
         * @param query Optional query string to filter workspaces by title
         */
        async getSavedWorkspaces(query?: string): Promise<Workspace[]> {
          logger.debug('Getting saved workspaces', { query });
          const workspaces = getWorkspaces();
          if (!query) {
            return workspaces;
          }
          const lowerQuery = query.toLowerCase();
          return workspaces.filter(
            (workspace) => workspace.title.toLowerCase().includes(lowerQuery) || workspace.workspaceId.toLowerCase().includes(lowerQuery),
          );
        }

        /**
         * Get metadata for all saved workspaces from localStorage.
         * @param query Optional query string to filter workspaces by title
         */
        async getSavedWorkspacesMetadata(query?: string): Promise<Pick<Workspace, 'workspaceId' | 'title'>[]> {
          logger.debug('Getting saved workspaces metadata', { query });
          const workspaces = await this.getSavedWorkspaces(query);
          return workspaces.map((workspace) => ({
            workspaceId: workspace.workspaceId,
            title: workspace.title,
          }));
        }

        /**
         * Get a single saved workspace by ID from localStorage.
         * @param id The workspace ID
         */
        async getSavedWorkspace(id: string): Promise<Workspace | undefined> {
          logger.debug('Getting saved workspace', { workspaceId: id });
          const workspaces = getWorkspaces();
          const workspace = workspaces.find((w) => w.workspaceId === id);
          if (workspace) {
            logger.info('Found saved workspace', { workspaceId: id, title: workspace.title });
          } else {
            logger.warn('Workspace not found', { workspaceId: id });
          }
          return workspace;
        }

        /**
         * Create a new workspace in localStorage.
         * @param req The create workspace request
         */
        async createSavedWorkspace(req: CreateSavedWorkspaceRequest): Promise<void> {
          logger.info('Creating saved workspace', { workspaceId: req.workspace.workspaceId, title: req.workspace.title });
          const workspaces = getWorkspaces();
          const existingIndex = workspaces.findIndex((w) => w.workspaceId === req.workspace.workspaceId);
          if (existingIndex >= 0) {
            logger.warn('Workspace already exists, updating instead', { workspaceId: req.workspace.workspaceId });
            workspaces[existingIndex] = req.workspace;
          } else {
            workspaces.push(req.workspace);
          }
          saveWorkspaces(workspaces);
          setLastSavedWorkspaceId(req.workspace.workspaceId);
          logger.info('Workspace created successfully', { workspaceId: req.workspace.workspaceId });
        }

        /**
         * Update an existing workspace in localStorage.
         * @param req The update workspace request
         */
        async updateSavedWorkspace(req: UpdateSavedWorkspaceRequest): Promise<void> {
          logger.info('Updating saved workspace', { workspaceId: req.workspaceId, title: req.workspace.title });
          const workspaces = getWorkspaces();
          const index = workspaces.findIndex((w) => w.workspaceId === req.workspaceId);
          if (index >= 0) {
            workspaces[index] = req.workspace;
            saveWorkspaces(workspaces);
            setLastSavedWorkspaceId(req.workspaceId);
            logger.info('Workspace updated successfully', { workspaceId: req.workspaceId });
          } else {
            logger.warn('Workspace not found for update, creating new one', { workspaceId: req.workspaceId });
            workspaces.push(req.workspace);
            saveWorkspaces(workspaces);
            setLastSavedWorkspaceId(req.workspaceId);
          }
        }

        /**
         * Delete a workspace from localStorage.
         * @param id The workspace ID to delete
         */
        async deleteSavedWorkspace(id: string): Promise<void> {
          logger.info('Deleting saved workspace', { workspaceId: id });
          const workspaces = getWorkspaces();
          const filtered = workspaces.filter((w) => w.workspaceId !== id);
          if (filtered.length < workspaces.length) {
            saveWorkspaces(filtered);
            const lastSavedId = getLastSavedWorkspaceId();
            if (lastSavedId === id) {
              localStorage.removeItem(LAST_SAVED_KEY);
              logger.info('Removed last saved workspace reference', { workspaceId: id });
            }
            logger.info('Workspace deleted successfully', { workspaceId: id });
          } else {
            logger.warn('Workspace not found for deletion', { workspaceId: id });
          }
        }

        /**
         * Apply a workspace to the desktop and log the last saved workspace.
         * @param payload The workspace payload with options
         */
        async applyWorkspace(payload: ApplyWorkspacePayload): Promise<boolean> {
          logger.info('Applying workspace', {
            workspaceId: payload.workspaceId,
            title: payload.title,
            options: payload.options,
          });

          // Show last saved workspace info
          const lastSavedId = getLastSavedWorkspaceId();
          if (lastSavedId) {
            const lastSaved = await this.getSavedWorkspace(lastSavedId);
            if (lastSaved) {
              logger.info('Last saved workspace', {
                workspaceId: lastSaved.workspaceId,
                title: lastSaved.title,
              });
            }
          }

          // Call parent implementation to actually apply the workspace
          const result = await super.applyWorkspace(payload);
          logger.info('Workspace apply result', { workspaceId: payload.workspaceId, result });
          return result;
        }
      }
      return new CustomWorkspacePlatformProvider() as WorkspacePlatformProvider;
    };
  }
}

