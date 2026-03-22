/**
 * NATS Wrapper Library
 *
 * This library provides a TypeScript wrapper for the NATS.js v3 client
 * using WebSocket transport for browser runtimes.
 * Based on @nats-io/nats-core: https://github.com/nats-io/nats.js
 *
 * The actual NATS API:
 * - await wsconnect({ servers: 'ws://host:port' })
 * - nc.publish('topic', payload)
 * - nc.subscribe('topic')
 * - await nc.drain()
 * - await nc.close()
 */

import { wsconnect, type NatsConnection, type Subscription, type Msg } from '@nats-io/nats-core';
import { Observable, Subject } from 'rxjs';
import { Logger } from '@macro/logger';

const logger = Logger.getLogger('NatsClient');

export interface NatsConnectionOptions {
  /** WebSocket server URL (e.g., 'ws://localhost:8224') */
  servers: string;
  /** Optional client name */
  name?: string;
  /** Max reconnect attempts (-1 for unlimited) */
  maxReconnectAttempts?: number;
  /** Reconnect wait time in ms */
  reconnectTimeWait?: number;
}

export interface NatsMessage {
  /** The subject the message was published on */
  subject: string;
  /** Message data as string */
  data: string;
  /** Parsed JSON data (if parseable) */
  json<T = unknown>(): T;
  /** Reply subject (for request/reply pattern) */
  reply?: string;
}

export type NatsMessageHandler = (message: NatsMessage) => void;
export type NatsErrorHandler = (error: Error) => void;

/**
 * NATS Client Wrapper
 *
 * Provides a high-level, type-safe interface for interacting with NATS servers
 * via WebSocket. Follows the same patterns as @macro/amps and @macro/solace.
 *
 * @example
 * ```typescript
 * const client = new NatsClient('my-app');
 * await client.connect({ servers: 'ws://localhost:8224' });
 *
 * // Publish
 * client.publish('orders.new', { symbol: 'AAPL', qty: 100 });
 *
 * // Subscribe with callback
 * const subId = await client.subscribe(
 *   msg => console.log(msg.json()),
 *   'orders.>'
 * );
 *
 * // Subscribe as Observable
 * const { observable } = await client.subscribeAsObservable('prices.>');
 * observable.subscribe(msg => console.log(msg.subject, msg.json()));
 *
 * await client.disconnect();
 * ```
 */
export class NatsClient {
  private nc: NatsConnection | null = null;
  private clientName: string;
  private errorHandlerCallback: NatsErrorHandler | null = null;
  private subscriptionMap = new Map<string, { subscription: Subscription; subject?: Subject<NatsMessage> }>();
  private subCounter = 0;

  constructor(clientName = 'nats-client') {
    this.clientName = clientName;
  }

  /**
   * Connect to a NATS server via WebSocket.
   */
  async connect(options: NatsConnectionOptions): Promise<void> {
    if (this.nc) {
      throw new Error('Already connected to NATS server. Disconnect first.');
    }

    try {
      this.nc = await wsconnect({
        servers: options.servers,
        name: options.name ?? this.clientName,
        maxReconnectAttempts: options.maxReconnectAttempts ?? -1,
        reconnectTimeWait: options.reconnectTimeWait ?? 2000,
      });

      logger.info('Connected to NATS', { server: options.servers, name: this.clientName });

      // Monitor connection closure
      this.nc.closed().then((err) => {
        if (err) {
          logger.warn('NATS connection closed with error', err);
          this.errorHandlerCallback?.(err instanceof Error ? err : new Error(String(err)));
        } else {
          logger.info('NATS connection closed');
        }
        this.nc = null;
      });
    } catch (error) {
      this.nc = null;
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to connect to NATS', err);
      throw err;
    }
  }

  /**
   * Disconnect from the NATS server, draining all subscriptions.
   */
  async disconnect(): Promise<void> {
    if (!this.nc) return;

    try {
      for (const [, entry] of this.subscriptionMap.entries()) {
        entry.subject?.complete();
        entry.subscription.unsubscribe();
      }
      this.subscriptionMap.clear();

      await this.nc.drain();
      this.nc = null;
      logger.info('NATS disconnected');
    } catch (error) {
      this.nc = null;
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Error disconnecting from NATS', err);
      throw err;
    }
  }

