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
});
