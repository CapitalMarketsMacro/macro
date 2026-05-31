import { onOpenFinThemeChange } from './openfin-theme-sync';

describe('onOpenFinThemeChange', () => {
  afterEach(() => {
    delete (globalThis as unknown as { fin?: unknown }).fin;
  });

  it('returns a no-op cleanup when not running inside OpenFin', () => {
    const cb = jest.fn();
    const cleanup = onOpenFinThemeChange(cb);
    expect(typeof cleanup).toBe('function');
    expect(() => cleanup()).not.toThrow();
    expect(cb).not.toHaveBeenCalled();
  });

  it('subscribes to the theme-changed topic and forwards isDark', () => {
    let handler: ((payload: { isDark: boolean }) => void) | undefined;
    const subscribe = jest.fn((_s: unknown, _t: string, h: (payload: { isDark: boolean }) => void) => {
      handler = h;
    });
    const unsubscribe = jest.fn();
    (globalThis as unknown as { fin?: unknown }).fin = {
      InterApplicationBus: { subscribe, unsubscribe },
    };

    const cb = jest.fn();
    const cleanup = onOpenFinThemeChange(cb);

    expect(subscribe).toHaveBeenCalledWith({ uuid: '*' }, 'workspace:theme-changed', expect.any(Function));

    handler?.({ isDark: true });
    expect(cb).toHaveBeenCalledWith(true);
    handler?.({ isDark: false });
    expect(cb).toHaveBeenCalledWith(false);

    cleanup();
    expect(unsubscribe).toHaveBeenCalledWith({ uuid: '*' }, 'workspace:theme-changed', expect.any(Function));
  });

  it('swallows errors thrown during unsubscribe', () => {
    (globalThis as unknown as { fin?: unknown }).fin = {
      InterApplicationBus: {
        subscribe: jest.fn(),
        unsubscribe: jest.fn(() => {
          throw new Error('boom');
        }),
      },
    };
    const cleanup = onOpenFinThemeChange(jest.fn());
    expect(() => cleanup()).not.toThrow();
  });
});
