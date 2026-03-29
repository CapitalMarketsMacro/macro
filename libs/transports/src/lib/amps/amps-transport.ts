import { Client, Command } from 'amps';
import { Observable, Subject, ReplaySubject } from 'rxjs';
import { Logger } from '@macro/logger';
import type { TransportClient, TransportMessage, MessageHandler, ErrorHandler } from '../transport';

const logger = Logger.getLogger('AmpsTransport');

export interface AmpsConnectionOptions {
  url: string;
  /** Optional logon options (e.g., authentication token) */
  logon?: string;
  /** Heartbeat interval in seconds (0 = disabled) */
  heartbeat?: number;
}

export interface AmpsSowOptions {
  batchSize?: number;
  timeout?: number;
  topN?: number;
  orderBy?: string;
  filter?: string;
  [key: string]: unknown;
}

/**
 * AMPS Transport — high-level wrapper for 60East AMPS JavaScript Client.
 *
 * Handles group_begin/group_end internally for SOW operations.
 * All subscribe methods filter out AMPS control messages (oof, group_begin, group_end).
 * Provides clean data-only streams to consumers.
 */
export class AmpsTransport implements TransportClient {
  readonly transportName = 'amps';
  private client: Client | null = null;
  private clientName: string;
  private errorHandlerCallback: ErrorHandler | null = null;
  private subscriptionMap = new Map<string, Subject<TransportMessage>>();

  constructor(clientName = 'amps-client') {
    this.clientName = clientName;
  }

  // ── Connection ──

