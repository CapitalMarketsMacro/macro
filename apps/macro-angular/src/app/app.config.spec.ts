import { appConfig } from './app.config';

// Mock the route file so we don't pull in component dependencies
jest.mock('./app.routes', () => ({
  appRoutes: [],
}));

// Mock PrimeNG
jest.mock('primeng/config', () => ({
  providePrimeNG: jest.fn((config: unknown) => ({
    provide: 'PRIMENG',
    useValue: config,
  })),
}));

jest.mock('@primeuix/themes/aura', () => ({
  __esModule: true,
  default: { name: 'Aura' },
}));

describe('appConfig', () => {
  it('should be defined', () => {
    expect(appConfig).toBeDefined();
  });

  it('should have providers array', () => {
    expect(appConfig.providers).toBeDefined();
    expect(Array.isArray(appConfig.providers)).toBe(true);
  });

  it('should have at least 4 providers', () => {
    // provideBrowserGlobalErrorListeners, provideAnimationsAsync,
    // provideZoneChangeDetection, provideRouter, providePrimeNG
    expect(appConfig.providers.length).toBeGreaterThanOrEqual(4);
  });
});
