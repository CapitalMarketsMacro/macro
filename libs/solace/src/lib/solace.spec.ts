// Mock solclientjs before importing SolaceClient
const mockSessionConnect = jest.fn();
const mockSessionDisconnect = jest.fn();
const mockSessionSubscribe = jest.fn();
const mockSessionUnsubscribe = jest.fn();
const mockSessionSend = jest.fn();
const mockSessionOn = jest.fn();
const mockSessionDispose = jest.fn();

const mockSetDestination = jest.fn();
const mockSetBinaryAttachment = jest.fn();
const mockSetCorrelationId = jest.fn();
const mockSetReplyTo = jest.fn();
const mockAddField = jest.fn();
const mockGetUserPropertyMap = jest.fn().mockReturnValue({
  addField: mockAddField,
});
const mockGetDestination = jest.fn().mockReturnValue({ getName: () => 'test-topic' });

const mockFactoryInit = jest.fn();
const mockFactorySetLogLevel = jest.fn();
const mockFactoryCreateSession = jest.fn().mockReturnValue({
  connect: mockSessionConnect,
  disconnect: mockSessionDisconnect,
  subscribe: mockSessionSubscribe,
  unsubscribe: mockSessionUnsubscribe,
  send: mockSessionSend,
  on: mockSessionOn,
  dispose: mockSessionDispose,
});
const mockFactoryCreateTopicDestination = jest.fn().mockImplementation((t: string) => ({
  getName: () => t,
}));
const mockFactoryCreateMessage = jest.fn().mockReturnValue({
  setDestination: mockSetDestination,
  setBinaryAttachment: mockSetBinaryAttachment,
  setCorrelationId: mockSetCorrelationId,
  setReplyTo: mockSetReplyTo,
  getUserPropertyMap: mockGetUserPropertyMap,
  getDestination: mockGetDestination,
});

jest.mock('solclientjs', () => ({
  SolclientFactory: {
    init: mockFactoryInit,
    setLogLevel: mockFactorySetLogLevel,
    createSession: mockFactoryCreateSession,
    createTopicDestination: mockFactoryCreateTopicDestination,
    createMessage: mockFactoryCreateMessage,
  },
  SolclientFactoryProperties: jest.fn().mockImplementation(() => ({
    profile: null,
  })),
  SolclientFactoryProfiles: {
    version10_5: 'version10_5',
    version10: 'version10',
  },
  SessionProperties: jest.fn().mockImplementation((props: Record<string, unknown>) => props),
  SessionEventCode: {
    UP_NOTICE: 'UP_NOTICE',
    CONNECT_FAILED_ERROR: 'CONNECT_FAILED_ERROR',
    DISCONNECTED: 'DISCONNECTED',
    SUBSCRIPTION_ERROR: 'SUBSCRIPTION_ERROR',
    SUBSCRIPTION_OK: 'SUBSCRIPTION_OK',
    MESSAGE: 'MESSAGE',
  },
  LogLevel: {
    TRACE: 0,
    DEBUG: 1,
    INFO: 2,
    WARN: 3,
    ERROR: 4,
    FATAL: 5,
  },
  MessageDeliveryModeType: {
    DIRECT: 0,
    PERSISTENT: 1,
  },
  SDTFieldType: {
    STRING: 'STRING',
  },
}));

import { SolaceClient } from './solace';

