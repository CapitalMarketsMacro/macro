import { firstValueFrom } from 'rxjs';
import { ContextService } from './context.service';

// Silence logger output during tests
jest.mock('@macro/logger', () => ({
  Logger: {
    getLogger: () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }),
  },
}));

describe('ContextService', () => {
  let service: ContextService;

  /** Helper to install / remove mock fdc3 on globalThis. */
  function setFdc3(agent: Record<string, unknown> | undefined) {
    if (agent) {
      (globalThis as any).fdc3 = agent;
    } else {
      delete (globalThis as any).fdc3;
    }
  }

  beforeEach(() => {
    service = new ContextService();
    delete (globalThis as any).fdc3;
  });

  afterEach(() => {
    service.removeListener();
    delete (globalThis as any).fdc3;
  });

  // ── broadcast ────────────────────────────────────────────────

  describe('broadcast', () => {
    it('should do nothing when fdc3 is not available', () => {
      // Should not throw
      expect(() => service.broadcast({ type: 'fdc3.instrument' })).not.toThrow();
    });

    it('should call fdc3.broadcast when fdc3 is available', () => {
      const broadcastMock = jest.fn().mockResolvedValue(undefined);
      setFdc3({ broadcast: broadcastMock });

      const context = { type: 'fdc3.instrument', id: { ticker: 'AAPL' } };
      service.broadcast(context);

      expect(broadcastMock).toHaveBeenCalledWith(context);
    });

    it('should not throw when fdc3.broadcast rejects', () => {
      const broadcastMock = jest.fn().mockRejectedValue(new Error('broadcast error'));
      setFdc3({ broadcast: broadcastMock });

      // The service fire-and-forgets with .catch, so this should not throw
      expect(() => service.broadcast({ type: 'fdc3.instrument' })).not.toThrow();
    });
  });

  // ── registerContextListener ──────────────────────────────────

  describe('registerContextListener', () => {
    it('should do nothing when fdc3 is not available', async () => {
      // Should resolve without error
      await expect(service.registerContextListener()).resolves.toBeUndefined();
    });

    it('should register a listener via fdc3.addContextListener', async () => {
      const mockListener = { unsubscribe: jest.fn() };
      const addContextListener = jest.fn().mockResolvedValue(mockListener);
      setFdc3({ addContextListener });

      await service.registerContextListener('fdc3.instrument');

      expect(addContextListener).toHaveBeenCalledWith(
        'fdc3.instrument',
        expect.any(Function),
      );
    });

    it('should pass null as contextType when called with default', async () => {
      const mockListener = { unsubscribe: jest.fn() };
      const addContextListener = jest.fn().mockResolvedValue(mockListener);
      setFdc3({ addContextListener });

      await service.registerContextListener();

      expect(addContextListener).toHaveBeenCalledWith(null, expect.any(Function));
    });

    it('should emit received context on context$', async () => {
      let capturedHandler: (ctx: any) => void = () => {};
      const mockListener = { unsubscribe: jest.fn() };
      const addContextListener = jest.fn().mockImplementation((_type, handler) => {
        capturedHandler = handler;
        return Promise.resolve(mockListener);
      });
      setFdc3({ addContextListener });

      await service.registerContextListener();

      const contextPromise = firstValueFrom(service.context$);
      const testContext = { type: 'fdc3.instrument', id: { ticker: 'MSFT' } };
      capturedHandler(testContext);

      const received = await contextPromise;
      expect(received).toEqual(testContext);
    });

    it('should remove previous listener when registering again', async () => {
      const unsubscribe = jest.fn();
      const mockListener = { unsubscribe };
      const addContextListener = jest.fn().mockResolvedValue(mockListener);
      setFdc3({ addContextListener });

      await service.registerContextListener();
      await service.registerContextListener('fdc3.contact');

      expect(unsubscribe).toHaveBeenCalledTimes(1);
      expect(addContextListener).toHaveBeenCalledTimes(2);
    });
  });

  // ── removeListener ───────────────────────────────────────────

  describe('removeListener', () => {
    it('should be a no-op when no listener is registered', () => {
      expect(() => service.removeListener()).not.toThrow();
    });

    it('should call unsubscribe on the active listener', async () => {
      const unsubscribe = jest.fn();
      const mockListener = { unsubscribe };
      setFdc3({ addContextListener: jest.fn().mockResolvedValue(mockListener) });

      await service.registerContextListener();
      service.removeListener();

      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    it('should clear the listener reference (second call is a no-op)', async () => {
      const unsubscribe = jest.fn();
      const mockListener = { unsubscribe };
      setFdc3({ addContextListener: jest.fn().mockResolvedValue(mockListener) });

      await service.registerContextListener();
      service.removeListener();
      service.removeListener();

      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });
  });
});
