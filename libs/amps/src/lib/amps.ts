/**
 * AMPS (Advanced Message Processing System) Wrapper Library
 * 
 * This library provides a TypeScript wrapper for the 60East AMPS JavaScript client library.
 * Based on the official AMPS JavaScript Client 5.3.4 API documentation:
 * https://crankuptheamps.com/clients/amps-client-javascript
 * 
 * The actual AMPS API:
 * - new Client('client-name')
 * - await client.connect('ws://localhost:9100/amps/json')
 * - await client.subscribe(messageHandler, 'topic', filter?)
 * - client.publish('topic', data)
 * - await client.sow(messageHandler, 'topic', filter, options?)
 * - client.errorHandler(callback)
 * - await client.disconnect()
 */

// ES6/TypeScript module import
import { Client, Command } from 'amps';
import { Observable, Subject } from 'rxjs';

// Type definitions based on AMPS JavaScript Client API
export interface AmpsMessage {
  /** Message data (can be string or parsed object) */
  data: string | Record<string, unknown>;
  /** Message header */
  header?: {
    command(): string;
    [key: string]: unknown;
  };
  /** Message topic */
  topic?: string;
  /** Subscription ID that received this message */
  subId?: string;
  /** Message sequence number */
  sequence?: number;
  /** Additional message properties */
  [key: string]: unknown;
}

export interface AmpsSowOptions {
  /** Batch size for SOW queries */
  batchSize?: number;
  /** Timeout for SOW queries */
  timeout?: number;
  /** Additional options */
  [key: string]: unknown;
}

export type AmpsMessageHandler = (message: AmpsMessage) => void;
export type AmpsErrorHandler = (error: Error) => void;

/**
 * AMPS Client Wrapper
 * 
 * Provides a high-level, type-safe interface for interacting with AMPS servers.
 * This wrapper follows the actual AMPS JavaScript Client API while providing
 * TypeScript types and additional convenience methods.
 * 
 * @example
 * ```typescript
 * const client = new AmpsClient('my-application');
 * await client.connect('ws://localhost:9100/amps/json');
 * 
 * const subId = await client.subscribe(
 *   message => console.log(message.data),
 *   'orders'
 * );
 * 
 * client.publish('orders', { order: 'Tesla 3', qty: 10 });
 * ```
 */
export class AmpsClient {
  private client: Client | null = null;
  private clientName: string;
  private errorHandlerCallback: AmpsErrorHandler | null = null;
  /** Map of subscription IDs to RxJS Subjects/Observables */
  private subscriptionMap = new Map<string, Subject<AmpsMessage>>();

  /**
   * Create a new AMPS client instance
   * Based on: new Client('client-name')
   * 
   * @param clientName - Name identifier for this client (required by AMPS API)
   */
  constructor(clientName = 'amps-client') {
    this.clientName = clientName;
  }

  /**
   * Connect to an AMPS server
   * Based on: await client.connect('ws://localhost:9100/amps/json')
   * 
   * @param url - Connection URL (e.g., 'ws://localhost:9100/amps/json' or 'wss://localhost:9100/amps/json')
   */
  async connect(url: string): Promise<void> {
    if (this.client) {
      throw new Error('Already connected to AMPS server. Disconnect first.');
    }

    try {
      // Create new Client instance using ES6 import
      this.client = new Client(this.clientName);

      // Set error handler if one was configured before connection
      if (this.errorHandlerCallback) {
        this.client.errorHandler(this.errorHandlerCallback);
      }

      // Connect to the server
      // API: await client.connect('ws://localhost:9100/amps/json')
      await this.client.connect(url);
    } catch (error) {
      this.client = null;
      const err = error instanceof Error ? error : new Error(String(error));
      throw err;
    }
  }

