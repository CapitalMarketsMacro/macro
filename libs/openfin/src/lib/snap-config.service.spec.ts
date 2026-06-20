import { SnapConfigService } from './snap-config.service';

jest.mock('@macro/logger', () => ({
  Logger: { getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }) },
}));

describe('SnapConfigService', () => {
  it('loads the snap provider config', async () => {
    const config = { enabled: true, serverOptions: { showDebug: true } };
    const service = new SnapConfigService({ get: jest.fn().mockResolvedValue(config) }, () => '/local/snap-config.json');
    expect(await service.getSnapConfig()).toEqual(config);
  });

  it('caches the config (fetches once)', async () => {
    const http = { get: jest.fn().mockResolvedValue({ enabled: true }) };
    const service = new SnapConfigService(http, () => '/x');
    await service.getSnapConfig();
    await service.getSnapConfig();
    expect(http.get).toHaveBeenCalledTimes(1);
  });

  it('falls back to enabled defaults on fetch error', async () => {
    const service = new SnapConfigService({ get: jest.fn().mockRejectedValue(new Error('404')) }, () => '/x');
    expect(await service.getSnapConfig()).toEqual({ enabled: true });
  });
});
