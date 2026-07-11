import { LocalStorageWorkspaceStorageClient } from './local-storage-client';
import { WELL_KNOWN_PREFERENCES } from './storage-types';

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

describe('LocalStorageWorkspaceStorageClient', () => {
  let client: LocalStorageWorkspaceStorageClient;

  beforeEach(() => {
    // Tests run in a node environment — provide the browser localStorage (repo convention).
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
    };
    client = new LocalStorageWorkspaceStorageClient(async () => 'u-001');
  });

  describe('well-known preference key mapping (pre-API data survives)', () => {
    it('reads a legacy bare-string theme preset', async () => {
      localStorage.setItem('workspace-theme-preset', 'midnight-trader');
      await expect(
        client.getPreference<string>(WELL_KNOWN_PREFERENCES.themePreset),
      ).resolves.toBe('midnight-trader');
    });

    it('writes the theme preset back to the legacy key (JSON-wrapped, still readable)', async () => {
      await client.setPreference(
        WELL_KNOWN_PREFERENCES.themePreset,
        'executive-blue',
      );
      expect(localStorage.getItem('workspace-theme-preset')).toBe(
        JSON.stringify('executive-blue'),
      );
      await expect(
        client.getPreference<string>(WELL_KNOWN_PREFERENCES.themePreset),
      ).resolves.toBe('executive-blue');
    });

    it('maps last-saved-workspace onto workspace-platform-last-saved', async () => {
      localStorage.setItem('workspace-platform-last-saved', 'ws-7'); // legacy bare string
      await expect(
        client.getPreference<string>(WELL_KNOWN_PREFERENCES.lastSavedWorkspace),
      ).resolves.toBe('ws-7');

      await client.deletePreference(WELL_KNOWN_PREFERENCES.lastSavedWorkspace);
      expect(localStorage.getItem('workspace-platform-last-saved')).toBeNull();
    });

    it('maps view-titles onto macro:view-titles', async () => {
      localStorage.setItem(
        'macro:view-titles',
        JSON.stringify({ 'view-1': 'My Blotter' }),
      );
      await expect(
        client.getPreference(WELL_KNOWN_PREFERENCES.viewTitles),
      ).resolves.toEqual({ 'view-1': 'My Blotter' });
    });

    it('namespaces unknown preference keys under macro:pref', async () => {
      await client.setPreference('pages-migrated', true);
      expect(localStorage.getItem('macro:pref:pages-migrated')).toBe('true');
    });
  });

  describe('favorites', () => {
    it('keeps the per-user legacy key format', async () => {
      await client.saveFavorites(['app-a']);
      expect(localStorage.getItem('workspace-store-favorites:u-001')).toBe(
        JSON.stringify(['app-a']),
      );
      await expect(client.getFavorites()).resolves.toEqual(['app-a']);
    });

    it('falls back to anonymous when the user supplier fails', async () => {
      const failing = new LocalStorageWorkspaceStorageClient(async () => {
        throw new Error('no auth');
      });
      await failing.saveFavorites(['x']);
      expect(localStorage.getItem('workspace-store-favorites:anonymous')).toBe(
        JSON.stringify(['x']),
      );
    });
  });

  describe('LOB dock apps', () => {
    it('reads the shared workspace-lob-dock-apps key (empty when unset)', async () => {
      await expect(client.getLobDockApps()).resolves.toEqual([]);
      localStorage.setItem(
        'workspace-lob-dock-apps',
        JSON.stringify([
          {
            id: 'lob-a',
            label: 'A',
            iconUrl: 'http://x/a.svg',
            type: 'icon',
            url: 'http://x/a',
          },
        ]),
      );
      const apps = await client.getLobDockApps();
      expect(apps).toHaveLength(1);
      expect(apps[0].id).toBe('lob-a');
    });
  });

  describe('LOB store apps', () => {
    it('reads the shared workspace-lob-store-apps key (empty when unset)', async () => {
      await expect(client.getLobStoreApps()).resolves.toEqual([]);
      localStorage.setItem(
        'workspace-lob-store-apps',
        JSON.stringify([
          {
            appId: 'lob-a',
            title: 'A',
            manifest: 'http://x/a.fin.json',
            manifestType: 'view',
            icons: [{ src: 'http://x/a.svg' }],
          },
        ]),
      );
      const apps = await client.getLobStoreApps();
      expect(apps).toHaveLength(1);
      expect(apps[0].appId).toBe('lob-a');
    });
  });

  describe('dock config', () => {
    it('stores one entry per dock provider id', async () => {
      await client.saveDockConfig({ id: 'dock-a', buttons: [] } as never);
      await client.saveDockConfig({ id: 'dock-b', buttons: [{}] } as never);
      await expect(client.getDockConfig('dock-a')).resolves.toEqual({
        id: 'dock-a',
        buttons: [],
      });
      await expect(client.getDockConfig('dock-b')).resolves.toEqual({
        id: 'dock-b',
        buttons: [{}],
      });
      await expect(client.getDockConfig('dock-c')).resolves.toBeUndefined();
    });
  });
});
