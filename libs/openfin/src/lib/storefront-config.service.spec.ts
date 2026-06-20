import { StorefrontConfigService } from './storefront-config.service';

jest.mock('@macro/logger', () => ({
  Logger: { getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }) },
}));

const config = {
  navigation: { favoritesTitle: 'Favorites', sections: [{ id: 'markets', title: 'Markets', items: [] }] },
  footer: { text: 'Macro', links: [{ title: 'Support', url: 'x' }] },
  cardClickBehavior: 'show-app-details',
};

describe('StorefrontConfigService', () => {
  it('loads and exposes navigation / footer / card-click config', async () => {
    const http = { get: jest.fn().mockResolvedValue(config) };
    const service = new StorefrontConfigService(http, () => '/local/storefront-config.json');
    expect((await service.getNavigationConfig()).sections[0].id).toBe('markets');
    expect((await service.getFooterConfig())?.text).toBe('Macro');
    expect(await service.getCardClickBehavior()).toBe('show-app-details');
  });

  it('caches the config (fetches once)', async () => {
    const http = { get: jest.fn().mockResolvedValue(config) };
    const service = new StorefrontConfigService(http, () => '/local/storefront-config.json');
    await service.getNavigationConfig();
    await service.getFooterConfig();
    await service.getCardClickBehavior();
    expect(http.get).toHaveBeenCalledTimes(1);
  });

  it('defaults cardClickBehavior when unset', async () => {
    const http = { get: jest.fn().mockResolvedValue({ navigation: { sections: [] } }) };
    const service = new StorefrontConfigService(http, () => '/x');
    expect(await service.getCardClickBehavior()).toBe('perform-primary-button-action');
  });

  it('falls back to an empty config when the fetch fails', async () => {
    const http = { get: jest.fn().mockRejectedValue(new Error('404')) };
    const service = new StorefrontConfigService(http, () => '/x');
    expect((await service.getNavigationConfig()).sections).toEqual([]);
  });
});
