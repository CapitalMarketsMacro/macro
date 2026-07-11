import type OpenFin from '@openfin/core';
import type {
  AnalyticsEvent,
  ApplyWorkspacePayload,
  CreateSavedPageRequest,
  CreateSavedWorkspaceRequest,
  Page,
  UpdateSavedPageRequest,
  UpdateSavedWorkspaceRequest,
  Workspace,
  WorkspacePlatformOverrideCallback,
  WorkspacePlatformProvider,
} from '@openfin/workspace-platform';
import type { DockProviderConfigWithIdentity } from '@openfin/workspace';
import { ColorSchemeOptionType } from '@openfin/workspace-platform';
import { Logger } from '@macro/logger';
import { WorkspaceStorageService } from './workspace-storage.service';
import { SnapService } from './snap.service';
import { getAnalyticsNats } from './analytics-nats.service';
import { getWorkspaceStorage } from './storage/storage-context';
import { WELL_KNOWN_PREFERENCES } from './storage/storage-types';

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
 * - getSavedPages/getSavedPage/createSavedPage/updateSavedPage/deleteSavedPage: Page storage
 *   (unified storage backend, with one-time migration from the platform default storage)
 * - getDockProviderConfig/saveDockProviderConfig: Dock customization storage
 * - applyWorkspace: Workspace application
 *
 * Additional methods that can be overridden (not yet implemented):
 * - Page Management (beyond storage):
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
 * - Localization:
 *   - getLanguage(): Promise<Locale>
 *   - setLanguage(locale: Locale): Promise<void>
 */
const FLUSH_TOPIC = 'workspace:flush-view-state';
const FLUSH_DELAY_MS = 200;

export const THEME_CHANGED_TOPIC = 'workspace:theme-changed';

const VIEW_TITLES_KEY = 'macro:view-titles';

const viewTitlesLogger = Logger.getLogger('ViewTitles');

/**
 * View titles are read synchronously deep inside snapshot capture/patch paths, so they
 * live in an in-memory cache backed by the unified storage client: hydrated at boot,
 * written through (fire-and-forget) on every change. The legacy localStorage key is the
 * synchronous fallback for hosts that never hydrate (plain browser tabs, tests) — in
 * "local" storage mode it is also exactly where the client persists the preference.
 */
let viewTitlesCache: Record<string, string> | null = null;
let viewTitlesHydrateFailed = false;

function readLegacyViewTitles(): Record<string, string> {
  try {
    // Gracefully no-op outside the browser (e.g. Node-environment tests) — repo convention.
    if (typeof localStorage === 'undefined') return {};
    return JSON.parse(localStorage.getItem(VIEW_TITLES_KEY) || '{}');
  } catch { return {}; }
}

/**
 * Load custom view titles from the active storage backend into the sync cache.
 * Called once during platform boot, after `initWorkspaceStorage()`. Titles set before
 * hydration (unlikely, but possible during a slow boot) win over stored ones.
 *
 * On failure the cache is seeded EMPTY (not from the machine-local legacy key): in
 * REST mode the legacy titles belong to a different backend, and a later persist of a
 * legacy-seeded map would overwrite the environment's stored titles. The failure is
 * remembered so the next persist merge-reads the backend first.
 */
export async function hydrateViewTitles(): Promise<void> {
  try {
    const stored = await getWorkspaceStorage().getPreference<Record<string, string>>(WELL_KNOWN_PREFERENCES.viewTitles);
    viewTitlesCache = { ...(stored ?? {}), ...(viewTitlesCache ?? {}) };
    viewTitlesHydrateFailed = false;
  } catch (error) {
    viewTitlesLogger.warn('Failed to hydrate view titles from storage — titles unavailable until storage recovers', error);
    viewTitlesHydrateFailed = true;
    viewTitlesCache ??= {};
  }
}

/** Called by the rename-view action to register a custom title. */
export function setViewTitle(viewName: string, title: string): void {
  const titles = { ...(viewTitlesCache ?? readLegacyViewTitles()), [viewName]: title };
  viewTitlesCache = titles;
  void persistViewTitles();
}

async function persistViewTitles(): Promise<void> {
  try {
    if (viewTitlesHydrateFailed) {
      // Boot hydration failed, so the cache may be missing the backend's titles —
      // merge-read before writing the full map, or a recovered backend gets wiped.
      const stored = await getWorkspaceStorage().getPreference<Record<string, string>>(WELL_KNOWN_PREFERENCES.viewTitles);
      viewTitlesCache = { ...(stored ?? {}), ...(viewTitlesCache ?? {}) };
      viewTitlesHydrateFailed = false;
    }
    await getWorkspaceStorage().setPreference(WELL_KNOWN_PREFERENCES.viewTitles, viewTitlesCache ?? {});
  } catch (error) {
    viewTitlesLogger.error('Failed to persist view titles', error);
  }
}

