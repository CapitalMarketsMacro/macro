import type {
  AnalyticsEvent,
  ApplyWorkspacePayload,
  CreateSavedWorkspaceRequest,
  UpdateSavedWorkspaceRequest,
  Workspace,
  WorkspacePlatformOverrideCallback,
  WorkspacePlatformProvider,
} from '@openfin/workspace-platform';
import { ColorSchemeOptionType } from '@openfin/workspace-platform';
import { Logger } from '@macro/logger';
import { WorkspaceStorageService } from './workspace-storage.service';

/**
 * Workspace override service for customizing workspace platform behavior
 * Framework-agnostic implementation
 *
 * This service provides a comprehensive override callback that can customize
 * various aspects of the OpenFin Workspace Platform behavior.
 *
 * Available override methods (currently implemented):
 * - handleAnalytics: Analytics event handling
 * - getSavedWorkspaces/getSavedWorkspacesMetadata/getSavedWorkspace: Workspace storage
 * - createSavedWorkspace/updateSavedWorkspace/deleteSavedWorkspace: Workspace CRUD
 * - applyWorkspace: Workspace application
 *
 * Additional methods that can be overridden (not yet implemented):
 * - Page Management:
 *   - getSavedPages(query?: string): Promise<Page[]>
 *   - getSavedPage(id: string): Promise<Page | undefined>
 *   - createSavedPage(req: CreateSavedPageRequest): Promise<void>
 *   - updateSavedPage(req: UpdateSavedPageRequest): Promise<void>
 *   - deleteSavedPage(id: string): Promise<void>
 *   - handlePageChanges(payload: HandlePageChangesPayload): Promise<ModifiedPageState>
 *   - copyPage(payload: CopyPagePayload): Promise<Page>
 *   - setActivePage(payload: SetActivePageForWindowPayload): Promise<void>
 *   - addDefaultPage(payload: AddDefaultPagePayload): Promise<void>
 *
 * - Context Menus:
 *   - openGlobalContextMenu(req: OpenGlobalContextMenuPayload, callerIdentity: OpenFin.Identity): Promise<void>
 *   - openViewTabContextMenu(req: OpenViewTabContextMenuPayload, callerIdentity: OpenFin.Identity): Promise<void>
 *   - openPageTabContextMenu(req: OpenPageTabContextMenuPayload, callerIdentity: OpenFin.Identity): Promise<void>
 *   - openSaveButtonContextMenu(req: OpenSaveButtonContextMenuPayload, callerIdentity: OpenFin.Identity): Promise<void>
 *
 * - Theme Management:
 *   - getSelectedScheme(): ColorSchemeOptionType | null | undefined
 *   - setSelectedScheme(schemeType: ColorSchemeOptionType): Promise<void>
 *
 * - View Management:
 *   - createView(payload: BrowserCreateViewPayload, callerIdentity: OpenFin.Identity): Promise<OpenFin.View>
 *
 * - Close/Unload Handling:
 *   - shouldPageClose(payload: ShouldPageClosePayload): Promise<ShouldPageCloseResult>
 *   - handlePagesAndWindowClose(payload: HandlePagesAndWindowClosePayload): Promise<HandlePagesAndWindowCloseResult>
 *   - getUserDecisionForBeforeUnload(payload: ViewsPreventingUnloadPayload): Promise<OpenFin.BeforeUnloadUserDecision>
 *   - handleSaveModalOnPageClose(payload: HandleSaveModalOnPageClosePayload): Promise<SaveModalOnPageCloseResult>
 *
 * - Dock Provider:
 *   - getDockProviderConfig(id: string): Promise<DockProviderConfigWithIdentity | undefined>
 *   - saveDockProviderConfig(config: DockProviderConfigWithIdentity): Promise<void>
 *
 * - Localization:
 *   - getLanguage(): Promise<Locale>
 *   - setLanguage(locale: Locale): Promise<void>
 */
export class WorkspaceOverrideService {
  private readonly logger = Logger.getLogger('WorkspaceOverrideService');
  private readonly storageService: WorkspaceStorageService;

  private onThemeChanged?: (scheme: ColorSchemeOptionType) => Promise<void>;

  constructor(storageService: WorkspaceStorageService) {
    this.storageService = storageService;
  }

  /**
   * Register a callback that fires after the platform theme changes.
   */
  setOnThemeChanged(callback: (scheme: ColorSchemeOptionType) => Promise<void>): void {
    this.onThemeChanged = callback;
  }

