import { wsconnect, type NatsConnection, type Subscription, type Msg } from '@nats-io/nats-core';
import { Observable, Subject } from 'rxjs';
import { Logger } from '@macro/logger';
import type { TransportClient, TransportMessage, MessageHandler, ErrorHandler } from '../transport';

const logger = Logger.getLogger('NatsTransport');

export interface NatsConnectionOptions {
  servers: string;
  name?: string;
  maxReconnectAttempts?: number;
  reconnectTimeWait?: number;
}

export class NatsTransport implements TransportClient {
  readonly transportName = 'nats';
  private nc: NatsConnection | null = null;
  private clientName: string;
  private errorHandlerCallback: ErrorHandler | null = null;
  private subscriptionMap = new Map<string, { subscription: Subscription; subject?: Subject<TransportMessage> }>();
  private subCounter = 0;

  constructor(clientName = 'nats-client') {
    this.clientName = clientName;
  }

  async connect(options: NatsConnectionOptions): Promise<void> {
    if (this.nc) throw new Error('Already connected to NATS. Disconnect first.');
    try {
      this.nc = await wsconnect({
        servers: options.servers,
        name: options.name ?? this.clientName,
        maxReconnectAttempts: options.maxReconnectAttempts ?? -1,
        reconnectTimeWait: options.reconnectTimeWait ?? 2000,
      });
      logger.info('Connected to NATS', { server: options.servers, name: this.clientName });
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
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  async disconnect(): Promise<void> {
    if (!this.nc) return;
    try {
      for (const [, entry] of this.subscriptionMap) {
        entry.subject?.complete();
        entry.subscription.unsubscribe();
      }
      this.subscriptionMap.clear();
      await this.nc.drain();
      this.nc = null;
      logger.info('NATS disconnected');
    } catch (error) {
      this.nc = null;
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  publish(topic: string, data: string | Record<string, unknown>): void {
    if (!this.nc) throw new Error('Not connected to NATS.');
    this.nc.publish(topic, typeof data === 'string' ? data : JSON.stringify(data));
  }

  async subscribe(handler: MessageHandler, topic: string): Promise<string> {
    if (!this.nc) throw new Error('Not connected to NATS.');
    const sub = this.nc.subscribe(topic);
    const subId = `nats-sub-${++this.subCounter}`;
    this.subscriptionMap.set(subId, { subscription: sub });
    (async () => {
      for await (const msg of sub) {
        try { handler(this.wrapMessage(msg)); } catch (err) { logger.error('Error in handler', { topic, err }); }
      }
    })();
    logger.info('Subscribed', { subId, topic });
    return subId;
  }

  async subscribeAsObservable(topic: string): Promise<{ observable: Observable<TransportMessage>; subscriptionId: string }> {
    const { subject, subscriptionId } = await this.subscribeAsSubject(topic);
    return { observable: subject.asObservable(), subscriptionId };
  }

  async subscribeAsSubject(topic: string): Promise<{ subject: Subject<TransportMessage>; subscriptionId: string }> {
    if (!this.nc) throw new Error('Not connected to NATS.');
    const sub = this.nc.subscribe(topic);
    const subId = `nats-sub-${++this.subCounter}`;
    const rxSubject = new Subject<TransportMessage>();
    this.subscriptionMap.set(subId, { subscription: sub, subject: rxSubject });
    (async () => {
      for await (const msg of sub) { rxSubject.next(this.wrapMessage(msg)); }
      rxSubject.complete();
    })();
    logger.info('Subscribed (subject)', { subId, topic });
    return { subject: rxSubject, subscriptionId: subId };
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    const entry = this.subscriptionMap.get(subscriptionId);
    if (!entry) return;
    entry.subject?.complete();
    entry.subscription.unsubscribe();
    this.subscriptionMap.delete(subscriptionId);
    logger.info('Unsubscribed', { subscriptionId });
  }

  get isConnected(): boolean {
    return this.nc !== null;
  }

  onError(handler: ErrorHandler): void {
    this.errorHandlerCallback = handler;
  }

  getSubscriptionIds(): string[] {
    return Array.from(this.subscriptionMap.keys());
  }

  /** NATS-specific: request/reply pattern */
  async request(topic: string, data: string | Record<string, unknown>, timeout = 5000): Promise<TransportMessage> {
    if (!this.nc) throw new Error('Not connected to NATS.');
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    const msg = await this.nc.request(topic, payload, { timeout });
    return this.wrapMessage(msg);
  }

  /** Get the underlying NATS connection */
  getConnection(): NatsConnection | null {
    return this.nc;
  }

  private wrapMessage(msg: Msg): TransportMessage {
    const data = typeof msg.data === 'string' ? msg.data : new TextDecoder().decode(msg.data as Uint8Array);
    return { topic: msg.subject, data, json: <T = unknown>() => JSON.parse(data) as T, reply: msg.reply, raw: msg };
  }
}