  async connect(options: AmpsConnectionOptions): Promise<void> {
    if (this.client) throw new Error('Already connected to AMPS. Disconnect first.');
    try {
      this.client = new Client(this.clientName);
      if (this.errorHandlerCallback) {
        this.client.errorHandler(this.errorHandlerCallback);
      }
      if (options.heartbeat) {
        this.client.heartbeat(options.heartbeat);
      }
      if (options.logon) {
        this.client.logonOptions(options.logon);
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

  get isConnected(): boolean {
    return this.client !== null;
  }

  // ── Publish ──

  publish(topic: string, data: string | Record<string, unknown>): void {
    if (!this.client) throw new Error('Not connected to AMPS.');
    this.client.publish(topic, typeof data === 'string' ? data : JSON.stringify(data));
  }

  /** Publish a delta update (only changed fields) */
  deltaPublish(topic: string, data: string | Record<string, unknown>): void {
    if (!this.client) throw new Error('Not connected to AMPS.');
    this.client.deltaPublish(topic, typeof data === 'string' ? data : JSON.stringify(data));
  }

  // ── Subscribe (live updates only, no SOW) ──

  async subscribe(handler: MessageHandler, topic: string, filter?: string): Promise<string> {
    if (!this.client) throw new Error('Not connected to AMPS.');
    const subId = await this.client.subscribe(
      (message: any) => {
        if (this.isDataMessage(message)) handler(this.wrapMessage(message, topic));
      },
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
      (message: any) => {
        if (this.isDataMessage(message)) rxSubject.next(this.wrapMessage(message, topic));
      },
      topic,
      filter,
    );
    this.subscriptionMap.set(subId, rxSubject);
    logger.info('Subscribed (subject)', { subId, topic, filter });
    return { subject: rxSubject, subscriptionId: subId };
  }

  /** Subscribe to deltas only (changed fields per message) */
  async deltaSubscribe(topic: string, filter?: string): Promise<{ observable: Observable<TransportMessage>; subscriptionId: string }> {
    if (!this.client) throw new Error('Not connected to AMPS.');
    const rxSubject = new Subject<TransportMessage>();
    const subId = await this.client.deltaSubscribe(
      (message: any) => {
        if (this.isDataMessage(message)) rxSubject.next(this.wrapMessage(message, topic));
      },
      topic,
      filter,
    );
    this.subscriptionMap.set(subId, rxSubject);
    logger.info('Delta subscribed', { subId, topic, filter });
    return { observable: rxSubject.asObservable(), subscriptionId: subId };
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    const subject = this.subscriptionMap.get(subscriptionId);
    if (subject) {
      subject.complete();
      this.subscriptionMap.delete(subscriptionId);
    }
    if (this.client) {
      try { await this.client.unsubscribe(subscriptionId); } catch { /* ignore */ }
    }
    logger.info('Unsubscribed', { subscriptionId });
  }

  // ── SOW (State of the World) — returns complete snapshot as array ──

  /**
   * Query the current state for a topic. Returns all matching records as an array.
   * Handles group_begin/group_end internally — consumer gets clean data only.
   */
  async sow(topic: string, filter?: string, options?: AmpsSowOptions): Promise<TransportMessage[]> {
    if (!this.client) throw new Error('Not connected to AMPS.');

    return new Promise<TransportMessage[]>((resolve, reject) => {
      const results: TransportMessage[] = [];
      this.client!.sow(
        (message: any) => {
          const cmd = this.getCommand(message);
          if (cmd === 'group_end') {
            resolve(results);
          } else if (this.isDataMessage(message)) {
            results.push(this.wrapMessage(message, topic));
          }
        },
        topic,
        filter,
        options,
      ).catch(reject);

      // Safety timeout
      const timeoutMs = options?.timeout ?? 10000;
      setTimeout(() => resolve(results), timeoutMs);
    });
  }

  /**
   * Legacy SOW with callback handler (for backward compatibility).
   * Filters out group_begin/group_end — handler only receives data messages.
   */
  async sowWithHandler(handler: MessageHandler, topic: string, filter?: string, options?: AmpsSowOptions): Promise<void> {
    if (!this.client) throw new Error('Not connected to AMPS.');
    await this.client.sow(
      (message: any) => {
        if (this.isDataMessage(message)) handler(this.wrapMessage(message, topic));
      },
      topic,
      filter,
      options,
    );
  }

  // ── SOW + Subscribe (atomic: snapshot then live) ──

  /**
   * Atomic SOW + Subscribe: get current state then receive live updates.
   * Returns an observable that emits SOW records first, then live updates.
   * group_begin/group_end are handled internally.
   *
   * The returned `sowComplete` promise resolves when the initial SOW batch finishes.
   */
  async sowAndSubscribe(
    topic: string,
    filter?: string,
    options?: AmpsSowOptions,
  ): Promise<{ observable: Observable<TransportMessage>; subscriptionId: string; sowComplete: Promise<void> }> {
    if (!this.client) throw new Error('Not connected to AMPS.');

    const rxSubject = new Subject<TransportMessage>();
    let sowDone = false;
    let resolveSow: () => void;
    const sowComplete = new Promise<void>((r) => { resolveSow = r; });

    const subId = await this.client.sowAndSubscribe(
      (message: any) => {
        const cmd = this.getCommand(message);
        if (cmd === 'group_begin') return; // skip
        if (cmd === 'group_end') {
          sowDone = true;
          resolveSow!();
          return;
        }
        if (this.isDataMessage(message)) {
          rxSubject.next(this.wrapMessage(message, topic));
        }
      },
      topic,
      filter,
      options,
    );

    this.subscriptionMap.set(subId, rxSubject);
    logger.info('SOW+Subscribe', { subId, topic, filter });

    return { observable: rxSubject.asObservable(), subscriptionId: subId, sowComplete };
  }

  /**
   * Atomic SOW + Delta Subscribe: get current state then receive only changed fields.
   * Same clean API as sowAndSubscribe but with delta semantics.
   */
  async sowAndDeltaSubscribe(
    topic: string,
    filter?: string,
    options?: AmpsSowOptions,
  ): Promise<{ observable: Observable<TransportMessage>; subscriptionId: string; sowComplete: Promise<void> }> {
    if (!this.client) throw new Error('Not connected to AMPS.');

    const rxSubject = new Subject<TransportMessage>();
    let resolveSow: () => void;
    const sowComplete = new Promise<void>((r) => { resolveSow = r; });

    const subId = await this.client.sowAndDeltaSubscribe(
      (message: any) => {
        const cmd = this.getCommand(message);
        if (cmd === 'group_begin') return;
        if (cmd === 'group_end') { resolveSow!(); return; }
        if (this.isDataMessage(message)) {
          rxSubject.next(this.wrapMessage(message, topic));
        }
      },
      topic,
      filter,
      options,
    );

    this.subscriptionMap.set(subId, rxSubject);
    logger.info('SOW+DeltaSubscribe', { subId, topic, filter });

    return { observable: rxSubject.asObservable(), subscriptionId: subId, sowComplete };
  }

  // ── SOW Delete ──

  /** Delete records from the SOW by filter */
  async sowDelete(topic: string, filter: string): Promise<void> {
    if (!this.client) throw new Error('Not connected to AMPS.');
    await this.client.sowDelete(topic, filter);
  }

  /** Delete a specific record from the SOW by data (uses SOW key matching) */
  async sowDeleteByData(topic: string, data: string | Record<string, unknown>): Promise<void> {
    if (!this.client) throw new Error('Not connected to AMPS.');
    await this.client.sowDeleteByData(topic, typeof data === 'string' ? data : JSON.stringify(data));
  }

  /** Delete records from the SOW by keys */
  async sowDeleteByKeys(topic: string, keys: string): Promise<void> {
    if (!this.client) throw new Error('Not connected to AMPS.');
    await this.client.sowDeleteByKeys(topic, keys);
  }

  // ── Advanced: Command API ──

  /**
   * Execute a raw AMPS Command for advanced operations.
   * Use when the high-level methods don't cover your use case.
   *
   * @example
   * ```typescript
   * const Command = AmpsTransport.getCommand();
   * const cmd = new Command('subscribe').topic('orders').filter('/qty > 100').bookmark('recent');
   * const { observable } = await transport.executeCommand(cmd);
   * ```
   */
  async executeCommand(command: InstanceType<typeof Command>): Promise<{ observable: Observable<TransportMessage>; subscriptionId?: string }> {
    if (!this.client) throw new Error('Not connected to AMPS.');
    const rxSubject = new Subject<TransportMessage>();
    let subId: string | undefined;

    await this.client.execute(command, (message: any) => {
      if (!subId && message.header?.subId) subId = message.header.subId();
      if (this.isDataMessage(message)) {
        rxSubject.next(this.wrapMessage(message, command.topic?.() || ''));
      }
    });

    if (subId) this.subscriptionMap.set(subId, rxSubject);

    return { observable: rxSubject.asObservable(), subscriptionId: subId };
  }

  // ── Error Handling ──

  onError(handler: ErrorHandler): void {
    this.errorHandlerCallback = handler;
    if (this.client) this.client.errorHandler(handler);
  }

  // ── Accessors ──

  getSubscriptionIds(): string[] {
    return Array.from(this.subscriptionMap.keys());
  }

  getSubject(subscriptionId: string): Subject<TransportMessage> | undefined {
    return this.subscriptionMap.get(subscriptionId);
  }

  getClientName(): string {
    return this.clientName;
  }

  /** Get the underlying AMPS Client instance for advanced usage */
  getClient(): Client | null {
    return this.client;
  }

  /** Get the Command class for building advanced AMPS commands */
  static getCommand(): typeof Command {
    return Command;
  }

  // ── Internal Helpers ──

  /** Check if this is a data message (not a control message like group_begin/end/oof) */
  private isDataMessage(message: any): boolean {
    const cmd = this.getCommand(message);
    return cmd !== 'group_begin' && cmd !== 'group_end' && cmd !== 'oof' && cmd !== 'ack' && cmd !== 'heartbeat';
  }

  /** Extract the command type from a message header */
  private getCommand(message: any): string {
    try {
      if (message.header && typeof message.header.command === 'function') {
        return message.header.command();
      }
      if (message.c) return message.c; // compact format
    } catch { /* ignore */ }
    return '';
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
