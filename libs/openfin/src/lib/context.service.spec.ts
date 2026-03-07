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
    jest.useFakeTimers();
    service = new ContextService();
    delete (globalThis as any).fdc3;
  });

  afterEach(() => {
    service.removeListener();
    delete (globalThis as any).fdc3;
    jest.useRealTimers();
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

  // ── onContext ────────────────────────────────────────────────

  describe('onContext', () => {
    it('should register listener and return filtered observable', async () => {
      let capturedHandler: (ctx: any) => void = () => {};
      const mockListener = { unsubscribe: jest.fn() };
      const addContextListener = jest.fn().mockImplementation((_type, handler) => {
        capturedHandler = handler;
        return Promise.resolve(mockListener);
      });
      setFdc3({ addContextListener });

      const received: any[] = [];
      const sub = service.onContext('fdc3.instrument').subscribe((ctx) => received.push(ctx));

      // Wait for async registerContextListener
      await Promise.resolve();

      capturedHandler({ type: 'fdc3.instrument', id: { ticker: 'AAPL' } });
      capturedHandler({ type: 'fdc3.contact', id: { email: 'x@y.com' } });
      capturedHandler({ type: 'fdc3.instrument', id: { ticker: 'MSFT' } });

      expect(received).toHaveLength(2);
      expect(received[0].id.ticker).toBe('AAPL');
      expect(received[1].id.ticker).toBe('MSFT');

      sub.unsubscribe();
    });
  });

  // ── currentChannel$ ──────────────────────────────────────────

  describe('currentChannel$', () => {
    it('should emit null when fdc3 is not available', () => {
      const values: (string | null)[] = [];
      const sub = service.currentChannel$.subscribe((v) => values.push(v));

      expect(values).toEqual([null]);
      sub.unsubscribe();
    });

    it('should emit channel id from fdc3.getCurrentChannel', async () => {
      const getCurrentChannel = jest.fn().mockResolvedValue({ id: 'green' });
      setFdc3({ getCurrentChannel });

      const values: (string | null)[] = [];
      const sub = service.currentChannel$.subscribe((v) => values.push(v));

      // Let the initial poll resolve
      await Promise.resolve();

      expect(values).toEqual(['green']);
      sub.unsubscribe();
    });

    it('should emit new value when channel changes on poll', async () => {
      let channelId = 'green';
      const getCurrentChannel = jest.fn().mockImplementation(() =>
        Promise.resolve({ id: channelId }),
      );
      setFdc3({ getCurrentChannel });

      const values: (string | null)[] = [];
      const sub = service.currentChannel$.subscribe((v) => values.push(v));

      await Promise.resolve();
      expect(values).toEqual(['green']);

      channelId = 'red';
      jest.advanceTimersByTime(1000);
      await Promise.resolve();

      expect(values).toEqual(['green', 'red']);
      sub.unsubscribe();
    });

    it('should not emit duplicate values', async () => {
      const getCurrentChannel = jest.fn().mockResolvedValue({ id: 'green' });
      setFdc3({ getCurrentChannel });

      const values: (string | null)[] = [];
      const sub = service.currentChannel$.subscribe((v) => values.push(v));

      await Promise.resolve();
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      jest.advanceTimersByTime(1000);
      await Promise.resolve();

      expect(values).toEqual(['green']);
      sub.unsubscribe();
    });

    it('should stop polling when all subscribers unsubscribe', async () => {
      const getCurrentChannel = jest.fn().mockResolvedValue({ id: 'green' });
      setFdc3({ getCurrentChannel });

      const sub1 = service.currentChannel$.subscribe();
      const sub2 = service.currentChannel$.subscribe();

      await Promise.resolve();
      getCurrentChannel.mockClear();

      sub1.unsubscribe();

      // Still one subscriber — polling continues
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      expect(getCurrentChannel).toHaveBeenCalled();

      getCurrentChannel.mockClear();
      sub2.unsubscribe();

      // No subscribers — polling should have stopped
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      expect(getCurrentChannel).not.toHaveBeenCalled();
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
