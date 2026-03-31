import type OpenFin from '@openfin/core';
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
import { SnapService } from './snap.service';
import { getAnalyticsNats } from './analytics-nats.service';

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
const FLUSH_TOPIC = 'workspace:flush-view-state';
const FLUSH_DELAY_MS = 200;

export const THEME_CHANGED_TOPIC = 'workspace:theme-changed';

const VIEW_TITLES_KEY = 'macro:view-titles';

function loadViewTitles(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(VIEW_TITLES_KEY) || '{}');
  } catch { return {}; }
}

function saveViewTitles(titles: Record<string, string>): void {
  localStorage.setItem(VIEW_TITLES_KEY, JSON.stringify(titles));
}

/** Called by the rename-view action to register a custom title. */
export function setViewTitle(viewName: string, title: string): void {
  const titles = loadViewTitles();
  titles[viewName] = title;
  saveViewTitles(titles);
  console.log('[setViewTitle] SET', viewName, '→', title, 'all:', titles);
}

/** Get all custom view titles. */
export function getViewTitles(): Record<string, string> {
  return loadViewTitles();
}

export class WorkspaceOverrideService {
  private readonly logger = Logger.getLogger('WorkspaceOverrideService');
  private readonly storageService: WorkspaceStorageService;
  private readonly snapService: SnapService;

  private onThemeChanged?: (scheme: ColorSchemeOptionType) => Promise<void>;

