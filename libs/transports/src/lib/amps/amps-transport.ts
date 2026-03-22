import { Client, Command } from 'amps';
import { Observable, Subject } from 'rxjs';
import { Logger } from '@macro/logger';
import type { TransportClient, TransportMessage, MessageHandler, ErrorHandler } from '../transport';

const logger = Logger.getLogger('AmpsTransport');

export interface AmpsConnectionOptions {
  url: string;
}

export interface AmpsSowOptions {
  batchSize?: number;
  timeout?: number;
  [key: string]: unknown;
}

export class AmpsTransport implements TransportClient {
  readonly transportName = 'amps';
  private client: Client | null = null;
  private clientName: string;
  private errorHandlerCallback: ErrorHandler | null = null;
  private subscriptionMap = new Map<string, Subject<TransportMessage>>();

  constructor(clientName = 'amps-client') {
    this.clientName = clientName;
  }

  async connect(options: AmpsConnectionOptions): Promise<void> {
    if (this.client) throw new Error('Already connected to AMPS. Disconnect first.');
    try {
      this.client = new Client(this.clientName);
      if (this.errorHandlerCallback) {
        this.client.errorHandler(this.errorHandlerCallback);
      }
      await this.client.connect(options.url);
      logger.info('Connected to AMPS', { url: options.url, name: this.clientName });
    } catch (error) {
      this.client = null;
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  async disconnect(): Promise<void> {
    if (!this.client) return;
    try {
      for (const [, subject] of this.subscriptionMap) subject.complete();
      this.subscriptionMap.clear();
      await this.client.disconnect();
      this.client = null;
      logger.info('AMPS disconnected');
    } catch (error) {
      this.client = null;
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  publish(topic: string, data: string | Record<string, unknown>): void {
    if (!this.client) throw new Error('Not connected to AMPS.');
    this.client.publish(topic, typeof data === 'string' ? data : JSON.stringify(data));
  }

  async subscribe(handler: MessageHandler, topic: string, filter?: string): Promise<string> {
    if (!this.client) throw new Error('Not connected to AMPS.');
    const subId = await this.client.subscribe(
      (message: any) => handler(this.wrapMessage(message, topic)),
      topic,
      filter,
    );
    logger.info('Subscribed', { subId, topic, filter });
    return subId;
  }

  async subscribeAsObservable(topic: string, filter?: string): Promise<{ observable: Observable<TransportMessage>; subscriptionId: string }> {
    const { subject, subscriptionId } = await this.subscribeAsSubject(topic, filter);
    return { observable: subject.asObservable(), subscriptionId };
  }

  async subscribeAsSubject(topic: string, filter?: string): Promise<{ subject: Subject<TransportMessage>; subscriptionId: string }> {
    if (!this.client) throw new Error('Not connected to AMPS.');
    const rxSubject = new Subject<TransportMessage>();
    const subId = await this.client.subscribe(
      (message: any) => rxSubject.next(this.wrapMessage(message, topic)),
      topic,
      filter,
    );
    this.subscriptionMap.set(subId, rxSubject);
    logger.info('Subscribed (subject)', { subId, topic, filter });
    return { subject: rxSubject, subscriptionId: subId };
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    const subject = this.subscriptionMap.get(subscriptionId);
    if (subject) {
      subject.complete();
      this.subscriptionMap.delete(subscriptionId);
    }
    logger.info('Unsubscribed', { subscriptionId });
  }

  get isConnected(): boolean {
    return this.client !== null;
  }

  onError(handler: ErrorHandler): void {
    this.errorHandlerCallback = handler;
    if (this.client) this.client.errorHandler(handler);
  }

  getSubscriptionIds(): string[] {
    return Array.from(this.subscriptionMap.keys());
  }

  /** AMPS-specific: State-of-the-World query */
  async sow(handler: MessageHandler, topic: string, filter?: string, options?: AmpsSowOptions): Promise<void> {
    if (!this.client) throw new Error('Not connected to AMPS.');
    await this.client.sow(
      (message: any) => handler(this.wrapMessage(message, topic)),
      topic,
      filter,
      options,
    );
  }

  /** Get the underlying AMPS Client instance */
  getClient(): Client | null {
    return this.client;
  }

  /** Get the Command class for advanced usage */
  static getCommand(): typeof Command {
    return Command;
  }

  private wrapMessage(msg: any, fallbackTopic: string): TransportMessage {
    const data = typeof msg.data === 'string' ? msg.data : JSON.stringify(msg.data);
    return {
      topic: msg.topic || fallbackTopic,
      data,
      json: <T = unknown>() => (typeof msg.data === 'string' ? JSON.parse(msg.data) : msg.data) as T,
      raw: msg,
    };
  }
}
