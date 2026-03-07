import { firstValueFrom, take, toArray } from 'rxjs';
import { FavoritesService } from './favorites.service';

// Mock @macro/logger
jest.mock('@macro/logger', () => ({
  Logger: {
    getLogger: () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }),
  },
}));

const STORAGE_KEY = 'workspace-store-favorites';

describe('FavoritesService', () => {
  let service: FavoritesService;
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};

    // Mock localStorage since tests run in node environment
    (globalThis as any).localStorage = {
      getItem: jest.fn((key: string) => store[key] ?? null),
      setItem: jest.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: jest.fn((key: string) => {
        delete store[key];
      }),
      clear: jest.fn(() => {
        for (const key of Object.keys(store)) {
          delete store[key];
        }
      }),
    };

    service = new FavoritesService();
  });

  describe('loadFromStorage', () => {
    it('should return empty Set when nothing stored', () => {
      const ids = service.getFavoriteIds();
      expect(ids.size).toBe(0);
    });

    it('should load previously stored favorites', () => {
      store[STORAGE_KEY] = JSON.stringify(['app-1', 'app-2']);
      const fresh = new FavoritesService();
      expect(fresh.getFavoriteIds().size).toBe(2);
      expect(fresh.isFavorite('app-1')).toBe(true);
      expect(fresh.isFavorite('app-2')).toBe(true);
    });

    it('should gracefully handle corrupted localStorage data', () => {
      store[STORAGE_KEY] = '{invalid json';
      const fresh = new FavoritesService();
      expect(fresh.getFavoriteIds().size).toBe(0);
    });
  });

  describe('toggleFavorite', () => {
    it('should add an id on first toggle', () => {
      service.toggleFavorite('app-1');
      expect(service.isFavorite('app-1')).toBe(true);
    });

    it('should remove an id on second toggle', () => {
      service.toggleFavorite('app-1');
      service.toggleFavorite('app-1');
      expect(service.isFavorite('app-1')).toBe(false);
    });

    it('should persist to localStorage', () => {
      service.toggleFavorite('app-1');
      const stored = JSON.parse(store[STORAGE_KEY]);
      expect(stored).toEqual(['app-1']);
    });

    it('should remove from localStorage on second toggle', () => {
      service.toggleFavorite('app-1');
      service.toggleFavorite('app-1');
      const stored = JSON.parse(store[STORAGE_KEY]);
      expect(stored).toEqual([]);
    });
  });

  describe('isFavorite', () => {
    it('should return false for unknown id', () => {
      expect(service.isFavorite('unknown')).toBe(false);
    });

    it('should return true after adding', () => {
      service.toggleFavorite('app-1');
      expect(service.isFavorite('app-1')).toBe(true);
    });
  });

  describe('getFavoriteIds$', () => {
    it('should emit current value immediately', async () => {
      const ids = await firstValueFrom(service.getFavoriteIds$());
      expect(ids.size).toBe(0);
    });

    it('should emit on toggle', async () => {
      const promise = firstValueFrom(
        service.getFavoriteIds$().pipe(take(2), toArray())
      );

      service.toggleFavorite('app-1');

      const emissions = await promise;
      expect(emissions).toHaveLength(2);
      expect(emissions[0].size).toBe(0);
      expect(emissions[1].has('app-1')).toBe(true);
    });
  });
});
