import { BehaviorSubject, Observable } from 'rxjs';
import { Logger } from '@macro/logger';

const STORAGE_KEY = 'workspace-store-favorites';
const logger = Logger.getLogger('FavoritesService');

/**
 * Service that manages store favorites persistence using localStorage.
 * Follows the same pattern as WorkspaceStorageService.
 */
export class FavoritesService {
  private readonly favoriteIds$ = new BehaviorSubject<Set<string>>(
    this.loadFromStorage()
  );

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
    this.saveToStorage(ids);
  }

  private loadFromStorage(): Set<string> {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  }

  private saveToStorage(ids: Set<string>): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
    } catch (error) {
      logger.error('Failed to save favorites', error);
    }
  }
}
