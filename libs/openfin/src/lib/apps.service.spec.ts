import { firstValueFrom } from 'rxjs';
import { AppsService } from './apps.service';

jest.mock('@macro/logger', () => ({
  Logger: { getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }) },
}));

const config = { apps: [{ appId: 'app-1', title: 'App One' }, { appId: 'app-2', title: 'App Two' }] };

describe('AppsService', () => {
  it('returns empty before load()', () => {
    const service = new AppsService({ get: jest.fn().mockResolvedValue(config) }, () => '/local/apps.json');
    expect(service.getApps()).toEqual([]);
  });

  it('loads + caches the app registry', async () => {
    const http = { get: jest.fn().mockResolvedValue(config) };
    const service = new AppsService(http, () => '/local/apps.json');
    const apps = await service.load();
    expect(apps).toHaveLength(2);
    expect(service.getApps()).toEqual(config.apps);
    await service.ensureLoaded();
    expect(http.get).toHaveBeenCalledTimes(1); // cached
  });

  it('emits via getApps$ after load', async () => {
    const service = new AppsService({ get: jest.fn().mockResolvedValue(config) }, () => '/x');
    await service.load();
    expect(await firstValueFrom(service.getApps$())).toEqual(config.apps);
  });

  it('falls back to empty on fetch error', async () => {
    const service = new AppsService({ get: jest.fn().mockRejectedValue(new Error('404')) }, () => '/x');
    expect(await service.load()).toEqual([]);
    expect(service.getApps()).toEqual([]);
  });

  describe('LOB store apps merge', () => {
    const lobApp = (over: Record<string, unknown> = {}) => ({
      appId: 'lob-rates-analytics',
      title: 'Rates Analytics',
      manifest: 'http://lob/rates.fin.json',
      manifestType: 'view',
      icons: [{ src: 'http://lob/i.svg' }],
      lob: 'Rates',
      ...over,
    });
    const build = (lobApps: unknown[], reject = false) =>
      new AppsService(
        { get: jest.fn().mockResolvedValue(config) },
        () => '/x',
        {
          getLobStoreApps: reject
            ? jest.fn().mockRejectedValue(new Error('down'))
            : jest.fn().mockResolvedValue(lobApps),
        } as any,
      );

    it('appends LOB apps after the registry with the lob tag forced and publisher defaulted', async () => {
      const apps = await build([lobApp({ tags: ['analytics'] })]).load();
      expect(apps).toHaveLength(3);
      const lob = apps[2] as any;
      expect(lob.appId).toBe('lob-rates-analytics');
      expect(lob.tags).toEqual(['analytics', 'lob']);
      expect(lob.publisher).toBe('Rates'); // falls back to lob when publisher omitted
      expect(lob.name).toBe('lob-rates-analytics');
    });

    it('registry wins on appId collisions', async () => {
      const apps = await build([lobApp({ appId: 'app-1', title: 'Impostor' })]).load();
      expect(apps).toHaveLength(2);
      expect((apps[0] as any).title).toBe('App One');
    });

    it('orders LOB apps by sortOrder (undefined last) and skips malformed entries', async () => {
      const apps = await build([
        lobApp({ appId: 'z-noorder', title: 'Z' }),
        lobApp({ appId: 'b-second', title: 'B', sortOrder: 2 }),
        lobApp({ appId: 'a-first', title: 'A', sortOrder: 1 }),
        { appId: '', title: 'broken' },
      ]).load();
      expect(apps.slice(2).map((a) => a.appId)).toEqual(['a-first', 'b-second', 'z-noorder']);
    });

    it('degrades to registry-only when the storage read fails', async () => {
      const apps = await build([], true).load();
      expect(apps).toEqual(config.apps);
    });
  });
});
