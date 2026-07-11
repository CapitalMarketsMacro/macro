import { Logger } from '@macro/logger';
import type {
  ResolvedStorageEnvironment,
  StorageEnvironmentConfig,
  StorageSettings,
} from './storage-types';

const logger = Logger.getLogger('StorageEnvironment');

/** Query param on the provider URL that forces a storage environment (`?storageEnv=uat`). */
export const STORAGE_ENV_QUERY_PARAM = 'storageEnv';

/**
 * localStorage key holding the user's storage-environment choice from the provider UI.
 * This one deliberately stays in localStorage regardless of mode — it is the bootstrap
 * pointer that says WHERE storage lives, so it cannot itself live behind the API.
 */
export const STORAGE_ENV_CHOICE_KEY = 'macro:storage-env';

/** The always-available fallback environment: this machine's localStorage. */
export const LOCAL_STORAGE_ENVIRONMENT: ResolvedStorageEnvironment = {
  name: 'local',
  config: { mode: 'localStorage', label: 'Local (this machine)' },
};

/**
 * Resolve the active storage environment from settings + runtime context.
 * Precedence: `?storageEnv=` query param → saved user choice → `defaultEnvironment`
 * from settings.json → `local`. Invalid candidates (unknown name, or `rest` without a
 * `baseUrl`) are skipped with a warning so a bad config can never brick the boot —
 * the platform falls back to local localStorage.
 */
export function resolveStorageEnvironment(
  settings?: StorageSettings,
  search?: string,
): ResolvedStorageEnvironment {
  const environments: Record<string, StorageEnvironmentConfig> = {
    [LOCAL_STORAGE_ENVIRONMENT.name]: LOCAL_STORAGE_ENVIRONMENT.config,
    ...(settings?.environments ?? {}),
  };

  const candidates = [
    { source: 'query param', name: queryParamChoice(search) },
    { source: 'saved choice', name: getSavedStorageEnvironmentChoice() },
    { source: 'settings default', name: settings?.defaultEnvironment },
  ];

  for (const { source, name } of candidates) {
    if (!name) continue;
    const config = environments[name];
    if (!config) {
      logger.warn(
        `Storage environment "${name}" (${source}) is not defined in settings — skipping`,
      );
      continue;
    }
    if (config.mode === 'rest' && !config.baseUrl) {
      logger.warn(
        `Storage environment "${name}" (${source}) is mode "rest" but has no baseUrl — skipping`,
      );
      continue;
    }
    return { name, config };
  }
  return LOCAL_STORAGE_ENVIRONMENT;
}

/** All selectable environments (always includes `local`), for pickers. */
export function listStorageEnvironments(
  settings?: StorageSettings,
): ResolvedStorageEnvironment[] {
  const environments: Record<string, StorageEnvironmentConfig> = {
    [LOCAL_STORAGE_ENVIRONMENT.name]: LOCAL_STORAGE_ENVIRONMENT.config,
    ...(settings?.environments ?? {}),
  };
  return Object.entries(environments).map(([name, config]) => ({
    name,
    config,
  }));
}

/** The user's persisted environment choice from the provider UI, if any. */
export function getSavedStorageEnvironmentChoice(): string | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  try {
    return localStorage.getItem(STORAGE_ENV_CHOICE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Persist (or with `undefined`, clear) the environment choice; applied on next platform start. */
export function saveStorageEnvironmentChoice(name: string | undefined): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (name === undefined) {
      localStorage.removeItem(STORAGE_ENV_CHOICE_KEY);
    } else {
      localStorage.setItem(STORAGE_ENV_CHOICE_KEY, name);
    }
  } catch (error) {
    logger.error('Failed to persist storage environment choice', error);
  }
}

function queryParamChoice(search?: string): string | undefined {
  const source =
    search ?? (typeof window !== 'undefined' ? window.location.search : '');
  if (!source) return undefined;
  return new URLSearchParams(source).get(STORAGE_ENV_QUERY_PARAM) ?? undefined;
}
