import { firstValueFrom } from 'rxjs';
import { ChannelService } from './channel.service';

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

describe('ChannelService', () => {
  let service: ChannelService;

  /** Helper to install / remove mock fdc3 on globalThis. */
  function setFdc3(agent: Record<string, unknown> | undefined) {
    if (agent) {
      (globalThis as any).fdc3 = agent;
    } else {
      delete (globalThis as any).fdc3;
    }
  }

  /** Creates a mock Channel with broadcast and addContextListener. */
  function makeMockChannel(overrides?: Partial<{ broadcast: jest.Mock; addContextListener: jest.Mock }>) {
    return {
      broadcast: overrides?.broadcast ?? jest.fn().mockResolvedValue(undefined),
      addContextListener: overrides?.addContextListener ?? jest.fn().mockResolvedValue({ unsubscribe: jest.fn() }),
    };
  }

  beforeEach(() => {
    service = new ChannelService();
    delete (globalThis as any).fdc3;
  });

  afterEach(() => {
    service.removeListener();
    delete (globalThis as any).fdc3;
  });

  // ── broadcast ────────────────────────────────────────────────

  describe('broadcast', () => {
    it('should do nothing when fdc3 is not available', () => {
      expect(() => service.broadcast('test-channel', { type: 'fdc3.instrument' })).not.toThrow();
    });

    it('should call fdc3.getOrCreateChannel and channel.broadcast', async () => {
      const mockChannel = makeMockChannel();
      const getOrCreateChannel = jest.fn().mockResolvedValue(mockChannel);
      setFdc3({ getOrCreateChannel });

      const context = { type: 'fdc3.instrument', id: { ticker: 'EUR/USD' } };
      service.broadcast('fx-channel', context);

      // Wait for the promise chain inside broadcast to resolve
      await getOrCreateChannel.mock.results[0].value;

      expect(getOrCreateChannel).toHaveBeenCalledWith('fx-channel');
      expect(mockChannel.broadcast).toHaveBeenCalledWith(context);
    });
  });

  // ── broadcastMyChannel ───────────────────────────────────────

  describe('broadcastMyChannel', () => {
    it('should do nothing when fdc3 is not available', async () => {
      await expect(service.broadcastMyChannel({ type: 'fdc3.instrument' })).resolves.toBeUndefined();
    });

    it('should broadcast to my-channel', async () => {
      const mockChannel = makeMockChannel();
      const getOrCreateChannel = jest.fn().mockResolvedValue(mockChannel);
      setFdc3({ getOrCreateChannel });

      const context = { type: 'fdc3.contact', id: { email: 'test@test.com' } };
      await service.broadcastMyChannel(context);

      expect(getOrCreateChannel).toHaveBeenCalledWith('my-channel');
      expect(mockChannel.broadcast).toHaveBeenCalledWith(context);
    });

    it('should reuse the same channel promise on subsequent calls', async () => {
      const mockChannel = makeMockChannel();
      const getOrCreateChannel = jest.fn().mockResolvedValue(mockChannel);
      setFdc3({ getOrCreateChannel });

      await service.broadcastMyChannel({ type: 'ctx1' });
      await service.broadcastMyChannel({ type: 'ctx2' });

      // getOrCreateChannel should only be called once (cached)
      expect(getOrCreateChannel).toHaveBeenCalledTimes(1);
      expect(mockChannel.broadcast).toHaveBeenCalledTimes(2);
    });
  });

  // ── registerChannelListener ──────────────────────────────────

  describe('registerChannelListener', () => {
    it('should do nothing when fdc3 is not available', async () => {
      await expect(
        service.registerChannelListener('test-channel'),
      ).resolves.toBeUndefined();
    });

    it('should register a listener on the named channel', async () => {
      const mockListener = { unsubscribe: jest.fn() };
      const mockChannel = makeMockChannel({
        addContextListener: jest.fn().mockResolvedValue(mockListener),
      });
      const getOrCreateChannel = jest.fn().mockResolvedValue(mockChannel);
      setFdc3({ getOrCreateChannel });

      await service.registerChannelListener('fx-channel', 'fdc3.instrument');

      expect(getOrCreateChannel).toHaveBeenCalledWith('fx-channel');
      expect(mockChannel.addContextListener).toHaveBeenCalledWith(
        'fdc3.instrument',
        expect.any(Function),
      );
    });

    it('should emit received context on channel$', async () => {
      let capturedHandler: (ctx: any) => void = () => {};
      const mockListener = { unsubscribe: jest.fn() };
      const mockChannel = makeMockChannel({
        addContextListener: jest.fn().mockImplementation((_type, handler) => {
          capturedHandler = handler;
          return Promise.resolve(mockListener);
        }),
      });
      setFdc3({ getOrCreateChannel: jest.fn().mockResolvedValue(mockChannel) });

      await service.registerChannelListener('fx-channel');

      const contextPromise = firstValueFrom(service.channel$);
      const testContext = { type: 'fdc3.instrument', id: { ticker: 'USD/JPY' } };
      capturedHandler(testContext);

      const received = await contextPromise;
      expect(received).toEqual(testContext);
    });

    it('should remove previous listener when registering a new one', async () => {
      const unsubscribe = jest.fn();
      const mockListener = { unsubscribe };
      const mockChannel = makeMockChannel({
        addContextListener: jest.fn().mockResolvedValue(mockListener),
      });
      setFdc3({ getOrCreateChannel: jest.fn().mockResolvedValue(mockChannel) });

      await service.registerChannelListener('ch-1');
      await service.registerChannelListener('ch-2');

      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });
  });

  // ── registerMyChannelListener ────────────────────────────────

  describe('registerMyChannelListener', () => {
    it('should do nothing when fdc3 is not available', async () => {
      await expect(service.registerMyChannelListener()).resolves.toBeUndefined();
    });

    it('should register on the my-channel channel', async () => {
      const mockListener = { unsubscribe: jest.fn() };
      const mockChannel = makeMockChannel({
        addContextListener: jest.fn().mockResolvedValue(mockListener),
      });
      setFdc3({ getOrCreateChannel: jest.fn().mockResolvedValue(mockChannel) });

      await service.registerMyChannelListener('fdc3.instrument');

      expect(mockChannel.addContextListener).toHaveBeenCalledWith(
        'fdc3.instrument',
        expect.any(Function),
      );
    });

    it('should emit context on channel$ when listener fires', async () => {
      let capturedHandler: (ctx: any) => void = () => {};
      const mockListener = { unsubscribe: jest.fn() };
      const mockChannel = makeMockChannel({
        addContextListener: jest.fn().mockImplementation((_type, handler) => {
          capturedHandler = handler;
          return Promise.resolve(mockListener);
        }),
      });
      setFdc3({ getOrCreateChannel: jest.fn().mockResolvedValue(mockChannel) });

      await service.registerMyChannelListener();

      const contextPromise = firstValueFrom(service.channel$);
      capturedHandler({ type: 'fdc3.instrument' });

      const received = await contextPromise;
      expect(received).toEqual({ type: 'fdc3.instrument' });
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
      const mockChannel = makeMockChannel({
        addContextListener: jest.fn().mockResolvedValue(mockListener),
      });
      setFdc3({ getOrCreateChannel: jest.fn().mockResolvedValue(mockChannel) });

      await service.registerChannelListener('test-channel');
      service.removeListener();

      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    it('should clear the listener reference (second call is a no-op)', async () => {
      const unsubscribe = jest.fn();
      const mockListener = { unsubscribe };
      const mockChannel = makeMockChannel({
        addContextListener: jest.fn().mockResolvedValue(mockListener),
      });
      setFdc3({ getOrCreateChannel: jest.fn().mockResolvedValue(mockChannel) });

      await service.registerChannelListener('test-channel');
      service.removeListener();
      service.removeListener();

      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });
  });
});
