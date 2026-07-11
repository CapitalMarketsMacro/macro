import { Logger } from '@macro/logger';
import { resolveEnvConfigPath } from '../config-path';
import type { FavoritesStore } from '../favorites.service';
import { LocalStorageWorkspaceStorageClient } from './local-storage-client';
import { RestWorkspaceStorageClient } from './rest-storage-client';
import {
  LOCAL_STORAGE_ENVIRONMENT,
  resolveStorageEnvironment,
} from './storage-environment';
import type {
  ResolvedStorageEnvironment,
  StorageSettings,
  WorkspaceStorageClient,
} from './storage-types';

const logger = Logger.getLogger('WorkspaceStorageContext');

interface StorageContext {
  environment: ResolvedStorageEnvironment;
  client: WorkspaceStorageClient;
}

let context: StorageContext | null = null;
let initialized = false;
let markReady: (() => void) | null = null;
let readyPromise: Promise<void> | null = null;
const initListeners: Array<() => void> = [];

export interface InitWorkspaceStorageOptions {
  /** Query string override (defaults to `window.location.search`). */
  search?: string;
  /** Current-user supplier for user-scoped storage (REST `X-User-Id`, favorites keys). */
  getUserId?: () => Promise<string>;
}

/**
 * Initialize the platform-wide storage context from the settings.json `storage` block.
 * Called once during platform boot (after settings load, before anything persists);
 * everything else reaches the active backend through {@link getWorkspaceStorage}.
 * Re-initializing replaces the context (the platform restarts on environment change).
 */
export function initWorkspaceStorage(
  settings?: StorageSettings,
  options: InitWorkspaceStorageOptions = {},
): ResolvedStorageEnvironment {
  const environment = resolveStorageEnvironment(settings, options.search);
  context = {
    environment,
    client: createClient(environment, options.getUserId),
  };
  initialized = true;
  logger.info('Workspace storage initialized', {
    environment: environment.name,
    mode: environment.config.mode,
    baseUrl: environment.config.baseUrl,
  });
  markReady?.();
  markReady = null;
  for (const listener of [...initListeners]) {
    try {
      listener();
    } catch (error) {
      logger.warn('Storage-initialized listener failed', error);
    }
  }
  return environment;
}

/**
 * Run `listener` every time the storage context is (re)initialized — immediately as
 * well, when it already has been. Lets early hydrators (favorites) re-load from the
 * real backend even if they first ran against the pre-init fallback.
 */
export function onWorkspaceStorageInitialized(listener: () => void): void {
  initListeners.push(listener);
  if (initialized) listener();
}

/**
 * The active storage client. Before {@link initWorkspaceStorage} runs this falls back
 * to a local localStorage client, preserving pre-API behavior for non-platform hosts
 * (plain browser tabs, unit tests).
 */
export function getWorkspaceStorage(): WorkspaceStorageClient {
  if (!context) {
    context = {
      environment: LOCAL_STORAGE_ENVIRONMENT,
      client: new LocalStorageWorkspaceStorageClient(),
    };
  }
  return context.client;
}

/** The active environment (name + mode + baseUrl) — `local` until initialized. */
export function getActiveStorageEnvironment(): ResolvedStorageEnvironment {
  return context?.environment ?? LOCAL_STORAGE_ENVIRONMENT;
}

/**
 * Resolves when {@link initWorkspaceStorage} has run, or after `timeoutMs` as a
 * fail-open fallback (a host that never initializes storage — e.g. a view outside the
 * provider — just gets the default local client). Early hydrators (favorites) await
 * this so they can't race ahead of environment selection during boot.
 */
export function whenWorkspaceStorageReady(timeoutMs = 5000): Promise<void> {
  if (initialized) return Promise.resolve();
  if (!readyPromise) {
    readyPromise = new Promise<void>((resolve) => {
      markReady = resolve;
      setTimeout(resolve, timeoutMs);
    });
  }
  return readyPromise;
}

/**
 * Where a platform config file loads from: the storage service's `/config/*` endpoints
 * when the active environment is REST-backed (so storefront/dock/apps config is served
 * per environment by the API), else the static per-env public folder. `settings.json`
 * and `entitlements.json` deliberately do NOT go through this — they are bootstrap
 * config (they define the storage environments and the user identity) and always load
 * from the static folder.
 */
export function resolveConfigUrl(fileName: string): string {
  const { config } = getActiveStorageEnvironment();
  if (config.mode === 'rest' && config.baseUrl) {
    return `${config.baseUrl.replace(/\/+$/, '')}/config/${fileName.replace(/\.json$/, '')}`;
  }
  return resolveEnvConfigPath(fileName);
}

/**
 * {@link FavoritesStore} adapter over the unified storage client, so FavoritesService
 * rides the active backend. Waits for the context (bounded) — the service hydrates at
 * DI construction, which is earlier than environment selection during platform boot.
 * The `key` argument is ignored: user scoping is the client's job.
 *
 * Writes are gated on a prior successful load: favorites are persisted as the FULL
 * list, so saving from a cache that never hydrated (backend outage, or the fail-open
 * pre-init window) would silently wipe the user's stored favorites. Until a load has
 * succeeded against the initialized backend, saves are skipped with a warning — the
 * in-memory toggle survives and the next hydration re-syncs the view.
 */
export class ClientFavoritesStore implements FavoritesStore {
  private loadSucceeded = false;

  async load(_key: string): Promise<string[]> {
    await whenWorkspaceStorageReady();
    const ids = await getWorkspaceStorage().getFavorites();
    this.loadSucceeded = true;
    return ids;
  }

  async save(_key: string, ids: string[]): Promise<void> {
    if (!this.loadSucceeded) {
      logger.warn(
        'Skipping favorites persist — favorites were never successfully loaded from the active backend',
      );
      return;
    }
    return getWorkspaceStorage().saveFavorites(ids);
  }
}

/** Test-only: drop the context so specs can exercise initialization repeatedly. */
export function resetWorkspaceStorageForTests(): void {
  context = null;
  initialized = false;
  markReady = null;
  readyPromise = null;
  initListeners.length = 0;
}

function createClient(
  environment: ResolvedStorageEnvironment,
  getUserId?: () => Promise<string>,
): WorkspaceStorageClient {
  if (environment.config.mode === 'rest' && environment.config.baseUrl) {
    return new RestWorkspaceStorageClient({
      baseUrl: environment.config.baseUrl,
      getUserId,
    });
  }
  return new LocalStorageWorkspaceStorageClient(getUserId);
}
