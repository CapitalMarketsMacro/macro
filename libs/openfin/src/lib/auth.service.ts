import { Logger } from '@macro/logger';
import type { EntitlementsConfig, User } from './types';

const logger = Logger.getLogger('AuthService');

/** Fallback identity when entitlements config is missing/unreachable. */
const ANONYMOUS: User = { id: 'anonymous', name: 'Anonymous', entitlements: [] };

/**
 * Authentication service — provides the current user identity.
 *
 * Default implementation is config/mock-driven: it loads the current user from
 * `entitlements.json#currentUser`. Designed as a pluggable seam — swap the injected
 * `httpClient`/`resolvePath` (or subclass) for a real OIDC/REST identity provider
 * without changing callers. Caches the loaded config so the file is fetched once.
 */
export class AuthService {
  private config: EntitlementsConfig | null = null;
  private loading: Promise<EntitlementsConfig> | null = null;

  constructor(
    private readonly httpClient: { get: <T>(url: string) => Promise<T> },
    private readonly resolvePath: () => string,
  ) {}

  /** Load (and cache) the entitlements config — the source of identity + app requirements. */
  async getEntitlementsConfig(): Promise<EntitlementsConfig> {
    if (this.config) return this.config;
    if (!this.loading) {
      this.loading = this.httpClient
        .get<EntitlementsConfig>(this.resolvePath())
        .then((cfg) => (this.config = cfg))
        .catch((error) => {
          logger.error('Failed to load entitlements config; defaulting to anonymous', error);
          return (this.config = { currentUser: ANONYMOUS, apps: {} });
        });
    }
    return this.loading;
  }

  /** The current authenticated user. */
  async getUser(): Promise<User> {
    const cfg = await this.getEntitlementsConfig();
    return cfg.currentUser ?? ANONYMOUS;
  }

  /** Synchronous access to the loaded user id (`'anonymous'` until {@link getUser} resolves). */
  getCurrentUserId(): string {
    return this.config?.currentUser?.id ?? ANONYMOUS.id;
  }
}