  /**
   * Publish a message to a subject.
   * @param subject - NATS subject (e.g., 'orders.new')
   * @param data - Message data (string or object; objects are JSON-stringified)
   */
  publish(subject: string, data: string | Record<string, unknown>): void {
    if (!this.nc) {
      throw new Error('Not connected to NATS server. Call connect() first.');
    }
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    this.nc.publish(subject, payload);
  }

  /**
   * Subscribe to a subject with a callback handler.
   * Supports NATS wildcards: `*` (single token) and `>` (tail match).
   *
   * @param handler - Message handler callback
   * @param subject - NATS subject pattern
   * @returns Subscription ID (use for unsubscribe)
   */
  async subscribe(handler: NatsMessageHandler, subject: string): Promise<string> {
    if (!this.nc) {
      throw new Error('Not connected to NATS server. Call connect() first.');
    }

    const sub = this.nc.subscribe(subject);
    const subId = `nats-sub-${++this.subCounter}`;
    this.subscriptionMap.set(subId, { subscription: sub });

    // Process messages in background
    (async () => {
      for await (const msg of sub) {
        try {
          handler(this.wrapMessage(msg));
        } catch (err) {
          logger.error('Error in subscription handler', { subject, err });
        }
      }
    })();

    logger.info('Subscribed', { subId, subject });
    return subId;
  }

  /**
   * Subscribe to a subject and return an RxJS Observable.
   *
   * @param subject - NATS subject pattern
   * @returns Object with observable and subscriptionId
   */
  async subscribeAsObservable(subject: string): Promise<{ observable: Observable<NatsMessage>; subscriptionId: string }> {
    if (!this.nc) {
      throw new Error('Not connected to NATS server. Call connect() first.');
    }

    const sub = this.nc.subscribe(subject);
    const subId = `nats-sub-${++this.subCounter}`;
    const rxSubject = new Subject<NatsMessage>();

    this.subscriptionMap.set(subId, { subscription: sub, subject: rxSubject });

    // Process messages in background, push to RxJS Subject
    (async () => {
      for await (const msg of sub) {
        rxSubject.next(this.wrapMessage(msg));
      }
      rxSubject.complete();
    })();

    logger.info('Subscribed (observable)', { subId, subject });
    return { observable: rxSubject.asObservable(), subscriptionId: subId };
  }

  /**
   * Unsubscribe from a subscription by ID.
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    const entry = this.subscriptionMap.get(subscriptionId);
    if (!entry) {
      logger.warn('Subscription not found', { subscriptionId });
      return;
    }

    entry.subject?.complete();
    entry.subscription.unsubscribe();
    this.subscriptionMap.delete(subscriptionId);
    logger.info('Unsubscribed', { subscriptionId });
  }

  /**
   * Send a request and wait for a reply (request/reply pattern).
   * @param subject - NATS subject
   * @param data - Request data
   * @param timeout - Timeout in milliseconds (default: 5000)
   */
  async request(subject: string, data: string | Record<string, unknown>, timeout = 5000): Promise<NatsMessage> {
    if (!this.nc) {
      throw new Error('Not connected to NATS server. Call connect() first.');
    }
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    const msg = await this.nc.request(subject, payload, { timeout });
    return this.wrapMessage(msg);
  }

  /**
   * Register a global error handler.
   */
  onError(handler: NatsErrorHandler): void {
    this.errorHandlerCallback = handler;
  }

  /**
   * Check if the client is connected.
   */
  get isConnected(): boolean {
    return this.nc !== null;
  }

  /**
   * Get the underlying NATS connection (for advanced usage).
   */
  getConnection(): NatsConnection | null {
    return this.nc;
  }

  private wrapMessage(msg: Msg): NatsMessage {
    const dataStr = typeof msg.data === 'string'
      ? msg.data
      : new TextDecoder().decode(msg.data as Uint8Array);
    return {
      subject: msg.subject,
      data: dataStr,
      json: <T = unknown>() => JSON.parse(dataStr) as T,
      reply: msg.reply,
    };
  }
}