  /**
   * Creates an override callback function for the Workspace Platform initialization.
   * This allows customizing the WorkspacePlatformProvider behavior by extending it.
   *
   * @returns A function that extends WorkspacePlatformProvider with custom overrides
   */
  createOverrideCallback(): WorkspacePlatformOverrideCallback {
    const logger = this.logger;
    const storageService = this.storageService;
    const getOnThemeChanged = () => this.onThemeChanged;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
         * Get all saved workspaces from storage.
         * @param query Optional query string to filter workspaces by title
         */
        async getSavedWorkspaces(query?: string): Promise<Workspace[]> {
          logger.debug('Getting saved workspaces', { query });
          const workspaces = await storageService.getWorkspaces();
          if (!query) {
            return workspaces;
          }
          const lowerQuery = query.toLowerCase();
          return workspaces.filter(
            (workspace) => workspace.title.toLowerCase().includes(lowerQuery) || workspace.workspaceId.toLowerCase().includes(lowerQuery),
          );
        }

        /**
         * Get metadata for all saved workspaces from storage.
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
         * Get a single saved workspace by ID from storage.
         * @param id The workspace ID
         */
        async getSavedWorkspace(id: string): Promise<Workspace | undefined> {
          logger.debug('Getting saved workspace', { workspaceId: id });
          const workspaces = await storageService.getWorkspaces();
          const workspace = workspaces.find((w) => w.workspaceId === id);
          if (workspace) {
            logger.info('Found saved workspace', { workspaceId: id, title: workspace.title });
          } else {
            logger.warn('Workspace not found', { workspaceId: id });
          }
          return workspace;
        }

        /**
         * Create a new workspace in storage.
         * @param req The create workspace request
         */
        async createSavedWorkspace(req: CreateSavedWorkspaceRequest): Promise<void> {
          logger.info('Creating saved workspace', { workspaceId: req.workspace.workspaceId, title: req.workspace.title });
          const workspaces = await storageService.getWorkspaces();
          const existingIndex = workspaces.findIndex((w) => w.workspaceId === req.workspace.workspaceId);
          if (existingIndex >= 0) {
            logger.warn('Workspace already exists, updating instead', { workspaceId: req.workspace.workspaceId });
            workspaces[existingIndex] = req.workspace;
          } else {
            workspaces.push(req.workspace);
          }
          await storageService.saveWorkspaces(workspaces);
          await storageService.setLastSavedWorkspaceId(req.workspace.workspaceId);
          logger.info('Workspace created successfully', { workspaceId: req.workspace.workspaceId });
        }

        /**
         * Update an existing workspace in storage.
         * @param req The update workspace request
         */
        async updateSavedWorkspace(req: UpdateSavedWorkspaceRequest): Promise<void> {
          logger.info('Updating saved workspace', { workspaceId: req.workspaceId, title: req.workspace.title });
          const workspaces = await storageService.getWorkspaces();
          const index = workspaces.findIndex((w) => w.workspaceId === req.workspaceId);
          if (index >= 0) {
            workspaces[index] = req.workspace;
            await storageService.saveWorkspaces(workspaces);
            await storageService.setLastSavedWorkspaceId(req.workspaceId);
            logger.info('Workspace updated successfully', { workspaceId: req.workspaceId });
          } else {
            logger.warn('Workspace not found for update, creating new one', { workspaceId: req.workspaceId });
            workspaces.push(req.workspace);
            await storageService.saveWorkspaces(workspaces);
            await storageService.setLastSavedWorkspaceId(req.workspaceId);
          }
        }

        /**
         * Delete a workspace from storage.
         * @param id The workspace ID to delete
         */
        async deleteSavedWorkspace(id: string): Promise<void> {
          logger.info('Deleting saved workspace', { workspaceId: id });
          const workspaces = await storageService.getWorkspaces();
          const filtered = workspaces.filter((w) => w.workspaceId !== id);
          if (filtered.length < workspaces.length) {
            await storageService.saveWorkspaces(filtered);
            const lastSavedId = await storageService.getLastSavedWorkspaceId();
            if (lastSavedId === id) {
              await storageService.removeLastSavedWorkspaceId();
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
          const lastSavedId = await storageService.getLastSavedWorkspaceId();
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

        /**
         * Override theme change to swap sun/moon icon after theme is applied.
         */
        async setSelectedScheme(schemeType: ColorSchemeOptionType): Promise<void> {
          await super.setSelectedScheme(schemeType);
          const callback = getOnThemeChanged();
          if (callback) {
            await callback(schemeType);
          }
        }

        // ============================================
        // ADDITIONAL OVERRIDE METHODS (Examples)
        // Uncomment and customize as needed
        // ============================================

        /**
         * Override to customize page save behavior
         * Example: Save pages to a remote API instead of localStorage
         */
        // async createSavedPage(req: CreateSavedPageRequest): Promise<void> {
        //   logger.info('Creating saved page', { pageId: req.page.pageId });
        //   // Custom implementation here (e.g., save to API)
        //   return super.createSavedPage(req);
        // }

        /**
         * Override to customize context menu behavior
         * Example: Add custom menu items to the global context menu
         */
        // async openGlobalContextMenu(
        //   req: OpenGlobalContextMenuPayload,
        //   callerIdentity: OpenFin.Identity
        // ): Promise<void> {
        //   logger.debug('Opening global context menu', { callerIdentity });
        //   // Add custom menu items to req.template before calling super
        //   return super.openGlobalContextMenu(req, callerIdentity);
        // }

        /**
         * Override to customize view creation
         * Example: Add custom properties or modify view options
         */
        // async createView(
        //   payload: BrowserCreateViewPayload,
        //   callerIdentity: OpenFin.Identity
        // ): Promise<OpenFin.View> {
        //   logger.info('Creating view', { callerIdentity });
        //   // Modify payload if needed
        //   return super.createView(payload, callerIdentity);
        // }

        /**
         * Override to customize page close behavior
         * Example: Show custom confirmation dialog
         */
        // async shouldPageClose(payload: ShouldPageClosePayload): Promise<ShouldPageCloseResult> {
        //   logger.debug('Checking if page should close', { pageId: payload.page.pageId });
        //   // Custom logic to determine if page should close
        //   return super.shouldPageClose(payload);
        // }

        /**
         * Override to customize theme selection
         * Example: Persist theme preference to backend
         */
        // async setSelectedScheme(schemeType: ColorSchemeOptionType): Promise<void> {
        //   logger.info('Setting theme scheme', { schemeType });
        //   // Save to backend or custom storage
        //   return super.setSelectedScheme(schemeType);
        // }

        /**
         * Override to customize language/locale
         * Example: Sync language with user preferences
         */
        // async setLanguage(locale: Locale): Promise<void> {
        //   logger.info('Setting language', { locale });
        //   // Save language preference
        //   return super.setLanguage(locale);
        // }
      }
      return new CustomWorkspacePlatformProvider() as WorkspacePlatformProvider;
    };
  }
}
