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

  // ── LOB dock apps (SHARED across users — read-only from the workspace side) ──
  /**
   * Custom dock apps published by lines of business through the storage API
   * (`PUT /dock-apps/{id}` — Postman/curl/LOB tooling; the platform only reads).
   * Rendered into the dock at init: `icon` → a dock button, `dropdown` → a dock
   * folder whose children come from the entry itself.
   */
  getLobDockApps(): Promise<LobDockApp[]>;

  // ── LOB store apps (SHARED across users — read-only from the workspace side) ──
  /**
   * Full store apps published by lines of business (`PUT /store-apps/{appId}`).
   * Merged into the app registry at load: they appear in the Storefront (with an
   * app-details page fed by description/images/support fields), Home search, and
   * are launchable per their `manifestType` (`view` → embedded view, `manifest` →
   * another platform). Registry apps win on `appId` collisions.
   */
  getLobStoreApps(): Promise<LobStoreApp[]>;
}

/**
 * A full store app published by a line of business via the Workspace Storage API —
 * everything the Storefront needs: card icon, app-details screenshots, support
 * contacts, and the launch manifest.
 */
export interface LobStoreApp {
  /** Unique app id. Registry (apps.json) apps win on collisions. */
  appId: string;
  title: string;
  /** Shown on the card and the app-details page. */
  description?: string;
  /** Manifest URL — a view manifest (`view`) or a platform manifest (`manifest`). */
  manifest: string;
  manifestType: 'view' | 'manifest';
  /** Store card icon(s) — at least one required. */
  icons: Array<{ src: string }>;
  /** Screenshots for the app-details page. */
  images?: Array<{ src: string }>;
  /** Details-page fields. `publisher` defaults to `lob` when omitted. */
  publisher?: string;
  contactEmail?: string;
  supportEmail?: string;
  /**
   * Extra tags — route the app into matching business-area nav items
   * case-insensitively (e.g. `rates` → the Rates item); the platform additionally
   * force-adds a `lob` tag as metadata.
   */
  tags?: string[];
  /**
   * Storefront business-area category (FX / Rates / Commodities / Risk / Spread /
   * Middle Office). Optional — a matching tag works too; apps with neither still
   * appear under All Apps and in Home search.
   */
  category?: string;
  /** Owning line of business, e.g. "Rates". */
  lob?: string;
  /** Ordering among LOB store apps (ascending; undefined last; stable). */
  sortOrder?: number;
}

/** One child launcher inside a `dropdown` LOB dock app. */
export interface LobDockAppChild {
  id: string;
  label: string;
  /** URL opened as a platform view when clicked. */
  url: string;
  /** Optional icon (falls back to the parent's `iconUrl`). */
  iconUrl?: string;
}

/**
 * A custom dock app published by a line of business via the Workspace Storage API.
 * Minimum config: an icon URL and a URL to launch the view. `icon` renders as a
 * single dock button; `dropdown` renders as a dock folder of child launchers.
 */
export interface LobDockApp {
  id: string;
  label: string;
  /** Dock button icon (required by contract). */
  iconUrl: string;
  type: 'icon' | 'dropdown';
  /** View URL — required when `type` is `icon`. */
  url?: string;
  /** Child launchers — required (non-empty) when `type` is `dropdown`. */
  children?: LobDockAppChild[];
  /**
   * RESERVED — accepted and stored, but not currently rendered: Dock 3.0 entries
   * have no hover-text field, so the dock shows the label. Kept in the contract so
   * publishers don't have to migrate when the SDK grows tooltip support.
   */
  tooltip?: string;
  /** Owning line of business, e.g. "Rates" — used for grouping in the content menu. */
  lob?: string;
  /** Ordering among LOB entries appended to the dock (ascending; stable for ties). */
  sortOrder?: number;
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
  /** string[] — appIds the user pinned to the dock from the Storefront. */
  dockPinnedApps: 'dock-pinned-apps',
  /** string[] — content-menu entry ids the user bookmarked (starred) onto the dock bar. */
  dockBookmarks: 'dock-bookmarks',
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