  constructor(storageService: WorkspaceStorageService, snapService: SnapService) {
    this.storageService = storageService;
    this.snapService = snapService;
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
    const snapService = this.snapService;
    const analyticsNats = getAnalyticsNats();
    const getOnThemeChanged = () => this.onThemeChanged;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return async (WorkspacePlatformProvider: any) => {
      /**
       * Broadcast a flush event to all views so they persist their
       * current state to view options, then re-capture the platform
       * snapshot so the workspace includes the freshest data.
       */
      async function flushViewStatesAndRecapture(workspace: Workspace): Promise<void> {
        try {
          await fin.InterApplicationBus.publish(FLUSH_TOPIC, {});
          await new Promise((resolve) => setTimeout(resolve, FLUSH_DELAY_MS));
          const platform = fin.Platform.getCurrentSync();
          workspace.snapshot = await platform.getSnapshot() as unknown as typeof workspace.snapshot;
        } catch (err) {
          logger.warn('Failed to flush view states before workspace save', err);
        }
      }

      /**
       * Recursively walk a golden-layout content tree and patch view customData
       * with the latest runtime values (e.g. viewTitle from rename).
       */
      /**
       * Patch a workspace's snapshot with custom view titles from localStorage.
       */
      function patchWorkspaceWithTitles(workspace: Workspace): void {
        try {
          const titles = getViewTitles();
          const titleEntries = Object.entries(titles);
          console.log('[patchWorkspace] titles from localStorage:', titles);
          if (titleEntries.length === 0) return;
          const snap = workspace.snapshot as any;
          if (snap?.windows) {
            const titleMap = new Map(titleEntries);
            for (const win of snap.windows) {
              if (win?.layout?.content) {
                patchLayoutContent(win.layout.content, titleMap);
              }
            }
          }
        } catch (err) {
          logger.warn('Failed to patch workspace with view titles', err);
        }
      }

      /**
       * Collect values from layout components in tree-walk order.
       * extractor returns the value to collect, or undefined to skip.
       */
      function collectFromLayout<T>(items: any[], extractor: (cs: any) => T | undefined, result: T[]): void {
        for (const item of items) {
          if (item.type === 'component' && item.componentState) {
            const val = extractor(item.componentState);
            if (val !== undefined) {
              result.push(val);
            }
          }
          if (item.content) {
            collectFromLayout(item.content, extractor, result);
          }
        }
      }

      function collectUrlTitlesFromLayout(items: any[], result: Map<string, string[]>): void {
        for (const item of items) {
          if (item.type === 'component' && item.componentState?.customData?.viewTitle && item.componentState?.url) {
            const url = item.componentState.url;
            if (!result.has(url)) result.set(url, []);
            result.get(url)!.push(item.componentState.customData.viewTitle);
          }
          if (item.content) {
            collectUrlTitlesFromLayout(item.content, result);
          }
        }
      }

      function collectTitlesFromLayout(items: any[], result: Map<string, string>): void {
        for (const item of items) {
          if (item.type === 'component' && item.componentState?.name && item.componentState?.customData?.viewTitle) {
            result.set(item.componentState.name, item.componentState.customData.viewTitle);
          }
          if (item.content) {
            collectTitlesFromLayout(item.content, result);
          }
        }
      }

      function patchLayoutContent(items: any[], titleMap: Map<string, string>): void {
        for (const item of items) {
          console.log('[patchLayout] item type:', item.type, 'componentState?.name:', item.componentState?.name, 'keys:', Object.keys(item));
          if (item.type === 'component' && item.componentState?.name) {
            const title = titleMap.get(item.componentState.name);
            console.log('[patchLayout] lookup', item.componentState.name, '→', title, 'mapKeys:', [...titleMap.keys()]);
            if (title) {
              item.title = title;
              item.componentState.title = title;
              item.componentState.customData = { ...item.componentState.customData, viewTitle: title };
              console.log('[patchLayout] PATCHED', item.componentState.name, '→', title);
            }
          }
          if (item.content) {
            patchLayoutContent(item.content, titleMap);
          }
        }
      }

      class CustomWorkspacePlatformProvider extends WorkspacePlatformProvider {
        /**
         * Handles analytics events by logging them.
         * @param req Array of analytics events to handle
         */
        async handleAnalytics(req: AnalyticsEvent[]): Promise<void> {
          for (const event of req) {
            logger.info('Analytics', { type: event.type, source: event.source, action: (event as any).action, entity: (event as any).entityId });
            console.log('[Analytics]', event.type, event);
            analyticsNats.publish(event as any).catch(() => {});
          }
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
          await flushViewStatesAndRecapture(req.workspace);
          patchWorkspaceWithTitles(req.workspace);
          logger.info('Creating saved workspace', { workspaceId: req.workspace.workspaceId, title: req.workspace.title });
          analyticsNats.publish({ source: 'Platform', type: 'Workspace', action: 'Save',
            value: req.workspace.title, data: { workspaceId: req.workspace.workspaceId } }).catch(() => {});
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
          console.log('[updateSavedWorkspace] BUILD_V3 - starting');
          await flushViewStatesAndRecapture(req.workspace);
          console.log('[updateSavedWorkspace] BUILD_V3 - flush done');
          try {
            const raw = localStorage.getItem('macro:view-titles');
            console.log('[updateSavedWorkspace] raw localStorage:', raw);
            const titles = JSON.parse(raw || '{}');
            const entries = Object.entries(titles);
            console.log('[updateSavedWorkspace] titles count:', entries.length);
            if (entries.length > 0) {
              const snap = req.workspace.snapshot as any;
              console.log('[updateSavedWorkspace] snapshot type:', typeof snap, 'keys:', snap ? Object.keys(snap) : 'null');
              console.log('[updateSavedWorkspace] snapshot windows:', snap?.windows?.length, 'snapshotDetails:', snap?.snapshotDetails ? Object.keys(snap.snapshotDetails) : 'none');
              if (snap?.windows) {
                const titleMap = new Map<string, string>(entries as [string, string][]);
                for (const win of snap.windows) {
                  if (win?.layout?.content) {
                    patchLayoutContent(win.layout.content, titleMap);
                  }
                }
              }
            }
          } catch (e) {
            console.error('[updateSavedWorkspace] patch error:', e);
          }
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
          analyticsNats.publish({ source: 'Platform', type: 'Workspace', action: 'Delete',
            data: { workspaceId: id } }).catch(() => {});
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
         * Apply a snapshot, restoring any snap layout embedded in it.
         */
        async applySnapshot(payload: OpenFin.ApplySnapshotPayload, identity?: OpenFin.Identity): Promise<void> {
          // Extract custom titles from the snapshot BEFORE applying
          const titlesByName = new Map<string, string>();
          try {
            const snap = payload.snapshot as any;
            if (snap?.windows) {
              for (const win of snap.windows) {
                if (win?.layout?.content) {
                  collectTitlesFromLayout(win.layout.content, titlesByName);
                }
              }
            }
            console.log('[applySnapshot] titles from snapshot:', [...titlesByName.entries()]);
          } catch (e) { console.warn('[applySnapshot] error reading titles', e); }

          await snapService.prepareToApplySnapshot(payload);
          await super.applySnapshot(payload, identity);
          await snapService.applySnapshot(payload.snapshot);

          // After snapshot applied, match titles by tree-walk position
          if (titlesByName.size > 0) {
            // Collect titles in tree-walk order from the SNAPSHOT (has customData.viewTitle)
            const orderedTitles: (string | null)[] = [];
            try {
              const snap = payload.snapshot as any;
              if (snap?.windows) {
                for (const win of snap.windows) {
                  if (win?.layout?.content) {
                    collectFromLayout(win.layout.content, (cs) => cs.customData?.viewTitle || null, orderedTitles);
                  }
                }
              }
            } catch { /* ignore */ }
            console.log('[applySnapshot] orderedTitles from snapshot:', orderedTitles);

            setTimeout(async () => {
              try {
                // Collect NEW view names in the same tree-walk order from the LIVE layout
                const orderedViewNames: string[] = [];
                const appWindows = await fin.Application.getCurrentSync().getChildWindows();
                for (const win of appWindows) {
                  try {
                    const layout = fin.Platform.Layout.wrapSync(win.identity);
                    const config = await layout.getConfig() as any;
                    if (config?.content) {
                      collectFromLayout(config.content, (cs) => cs.name, orderedViewNames);
                    }
                  } catch (e) { console.warn('[applySnapshot] layout error', e); }
                }
                console.log('[applySnapshot] orderedViewNames from live:', orderedViewNames);

                // Match by position and apply
                const len = Math.min(orderedTitles.length, orderedViewNames.length);
                for (let i = 0; i < len; i++) {
                  const title = orderedTitles[i];
                  const viewName = orderedViewNames[i];
                  if (title && viewName) {
                    try {
                      const viewObj = fin.View.wrapSync({ uuid: fin.me.uuid, name: viewName });
                      await viewObj.executeJavaScript(`document.title = ${JSON.stringify(title)}`);
                      setViewTitle(viewName, title);
                      console.log('[applySnapshot] RESTORED', viewName, '→', title);
                    } catch (e) { console.warn('[applySnapshot] failed', viewName, e); }
                  }
                }
              } catch (e) { console.warn('[applySnapshot] error restoring titles', e); }
            }, 3000);
          }
        }

        /**
         * Override theme change to swap sun/moon icon after theme is applied.
         */
        async setSelectedScheme(schemeType: ColorSchemeOptionType): Promise<void> {
          await super.setSelectedScheme(schemeType);
          const isDark = schemeType === ColorSchemeOptionType.Dark;
          analyticsNats.publish({ source: 'Platform', type: 'Theme', action: 'Changed',
            value: isDark ? 'dark' : 'light' }).catch(() => {});
          const callback = getOnThemeChanged();
          if (callback) {
            await callback(schemeType);
          }
          // Broadcast theme change to all views
          try {
            const isDark = schemeType === ColorSchemeOptionType.Dark;
            await fin.InterApplicationBus.publish(THEME_CHANGED_TOPIC, { isDark });
          } catch (err) {
            logger.warn('Failed to broadcast theme change to views', err);
          }
        }

        /**
         * Override view creation to restore custom view titles from saved workspace.
         * The custom title is stored in view customData.viewTitle.
         */
        async createView(payload: any, callerIdentity: any): Promise<any> {
          console.log('[createView] customData:', payload?.opts?.customData, 'url:', payload?.opts?.url, 'name:', payload?.opts?.name,
            'target.customData:', payload?.target?.customData,
            'interop:', payload?.opts?.interop,
            'allOptsKeys:', payload?.opts ? Object.keys(payload.opts) : 'none');
          const view = await super.createView(payload, callerIdentity);
          try {
            const viewTitle = payload?.opts?.customData?.viewTitle
              || payload?.target?.customData?.viewTitle;
            const viewName = view?.identity?.name || view?.name || payload?.opts?.name || payload?.target?.name;
            const viewUuid = view?.identity?.uuid || view?.uuid || fin.me.uuid;
            console.log('[createView] viewTitle:', viewTitle, 'viewName:', viewName);
            if (viewTitle && viewName) {
              logger.info('Restoring custom view title', { viewTitle, viewName });
              setViewTitle(viewName, viewTitle);
              const viewObj = fin.View.wrapSync({ uuid: viewUuid, name: viewName });
              let done = false;
              const setTitle = async () => {
                if (done) return;
                try {
                  await viewObj.executeJavaScript(`document.title = ${JSON.stringify(viewTitle)}`);
                  console.log('[createView] Set document.title to', viewTitle);
                  done = true;
                } catch (e) { console.warn('[createView] Failed to set title', e); }
              };
              viewObj.once('page-title-updated' as any, () => setTimeout(setTitle, 50));
              setTimeout(setTitle, 1000);
              setTimeout(setTitle, 3000);
            }
          } catch (e) { console.warn('[createView] Error restoring title', e); }
          return view;
        }

        /**
         * Override getSnapshot to ensure custom view titles are captured in the snapshot.
         * OpenFin snapshots may not include runtime-updated customData from updateOptions,
         * so we re-read each view's current options and patch the snapshot.
         */
        async getSnapshot(...args: [undefined, OpenFin.ClientIdentity]): Promise<OpenFin.Snapshot> {
          const snapshot = await super.getSnapshot(...args);
          try {
            // Read the LIVE title of every view and build a name→title map
            const liveTitles = new Map<string, string>();
            const customTitles = getViewTitles();
            const app = fin.Application.getCurrentSync();
            const appWindows = await app.getChildWindows();
            console.log('[getSnapshot] childWindows count:', appWindows.length);
            for (const win of appWindows) {
              try {
                const views = await win.getCurrentViews();
                console.log('[getSnapshot] window', win.identity.name, 'views:', views.length);
                for (const v of views) {
                  try {
                    const info = await v.getInfo() as any;
                    const name = v.identity.name;
                    const stored = customTitles[name];
                    console.log('[getSnapshot] view', name, 'title:', info.title, 'stored:', stored);
                    if (stored) {
                      liveTitles.set(name, stored);
                    } else if (info.title) {
                      liveTitles.set(name, info.title);
                    }
                  } catch (e) { console.warn('[getSnapshot] view error', e); }
                }
              } catch (e) { console.warn('[getSnapshot] window error', e); }
            }
            console.log('[getSnapshot] liveTitles', [...liveTitles.entries()]);
            if (liveTitles.size > 0 && snapshot?.windows) {
              for (const win of snapshot.windows as any[]) {
                const layouts = win?.layout?.content;
                if (layouts) {
                  patchLayoutContent(layouts, liveTitles);
                }
              }
            }
          } catch (err) {
            logger.warn('Failed to patch snapshot with custom view titles', err);
          }
          return snapService.decorateSnapshot(snapshot);
        }

        /**
         * Add "Rename View" to the view tab right-click context menu.
         * The custom name is stored in view customData and persists across workspace save/restore.
         */
        async openViewTabContextMenu(req: any, callerIdentity: any): Promise<void> {
          const renameItem = {
            type: 'normal',
            label: 'Rename View',
            data: {
              type: 'Custom',
              action: { id: 'rename-view' },
            },
          };

          return super.openViewTabContextMenu({
            ...req,
            template: [
              renameItem,
              { type: 'separator' },
              ...req.template,
            ],
          }, callerIdentity);
        }
      }
      return new CustomWorkspacePlatformProvider() as WorkspacePlatformProvider;
    };
  }
}
