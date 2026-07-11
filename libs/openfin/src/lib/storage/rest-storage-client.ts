import type { Page, Workspace } from '@openfin/workspace-platform';
import type { DockProviderConfigWithIdentity } from '@openfin/workspace';
import { Logger } from '@macro/logger';
import type {
  LobDockApp,
  LobStoreApp,
  WorkspaceStorageClient,
} from './storage-types';

const logger = Logger.getLogger('RestWorkspaceStorageClient');

export interface RestWorkspaceStorageClientOptions {
  /** Service base URL for the active environment, e.g. `http://localhost:3000/workspace/v1`. */
  baseUrl: string;
  /** Supplies the current user id, sent as the `X-User-Id` header on every request. */
  getUserId?: () => Promise<string>;
  /** Injectable fetch for tests / non-browser hosts (defaults to global fetch). */
  fetchFn?: typeof fetch;
  /** Per-request timeout in ms (default 10 000). */
  timeoutMs?: number;
}

/**
 * REST implementation of the unified {@link WorkspaceStorageClient}, speaking the
 * Workspace Storage API contract in `docs/api/workspace-storage-api.openapi.yaml`.
 * One service deployment per environment (DEV / UAT / PROD) — the environment is
 * selected purely by `baseUrl`, and the user by the `X-User-Id` header (interim scheme;
 * phase 2 replaces it with a real identity token, see the OpenAPI spec).
 *
 * Error contract: GETs of a single resource resolve `undefined` on 404; DELETEs treat
 * 404 as success (idempotent); everything else non-2xx throws, so callers decide
 * whether a failure is fatal (saves) or degradable (reads with fallbacks).
 */
export class RestWorkspaceStorageClient implements WorkspaceStorageClient {
  private readonly baseUrl: string;
  private readonly getUserId: () => Promise<string>;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;
  private cachedUserId?: string;

  constructor(options: RestWorkspaceStorageClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.getUserId = options.getUserId ?? (async () => 'anonymous');
    // Bind: a bare `fetch` reference invoked as `this.fetchFn(...)` loses its Window
    // receiver and throws "Illegal invocation" in browsers.
    this.fetchFn = options.fetchFn ?? fetch.bind(globalThis);
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  // ── workspaces ──

  async getWorkspaces(): Promise<Workspace[]> {
    return (await this.request<Workspace[]>('GET', '/workspaces')) ?? [];
  }

  async getWorkspace(workspaceId: string): Promise<Workspace | undefined> {
    return this.request<Workspace>(
      'GET',
      `/workspaces/${encodeURIComponent(workspaceId)}`,
    );
  }

  async saveWorkspace(workspace: Workspace): Promise<void> {
    await this.request(
      'PUT',
      `/workspaces/${encodeURIComponent(workspace.workspaceId)}`,
      workspace,
    );
  }

  async deleteWorkspace(workspaceId: string): Promise<void> {
    await this.request(
      'DELETE',
      `/workspaces/${encodeURIComponent(workspaceId)}`,
    );
  }

  // ── pages ──

  async getPages(): Promise<Page[]> {
    return (await this.request<Page[]>('GET', '/pages')) ?? [];
  }

  async getPage(pageId: string): Promise<Page | undefined> {
    return this.request<Page>('GET', `/pages/${encodeURIComponent(pageId)}`);
  }

  async savePage(page: Page): Promise<void> {
    await this.request(
      'PUT',
      `/pages/${encodeURIComponent(page.pageId)}`,
      page,
    );
  }

  async deletePage(pageId: string): Promise<void> {
    await this.request('DELETE', `/pages/${encodeURIComponent(pageId)}`);
  }

  // ── dock ──

  async getDockConfig(
    dockProviderId: string,
  ): Promise<DockProviderConfigWithIdentity | undefined> {
    return this.request<DockProviderConfigWithIdentity>(
      'GET',
      `/dock/${encodeURIComponent(dockProviderId)}`,
    );
  }

  async saveDockConfig(config: DockProviderConfigWithIdentity): Promise<void> {
    await this.request('PUT', `/dock/${encodeURIComponent(config.id)}`, config);
  }

  // ── favorites ──

  async getFavorites(): Promise<string[]> {
    const body = await this.request<{ appIds: string[] }>('GET', '/favorites');
    return body?.appIds ?? [];
  }

  async saveFavorites(appIds: string[]): Promise<void> {
    await this.request('PUT', '/favorites', { appIds });
  }

  // ── LOB dock apps (shared resource — GET only from the platform; LOBs PUT via the API) ──

  async getLobDockApps(): Promise<LobDockApp[]> {
    return (await this.request<LobDockApp[]>('GET', '/dock-apps')) ?? [];
  }

  async getLobStoreApps(): Promise<LobStoreApp[]> {
    return (await this.request<LobStoreApp[]>('GET', '/store-apps')) ?? [];
  }

  // ── preferences ──

  async getPreference<T>(key: string): Promise<T | undefined> {
    const body = await this.request<{ key: string; value: T }>(
      'GET',
      `/preferences/${encodeURIComponent(key)}`,
    );
    return body?.value;
  }

  async setPreference<T>(key: string, value: T): Promise<void> {
    await this.request('PUT', `/preferences/${encodeURIComponent(key)}`, {
      value,
    });
  }

  async deletePreference(key: string): Promise<void> {
    await this.request('DELETE', `/preferences/${encodeURIComponent(key)}`);
  }

  // ── internals ──

  private async request<T>(
    method: 'GET' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T | undefined> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchFn(url, {
        method,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'X-User-Id': await this.userId(),
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });

      if (response.status === 404 && method !== 'PUT') {
        // Missing single resource (GET) / already-gone resource (DELETE) — not an error.
        // A 404 on PUT is a misrouted baseUrl and MUST throw: resolving it would report
        // a save as successful while nothing was persisted.
        return undefined;
      }
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(
          `Workspace storage request failed: ${method} ${url} → HTTP ${response.status}${detail ? ` (${truncate(detail)})` : ''}`,
        );
      }
      if (response.status === 204) return undefined;
      return (await response.json()) as T;
    } catch (error) {
      logger.error('Workspace storage request error', {
        method,
        url,
        error: String(error),
      });
      throw error instanceof Error ? error : new Error(String(error));
    } finally {
      clearTimeout(timer);
    }
  }

  private async userId(): Promise<string> {
    if (this.cachedUserId === undefined) {
      try {
        this.cachedUserId = await this.getUserId();
      } catch {
        this.cachedUserId = 'anonymous';
      }
    }
    return this.cachedUserId;
  }
}

function truncate(text: string, max = 200): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
