import { NatsClient } from './nats';

// ── Mocks ────────────────────────────────────────────────────────────

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

// Must define mocks before jest.mock factory (hoisted)
const mockPublish = jest.fn();
const mockDrain = jest.fn().mockResolvedValue(undefined);
const mockRequest = jest.fn();
// Default: never-resolving promise (connection stays open)
const mockClosed = jest.fn().mockReturnValue(new Promise(() => {}));
const mockSubscribe = jest.fn();

jest.mock('@nats-io/nats-core', () => ({
  wsconnect: jest.fn().mockImplementation(() =>
    Promise.resolve({
      publish: mockPublish,
      subscribe: mockSubscribe,
      drain: mockDrain,
      request: mockRequest,
      closed: mockClosed,
    }),
  ),
}));

import { wsconnect } from '@nats-io/nats-core';

function createMockSubscription(messages: any[] = []) {
  const unsub = jest.fn();
  let index = 0;
  const sub = {
    unsubscribe: unsub,
    [Symbol.asyncIterator]: () => ({
      next: () => {
        if (index < messages.length) {
          return Promise.resolve({ value: messages[index++], done: false });
        }
        return new Promise(() => {});
      },
    }),
  };
  return { sub, unsub };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('NatsClient', () => {
  let client: NatsClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSubscribe.mockReturnValue(createMockSubscription().sub);
    client = new NatsClient('test-client');
  });

  // ── Constructor ──

  describe('constructor', () => {
    it('should create with default name', () => {
      const c = new NatsClient();
      expect(c.isConnected).toBe(false);
    });

    it('should create with custom name', () => {
      const c = new NatsClient('custom');
      expect(c.isConnected).toBe(false);
    });
  });

  // ── connect ──

  describe('connect', () => {
    it('should connect to NATS via wsconnect', async () => {
      await client.connect({ servers: 'ws://localhost:8224' });

      expect(wsconnect).toHaveBeenCalledWith({
        servers: 'ws://localhost:8224',
        name: 'test-client',
        maxReconnectAttempts: -1,
        reconnectTimeWait: 2000,
      });
      expect(client.isConnected).toBe(true);
    });

    it('should use custom connection options', async () => {
      await client.connect({
        servers: 'ws://host:9999',
        name: 'override-name',
        maxReconnectAttempts: 5,
        reconnectTimeWait: 500,
      });

      expect(wsconnect).toHaveBeenCalledWith({
        servers: 'ws://host:9999',
        name: 'override-name',
        maxReconnectAttempts: 5,
        reconnectTimeWait: 500,
      });
    });

    it('should throw if already connected', async () => {
      await client.connect({ servers: 'ws://localhost:8224' });

      await expect(client.connect({ servers: 'ws://localhost:8224' }))
        .rejects.toThrow('Already connected');
    });

    it('should throw and reset on connection failure', async () => {
      (wsconnect as jest.Mock).mockRejectedValueOnce(new Error('Connection refused'));

      await expect(client.connect({ servers: 'ws://bad:1234' }))
        .rejects.toThrow('Connection refused');
      expect(client.isConnected).toBe(false);
    });

    it('should handle non-Error connection failures', async () => {
      (wsconnect as jest.Mock).mockRejectedValueOnce('string error');

      await expect(client.connect({ servers: 'ws://bad:1234' }))
        .rejects.toThrow('string error');
    });

    it('should invoke error handler when connection closes with error', async () => {
      const closedWithError = Promise.resolve(new Error('lost'));
      mockClosed.mockReturnValueOnce(closedWithError);

      const errorHandler = jest.fn();
      client.onError(errorHandler);
      await client.connect({ servers: 'ws://localhost:8224' });

      // Let the closed() promise resolve
      await closedWithError;
      await new Promise((r) => setTimeout(r, 0));

      expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
      expect(client.isConnected).toBe(false);
    });

    it('should handle connection close without error', async () => {
      const closedClean = Promise.resolve(undefined);
      mockClosed.mockReturnValueOnce(closedClean);

      await client.connect({ servers: 'ws://localhost:8224' });
      await closedClean;
      await new Promise((r) => setTimeout(r, 0));

      expect(client.isConnected).toBe(false);
    });
  });

  // ── disconnect ──

  describe('disconnect', () => {
    it('should drain and disconnect', async () => {
      await client.connect({ servers: 'ws://localhost:8224' });
      await client.disconnect();

      expect(mockDrain).toHaveBeenCalled();
      expect(client.isConnected).toBe(false);
    });

    it('should no-op if not connected', async () => {
      await client.disconnect();
      expect(mockDrain).not.toHaveBeenCalled();
    });

    it('should clean up subscriptions on disconnect', async () => {
      await client.connect({ servers: 'ws://localhost:8224' });
      const { sub, unsub } = createMockSubscription();
      mockSubscribe.mockReturnValueOnce(sub);

      await client.subscribe(jest.fn(), 'test.topic');
      await client.disconnect();

      expect(unsub).toHaveBeenCalled();
    });

    it('should throw on drain error', async () => {
      await client.connect({ servers: 'ws://localhost:8224' });
      mockDrain.mockRejectedValueOnce(new Error('drain failed'));

      await expect(client.disconnect()).rejects.toThrow('drain failed');
      expect(client.isConnected).toBe(false);
    });
  });

  // ── publish ──

  describe('publish', () => {
    it('should publish string data', async () => {
      await client.connect({ servers: 'ws://localhost:8224' });
      client.publish('test.topic', 'hello');

      expect(mockPublish).toHaveBeenCalledWith('test.topic', 'hello');
    });

    it('should JSON-stringify object data', async () => {
      await client.connect({ servers: 'ws://localhost:8224' });
      client.publish('test.topic', { key: 'value' });

      expect(mockPublish).toHaveBeenCalledWith('test.topic', '{"key":"value"}');
    });

    it('should throw if not connected', () => {
      expect(() => client.publish('test', 'data'))
        .toThrow('Not connected');
    });
  });

  // ── subscribe ──

  describe('subscribe', () => {
    it('should subscribe and return subscription ID', async () => {
      await client.connect({ servers: 'ws://localhost:8224' });
      const subId = await client.subscribe(jest.fn(), 'test.>');

      expect(subId).toMatch(/^nats-sub-\d+$/);
      expect(mockSubscribe).toHaveBeenCalledWith('test.>');
    });

    it('should throw if not connected', async () => {
      await expect(client.subscribe(jest.fn(), 'test'))
        .rejects.toThrow('Not connected');
    });

    it('should call handler with wrapped messages', async () => {
      const handler = jest.fn();
      const msg = { subject: 'test.1', data: '{"a":1}', reply: undefined };
      const { sub } = createMockSubscription([msg]);
      mockSubscribe.mockReturnValueOnce(sub);

      await client.connect({ servers: 'ws://localhost:8224' });
      await client.subscribe(handler, 'test.>');

      // Let the async iterator process
      await new Promise((r) => setTimeout(r, 10));

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        subject: 'test.1',
        data: '{"a":1}',
      }));
    });

    it('should generate incrementing subscription IDs', async () => {
      await client.connect({ servers: 'ws://localhost:8224' });
      const id1 = await client.subscribe(jest.fn(), 'a');
      const id2 = await client.subscribe(jest.fn(), 'b');

      expect(id1).not.toBe(id2);
    });
  });

  // ── subscribeAsObservable ──

  describe('subscribeAsObservable', () => {
    it('should return observable and subscription ID', async () => {
      await client.connect({ servers: 'ws://localhost:8224' });
      const result = await client.subscribeAsObservable('prices.>');

      expect(result.subscriptionId).toMatch(/^nats-sub-\d+$/);
      expect(result.observable).toBeDefined();
      expect(result.observable.subscribe).toBeDefined();
    });

    it('should throw if not connected', async () => {
      await expect(client.subscribeAsObservable('test'))
        .rejects.toThrow('Not connected');
    });

    it('should create an observable that can be subscribed to', async () => {
      await client.connect({ servers: 'ws://localhost:8224' });
      const { observable, subscriptionId } = await client.subscribeAsObservable('prices.>');

      // Observable should be subscribable without error
      const sub = observable.subscribe();
      expect(sub).toBeDefined();
      expect(subscriptionId).toBeDefined();
      sub.unsubscribe();
    });
  });

  // ── unsubscribe ──

  describe('unsubscribe', () => {
    it('should unsubscribe by ID', async () => {
      const { sub, unsub } = createMockSubscription();
      mockSubscribe.mockReturnValueOnce(sub);

      await client.connect({ servers: 'ws://localhost:8224' });
      const subId = await client.subscribe(jest.fn(), 'test');

      await client.unsubscribe(subId);
      expect(unsub).toHaveBeenCalled();
    });

    it('should no-op for unknown subscription ID', async () => {
      await client.connect({ servers: 'ws://localhost:8224' });
      await client.unsubscribe('nats-sub-unknown');
      // Should not throw
    });
  });

  // ── request ──

  describe('request', () => {
    it('should send request and return wrapped reply', async () => {
      const replyMsg = { subject: 'reply', data: '{"ok":true}', reply: undefined };
      mockRequest.mockResolvedValue(replyMsg);

      await client.connect({ servers: 'ws://localhost:8224' });
      const reply = await client.request('service.ping', { ts: 123 });

      expect(mockRequest).toHaveBeenCalledWith('service.ping', '{"ts":123}', { timeout: 5000 });
      expect(reply.json()).toEqual({ ok: true });
    });

    it('should accept custom timeout', async () => {
      mockRequest.mockResolvedValue({ subject: 'r', data: '{}', reply: undefined });

      await client.connect({ servers: 'ws://localhost:8224' });
      await client.request('svc', 'data', 10000);

      expect(mockRequest).toHaveBeenCalledWith('svc', 'data', { timeout: 10000 });
    });

    it('should throw if not connected', async () => {
      await expect(client.request('svc', 'data'))
        .rejects.toThrow('Not connected');
    });
  });

  // ── onError ──

  describe('onError', () => {
    it('should register error handler', () => {
      const handler = jest.fn();
      client.onError(handler);
      // Handler is stored internally — tested via connection close path
    });
  });

  // ── getConnection ──

  describe('getConnection', () => {
    it('should return null when not connected', () => {
      expect(client.getConnection()).toBeNull();
    });

    it('should return connection when connected', async () => {
      await client.connect({ servers: 'ws://localhost:8224' });
      expect(client.getConnection()).not.toBeNull();
    });
  });

  // ── wrapMessage (via subscribe) ──

  describe('message wrapping', () => {
    it('should handle Uint8Array data', async () => {
      const handler = jest.fn();
      const encoded = new TextEncoder().encode('{"binary":true}');
      const msg = { subject: 'bin', data: encoded, reply: 'inbox.1' };
      const { sub } = createMockSubscription([msg]);
      mockSubscribe.mockReturnValueOnce(sub);

      await client.connect({ servers: 'ws://localhost:8224' });
      await client.subscribe(handler, 'bin');

      await new Promise((r) => setTimeout(r, 10));

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        subject: 'bin',
        data: '{"binary":true}',
        reply: 'inbox.1',
      }));
      expect(handler.mock.calls[0][0].json()).toEqual({ binary: true });
    });
  });
});