/** Get all custom view titles. */
export function getViewTitles(): Record<string, string> {
  viewTitlesCache ??= readLegacyViewTitles();
  return viewTitlesCache;
}

/** Test-only: drop the in-memory view-title cache. */
export function resetViewTitlesForTests(): void {
  viewTitlesCache = null;
  viewTitlesHydrateFailed = false;
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
       * One-time import of pages from the platform's DEFAULT storage (per-machine
       * IndexedDB) into the unified backend, so pages saved before this override
       * existed keep appearing. Guarded per boot AND by a persisted flag per backend,
       * so it never re-imports pages the user has since deleted. The flag is read via
       * the RAW client (which throws) rather than the degrading facade: an unreadable
       * flag means the migration state is UNKNOWN, and importing then could resurrect
       * pages the user deleted — so the attempt aborts instead.
       */
      const PAGES_MIGRATED_PREF = 'pages-migrated';
      let pagesMigrationChecked = false;
      async function migrateLegacyPagesOnce(loadDefaultPages: () => Promise<Page[] | undefined>): Promise<Page[] | null> {
        if (pagesMigrationChecked) return null;
        pagesMigrationChecked = true;
        try {
          const alreadyMigrated = await getWorkspaceStorage().getPreference<boolean>(PAGES_MIGRATED_PREF);
          if (alreadyMigrated) return null;
          const legacyPages = (await loadDefaultPages()) ?? [];
          for (const page of legacyPages) {
            await storageService.savePage(page);
          }
          await storageService.setPreference(PAGES_MIGRATED_PREF, true);
          if (legacyPages.length > 0) {
            logger.info(`Migrated ${legacyPages.length} page(s) from platform default storage`);
          }
          return legacyPages;
        } catch (error) {
          logger.warn('Page migration from platform default storage failed', error);
          return null;
        }
      }

      /**
       * Any explicit page save marks the backend as past migration: once the user has
       * written pages of their own, a later empty page list (e.g. after delete-all)
       * must never re-import stale legacy pages over their intent.
       */
      function markPagesMigrated(): void {
        pagesMigrationChecked = true;
        storageService
          .setPreference(PAGES_MIGRATED_PREF, true)
          .catch((error) => logger.warn('Failed to persist pages-migrated flag', error));
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
          if (item.type === 'component' && item.componentState?.name) {
            const title = titleMap.get(item.componentState.name);
            if (title) {
              item.title = title;
              item.componentState.title = title;
              item.componentState.customData = { ...item.componentState.customData, viewTitle: title };
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
          const workspace = await storageService.getWorkspace(id);
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
          await storageService.saveWorkspace(req.workspace);
          await storageService.setLastSavedWorkspaceId(req.workspace.workspaceId);
          logger.info('Workspace created successfully', { workspaceId: req.workspace.workspaceId });
        }

        /**
         * Update an existing workspace in storage (upsert — a missing id becomes a create).
         * @param req The update workspace request
         */
        async updateSavedWorkspace(req: UpdateSavedWorkspaceRequest): Promise<void> {
          await flushViewStatesAndRecapture(req.workspace);
          patchWorkspaceWithTitles(req.workspace);
          logger.info('Updating saved workspace', { workspaceId: req.workspaceId, title: req.workspace.title });
          await storageService.saveWorkspace(req.workspace);
          await storageService.setLastSavedWorkspaceId(req.workspaceId);
          logger.info('Workspace updated successfully', { workspaceId: req.workspaceId });
        }

        /**
         * Delete a workspace from storage.
         * @param id The workspace ID to delete
         */
        async deleteSavedWorkspace(id: string): Promise<void> {
          logger.info('Deleting saved workspace', { workspaceId: id });
          analyticsNats.publish({ source: 'Platform', type: 'Workspace', action: 'Delete',
            data: { workspaceId: id } }).catch(() => {});
          await storageService.deleteWorkspace(id);
          const lastSavedId = await storageService.getLastSavedWorkspaceId();
          if (lastSavedId === id) {
            await storageService.removeLastSavedWorkspaceId();
            logger.info('Removed last saved workspace reference', { workspaceId: id });
          }
          logger.info('Workspace deleted successfully', { workspaceId: id });
        }

        /**
         * Get all saved pages from unified storage (browser "Save Page"). Previously the
         * platform's DEFAULT storage (per-machine IndexedDB) held these; on first read of
         * an empty backend, any legacy default-storage pages are migrated in once.
         */
        async getSavedPages(query?: string): Promise<Page[]> {
          try {
            let pages = await storageService.getPages();
            if (pages.length === 0) {
              const migrated = await migrateLegacyPagesOnce(() => super.getSavedPages());
              if (migrated) pages = migrated;
            }
            if (!query) return pages;
            const lowerQuery = query.toLowerCase();
            return pages.filter(
              (page) => page.title.toLowerCase().includes(lowerQuery) || page.pageId.toLowerCase().includes(lowerQuery),
            );
          } catch (error) {
            logger.error('Failed to get saved pages', error);
            return [];
          }
        }

        async getSavedPage(id: string): Promise<Page | undefined> {
          const page = await storageService.getPage(id);
          if (page) return page;
          // Cover the not-yet-migrated case (backend empty, legacy page opened directly).
          await this.getSavedPages();
          return storageService.getPage(id);
        }

        async createSavedPage(req: CreateSavedPageRequest): Promise<void> {
          logger.info('Creating saved page', { pageId: req.page.pageId, title: req.page.title });
          await storageService.savePage(req.page);
          markPagesMigrated();
        }

        async updateSavedPage(req: UpdateSavedPageRequest): Promise<void> {
          logger.info('Updating saved page', { pageId: req.pageId, title: req.page.title });
          await storageService.savePage(req.page);
          markPagesMigrated();
        }

        async deleteSavedPage(id: string): Promise<void> {
          logger.info('Deleting saved page', { pageId: id });
          await storageService.deletePage(id);
        }

        /**
         * Dock customization (user-arranged dock) from unified storage; falls back to the
         * platform default storage so a pre-migration customization still applies.
         */
        async getDockProviderConfig(id: string): Promise<DockProviderConfigWithIdentity | undefined> {
          const stored = await storageService.getDockConfig(id);
          if (stored) return stored;
          return super.getDockProviderConfig(id);
        }

        async saveDockProviderConfig(config: DockProviderConfigWithIdentity): Promise<void> {
          logger.info('Saving dock provider config', { dockProviderId: config.id });
          await storageService.saveDockConfig(config);
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
          } catch (e) { logger.warn('applySnapshot: error reading titles from snapshot', e); }

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
                  } catch (e) { logger.warn('applySnapshot: layout error', e); }
                }

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
                    } catch (e) { logger.warn('applySnapshot: failed restoring view title', { viewName, e }); }
                  }
                }
              } catch (e) { logger.warn('applySnapshot: error restoring titles', e); }
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
          const view = await super.createView(payload, callerIdentity);
          try {
            const viewTitle = payload?.opts?.customData?.viewTitle
              || payload?.target?.customData?.viewTitle;
            const viewName = view?.identity?.name || view?.name || payload?.opts?.name || payload?.target?.name;
            const viewUuid = view?.identity?.uuid || view?.uuid || fin.me.uuid;
            if (viewTitle && viewName) {
              logger.info('Restoring custom view title', { viewTitle, viewName });
              setViewTitle(viewName, viewTitle);
              const viewObj = fin.View.wrapSync({ uuid: viewUuid, name: viewName });
              let done = false;
              const setTitle = async () => {
                if (done) return;
                try {
                  await viewObj.executeJavaScript(`document.title = ${JSON.stringify(viewTitle)}`);
                  done = true;
                } catch (e) { logger.warn('createView: failed to set restored view title', e); }
              };
              viewObj.once('page-title-updated' as any, () => setTimeout(setTitle, 50));
              setTimeout(setTitle, 1000);
              setTimeout(setTitle, 3000);
            }
          } catch (e) { logger.warn('createView: error restoring view title', e); }
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
            for (const win of appWindows) {
              try {
                const views = await win.getCurrentViews();
                for (const v of views) {
                  try {
                    const info = await v.getInfo() as any;
                    const name = v.identity.name;
                    const stored = customTitles[name];
                    if (stored) {
                      liveTitles.set(name, stored);
                    } else if (info.title) {
                      liveTitles.set(name, info.title);
                    }
                  } catch (e) { logger.warn('getSnapshot: view error', e); }
                }
              } catch (e) { logger.warn('getSnapshot: window error', e); }
            }
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
