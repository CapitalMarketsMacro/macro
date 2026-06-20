import { DockConfigService } from './dock-config.service';

jest.mock('@macro/logger', () => ({
  Logger: { getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }) },
}));

const config = {
  favorites: [{ type: 'item', id: 'fav-fx', icon: 'x', label: 'FX', appId: 'fx' }],
  contentMenu: [{ type: 'folder', id: 'angular', label: 'Angular', children: [] }],
};

describe('DockConfigService', () => {
  it('loads the dock favorites + content menu', async () => {
    const service = new DockConfigService({ get: jest.fn().mockResolvedValue(config) }, () => '/local/dock-config.json');
    const cfg = await service.getDockConfig();
    expect(cfg.favorites).toHaveLength(1);
    expect(cfg.contentMenu).toHaveLength(1);
  });

  it('caches the config (fetches once)', async () => {
    const http = { get: jest.fn().mockResolvedValue(config) };
    const service = new DockConfigService(http, () => '/x');
    await service.getDockConfig();
    await service.getDockConfig();
    expect(http.get).toHaveBeenCalledTimes(1);
  });

  it('falls back to an empty config on fetch error', async () => {
    const service = new DockConfigService({ get: jest.fn().mockRejectedValue(new Error('404')) }, () => '/x');
    expect(await service.getDockConfig()).toEqual({ favorites: [], contentMenu: [] });
  });
});