  /**
   * Disconnect from the AMPS server
   * Based on: await client.disconnect()
   */
  async disconnect(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      // Complete all active RxJS subscriptions
      for (const [, subject] of this.subscriptionMap.entries()) {
        subject.complete();
      }
      this.subscriptionMap.clear();

      await this.client.disconnect();
      this.client = null;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw err;
    }
  }

  /**
   * Publish a message to a topic
   * Based on: client.publish('topic', data)
   * Note: publish() is synchronous in the AMPS API
   * 
   * @param topic - Topic name
   * @param data - Message data (string or object, will be JSON stringified if object)
   */
  publish(topic: string, data: string | Record<string, unknown>): void {
    if (!this.client) {
      throw new Error('Not connected to AMPS server. Call connect() first.');
    }

    // Convert object to JSON string if needed
    const messageData = typeof data === 'string' ? data : JSON.stringify(data);

    // API: client.publish('topic', data) - synchronous
    this.client.publish(topic, messageData);
  }

  /**
   * Subscribe to a topic with optional filter
   * Based on: await client.subscribe(messageHandler, 'topic', filter?)
   * 
   * @param handler - Message handler callback
   * @param topic - Topic name to subscribe to
   * @param filter - Optional AMPS filter expression (e.g., "/symbol='ROL'")
   * @returns Subscription ID
   */
  async subscribe(
    handler: AmpsMessageHandler,
    topic: string,
    filter?: string
  ): Promise<string> {
    if (!this.client) {
      throw new Error('Not connected to AMPS server. Call connect() first.');
    }

    // Wrap handler to provide consistent message format
    const wrappedHandler = (message: unknown) => {
      try {
        // Type guard for message object
        const msg = message as Record<string, unknown>;
        
        // Parse message data if it's a string
        let messageData: string | Record<string, unknown> = (msg['data'] as string | Record<string, unknown>) || (message as string | Record<string, unknown>);
        if (typeof messageData === 'string') {
          try {
            messageData = JSON.parse(messageData);
          } catch {
            // Keep as string if not valid JSON
          }
        }

        const ampsMessage: AmpsMessage = {
          data: messageData,
          header: msg['header'] as AmpsMessage['header'],
          topic: topic,
          subId: msg['subId'] as string | undefined,
          sequence: msg['sequence'] as number | undefined,
          ...msg,
        };

        handler(ampsMessage);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        if (this.errorHandlerCallback) {
          this.errorHandlerCallback(err);
        }
      }
    };

    // API: await client.subscribe(messageHandler, 'topic', filter?)
    // Returns a subscription ID
    const subId = await this.client.subscribe(wrappedHandler, topic, filter);
    return subId;
  }

  /**
   * Subscribe to a topic and return an RxJS Observable
   * 
   * @param topic - Topic name to subscribe to
   * @param filter - Optional AMPS filter expression (e.g., "/symbol='ROL'")
   * @returns Object containing the Observable and subscription ID
   * 
   * @example
   * ```typescript
   * const { observable, subId } = await client.subscribeAsObservable('orders');
   * observable.subscribe(message => console.log(message.data));
   * ```
   */
  async subscribeAsObservable(
    topic: string,
    filter?: string
  ): Promise<{ observable: Observable<AmpsMessage>; subId: string }> {
    if (!this.client) {
      throw new Error('Not connected to AMPS server. Call connect() first.');
    }

    const subject = new Subject<AmpsMessage>();
    
    // Wrap handler to provide consistent message format and emit to subject
    const wrappedHandler = (message: unknown) => {
      try {
        // Type guard for message object
        const msg = message as Record<string, unknown>;
        
        // Parse message data if it's a string
        let messageData: string | Record<string, unknown> = (msg['data'] as string | Record<string, unknown>) || (message as string | Record<string, unknown>);
        if (typeof messageData === 'string') {
          try {
            messageData = JSON.parse(messageData);
          } catch {
            // Keep as string if not valid JSON
          }
        }

        const ampsMessage: AmpsMessage = {
          data: messageData,
          header: msg['header'] as AmpsMessage['header'],
          topic: topic,
          subId: msg['subId'] as string | undefined,
          sequence: msg['sequence'] as number | undefined,
          ...msg,
        };

        subject.next(ampsMessage);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        subject.error(err);
        if (this.errorHandlerCallback) {
          this.errorHandlerCallback(err);
        }
      }
    };

    // API: await client.subscribe(messageHandler, 'topic', filter?)
    // Returns a subscription ID
    const subId = await this.client.subscribe(wrappedHandler, topic, filter);
    
    // Store the subject in the map
    this.subscriptionMap.set(subId, subject);

    return {
      observable: subject.asObservable(),
      subId,
    };
  }

  /**
   * Subscribe to a topic and return an RxJS Subject
   * 
   * @param topic - Topic name to subscribe to
   * @param filter - Optional AMPS filter expression (e.g., "/symbol='ROL'")
   * @returns Object containing the Subject and subscription ID
   * 
   * @example
   * ```typescript
   * const { subject, subId } = await client.subscribeAsSubject('orders');
   * subject.subscribe(message => console.log(message.data));
   * ```
   */
  async subscribeAsSubject(
    topic: string,
    filter?: string
  ): Promise<{ subject: Subject<AmpsMessage>; subId: string }> {
    if (!this.client) {
      throw new Error('Not connected to AMPS server. Call connect() first.');
    }

    const subject = new Subject<AmpsMessage>();
    
    // Wrap handler to provide consistent message format and emit to subject
    const wrappedHandler = (message: unknown) => {
      try {
        // Type guard for message object
        const msg = message as Record<string, unknown>;
        
        // Parse message data if it's a string
        let messageData: string | Record<string, unknown> = (msg['data'] as string | Record<string, unknown>) || (message as string | Record<string, unknown>);
        if (typeof messageData === 'string') {
          try {
            messageData = JSON.parse(messageData);
          } catch {
            // Keep as string if not valid JSON
          }
        }

        const ampsMessage: AmpsMessage = {
          data: messageData,
          header: msg['header'] as AmpsMessage['header'],
          topic: topic,
          subId: msg['subId'] as string | undefined,
          sequence: msg['sequence'] as number | undefined,
          ...msg,
        };

        subject.next(ampsMessage);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        subject.error(err);
        if (this.errorHandlerCallback) {
          this.errorHandlerCallback(err);
        }
      }
    };

    // API: await client.subscribe(messageHandler, 'topic', filter?)
    // Returns a subscription ID
    const subId = await this.client.subscribe(wrappedHandler, topic, filter);
    
    // Store the subject in the map
    this.subscriptionMap.set(subId, subject);

    return {
      subject,
      subId,
    };
  }

  /**
   * Unsubscribe from a subscription
   * Note: The AMPS API doesn't explicitly show an unsubscribe method in the README,
   * but it's typically available. This is a convenience wrapper.
   * 
   * @param subId - Subscription ID returned from subscribe()
   */
  async unsubscribe(subId: string): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected to AMPS server. Call connect() first.');
    }

    // Clean up RxJS subscription if it exists
    const subject = this.subscriptionMap.get(subId);
    if (subject) {
      subject.complete();
      this.subscriptionMap.delete(subId);
    }

    // Check if unsubscribe method exists
    if (this.client.unsubscribe && typeof this.client.unsubscribe === 'function') {
      await this.client.unsubscribe(subId);
    } else {
      console.warn('AMPS client does not support unsubscribe. Subscription may remain active.');
    }
  }

  /**
   * Query data from a topic (State-of-the-World / SOW)
   * Based on: await client.sow(messageHandler, 'topic', filter, options?)
   * 
   * @param handler - Message handler callback for query results
   * @param topic - Topic name to query
   * @param filter - AMPS filter expression (e.g., "/symbol='ROL'")
   * @param options - Optional SOW options (batchSize, timeout, etc.)
   */
  async sow(
    handler: AmpsMessageHandler,
    topic: string,
    filter = '',
    options?: AmpsSowOptions
  ): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected to AMPS server. Call connect() first.');
    }

    const wrappedHandler = (message: unknown) => {
      try {
        // Type guard for message object
        const msg = message as Record<string, unknown>;
        
        let messageData: string | Record<string, unknown> = (msg['data'] as string | Record<string, unknown>) || (message as string | Record<string, unknown>);
        if (typeof messageData === 'string') {
          try {
            messageData = JSON.parse(messageData);
          } catch {
            // Keep as string if not valid JSON
          }
        }

        const ampsMessage: AmpsMessage = {
          data: messageData,
          header: msg['header'] as AmpsMessage['header'],
          topic: topic,
          ...msg,
        };

        handler(ampsMessage);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        if (this.errorHandlerCallback) {
          this.errorHandlerCallback(err);
        }
      }
    };

    // API: await client.sow(messageHandler, 'topic', filter, options?)
    await this.client.sow(wrappedHandler, topic, filter, options);
  }

  /**
   * Set error handler
   * Based on: client.errorHandler(async err => { ... })
   * 
   * The error handler is only called if an error occurred after
   * a successful connection has been established.
   * 
   * @param handler - Error handler callback
   * @returns This client instance for method chaining
   */
  errorHandler(handler: AmpsErrorHandler): AmpsClient {
    this.errorHandlerCallback = handler;
    
    // If already connected, set it on the client
    if (this.client && typeof this.client.errorHandler === 'function') {
      this.client.errorHandler(handler);
    }

    return this;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.client !== null;
  }

  /**
   * Get the underlying AMPS client instance
   * Useful for accessing advanced features not wrapped by this library
   */
  getClient(): Client | null {
    return this.client;
  }

  /**
   * Get the Command class for advanced usage
   * Useful for creating custom commands
   */
  static getCommand(): typeof Command {
    return Command;
  }

  /**
   * Get client name
   */
  getClientName(): string {
    return this.clientName;
  }

  /**
   * Get the Subject for a given subscription ID
   * 
   * @param subId - Subscription ID
   * @returns The Subject associated with the subscription ID, or undefined if not found
   */
  getSubject(subId: string): Subject<AmpsMessage> | undefined {
    return this.subscriptionMap.get(subId);
  }

  /**
   * Get all active subscription IDs
   * 
   * @returns Array of subscription IDs
   */
  getSubscriptionIds(): string[] {
    return Array.from(this.subscriptionMap.keys());
  }
}

