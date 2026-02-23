import { appConfig } from './app.config';

describe('appConfig', () => {
  it('should be defined', () => {
    expect(appConfig).toBeDefined();
  });

  it('should have providers array', () => {
    expect(appConfig.providers).toBeDefined();
    expect(Array.isArray(appConfig.providers)).toBe(true);
  });

  it('should contain at least 3 providers (zoneless, router, http)', () => {
    expect(appConfig.providers.length).toBeGreaterThanOrEqual(3);
  });
});
