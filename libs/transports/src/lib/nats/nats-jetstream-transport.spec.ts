import { NatsJetStreamTransport } from './nats-jetstream-transport';

// ── Mocks ────────────────────────────────────────────────────────────

jest.mock('@macro/logger', () => ({
  Logger: {
    getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
  },
}));

// All names referenced inside a jest.mock factory must be prefixed with `mock` (jest hoisting rule).
const mockNcPublish = jest.fn();
const mockNcDrain = jest.fn().mockResolvedValue(undefined);
const mockNcClosed = jest.fn().mockReturnValue(new Promise<never>(() => undefined));
const mockNc = { publish: mockNcPublish, drain: mockNcDrain, closed: mockNcClosed };

const mockConsumerGet = jest.fn();
const mockStreamsFind = jest.fn();
const mockJsPublish = jest.fn();
const mockJs = { consumers: { get: mockConsumerGet }, publish: mockJsPublish };
const mockJsm = { streams: { find: mockStreamsFind } };

const mockKvOpen = jest.fn();
const mockKvmCtor = jest.fn(() => ({ open: mockKvOpen }));

jest.mock('@nats-io/nats-core', () => ({
  wsconnect: jest.fn().mockImplementation(() => Promise.resolve(mockNc)),
}));

jest.mock('@nats-io/jetstream', () => ({
  jetstream: jest.fn(() => mockJs),
  jetstreamManager: jest.fn(async () => mockJsm),
  DeliverPolicy: {
    All: 'all',
    Last: 'last',
    New: 'new',
    StartSequence: 'by_start_sequence',
    StartTime: 'by_start_time',
    LastPerSubject: 'last_per_subject',
  },
}));

jest.mock('@nats-io/kv', () => ({
  Kvm: mockKvmCtor,
  KvWatchInclude: { LastValue: '', AllHistory: 'history', UpdatesOnly: 'updates' },
}));

import { wsconnect } from '@nats-io/nats-core';

// ── Helpers ──────────────────────────────────────────────────────────

const flush = () => new Promise((r) => setTimeout(r, 0));

/** Build a fake JsMsg the way the real ordered consumer delivers it. */
function jsMsg(subject: string, obj: unknown, pending: number) {
  return {
    subject,
    data: new TextEncoder().encode(JSON.stringify(obj)),
    info: { pending },
    json: () => obj,
    ack: jest.fn(),
  } as any;
}

/** Build a fake KV watch entry. */
function kvEntry(key: string, obj: unknown, opts: { delta: number; isUpdate: boolean }) {
  return { key, string: () => JSON.stringify(obj), delta: opts.delta, isUpdate: opts.isUpdate } as any;
}

