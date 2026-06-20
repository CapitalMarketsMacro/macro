import { AuthService } from './auth.service';

jest.mock('@macro/logger', () => ({
  Logger: { getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }) },
}));

const config = {
  currentUser: { id: 'u-001', name: 'Macro Trader', entitlements: ['fx-trader'] },
  apps: { 'a-1': ['fx-trader'] },
};

describe('AuthService', () => {
  it('returns the current user from entitlements config', async () => {
    const http = { get: jest.fn().mockResolvedValue(config) };
    const service = new AuthService(http, () => '/local/entitlements.json');
    const user = await service.getUser();
    expect(user.id).toBe('u-001');
    expect(user.entitlements).toContain('fx-trader');
  });

  it('caches the config (fetches once)', async () => {
    const http = { get: jest.fn().mockResolvedValue(config) };
    const service = new AuthService(http, () => '/local/entitlements.json');
    await service.getUser();
    await service.getEntitlementsConfig();
    await service.getUser();
    expect(http.get).toHaveBeenCalledTimes(1);
  });

  it('exposes the user id synchronously once loaded', async () => {
    const http = { get: jest.fn().mockResolvedValue(config) };
    const service = new AuthService(http, () => '/local/entitlements.json');
    expect(service.getCurrentUserId()).toBe('anonymous');
    await service.getUser();
    expect(service.getCurrentUserId()).toBe('u-001');
  });

  it('falls back to anonymous when the config fetch fails', async () => {
    const http = { get: jest.fn().mockRejectedValue(new Error('404')) };
    const service = new AuthService(http, () => '/local/entitlements.json');
    const user = await service.getUser();
    expect(user.id).toBe('anonymous');
    expect(user.entitlements).toEqual([]);
  });
});
