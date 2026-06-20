import { EntitlementsService } from './entitlements.service';

const makeAuth = (entitlements: string[], apps: Record<string, string[]>) =>
  ({
    getEntitlementsConfig: jest.fn().mockResolvedValue({
      currentUser: { id: 'u-001', name: 'U', entitlements },
      apps,
    }),
    getUser: jest.fn().mockResolvedValue({ id: 'u-001', name: 'U', entitlements }),
  }) as any;

describe('EntitlementsService', () => {
  it('allows launch when the app has no required entitlements', async () => {
    const service = new EntitlementsService(makeAuth([], { other: ['x'] }));
    await service.ensureLoaded();
    expect(service.canLaunch('open-app')).toBe(true);
  });

  it('allows launch when the user holds a required entitlement (any-of)', async () => {
    const service = new EntitlementsService(makeAuth(['fx-trader'], { 'fx-app': ['fx-trader', 'fx-admin'] }));
    await service.ensureLoaded();
    expect(service.canLaunch('fx-app')).toBe(true);
  });

  it('blocks launch when the user holds none of the required entitlements', async () => {
    const service = new EntitlementsService(makeAuth(['rates-trader'], { 'fx-app': ['fx-trader'] }));
    await service.ensureLoaded();
    expect(service.canLaunch('fx-app')).toBe(false);
  });

  it('exposes the required entitlements for an app', async () => {
    const service = new EntitlementsService(makeAuth([], { 'fx-app': ['fx-trader'] }));
    await service.ensureLoaded();
    expect(service.getRequiredEntitlements('fx-app')).toEqual(['fx-trader']);
    expect(service.getRequiredEntitlements('unknown')).toEqual([]);
  });

  it('loads once (idempotent ensureLoaded)', async () => {
    const auth = makeAuth(['fx-trader'], {});
    const service = new EntitlementsService(auth);
    await service.ensureLoaded();
    await service.ensureLoaded();
    expect(auth.getEntitlementsConfig).toHaveBeenCalledTimes(1);
  });
});
