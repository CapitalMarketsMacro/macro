import { RestWorkspaceStorageClient } from './rest-storage-client';
import type { Workspace } from '@openfin/workspace-platform';

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

const makeResponse = (status: number, body?: unknown): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  }) as unknown as Response;

describe('RestWorkspaceStorageClient', () => {
  let fetchFn: jest.Mock;
  let client: RestWorkspaceStorageClient;

  beforeEach(() => {
    fetchFn = jest.fn().mockResolvedValue(makeResponse(200, []));
    client = new RestWorkspaceStorageClient({
      baseUrl: 'http://storage.test/workspace/v1/', // trailing slash must be tolerated
      getUserId: async () => 'u-001',
      fetchFn: fetchFn as unknown as typeof fetch,
    });
  });

  const lastCall = () => {
    const [url, init] = fetchFn.mock.calls[fetchFn.mock.calls.length - 1];
    return { url: url as string, init: init as RequestInit };
  };

  it('hits the workspaces collection with the X-User-Id header', async () => {
    await client.getWorkspaces();
    const { url, init } = lastCall();
    expect(url).toBe('http://storage.test/workspace/v1/workspaces');
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>)['X-User-Id']).toBe('u-001');
  });

  it('PUTs a workspace to its id with a JSON body', async () => {
    fetchFn.mockResolvedValue(makeResponse(201, { workspaceId: 'ws 1' }));
    const ws = {
      workspaceId: 'ws 1',
      title: 'T',
      snapshot: {},
    } as unknown as Workspace;
    await client.saveWorkspace(ws);

    const { url, init } = lastCall();
    expect(url).toBe('http://storage.test/workspace/v1/workspaces/ws%201');
    expect(init.method).toBe('PUT');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json',
    );
    expect(JSON.parse(init.body as string)).toEqual(ws);
  });

  it('treats 404 as undefined on single-resource GETs', async () => {
    fetchFn.mockResolvedValue(makeResponse(404, { title: 'Not Found' }));
    await expect(client.getWorkspace('missing')).resolves.toBeUndefined();
    await expect(client.getPage('missing')).resolves.toBeUndefined();
    await expect(client.getDockConfig('missing')).resolves.toBeUndefined();
    await expect(client.getPreference('missing')).resolves.toBeUndefined();
  });

  it('treats 404 as success on DELETEs (idempotent)', async () => {
    fetchFn.mockResolvedValue(makeResponse(404, { title: 'Not Found' }));
    await expect(client.deleteWorkspace('gone')).resolves.toBeUndefined();
    await expect(client.deletePage('gone')).resolves.toBeUndefined();
    await expect(client.deletePreference('gone')).resolves.toBeUndefined();
  });

  it('throws on 404 for PUTs — a misrouted baseUrl must never report saves as successful', async () => {
    fetchFn.mockResolvedValue(makeResponse(404, { title: 'Not Found' }));
    const ws = {
      workspaceId: 'w1',
      title: 'T',
      snapshot: {},
    } as unknown as Workspace;
    await expect(client.saveWorkspace(ws)).rejects.toThrow(/HTTP 404/);
    await expect(client.saveFavorites(['a'])).rejects.toThrow(/HTTP 404/);
    await expect(client.setPreference('k', 1)).rejects.toThrow(/HTTP 404/);
  });

  it('aborts a hanging request after timeoutMs', async () => {
    const hangingFetch = jest.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new Error('aborted')),
          );
        }),
    );
    client = new RestWorkspaceStorageClient({
      baseUrl: 'http://storage.test/workspace/v1',
      fetchFn: hangingFetch as unknown as typeof fetch,
      timeoutMs: 20,
    });
    await expect(client.getWorkspaces()).rejects.toThrow('aborted');
  });

  it('throws on non-2xx with status and detail in the message', async () => {
    fetchFn.mockResolvedValue(makeResponse(503, { title: 'down' }));
    await expect(client.getWorkspaces()).rejects.toThrow(/HTTP 503/);
  });

  it('unwraps the favorites envelope and round-trips saves', async () => {
    fetchFn.mockResolvedValue(makeResponse(200, { appIds: ['a', 'b'] }));
    await expect(client.getFavorites()).resolves.toEqual(['a', 'b']);

    fetchFn.mockResolvedValue(makeResponse(200, { appIds: ['a'] }));
    await client.saveFavorites(['a']);
    const { url, init } = lastCall();
    expect(url).toBe('http://storage.test/workspace/v1/favorites');
    expect(JSON.parse(init.body as string)).toEqual({ appIds: ['a'] });
  });

  it('unwraps the preference envelope and wraps values on write', async () => {
    fetchFn.mockResolvedValue(
      makeResponse(200, { key: 'theme-preset', value: 'default' }),
    );
    await expect(client.getPreference<string>('theme-preset')).resolves.toBe(
      'default',
    );

    fetchFn.mockResolvedValue(
      makeResponse(201, { key: 'view-titles', value: { v1: 'Blotter' } }),
    );
    await client.setPreference('view-titles', { v1: 'Blotter' });
    const { url, init } = lastCall();
    expect(url).toBe(
      'http://storage.test/workspace/v1/preferences/view-titles',
    );
    expect(JSON.parse(init.body as string)).toEqual({
      value: { v1: 'Blotter' },
    });
  });

  it('reads LOB dock apps from the shared /dock-apps collection', async () => {
    fetchFn.mockResolvedValue(
      makeResponse(200, [
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
    const { url, init } = lastCall();
    expect(url).toBe('http://storage.test/workspace/v1/dock-apps');
    expect(init.method).toBe('GET');
  });

  it('reads LOB store apps from the shared /store-apps collection', async () => {
    fetchFn.mockResolvedValue(
      makeResponse(200, [
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
    expect(lastCall().url).toBe('http://storage.test/workspace/v1/store-apps');
  });

  it('handles 204 responses without parsing a body', async () => {
    fetchFn.mockResolvedValue(makeResponse(204));
    await expect(client.deleteWorkspace('ws-1')).resolves.toBeUndefined();
  });

  it('falls back to anonymous when the user supplier fails', async () => {
    client = new RestWorkspaceStorageClient({
      baseUrl: 'http://storage.test/workspace/v1',
      getUserId: async () => {
        throw new Error('no identity');
      },
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    await client.getPages();
    expect(
      (lastCall().init.headers as Record<string, string>)['X-User-Id'],
    ).toBe('anonymous');
  });
});