/** An object that is both async-iterable (KV watcher) and has a stop(). */
function kvWatcher(entries: any[]) {
  return {
    stop: jest.fn().mockResolvedValue(undefined),
    async *[Symbol.asyncIterator]() {
      for (const e of entries) yield e;
    },
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('NatsJetStreamTransport', () => {
  let client: NatsJetStreamTransport;
  let capturedCallback: ((m: any) => void) | undefined;
  const mockMessagesClose = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    capturedCallback = undefined;
    mockNcClosed.mockReturnValue(new Promise<never>(() => undefined));
    mockNcDrain.mockResolvedValue(undefined);
    mockStreamsFind.mockResolvedValue('TEST_STREAM');
    mockConsumerGet.mockResolvedValue({
      consume: jest.fn(async (opts: any) => {
        capturedCallback = opts.callback;
        return { close: mockMessagesClose };
      }),
    });
    client = new NatsJetStreamTransport('test-js');
  });

  describe('constructor / identity', () => {
    it('reports the transport name and starts disconnected', () => {
      expect(client.transportName).toBe('nats-jetstream');
      expect(client.isConnected).toBe(false);
    });
  });

  describe('connect', () => {
    it('connects via wsconnect and builds JetStream + manager', async () => {
      await client.connect({ servers: 'ws://localhost:8224' });
      expect(wsconnect).toHaveBeenCalledWith({
        servers: 'ws://localhost:8224',
        name: 'test-js',
        maxReconnectAttempts: -1,
        reconnectTimeWait: 2000,
      });
      expect(client.isConnected).toBe(true);
      expect(client.getJetStream()).toBe(mockJs);
    });

    it('throws if already connected', async () => {
      await client.connect({ servers: 'ws://localhost:8224' });
      await expect(client.connect({ servers: 'ws://localhost:8224' })).rejects.toThrow('Already connected');
    });

    it('resets state on connection failure', async () => {
      (wsconnect as jest.Mock).mockRejectedValueOnce(new Error('refused'));
      await expect(client.connect({ servers: 'ws://bad' })).rejects.toThrow('refused');
      expect(client.isConnected).toBe(false);
    });
  });

  describe('snapshotAndSubscribe', () => {
    it('uses a LastPerSubject ordered consumer on the configured stream', async () => {
      await client.connect({ servers: 'ws://x', stream: 'ORDERS' });
      await client.snapshotAndSubscribe('orders.>');
      expect(mockConsumerGet).toHaveBeenCalledWith('ORDERS', {
        filter_subjects: 'orders.>',
        deliver_policy: 'last_per_subject',
      });
    });

    it('resolves the owning stream from the subject when none is configured', async () => {
      await client.connect({ servers: 'ws://x' });
      await client.snapshotAndSubscribe('orders.>');
      expect(mockStreamsFind).toHaveBeenCalledWith('orders.>');
      expect(mockConsumerGet).toHaveBeenCalledWith('TEST_STREAM', expect.anything());
    });

    it('emits snapshot records and resolves snapshotComplete when pending hits 0', async () => {
      await client.connect({ servers: 'ws://x', stream: 'ORDERS' });
      const received: any[] = [];
      const { observable, snapshotComplete } = await client.snapshotAndSubscribe('orders.>');
      observable.subscribe((m) => received.push(m));

      let resolved = false;
      snapshotComplete.then(() => (resolved = true));

      capturedCallback!(jsMsg('orders.1', { px: 1 }, 1));
      await flush();
      expect(resolved).toBe(false);

      capturedCallback!(jsMsg('orders.2', { px: 2 }, 0));
      await flush();
      expect(resolved).toBe(true);

      expect(received.map((m) => m.topic)).toEqual(['orders.1', 'orders.2']);
      expect(received[0].data).toBe('{"px":1}');
      expect(received[0].json()).toEqual({ px: 1 });
    });

    it('resolves snapshotComplete via the timeout when the snapshot is empty', async () => {
      await client.connect({ servers: 'ws://x', stream: 'ORDERS' });
      const { snapshotComplete } = await client.snapshotAndSubscribe('empty.>', { snapshotTimeout: 10 });
      await expect(snapshotComplete).resolves.toBeUndefined();
    });
  });

  describe('live subscribe', () => {
    it('uses a New ordered consumer and delivers wrapped messages to the handler', async () => {
      await client.connect({ servers: 'ws://x', stream: 'LIVE' });
      const handler = jest.fn();
      const subId = await client.subscribe(handler, 'live.>');
      expect(subId).toMatch(/^njs-sub-\d+$/);
      expect(mockConsumerGet).toHaveBeenCalledWith('LIVE', { filter_subjects: 'live.>', deliver_policy: 'new' });

      capturedCallback!(jsMsg('live.1', { a: 1 }, 0));
      await flush();
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ topic: 'live.1', data: '{"a":1}' }));
    });

    it('subscribeAsObservable returns a subscribable observable', async () => {
      await client.connect({ servers: 'ws://x', stream: 'LIVE' });
      const { observable, subscriptionId } = await client.subscribeAsObservable('live.>');
      expect(subscriptionId).toMatch(/^njs-sub-\d+$/);
      const sub = observable.subscribe();
      expect(sub).toBeDefined();
      sub.unsubscribe();
    });
  });

  describe('jsPublish', () => {
    it('publishes through JetStream and returns the ack', async () => {
      mockJsPublish.mockResolvedValue({ seq: 7 });
      await client.connect({ servers: 'ws://x' });
      const ack = await client.jsPublish('orders.1', { px: 1 });
      expect(mockJsPublish).toHaveBeenCalledWith('orders.1', '{"px":1}');
      expect(ack).toEqual({ seq: 7 });
    });
  });

  describe('snapshotAndSubscribeKv', () => {
    it('emits KV entries and resolves snapshotComplete on the last initial value (delta 0)', async () => {
      await client.connect({ servers: 'ws://x' });
      const mockWatch = jest.fn().mockResolvedValue(
        kvWatcher([
          kvEntry('a', { v: 1 }, { delta: 1, isUpdate: false }),
          kvEntry('b', { v: 2 }, { delta: 0, isUpdate: false }),
        ]),
      );
      mockKvOpen.mockResolvedValue({ watch: mockWatch });

      const received: any[] = [];
      const { observable, snapshotComplete } = await client.snapshotAndSubscribeKv('positions', '>');
      observable.subscribe((m) => received.push(m));

      let resolved = false;
      snapshotComplete.then(() => (resolved = true));
      await flush();
      await flush();

      expect(mockKvmCtor).toHaveBeenCalled();
      expect(mockKvOpen).toHaveBeenCalledWith('positions');
      expect(received.map((m) => m.topic)).toEqual(['a', 'b']);
      expect(resolved).toBe(true);
    });
  });

  describe('unsubscribe / disconnect', () => {
    it('unsubscribe closes the consumer messages', async () => {
      await client.connect({ servers: 'ws://x', stream: 'S' });
      const { subscriptionId } = await client.snapshotAndSubscribe('o.>');
      await client.unsubscribe(subscriptionId);
      expect(mockMessagesClose).toHaveBeenCalled();
      expect(client.getSubscriptionIds()).not.toContain(subscriptionId);
    });

    it('disconnect drains the connection and closes active consumers', async () => {
      await client.connect({ servers: 'ws://x', stream: 'S' });
      await client.snapshotAndSubscribe('o.>');
      await client.disconnect();
      expect(mockMessagesClose).toHaveBeenCalled();
      expect(mockNcDrain).toHaveBeenCalled();
      expect(client.isConnected).toBe(false);
    });

    it('disconnect is a no-op when not connected', async () => {
      await client.disconnect();
      expect(mockNcDrain).not.toHaveBeenCalled();
    });
  });
});
