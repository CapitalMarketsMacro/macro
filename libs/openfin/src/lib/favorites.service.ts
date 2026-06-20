import { BehaviorSubject, Observable } from 'rxjs';
import { Logger } from '@macro/logger';
import type { AuthService } from './auth.service';

const KEY_PREFIX = 'workspace-store-favorites';
const logger = Logger.getLogger('FavoritesService');

/**
 * Pluggable favorites persistence. Default is localStorage; swap for a REST backend
 * without changing callers (same idea as WorkspaceStorageService).
 */
export interface FavoritesStore {
  load(key: string): Promise<string[]>;
  save(key: string, ids: string[]): Promise<void>;
}

/** Default localStorage-backed favorites store. */
export class LocalStorageFavoritesStore implements FavoritesStore {
  async load(key: string): Promise<string[]> {
    try {
      const stored = localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as string[]) : [];
    } catch {
      return [];
    }
  }

  async save(key: string, ids: string[]): Promise<void> {
    try {
      localStorage.setItem(key, JSON.stringify(ids));
    } catch (error) {
      logger.error('Failed to save favorites', error);
    }
  }
}

/**
 * Manages per-user store favorites with pluggable persistence.
 *
 * Keeps a synchronous in-memory cache (BehaviorSubject) so the storefront can read
 * favorites synchronously; persistence is keyed **per user** (`workspace-store-favorites:<userId>`)
 * and routed through an injectable {@link FavoritesStore}. Hydrated on construction
 * (resolving the user via AuthService); written through on every toggle so favorites
 * survive a platform restart.
 */
export class FavoritesService {
  private readonly favoriteIds$ = new BehaviorSubject<Set<string>>(new Set());
  private userId = 'anonymous';

  constructor(
    private readonly store: FavoritesStore = new LocalStorageFavoritesStore(),
    private readonly authService?: AuthService,
  ) {}

  /** Resolve the current user and load their persisted favorites into the cache. */
  async hydrate(): Promise<void> {
    try {
      if (this.authService) {
        this.userId = (await this.authService.getUser()).id;
      }
      const ids = await this.store.load(this.storageKey());
      this.favoriteIds$.next(new Set(ids));
    } catch (error) {
      logger.error('Failed to hydrate favorites', error);
    }
  }

  private storageKey(): string {
    return `${KEY_PREFIX}:${this.userId}`;
  }

  getFavoriteIds$(): Observable<Set<string>> {
    return this.favoriteIds$.asObservable();
  }

  getFavoriteIds(): Set<string> {
    return this.favoriteIds$.getValue();
  }

  isFavorite(appId: string): boolean {
    return this.favoriteIds$.getValue().has(appId);
  }

  toggleFavorite(appId: string): void {
    const ids = new Set(this.favoriteIds$.getValue());
    if (ids.has(appId)) {
      ids.delete(appId);
    } else {
      ids.add(appId);
    }
    this.favoriteIds$.next(ids);
    void this.store.save(this.storageKey(), [...ids]);
  }
}