describe('SolaceClient', () => {
  let client: SolaceClient;
  const connProps = {
    hostUrl: 'ws://localhost:8008',
    vpnName: 'default',
    userName: 'admin',
    password: 'admin',
  };

  // Capture all event handlers registered via session.on()
  let eventHandlers: Record<string, (...args: unknown[]) => void>;

  function setupMockSession() {
    eventHandlers = {};
    mockSessionOn.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      eventHandlers[event] = handler;
    });
  }

  async function connectClient() {
    setupMockSession();
    const connectPromise = client.connect(connProps);
    // Fire UP_NOTICE to resolve the promise
    eventHandlers['UP_NOTICE']?.();
    await connectPromise;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    setupMockSession();
    client = new SolaceClient();
  });

  describe('constructor', () => {
    it('should create an instance', () => {
      expect(client).toBeTruthy();
    });

    it('should initialize SolclientFactory', () => {
      expect(mockFactoryInit).toHaveBeenCalled();
    });

    it('should handle factory already initialized (no throw)', () => {
      mockFactoryInit.mockImplementationOnce(() => {
        throw new Error('already initialized');
      });
      const c = new SolaceClient();
      expect(c).toBeTruthy();
    });

    it('should set log level when provided', () => {
      new SolaceClient({ logLevel: 'DEBUG' });
      expect(mockFactorySetLogLevel).toHaveBeenCalled();
    });

    it('should handle unknown log level gracefully', () => {
      // An invalid log level string should still not throw
      new SolaceClient({ logLevel: 'INVALID' as any });
      expect(mockFactoryInit).toHaveBeenCalled();
    });
  });

  describe('connect', () => {
    it('should create session and connect', async () => {
      await connectClient();
      expect(mockFactoryCreateSession).toHaveBeenCalled();
      expect(mockSessionConnect).toHaveBeenCalled();
      expect(client.isConnected()).toBe(true);
    });

    it('should register all event handlers', async () => {
      await connectClient();
      expect(eventHandlers['UP_NOTICE']).toBeDefined();
      expect(eventHandlers['CONNECT_FAILED_ERROR']).toBeDefined();
      expect(eventHandlers['DISCONNECTED']).toBeDefined();
      expect(eventHandlers['SUBSCRIPTION_ERROR']).toBeDefined();
      expect(eventHandlers['SUBSCRIPTION_OK']).toBeDefined();
      expect(eventHandlers['MESSAGE']).toBeDefined();
    });

    it('should throw if already connected', async () => {
      await connectClient();
      await expect(client.connect(connProps)).rejects.toThrow('Already connected');
    });

    it('should call event handler on successful connection', async () => {
      const eventCb = jest.fn();
      client.eventHandler(eventCb);
      await connectClient();
      expect(eventCb).toHaveBeenCalledWith('connected');
    });

    it('should reject on connection failure', async () => {
      setupMockSession();
      const connectPromise = client.connect(connProps);
      eventHandlers['CONNECT_FAILED_ERROR']?.(new Error('refused'));
      await expect(connectPromise).rejects.toThrow('refused');
      expect(client.isConnected()).toBe(false);
    });

    it('should call error handler on connection failure', async () => {
      const errorCb = jest.fn();
      client.errorHandler(errorCb);
      setupMockSession();
      const connectPromise = client.connect(connProps);
      eventHandlers['CONNECT_FAILED_ERROR']?.(new Error('refused'));
      await expect(connectPromise).rejects.toThrow();
      expect(errorCb).toHaveBeenCalled();
    });

    it('should pass optional connection properties', async () => {
      const fullProps = {
        ...connProps,
        clientName: 'test-client',
        connectTimeoutInMsecs: 5000,
        reconnectRetries: 3,
        reconnectRetryWaitInMsecs: 1000,
      };
      setupMockSession();
      const p = client.connect(fullProps);
      eventHandlers['UP_NOTICE']?.();
      await p;
      expect(client.isConnected()).toBe(true);
    });

    it('should handle DISCONNECTED event', async () => {
      const eventCb = jest.fn();
      client.eventHandler(eventCb);
      await connectClient();
      // Simulate disconnection
      eventHandlers['DISCONNECTED']?.();
      expect(eventCb).toHaveBeenCalledWith('disconnected');
      expect(client.isConnected()).toBe(false);
    });

    it('should handle SUBSCRIPTION_ERROR event', async () => {
      const errorCb = jest.fn();
      client.errorHandler(errorCb);
      await connectClient();
      eventHandlers['SUBSCRIPTION_ERROR']?.(new Error('sub error'));
      expect(errorCb).toHaveBeenCalled();
    });

    it('should handle SUBSCRIPTION_OK event', async () => {
      const eventCb = jest.fn();
      client.eventHandler(eventCb);
      await connectClient();
      eventCb.mockClear();
      eventHandlers['SUBSCRIPTION_OK']?.();
      expect(eventCb).toHaveBeenCalledWith('subscription_ok');
    });

    it('should handle session.connect() throwing', async () => {
      mockSessionConnect.mockImplementationOnce(() => {
        throw new Error('connect throw');
      });
      setupMockSession();
      await expect(client.connect(connProps)).rejects.toThrow('connect throw');
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('MESSAGE event handler', () => {
    it('should emit to matching subscription subject', async () => {
      await connectClient();
      const { subject } = await client.subscribeAsSubject('test-topic');

      const received: unknown[] = [];
      subject.subscribe((msg) => received.push(msg));

      // Simulate MESSAGE event
      const mockMessage = {
        getDestination: () => ({ getName: () => 'test-topic' }),
      };
      eventHandlers['MESSAGE']?.(mockMessage);

      expect(received).toHaveLength(1);
    });

    it('should call handler callback on matching subscription', async () => {
      await connectClient();
      const handler = jest.fn();
      await client.subscribe(handler, 'test-topic');

      const mockMessage = {
        getDestination: () => ({ getName: () => 'test-topic' }),
      };
      eventHandlers['MESSAGE']?.(mockMessage);

      expect(handler).toHaveBeenCalledWith(mockMessage);
    });

    it('should not emit to non-matching subscriptions', async () => {
      await connectClient();
      const { subject } = await client.subscribeAsSubject('other-topic');

      const received: unknown[] = [];
      subject.subscribe((msg) => received.push(msg));

      const mockMessage = {
        getDestination: () => ({ getName: () => 'test-topic' }),
      };
      eventHandlers['MESSAGE']?.(mockMessage);

      expect(received).toHaveLength(0);
    });

    it('should match wildcard * pattern (single level)', async () => {
      await connectClient();
      const { subject } = await client.subscribeAsSubject('orders/*');

      const received: unknown[] = [];
      subject.subscribe((msg) => received.push(msg));

      const mockMessage = {
        getDestination: () => ({ getName: () => 'orders/stock' }),
      };
      eventHandlers['MESSAGE']?.(mockMessage);

      expect(received).toHaveLength(1);
    });

    it('should match wildcard > pattern (multi-level)', async () => {
      await connectClient();
      const { subject } = await client.subscribeAsSubject('orders/>');

      const received: unknown[] = [];
      subject.subscribe((msg) => received.push(msg));

      const mockMessage = {
        getDestination: () => ({ getName: () => 'orders/stock/buy' }),
      };
      eventHandlers['MESSAGE']?.(mockMessage);

      expect(received).toHaveLength(1);
    });

    it('should not match when topic has extra levels beyond non-wildcard pattern', async () => {
      await connectClient();
      const { subject } = await client.subscribeAsSubject('orders/stock');

      const received: unknown[] = [];
      subject.subscribe((msg) => received.push(msg));

      const mockMessage = {
        getDestination: () => ({ getName: () => 'orders/stock/buy' }),
      };
      eventHandlers['MESSAGE']?.(mockMessage);

      expect(received).toHaveLength(0);
    });

    it('should handle handler throwing an error', async () => {
      const errorCb = jest.fn();
      client.errorHandler(errorCb);
      await connectClient();

      const handler = jest.fn().mockImplementation(() => {
        throw new Error('handler error');
      });
      await client.subscribe(handler, 'test-topic');

      const mockMessage = {
        getDestination: () => ({ getName: () => 'test-topic' }),
      };
      eventHandlers['MESSAGE']?.(mockMessage);

      expect(errorCb).toHaveBeenCalled();
    });

    it('should handle null destination gracefully', async () => {
      await connectClient();
      const { subject } = await client.subscribeAsSubject('test-topic');

      const received: unknown[] = [];
      subject.subscribe((msg) => received.push(msg));

      const mockMessage = {
        getDestination: () => null,
      };
      // Should not throw
      eventHandlers['MESSAGE']?.(mockMessage);
      expect(received).toHaveLength(0);
    });

    it('should call errorHandler when MESSAGE handler itself throws', async () => {
      const errorCb = jest.fn();
      client.errorHandler(errorCb);
      await connectClient();
      await client.subscribeAsSubject('test-topic');

      // Simulate a message where getDestination throws
      const mockMessage = {
        getDestination: () => { throw new Error('dest error'); },
      };
      eventHandlers['MESSAGE']?.(mockMessage);
      expect(errorCb).toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('should disconnect and clear subscriptions', async () => {
      await connectClient();
      await client.disconnect();
      expect(mockSessionDisconnect).toHaveBeenCalled();
      expect(client.isConnected()).toBe(false);
    });

    it('should be a no-op when not connected', async () => {
      await client.disconnect(); // no throw
      expect(mockSessionDisconnect).not.toHaveBeenCalled();
    });

    it('should complete all subjects on disconnect', async () => {
      await connectClient();
      const { subject } = await client.subscribeAsSubject('test-topic');
      let completed = false;
      subject.subscribe({ complete: () => { completed = true; } });

      await client.disconnect();
      expect(completed).toBe(true);
    });

    it('should clear subscription IDs on disconnect', async () => {
      await connectClient();
      await client.subscribeAsSubject('test-topic');
      expect(client.getSubscriptionIds().length).toBe(1);
      await client.disconnect();
      expect(client.getSubscriptionIds()).toEqual([]);
    });
  });

  describe('publish', () => {
    it('should create and send a message with object data', async () => {
      await connectClient();
      client.publish('test-topic', { key: 'value' });

      expect(mockFactoryCreateMessage).toHaveBeenCalled();
      expect(mockSetDestination).toHaveBeenCalled();
      expect(mockSetBinaryAttachment).toHaveBeenCalledWith(JSON.stringify({ key: 'value' }));
      expect(mockSessionSend).toHaveBeenCalled();
    });

    it('should send string data as-is', async () => {
      await connectClient();
      client.publish('test-topic', 'raw string');
      expect(mockSetBinaryAttachment).toHaveBeenCalledWith('raw string');
    });

    it('should send ArrayBuffer data', async () => {
      await connectClient();
      const buffer = new ArrayBuffer(8);
      client.publish('test-topic', buffer as any);
      expect(mockSetBinaryAttachment).toHaveBeenCalledWith(buffer);
    });

    it('should set correlation ID when provided', async () => {
      await connectClient();
      client.publish('test-topic', 'data', { correlationId: 'corr-1' });
      expect(mockSetCorrelationId).toHaveBeenCalledWith('corr-1');
    });

    it('should set replyTo when provided', async () => {
      await connectClient();
      client.publish('test-topic', 'data', { replyTo: 'reply-topic' });
      expect(mockSetReplyTo).toHaveBeenCalled();
    });

    it('should set user properties when provided', async () => {
      await connectClient();
      client.publish('test-topic', 'data', { userProperties: { key: 'val' } });
      expect(mockGetUserPropertyMap).toHaveBeenCalled();
      expect(mockAddField).toHaveBeenCalledWith('key', 'STRING', 'val');
    });

    it('should not set optional properties when not provided', async () => {
      await connectClient();
      client.publish('test-topic', 'data');
      expect(mockSetCorrelationId).not.toHaveBeenCalled();
      expect(mockSetReplyTo).not.toHaveBeenCalled();
      expect(mockGetUserPropertyMap).not.toHaveBeenCalled();
    });

    it('should throw when not connected', () => {
      expect(() => client.publish('test-topic', 'data')).toThrow(
        'Not connected to Solace broker'
      );
    });

    it('should call errorHandler on send failure', async () => {
      const errorCb = jest.fn();
      client.errorHandler(errorCb);
      await connectClient();
      mockSessionSend.mockImplementationOnce(() => {
        throw new Error('send fail');
      });
      expect(() => client.publish('test-topic', 'data')).toThrow('send fail');
      expect(errorCb).toHaveBeenCalled();
    });
  });

  describe('subscribe', () => {
    it('should subscribe and return subscription ID', async () => {
      await connectClient();
      const handler = jest.fn();
      const subId = await client.subscribe(handler, 'test-topic');
      expect(subId).toBeDefined();
      expect(subId).toContain('test-topic');
      expect(mockSessionSubscribe).toHaveBeenCalled();
    });

    it('should store subscription in map', async () => {
      await connectClient();
      const subId = await client.subscribe(jest.fn(), 'test-topic');
      expect(client.getSubscriptionIds()).toContain(subId);
      expect(client.getSubject(subId)).toBeDefined();
    });

    it('should pass requestConfirm property', async () => {
      await connectClient();
      await client.subscribe(jest.fn(), 'test-topic', { requestConfirm: false });
      expect(mockSessionSubscribe).toHaveBeenCalledWith(
        expect.anything(),
        false,
        expect.any(String),
        10000
      );
    });

    it('should throw when not connected', async () => {
      await expect(client.subscribe(jest.fn(), 'test-topic')).rejects.toThrow(
        'Not connected to Solace broker'
      );
    });

    it('should reject when session.subscribe throws', async () => {
      await connectClient();
      mockSessionSubscribe.mockImplementationOnce(() => {
        throw new Error('sub error');
      });
      await expect(client.subscribe(jest.fn(), 'err-topic')).rejects.toThrow('sub error');
    });
  });

  describe('subscribeAsObservable', () => {
    it('should return observable and subscriptionId', async () => {
      await connectClient();
      const result = await client.subscribeAsObservable('test-topic');
      expect(result.observable).toBeDefined();
      expect(result.subscriptionId).toBeDefined();
    });

    it('should store subscription in map', async () => {
      await connectClient();
      const { subscriptionId } = await client.subscribeAsObservable('test-topic');
      expect(client.getSubscriptionIds()).toContain(subscriptionId);
    });

    it('should throw when not connected', async () => {
      await expect(client.subscribeAsObservable('test-topic')).rejects.toThrow(
        'Not connected to Solace broker'
      );
    });

    it('should reject when session.subscribe throws', async () => {
      await connectClient();
      mockSessionSubscribe.mockImplementationOnce(() => {
        throw new Error('sub error');
      });
      await expect(client.subscribeAsObservable('err-topic')).rejects.toThrow('sub error');
    });
  });

  describe('subscribeAsSubject', () => {
    it('should return subject and subscriptionId', async () => {
      await connectClient();
      const result = await client.subscribeAsSubject('test-topic');
      expect(result.subject).toBeDefined();
      expect(result.subscriptionId).toBeDefined();
    });

    it('should store subscription in map', async () => {
      await connectClient();
      const { subscriptionId } = await client.subscribeAsSubject('test-topic');
      expect(client.getSubscriptionIds()).toContain(subscriptionId);
    });

    it('should throw when not connected', async () => {
      await expect(client.subscribeAsSubject('test-topic')).rejects.toThrow(
        'Not connected to Solace broker'
      );
    });

    it('should reject when session.subscribe throws', async () => {
      await connectClient();
      mockSessionSubscribe.mockImplementationOnce(() => {
        throw new Error('sub error');
      });
      await expect(client.subscribeAsSubject('err-topic')).rejects.toThrow('sub error');
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe and complete subject', async () => {
      await connectClient();
      const { subscriptionId, subject } = await client.subscribeAsSubject('test-topic');
      let completed = false;
      subject.subscribe({ complete: () => { completed = true; } });

      await client.unsubscribe(subscriptionId);
      expect(completed).toBe(true);
      expect(client.getSubject(subscriptionId)).toBeUndefined();
      expect(mockSessionUnsubscribe).toHaveBeenCalled();
    });

    it('should accept topic parameter', async () => {
      await connectClient();
      const { subscriptionId } = await client.subscribeAsSubject('test-topic');
      await client.unsubscribe(subscriptionId, 'test-topic');
      expect(mockSessionUnsubscribe).toHaveBeenCalled();
    });

    it('should throw for unknown subscription without topic', async () => {
      await connectClient();
      await expect(client.unsubscribe('unknown-id')).rejects.toThrow(
        'Topic not found for subscription ID'
      );
    });

    it('should throw when not connected', async () => {
      await expect(client.unsubscribe('sub-1')).rejects.toThrow(
        'Not connected to Solace broker'
      );
    });
  });

  describe('errorHandler / eventHandler', () => {
    it('errorHandler should return client for chaining', () => {
      const result = client.errorHandler(jest.fn());
      expect(result).toBe(client);
    });

    it('eventHandler should return client for chaining', () => {
      const result = client.eventHandler(jest.fn());
      expect(result).toBe(client);
    });
  });

  describe('getters', () => {
    it('isConnected should return false initially', () => {
      expect(client.isConnected()).toBe(false);
    });

    it('isConnected should return true after connect', async () => {
      await connectClient();
      expect(client.isConnected()).toBe(true);
    });

    it('getSession should return null initially', () => {
      expect(client.getSession()).toBeNull();
    });

    it('getSession should return session after connect', async () => {
      await connectClient();
      expect(client.getSession()).not.toBeNull();
    });

    it('getSolace should return solace module', () => {
      expect(client.getSolace()).toBeDefined();
      expect(client.getSolace().SolclientFactory).toBeDefined();
    });

    it('getSubscriptionIds should return empty array initially', () => {
      expect(client.getSubscriptionIds()).toEqual([]);
    });

    it('getSubject should return undefined for unknown ID', () => {
      expect(client.getSubject('nonexistent')).toBeUndefined();
    });
  });
});
