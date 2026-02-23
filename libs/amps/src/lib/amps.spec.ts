// Mock the amps module before importing AmpsClient
const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockDisconnect = jest.fn().mockResolvedValue(undefined);
const mockPublish = jest.fn();
const mockSubscribe = jest.fn().mockResolvedValue('sub-1');
const mockUnsubscribe = jest.fn().mockResolvedValue(undefined);
const mockSow = jest.fn().mockResolvedValue(undefined);
const mockErrorHandler = jest.fn();

jest.mock('amps', () => ({
  Client: jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    disconnect: mockDisconnect,
    publish: mockPublish,
    subscribe: mockSubscribe,
    unsubscribe: mockUnsubscribe,
    sow: mockSow,
    errorHandler: mockErrorHandler,
  })),
  Command: { SUBSCRIBE: 'subscribe', PUBLISH: 'publish' },
}));

import { AmpsClient } from './amps';

describe('AmpsClient', () => {
  let client: AmpsClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new AmpsClient('test-client');
  });

  afterEach(async () => {
    if (client.isConnected()) {
      await client.disconnect();
    }
  });

  describe('constructor / basic state', () => {
    it('should create an instance', () => {
      expect(client).toBeTruthy();
      expect(client.getClientName()).toBe('test-client');
    });

    it('should use default name when none provided', () => {
      const defaultClient = new AmpsClient();
      expect(defaultClient.getClientName()).toBe('amps-client');
    });

    it('should not be connected initially', () => {
      expect(client.isConnected()).toBe(false);
    });

    it('should return null client when not connected', () => {
      expect(client.getClient()).toBeNull();
    });

    it('should return empty subscription IDs when not connected', () => {
      expect(client.getSubscriptionIds()).toEqual([]);
    });
  });

  describe('connect', () => {
    it('should connect to server and set connected flag', async () => {
      await client.connect('ws://localhost:9008/amps/json');
      expect(client.isConnected()).toBe(true);
      expect(mockConnect).toHaveBeenCalledWith('ws://localhost:9008/amps/json');
    });

    it('should return non-null client after connection', async () => {
      await client.connect('ws://localhost:9008/amps/json');
      expect(client.getClient()).not.toBeNull();
    });

    it('should throw if already connected', async () => {
      await client.connect('ws://localhost:9008/amps/json');
      await expect(client.connect('ws://localhost:9008/amps/json')).rejects.toThrow(
        'Already connected'
      );
    });

    it('should set error handler on client if configured before connect', async () => {
      const handler = jest.fn();
      client.errorHandler(handler);
      await client.connect('ws://localhost:9008/amps/json');
      expect(mockErrorHandler).toHaveBeenCalledWith(handler);
    });

    it('should reset client to null on connection failure', async () => {
      mockConnect.mockRejectedValueOnce(new Error('Connection refused'));
      await expect(client.connect('ws://bad:9008')).rejects.toThrow('Connection refused');
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('should disconnect and clear subscriptions', async () => {
      await client.connect('ws://localhost:9008/amps/json');
      await client.disconnect();
      expect(client.isConnected()).toBe(false);
      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('should complete all subjects on disconnect', async () => {
      await client.connect('ws://localhost:9008/amps/json');
      const { subject } = await client.subscribeAsSubject('test-topic');
      let completed = false;
      subject.subscribe({ complete: () => { completed = true; } });

      await client.disconnect();
      expect(completed).toBe(true);
    });

    it('should be a no-op when not connected', async () => {
      await client.disconnect(); // Should not throw
      expect(mockDisconnect).not.toHaveBeenCalled();
    });
  });

  describe('publish', () => {
    it('should publish object data as JSON string', async () => {
      await client.connect('ws://localhost:9008/amps/json');
      const data = { key: 'value' };
      client.publish('test-topic', data);
      expect(mockPublish).toHaveBeenCalledWith('test-topic', JSON.stringify(data));
    });

    it('should publish string data as-is', async () => {
      await client.connect('ws://localhost:9008/amps/json');
      client.publish('test-topic', 'raw string');
      expect(mockPublish).toHaveBeenCalledWith('test-topic', 'raw string');
    });

    it('should throw when not connected', () => {
      expect(() => client.publish('test-topic', { data: 'test' })).toThrow(
        'Not connected to AMPS server'
      );
    });
  });

  describe('subscribe', () => {
    it('should subscribe and return subscription ID', async () => {
      await client.connect('ws://localhost:9008/amps/json');
      const handler = jest.fn();
      const subId = await client.subscribe(handler, 'test-topic');
      expect(subId).toBe('sub-1');
      expect(mockSubscribe).toHaveBeenCalledWith(expect.any(Function), 'test-topic', undefined);
    });

    it('should subscribe with filter', async () => {
      await client.connect('ws://localhost:9008/amps/json');
      const handler = jest.fn();
      await client.subscribe(handler, 'test-topic', "/symbol='AAPL'");
      expect(mockSubscribe).toHaveBeenCalledWith(
        expect.any(Function),
        'test-topic',
        "/symbol='AAPL'"
      );
    });

    it('should wrap handler and pass messages with topic', async () => {
      await client.connect('ws://localhost:9008/amps/json');
      const handler = jest.fn();
      await client.subscribe(handler, 'test-topic');

      // Get the wrapped handler that was passed to the mock
      const wrappedHandler = mockSubscribe.mock.calls[0][0];

      // Simulate a message — note: ...msg spread puts original data back
      wrappedHandler({ data: '{"price":100}' });
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'test-topic',
        })
      );
    });

    it('should handle non-JSON string data', async () => {
      await client.connect('ws://localhost:9008/amps/json');
      const handler = jest.fn();
      await client.subscribe(handler, 'test-topic');

      const wrappedHandler = mockSubscribe.mock.calls[0][0];
      wrappedHandler({ data: 'not json' });
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'test-topic',
        })
      );
    });

    it('should call errorHandler on handler exception', async () => {
      const errorCb = jest.fn();
      client.errorHandler(errorCb);
      await client.connect('ws://localhost:9008/amps/json');

      const handler = jest.fn().mockImplementation(() => {
        throw new Error('handler boom');
      });
      await client.subscribe(handler, 'test-topic');

      const wrappedHandler = mockSubscribe.mock.calls[0][0];
      wrappedHandler({ data: 'test' });
      expect(errorCb).toHaveBeenCalled();
    });

    it('should throw when not connected', async () => {
      await expect(client.subscribe(jest.fn(), 'test-topic')).rejects.toThrow(
        'Not connected to AMPS server'
      );
    });
  });

  describe('subscribeAsObservable', () => {
    it('should return observable and subId', async () => {
      await client.connect('ws://localhost:9008/amps/json');
      const result = await client.subscribeAsObservable('test-topic');
      expect(result.observable).toBeDefined();
      expect(result.subId).toBe('sub-1');
    });

    it('should emit messages on observable', async () => {
      await client.connect('ws://localhost:9008/amps/json');
      const { observable } = await client.subscribeAsObservable('test-topic');

      const received: unknown[] = [];
      observable.subscribe((msg) => received.push(msg));

      const wrappedHandler = mockSubscribe.mock.calls[0][0];
      wrappedHandler({ data: '{"price":42}' });

      expect(received).toHaveLength(1);
      expect(received[0]).toEqual(expect.objectContaining({ topic: 'test-topic' }));
    });

    it('should store subject in subscription map', async () => {
      await client.connect('ws://localhost:9008/amps/json');
      const { subId } = await client.subscribeAsObservable('test-topic');
      expect(client.getSubject(subId)).toBeDefined();
      expect(client.getSubscriptionIds()).toContain(subId);
    });

    it('should throw when not connected', async () => {
      await expect(client.subscribeAsObservable('test-topic')).rejects.toThrow(
        'Not connected to AMPS server'
      );
    });
  });

  describe('subscribeAsSubject', () => {
    it('should return subject and subId', async () => {
      await client.connect('ws://localhost:9008/amps/json');
      const result = await client.subscribeAsSubject('test-topic');
      expect(result.subject).toBeDefined();
      expect(result.subId).toBe('sub-1');
    });

    it('should throw when not connected', async () => {
      await expect(client.subscribeAsSubject('test-topic')).rejects.toThrow(
        'Not connected to AMPS server'
      );
    });
  });

  describe('unsubscribe', () => {
    it('should complete subject and remove from map', async () => {
      await client.connect('ws://localhost:9008/amps/json');
      const { subId, subject } = await client.subscribeAsSubject('test-topic');
      let completed = false;
      subject.subscribe({ complete: () => { completed = true; } });

      await client.unsubscribe(subId);
      expect(completed).toBe(true);
      expect(client.getSubject(subId)).toBeUndefined();
      expect(mockUnsubscribe).toHaveBeenCalledWith(subId);
    });

    it('should throw when not connected', async () => {
      await expect(client.unsubscribe('sub-1')).rejects.toThrow(
        'Not connected to AMPS server'
      );
    });
  });

  describe('sow', () => {
    it('should call sow with handler, topic, and options', async () => {
      await client.connect('ws://localhost:9008/amps/json');
      const handler = jest.fn();
      await client.sow(handler, 'test-topic', "/symbol='AAPL'", { batchSize: 10 });
      expect(mockSow).toHaveBeenCalledWith(
        expect.any(Function),
        'test-topic',
        "/symbol='AAPL'",
        { batchSize: 10 }
      );
    });

    it('should wrap handler and pass messages', async () => {
      await client.connect('ws://localhost:9008/amps/json');
      const handler = jest.fn();
      await client.sow(handler, 'test-topic');

      const wrappedHandler = mockSow.mock.calls[0][0];
      wrappedHandler({ data: '{"price":100}' });
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ topic: 'test-topic' })
      );
    });

    it('should throw when not connected', async () => {
      await expect(client.sow(jest.fn(), 'test-topic')).rejects.toThrow(
        'Not connected to AMPS server'
      );
    });
  });

  describe('errorHandler', () => {
    it('should store handler and return client for chaining', () => {
      const handler = jest.fn();
      const result = client.errorHandler(handler);
      expect(result).toBe(client);
    });

    it('should set error handler on client if already connected', async () => {
      await client.connect('ws://localhost:9008/amps/json');
      const handler = jest.fn();
      client.errorHandler(handler);
      expect(mockErrorHandler).toHaveBeenCalledWith(handler);
    });
  });

  describe('static getCommand', () => {
    it('should return Command class', () => {
      const Cmd = AmpsClient.getCommand();
      expect(Cmd).toBeDefined();
    });
  });
});
