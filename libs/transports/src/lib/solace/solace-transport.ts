import * as solace from 'solclientjs';
import { Observable, Subject } from 'rxjs';
import { Logger } from '@macro/logger';
import type { TransportClient, TransportMessage, MessageHandler, ErrorHandler, EventHandler } from '../transport';

const logger = Logger.getLogger('SolaceTransport');

let factoryInitialized = false;

export interface SolaceConnectionOptions {
  hostUrl: string;
  vpnName: string;
  userName: string;
  password: string;
  clientName?: string;
  connectTimeoutInMsecs?: number;
  reconnectRetries?: number;
  reconnectRetryWaitInMsecs?: number;
}

export interface SolacePublishOptions {
  correlationId?: string;
  replyTo?: string;
  userProperties?: Record<string, unknown>;
}

export class SolaceTransport implements TransportClient {
  readonly transportName = 'solace';
  private session: solace.Session | null = null;
  private errorHandlerCallback: ErrorHandler | null = null;
  private eventHandlerCallback: EventHandler | null = null;
  private subscriptionMap = new Map<string, { topic: string; subject?: Subject<TransportMessage> }>();
  private subCounter = 0;

  constructor(initOptions?: { logLevel?: 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL' }) {
    if (!factoryInitialized) {
      const factoryProps = new solace.SolclientFactoryProperties();
      factoryProps.profile = solace.SolclientFactoryProfiles.version10_5;
      if (initOptions?.logLevel) {
        factoryProps.logLevel = solace.LogLevel[initOptions.logLevel] ?? solace.LogLevel.WARN;
      }
      solace.SolclientFactory.init(factoryProps);
      factoryInitialized = true;
    }
  }

  async connect(options: SolaceConnectionOptions): Promise<void> {
    if (this.session) throw new Error('Already connected to Solace. Disconnect first.');
    return new Promise<void>((resolve, reject) => {
      try {
        this.session = solace.SolclientFactory.createSession({
          url: options.hostUrl,
          vpnName: options.vpnName,
          userName: options.userName,
          password: options.password,
          clientName: options.clientName,
          connectTimeoutInMsecs: options.connectTimeoutInMsecs ?? 10000,
          reconnectRetries: options.reconnectRetries ?? 3,
          reconnectRetryWaitInMsecs: options.reconnectRetryWaitInMsecs ?? 3000,
        } as any);

        this.session.on(solace.SessionEventCode.UP_NOTICE, () => {
          logger.info('Connected to Solace', { host: options.hostUrl });
          this.eventHandlerCallback?.('connected');
          resolve();
        });
        this.session.on(solace.SessionEventCode.CONNECT_FAILED_ERROR, (event: any) => {
          logger.error('Solace connection failed', event);
          this.session = null;
          reject(new Error(`Solace connection failed: ${event?.infoStr || 'unknown'}`));
        });
        this.session.on(solace.SessionEventCode.DISCONNECTED, () => {
          logger.info('Solace disconnected');
          this.eventHandlerCallback?.('disconnected');
          this.session = null;
        });
        this.session.on(solace.SessionEventCode.MESSAGE, (message: solace.Message) => {
          const topic = message.getDestination()?.getName() || '';
          const wrapped = this.wrapMessage(message, topic);
          for (const [, entry] of this.subscriptionMap) {
            entry.subject?.next(wrapped);
          }
        });

        this.session.connect();
      } catch (error) {
        this.session = null;
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  async disconnect(): Promise<void> {
    if (!this.session) return;
    try {
      for (const [, entry] of this.subscriptionMap) entry.subject?.complete();
      this.subscriptionMap.clear();
      this.session.disconnect();
      this.session = null;
      logger.info('Solace disconnected');
    } catch (error) {
      this.session = null;
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  publish(topic: string, data: string | Record<string, unknown>, options?: SolacePublishOptions): void {
    if (!this.session) throw new Error('Not connected to Solace.');
    const message = solace.SolclientFactory.createMessage();
    message.setDestination(solace.SolclientFactory.createTopicDestination(topic));
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    message.setBinaryAttachment(payload);
    message.setDeliveryMode(solace.MessageDeliveryModeType.DIRECT);
    if (options?.correlationId) message.setCorrelationId(options.correlationId);
    this.session.send(message);
  }

  async subscribe(handler: MessageHandler, topic: string): Promise<string> {
    if (!this.session) throw new Error('Not connected to Solace.');
    const subId = `solace-sub-${++this.subCounter}`;
    const rxSubject = new Subject<TransportMessage>();
    rxSubject.subscribe((msg) => handler(msg));
    this.subscriptionMap.set(subId, { topic, subject: rxSubject });
    this.session.subscribe(solace.SolclientFactory.createTopicDestination(topic), true, topic, 10000);
    logger.info('Subscribed', { subId, topic });
    return subId;
  }

  async subscribeAsObservable(topic: string): Promise<{ observable: Observable<TransportMessage>; subscriptionId: string }> {
    const { subject, subscriptionId } = await this.subscribeAsSubject(topic);
    return { observable: subject.asObservable(), subscriptionId };
  }

  async subscribeAsSubject(topic: string): Promise<{ subject: Subject<TransportMessage>; subscriptionId: string }> {
    if (!this.session) throw new Error('Not connected to Solace.');
    const subId = `solace-sub-${++this.subCounter}`;
    const rxSubject = new Subject<TransportMessage>();
    this.subscriptionMap.set(subId, { topic, subject: rxSubject });
    this.session.subscribe(solace.SolclientFactory.createTopicDestination(topic), true, topic, 10000);
    logger.info('Subscribed (subject)', { subId, topic });
    return { subject: rxSubject, subscriptionId: subId };
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    const entry = this.subscriptionMap.get(subscriptionId);
    if (!entry) return;
    entry.subject?.complete();
    if (this.session) {
      try { this.session.unsubscribe(solace.SolclientFactory.createTopicDestination(entry.topic), true, entry.topic, 10000); } catch { /* ignore */ }
    }
    this.subscriptionMap.delete(subscriptionId);
    logger.info('Unsubscribed', { subscriptionId });
  }

  get isConnected(): boolean {
    return this.session !== null;
  }

  onError(handler: ErrorHandler): void {
    this.errorHandlerCallback = handler;
  }

  onEvent(handler: EventHandler): void {
    this.eventHandlerCallback = handler;
  }

  getSubscriptionIds(): string[] {
    return Array.from(this.subscriptionMap.keys());
  }

  /** Get the underlying Solace session */
  getSession(): solace.Session | null {
    return this.session;
  }

  private wrapMessage(msg: solace.Message, topic: string): TransportMessage {
    const data = msg.getBinaryAttachment()?.toString() || '';
    return {
      topic,
      data,
      json: <T = unknown>() => JSON.parse(data) as T,
      raw: msg,
    };
  }
}
