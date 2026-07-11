import type { Page, Workspace } from '@openfin/workspace-platform';
import type { DockProviderConfigWithIdentity } from '@openfin/workspace';

/**
 * Unified Workspace Storage API — the single client-side contract for everything the
 * OpenFin platform persists per user: saved workspaces (list + layout snapshots), saved
 * pages, dock customization, store favorites, and small named preferences (theme preset,
 * view titles, last-saved workspace pointer, …).
 *
 * Two implementations ship today:
 * - {@link LocalStorageWorkspaceStorageClient} — browser localStorage, single machine,
 *   backward compatible with the pre-API storage keys ("local" mode).
 * - {@link RestWorkspaceStorageClient} — the Workspace Storage REST service
 *   (see docs/api/workspace-storage-api.openapi.yaml), one deployment per environment
 *   (DEV / UAT / PROD). Phase 2 backs this with Java Spring Boot + MongoDB.
 *
 * All methods are async and user-scoped: the client is constructed with a user-id
 * supplier; the REST client sends it as the `X-User-Id` header, the localStorage client
 * uses it where the legacy keys were already per-user (favorites).
 */
export interface WorkspaceStorageClient {
  // ── Saved workspaces (the "List of Workspaces" + their layout snapshots) ──
  /** All saved workspaces for the current user (full snapshots). */
  getWorkspaces(): Promise<Workspace[]>;
  /** One saved workspace by id, or undefined when it doesn't exist. */
  getWorkspace(workspaceId: string): Promise<Workspace | undefined>;
  /** Create-or-replace one saved workspace (upsert by `workspace.workspaceId`). */
  saveWorkspace(workspace: Workspace): Promise<void>;
  /** Delete one saved workspace; resolves even when the id doesn't exist. */
  deleteWorkspace(workspaceId: string): Promise<void>;

  // ── Saved pages (browser "Save Page") ──
  getPages(): Promise<Page[]>;
  getPage(pageId: string): Promise<Page | undefined>;
  /** Create-or-replace one saved page (upsert by `page.pageId`). */
  savePage(page: Page): Promise<void>;
  deletePage(pageId: string): Promise<void>;

  // ── Dock customization (user-arranged dock layout, keyed by dock provider id) ──
  getDockConfig(
    dockProviderId: string,
  ): Promise<DockProviderConfigWithIdentity | undefined>;
  saveDockConfig(config: DockProviderConfigWithIdentity): Promise<void>;

  // ── Store favorites ──
  getFavorites(): Promise<string[]>;
  saveFavorites(appIds: string[]): Promise<void>;

  // ── Named preferences (small JSON values; see WELL_KNOWN_PREFERENCES) ──
  getPreference<T>(key: string): Promise<T | undefined>;
  setPreference<T>(key: string, value: T): Promise<void>;
  deletePreference(key: string): Promise<void>;
}

/**
 * Well-known preference keys. Anything JSON-serializable can be stored under any key,
 * but these are the ones the platform itself uses — the localStorage client maps them
 * onto the legacy pre-API keys so existing user data survives the migration.
 */
export const WELL_KNOWN_PREFERENCES = {
  /** string — id of the workspace restored at startup (legacy key `workspace-platform-last-saved`). */
  lastSavedWorkspace: 'last-saved-workspace',
  /** string — active theme preset id (legacy key `workspace-theme-preset`). */
  themePreset: 'theme-preset',
  /** Record<viewName, title> — custom view tab titles (legacy key `macro:view-titles`). */
  viewTitles: 'view-titles',
} as const;

/** How a storage environment persists data. */
export type StorageMode = 'localStorage' | 'rest';

/**
 * One selectable storage environment. `local` is implicit and always available;
 * DEV / UAT / PROD entries point at that environment's Workspace Storage service.
 */
export interface StorageEnvironmentConfig {
  mode: StorageMode;
  /** Service base URL (e.g. `https://workspace-storage-uat.bank.com/workspace/v1`). Required for `rest`. */
  baseUrl?: string;
  /** Display label for pickers (defaults to the environment name). */
  label?: string;
}

/**
 * The `storage` block of settings.json — declares the selectable environments and
 * which one the platform boots with. Runtime precedence for the active environment:
 * `?storageEnv=` query param → user's saved choice → `defaultEnvironment` → `local`.
 */
export interface StorageSettings {
  defaultEnvironment?: string;
  environments?: Record<string, StorageEnvironmentConfig>;
}

/** The resolved active environment: its name plus its (validated) config. */
export interface ResolvedStorageEnvironment {
  name: string;
  config: StorageEnvironmentConfig;
}
