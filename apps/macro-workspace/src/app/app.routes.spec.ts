import { routes } from './app.routes';

describe('routes', () => {
  it('should be defined', () => {
    expect(routes).toBeDefined();
    expect(Array.isArray(routes)).toBe(true);
  });

  it('should contain 5 route entries', () => {
    expect(routes.length).toBe(5);
  });

  it('should have a provider route with lazy-loaded component', () => {
    const providerRoute = routes.find((r) => r.path === 'provider');
    expect(providerRoute).toBeDefined();
    expect(providerRoute!.loadComponent).toBeDefined();
    expect(typeof providerRoute!.loadComponent).toBe('function');
  });

  it('should have a view1 route with lazy-loaded component', () => {
    const view1Route = routes.find((r) => r.path === 'view1');
    expect(view1Route).toBeDefined();
    expect(view1Route!.loadComponent).toBeDefined();
    expect(typeof view1Route!.loadComponent).toBe('function');
  });

  it('should have a view2 route with lazy-loaded component', () => {
    const view2Route = routes.find((r) => r.path === 'view2');
    expect(view2Route).toBeDefined();
    expect(view2Route!.loadComponent).toBeDefined();
    expect(typeof view2Route!.loadComponent).toBe('function');
  });

  it('should redirect empty path to provider', () => {
    const emptyRoute = routes.find(
      (r) => r.path === '' && r.pathMatch === 'full'
    );
    expect(emptyRoute).toBeDefined();
    expect(emptyRoute!.redirectTo).toBe('provider');
  });

  it('should redirect wildcard path to provider', () => {
    const wildcardRoute = routes.find((r) => r.path === '**');
    expect(wildcardRoute).toBeDefined();
    expect(wildcardRoute!.redirectTo).toBe('provider');
  });

  it('should have provider route as the first content route', () => {
    expect(routes[0].path).toBe('provider');
  });

  it('should have view1 route as the second content route', () => {
    expect(routes[1].path).toBe('view1');
  });

  it('should have view2 route as the third content route', () => {
    expect(routes[2].path).toBe('view2');
  });

  it('should not have any route with a component property (all lazy-loaded)', () => {
    const contentRoutes = routes.filter(
      (r) => r.path === 'provider' || r.path === 'view1' || r.path === 'view2'
    );
    contentRoutes.forEach((route) => {
      expect(route.component).toBeUndefined();
      expect(route.loadComponent).toBeDefined();
    });
  });
});
