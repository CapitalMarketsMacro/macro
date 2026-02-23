import { appRoutes } from './app.routes';

// The route file imports these components; mock them so we don't pull in
// their entire dependency trees.
jest.mock('./fx-market-data/fx-market-data.component', () => ({
  FxMarketDataComponent: class MockFxMarketDataComponent {},
}));
jest.mock('./treasury-microstructure/treasury-microstructure.component', () => ({
  TreasuryMicrostructureComponent: class MockTreasuryMicrostructureComponent {},
}));

describe('appRoutes', () => {
  it('should be defined as an array', () => {
    expect(Array.isArray(appRoutes)).toBe(true);
  });

  it('should contain exactly 3 routes', () => {
    expect(appRoutes).toHaveLength(3);
  });

  it('should have a route for fx-market-data', () => {
    const route = appRoutes.find((r) => r.path === 'fx-market-data');
    expect(route).toBeDefined();
    expect(route!.component).toBeDefined();
  });

  it('should have a route for treasury-microstructure', () => {
    const route = appRoutes.find((r) => r.path === 'treasury-microstructure');
    expect(route).toBeDefined();
    expect(route!.component).toBeDefined();
  });

  it('should redirect empty path to /fx-market-data', () => {
    const route = appRoutes.find((r) => r.path === '');
    expect(route).toBeDefined();
    expect(route!.redirectTo).toBe('/fx-market-data');
    expect(route!.pathMatch).toBe('full');
  });

  it('should list routes in expected order: fx, treasury, redirect', () => {
    expect(appRoutes[0].path).toBe('fx-market-data');
    expect(appRoutes[1].path).toBe('treasury-microstructure');
    expect(appRoutes[2].path).toBe('');
  });
});
