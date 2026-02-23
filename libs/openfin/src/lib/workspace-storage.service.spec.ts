import { WorkspaceStorageService } from './workspace-storage.service';
import type { Workspace } from '@openfin/workspace-platform';

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

const STORAGE_KEY = 'workspace-platform-workspaces';
const LAST_SAVED_KEY = 'workspace-platform-last-saved';

const makeWorkspace = (id: string, title: string): Workspace =>
  ({ workspaceId: id, title } as Workspace);

describe('WorkspaceStorageService', () => {
  let service: WorkspaceStorageService;
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
    };

    service = new WorkspaceStorageService();
  });

  // ── getWorkspaces ──────────────────────────────────────────

  describe('getWorkspaces', () => {
    it('should return empty array when nothing is stored', async () => {
      const result = await service.getWorkspaces();
      expect(result).toEqual([]);
      expect(localStorage.getItem).toHaveBeenCalledWith(STORAGE_KEY);
    });

    it('should return parsed workspaces from storage', async () => {
      const workspaces = [makeWorkspace('1', 'WS1'), makeWorkspace('2', 'WS2')];
      store[STORAGE_KEY] = JSON.stringify(workspaces);

      const result = await service.getWorkspaces();
      expect(result).toEqual(workspaces);
    });

    it('should return empty array and log error on invalid JSON', async () => {
      store[STORAGE_KEY] = 'not-json';
      const result = await service.getWorkspaces();
      expect(result).toEqual([]);
    });
  });

  // ── saveWorkspaces ─────────────────────────────────────────

  describe('saveWorkspaces', () => {
    it('should serialize and store workspaces', async () => {
      const workspaces = [makeWorkspace('1', 'WS1')];
      await service.saveWorkspaces(workspaces);
      expect(localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify(workspaces),
      );
      expect(store[STORAGE_KEY]).toBe(JSON.stringify(workspaces));
    });

    it('should log error when setItem throws', async () => {
      (localStorage.setItem as jest.Mock).mockImplementation(() => {
        throw new Error('quota exceeded');
      });
      // Should not throw
      await expect(service.saveWorkspaces([])).resolves.toBeUndefined();
    });

    it('should overwrite existing workspaces', async () => {
      const ws1 = [makeWorkspace('1', 'WS1')];
      const ws2 = [makeWorkspace('2', 'WS2'), makeWorkspace('3', 'WS3')];

      await service.saveWorkspaces(ws1);
      await service.saveWorkspaces(ws2);

      const result = await service.getWorkspaces();
      expect(result).toEqual(ws2);
    });
  });

  // ── getLastSavedWorkspaceId ────────────────────────────────

  describe('getLastSavedWorkspaceId', () => {
    it('should return null when no id is stored', async () => {
      const result = await service.getLastSavedWorkspaceId();
      expect(result).toBeNull();
      expect(localStorage.getItem).toHaveBeenCalledWith(LAST_SAVED_KEY);
    });

    it('should return the stored id', async () => {
      store[LAST_SAVED_KEY] = 'ws-42';
      const result = await service.getLastSavedWorkspaceId();
      expect(result).toBe('ws-42');
    });
  });

  // ── setLastSavedWorkspaceId ────────────────────────────────

  describe('setLastSavedWorkspaceId', () => {
    it('should store the workspace id', async () => {
      await service.setLastSavedWorkspaceId('ws-99');
      expect(localStorage.setItem).toHaveBeenCalledWith(LAST_SAVED_KEY, 'ws-99');
      expect(store[LAST_SAVED_KEY]).toBe('ws-99');
    });
  });

  // ── removeLastSavedWorkspaceId ─────────────────────────────

  describe('removeLastSavedWorkspaceId', () => {
    it('should remove the stored id', async () => {
      store[LAST_SAVED_KEY] = 'ws-99';
      await service.removeLastSavedWorkspaceId();
      expect(localStorage.removeItem).toHaveBeenCalledWith(LAST_SAVED_KEY);
      expect(store[LAST_SAVED_KEY]).toBeUndefined();
    });
  });

  // ── round-trip ─────────────────────────────────────────────

  describe('round-trip', () => {
    it('should persist and retrieve workspaces end-to-end', async () => {
      const workspaces = [makeWorkspace('a', 'Alpha'), makeWorkspace('b', 'Beta')];
      await service.saveWorkspaces(workspaces);
      const result = await service.getWorkspaces();
      expect(result).toEqual(workspaces);
    });

    it('should persist and retrieve last saved id end-to-end', async () => {
      await service.setLastSavedWorkspaceId('a');
      expect(await service.getLastSavedWorkspaceId()).toBe('a');

      await service.removeLastSavedWorkspaceId();
      expect(await service.getLastSavedWorkspaceId()).toBeNull();
    });
  });
});
