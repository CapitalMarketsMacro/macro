/**
 * Solace PubSub+ Wrapper Library
 *
 * This library provides a TypeScript wrapper for the Solace PubSub+ JavaScript API (solclientjs).
 * Based on the official Solace JavaScript API documentation:
 * https://docs.solace.com/Developer-Tools/JavaScript-API/js-api-home.htm
 *
 * Uses the solclientjs npm package: https://www.npmjs.com/package/solclientjs
 *
 * The actual Solace API:
 * - solace.SolclientFactory.init()
 * - solace.SolclientFactory.createSession()
 * - session.connect()
 * - session.subscribe(topic, requestConfirm, topicSubscriptionCorrelationKey, requestTimeout)
 * - session.send(message)
 * - session.disconnect()
 */
import * as solace from 'solclientjs';

import { Observable, Subject } from 'rxjs';
import { Logger } from '@macro/logger';

const logger = Logger.getLogger('SolaceClient');

// Re-export solace types for convenience
export type SolaceMessage = solace.Message;
export interface SolaceConnectionProperties {
  /** Solace host URL (e.g., 'ws://localhost:8008' or 'wss://host:port') */
  hostUrl: string;
  /** VPN name */
  vpnName: string;
  /** Username */
  userName: string;
  /** Password */
  password: string;
  /** Client name (optional) */
  clientName?: string;
  /** Connection timeout in milliseconds (optional) */
  connectTimeoutInMsecs?: number;
  /** Reconnect retries (optional) */
  reconnectRetries?: number;
  /** Reconnect retry wait in milliseconds (optional) */
  reconnectRetryWaitInMsecs?: number;
}
export type SolaceSubscriptionProperties = {
  /** Request confirmation for subscription (optional) */
  requestConfirm?: boolean;
};

export type SolaceMessageHandler = (message: solace.Message) => void;
export type SolaceErrorHandler = (error: Error) => void;
export type SolaceEventHandler = (event: string, details?: unknown) => void;

/**
 * Solace Client Wrapper
 *
 * Provides a high-level, type-safe interface for interacting with Solace PubSub+ brokers.
 * This wrapper follows the Solace JavaScript API while providing TypeScript types
 * and RxJS Observable/Subject support for reactive programming.
 *
 * @example
 * ```typescript
 * const client = new SolaceClient();
 * await client.connect({
 *   url: 'ws://localhost:8008',
 *   vpnName: 'default',
 *   userName: 'default',
 *   password: 'default'
 * });
 *
 * const { observable, subscriptionId } = await client.subscribeAsObservable('orders');
 * observable.subscribe(message => console.log(message.data));
 *
 * client.publish('orders', { order: 'Tesla 3', qty: 10 });
 * ```
 */
export class SolaceClient {
  private session: solace.Session | null = null;
  private connectionProperties: SolaceConnectionProperties | null = null;
  private errorHandlerCallback: SolaceErrorHandler | null = null;
  private eventHandlerCallback: SolaceEventHandler | null = null;
  /** Map of subscription IDs to RxJS Subjects/Observables and handlers */
  private subscriptionMap = new Map<string, {
    subject: Subject<solace.Message>;
    topic: string;
    handler?: SolaceMessageHandler;
  }>();
  private initialized = false;

  /**
   * Create a new Solace client instance
   *
   * @param initOptions - Optional initialization options for SolclientFactory
   *                      - logLevel: 'TRACE', 'DEBUG', 'INFO' (default), 'WARN', 'ERROR', 'FATAL'
   *
   * @remarks
   * IMPORTANT: SolclientFactory.init must be called before any other API function.
   * This constructor handles initialization automatically if not already done.
   * Uses version10_5 profile by default.
   */
  constructor(initOptions?: { logLevel?: 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL' }) {
    // Initialize Solace factory if not already initialized
    // IMPORTANT: SolclientFactory.init must be called before any other API function
    if (!this.initialized && solace?.SolclientFactory) {
      try {
        // Try to initialize factory (will throw if already initialized, which is fine)
        try {
          const factoryProps = new solace.SolclientFactoryProperties();
          // Use version10_5 profile
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          factoryProps.profile = (solace.SolclientFactoryProfiles as any).version10_5 || solace.SolclientFactoryProfiles.version10;
          solace.SolclientFactory.init(factoryProps);
        } catch {
          // Factory might already be initialized, which is fine - continue
        }

        // Set log level if specified (can be called even if factory was already initialized)
        if (initOptions?.logLevel) {
          const logLevel = solace.LogLevel[initOptions.logLevel];
          if (logLevel !== undefined) {
            solace.SolclientFactory.setLogLevel(logLevel);
          }
        }

        this.initialized = true;
      } catch (error) {
        // Factory might already be initialized, which is fine
        // Or initialization failed - log warning but continue
        logger.warn('Solace factory initialization warning', error);
        this.initialized = true; // Mark as initialized to prevent repeated attempts
      }
    }
  }

  /**
   * Connect to a Solace broker
   *
   * @param properties - Connection properties (hostUrl, vpnName, userName, password, etc.)
   */
  async connect(properties: SolaceConnectionProperties): Promise<void> {
    if (this.session) {
      throw new Error('Already connected to Solace broker. Disconnect first.');
    }

    if (!solace?.SolclientFactory) {
      throw new Error('Solace JavaScript API not available. Make sure solclientjs is installed and loaded.');
    }

    this.connectionProperties = properties;

    return new Promise((resolve, reject) => {
      try {
        // Create session properties from connection properties
        const sessionProperties = new solace.SessionProperties({
          url: properties.hostUrl,
          vpnName: properties.vpnName,
          userName: properties.userName,
          password: properties.password,
          ...(properties.clientName && { clientName: properties.clientName }),
          ...(properties.connectTimeoutInMsecs && { connectTimeoutInMsecs: properties.connectTimeoutInMsecs }),
          ...(properties.reconnectRetries !== undefined && { reconnectRetries: properties.reconnectRetries }),
          ...(properties.reconnectRetryWaitInMsecs && { reconnectRetryWaitInMsecs: properties.reconnectRetryWaitInMsecs }),
        });

        // Create session using SolclientFactory
        this.session = solace.SolclientFactory.createSession(sessionProperties);

        // Set up message handler for all subscriptions
        this.session.on(solace.SessionEventCode.MESSAGE, (message: solace.Message) => {
          try {
            // Emit to all relevant subscriptions
            for (const [, { subject, topic, handler }] of this.subscriptionMap.entries()) {
              const destination = message.getDestination()?.getName();
              if (destination === topic || this.topicMatches(destination || '', topic)) {
                // Call handler if provided (for subscribe method)
                if (handler) {
                  try {
                    handler(message);
                  } catch (error) {
                    const err = error instanceof Error ? error : new Error(String(error));
                    if (this.errorHandlerCallback) {
                      this.errorHandlerCallback(err);
                    }
                  }
                }
                // Emit to RxJS subject
                subject.next(message);
              }
            }
          } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            if (this.errorHandlerCallback) {
              this.errorHandlerCallback(err);
            }
          }
        });

        // Set up event handlers
        this.session.on(solace.SessionEventCode.UP_NOTICE, () => {
          if (this.eventHandlerCallback) {
            this.eventHandlerCallback('connected');
          }
          resolve();
        });

        this.session.on(solace.SessionEventCode.CONNECT_FAILED_ERROR, (error: unknown) => {
          const err = error instanceof Error ? error : new Error(String(error));
          if (this.errorHandlerCallback) {
            this.errorHandlerCallback(err);
          }
          this.session = null;
          reject(err);
        });

        this.session.on(solace.SessionEventCode.DISCONNECTED, () => {
          if (this.eventHandlerCallback) {
            this.eventHandlerCallback('disconnected');
          }
          this.session = null;
        });

        this.session.on(solace.SessionEventCode.SUBSCRIPTION_ERROR, (error: unknown) => {
          const err = error instanceof Error ? error : new Error(String(error));
          if (this.errorHandlerCallback) {
            this.errorHandlerCallback(err);
          }
        });

        this.session.on(solace.SessionEventCode.SUBSCRIPTION_OK, () => {
          if (this.eventHandlerCallback) {
            this.eventHandlerCallback('subscription_ok');
          }
        });

        // Connect to the broker
        this.session.connect();
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.session = null;
        reject(err);
      }
    });
  }

  /**
   * Check if a topic matches a subscription pattern (supports wildcards)
   */
  private topicMatches(topic: string | undefined, pattern: string): boolean {
    if (!topic) return false;
    if (topic === pattern) return true;

    // Simple wildcard matching: * matches any single level, > matches any suffix
    const patternParts = pattern.split('/');
    const topicParts = topic.split('/');

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] === '>') {
        return true; // > matches everything after
      }
      if (patternParts[i] === '*') {
        continue; // * matches single level
      }
      if (patternParts[i] !== topicParts[i]) {
        return false;
      }
    }

    return patternParts.length === topicParts.length;
  }

  /**
   * Disconnect from the Solace broker
   */
  async disconnect(): Promise<void> {
    if (!this.session) {
      return;
    }

    try {
      // Unsubscribe from all topics
      for (const [subscriptionId, { subject, topic }] of this.subscriptionMap.entries()) {
        try {
          this.unsubscribe(subscriptionId, topic);
        } catch (error) {
          logger.warn('Error unsubscribing from topic', { topic, error });
        }
        subject.complete();
      }
      this.subscriptionMap.clear();



      // Disconnect session
      this.session.disconnect();
      this.session = null;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw err;
    }
  }

  /**
   * Publish a message to a topic
   *
   * @param topic - Topic name (e.g., 'orders/stock')
   * @param data - Message data (string, object, or ArrayBuffer)
   * @param properties - Optional message properties
   */
  publish(
    topic: string,
    data: string | Record<string, unknown> | ArrayBuffer,
    properties?: {
      correlationId?: string;
      replyTo?: string;
      userProperties?: Record<string, unknown>;
      [key: string]: unknown;
    }
  ): void {
    if (!this.session) {
      throw new Error('Not connected to Solace broker. Call connect() first.');
    }

      try {
        // Create topic destination using SolclientFactory
        const topicDestination = solace.SolclientFactory.createTopicDestination(topic);

        // Create message using SolclientFactory
        const message = solace.SolclientFactory.createMessage();
        message.setDestination(topicDestination);

        // Set message payload
        if (data instanceof ArrayBuffer) {
          message.setBinaryAttachment(data);
        } else if (typeof data === 'string') {
          message.setBinaryAttachment(data);
        } else {
          // Convert object to JSON string
          message.setBinaryAttachment(JSON.stringify(data));
        }

        // Set optional properties
        if (properties?.correlationId) {
          message.setCorrelationId(properties.correlationId);
        }

        if (properties?.replyTo) {
          message.setReplyTo(solace.SolclientFactory.createTopicDestination(properties.replyTo));
        }

        if (properties?.userProperties) {
          const userPropertyMap = message.getUserPropertyMap();
          if (userPropertyMap) {
            for (const [key, value] of Object.entries(properties.userProperties)) {
              userPropertyMap.addField(key, solace.SDTFieldType.STRING, String(value));
            }
          }
        }

        // Send message directly through session
        this.session.send(message);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (this.errorHandlerCallback) {
        this.errorHandlerCallback(err);
      }
      throw err;
    }
  }

  /**
   * Subscribe to a topic with a message handler
   *
   * @param handler - Message handler callback
   * @param topic - Topic name to subscribe to (supports wildcards, e.g., 'orders/*')
   * @param properties - Optional subscription properties
   * @returns Subscription ID
   */
  async subscribe(
    handler: SolaceMessageHandler,
    topic: string,
    properties?: SolaceSubscriptionProperties
  ): Promise<string> {
    if (!this.session) {
      throw new Error('Not connected to Solace broker. Call connect() first.');
    }

    return new Promise((resolve, reject) => {
      try {
        // Create topic subscription using SolclientFactory
        const solaceTopic = solace.SolclientFactory.createTopicDestination(topic);
        const subscriptionId = `${topic}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Create subject for this subscription
        const subject = new Subject<solace.Message>();

        // Store subscription info with handler before subscribing
        this.subscriptionMap.set(subscriptionId, {
          subject,
          topic,
          handler,
        });

        // Subscribe to topic
        // API: session.subscribe(topic, requestConfirm, topicSubscriptionCorrelationKey, requestTimeout)
        try {
          if (!this.session) {
            throw new Error('Session is null');
          }
          this.session.subscribe(
            solaceTopic,
            properties?.requestConfirm ?? true,
            subscriptionId,
            10000 // 10 second timeout
          );

          resolve(subscriptionId);
        } catch (error) {
          this.subscriptionMap.delete(subscriptionId);
          const err = error instanceof Error ? error : new Error(String(error));
          reject(err);
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        reject(err);
      }
    });
  }

  /**
   * Subscribe to a topic and return an RxJS Observable
   *
   * @param topic - Topic name to subscribe to
   * @param properties - Optional subscription properties
   * @returns Object containing the Observable and subscription ID
   *
   * @example
   * ```typescript
   * const { observable, subscriptionId } = await client.subscribeAsObservable('orders');
   * observable.subscribe(message => console.log(message.data));
   * ```
   */
  async subscribeAsObservable(
    topic: string,
    properties?: SolaceSubscriptionProperties
  ): Promise<{ observable: Observable<solace.Message>; subscriptionId: string }> {
    if (!this.session) {
      throw new Error('Not connected to Solace broker. Call connect() first.');
    }

    return new Promise((resolve, reject) => {
      try {
        const subject = new Subject<solace.Message>();
        const solaceTopic = solace.SolclientFactory.createTopicDestination(topic);
        const subscriptionId = `${topic}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Store the subject in the map before subscribing
        this.subscriptionMap.set(subscriptionId, { subject, topic });

        // Subscribe to topic
        // API: session.subscribe(topic, requestConfirm, topicSubscriptionCorrelationKey, requestTimeout)
        try {
          if (!this.session) {
            throw new Error('Session is null');
          }
          this.session.subscribe(
            solaceTopic,
            properties?.requestConfirm || true,
            subscriptionId,
            10000 // 10 second timeout
          );

          resolve({
            observable: subject.asObservable(),
            subscriptionId,
          });
        } catch (error) {
          this.subscriptionMap.delete(subscriptionId);
          const err = error instanceof Error ? error : new Error(String(error));
          reject(err);
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        reject(err);
      }
    });
  }

  /**
   * Subscribe to a topic and return an RxJS Subject
   *
   * @param topic - Topic name to subscribe to
   * @param properties - Optional subscription properties
   * @returns Object containing the Subject and subscription ID
   *
   * @example
   * ```typescript
   * const { subject, subscriptionId } = await client.subscribeAsSubject('orders');
   * subject.subscribe(message => console.log(message.data));
   * ```
   */
  async subscribeAsSubject(
    topic: string,
    properties?: SolaceSubscriptionProperties
  ): Promise<{ subject: Subject<solace.Message>; subscriptionId: string }> {
    if (!this.session) {
      throw new Error('Not connected to Solace broker. Call connect() first.');
    }

    return new Promise((resolve, reject) => {
      try {
        const subject = new Subject<solace.Message>();
        const solaceTopic = solace.SolclientFactory.createTopicDestination(topic);
        const subscriptionId = `${topic}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Store the subject in the map before subscribing
        this.subscriptionMap.set(subscriptionId, { subject, topic });

        // Subscribe to topic
        // API: session.subscribe(topic, requestConfirm, topicSubscriptionCorrelationKey, requestTimeout)
        try {
          if (!this.session) {
            throw new Error('Session is null');
          }
          this.session.subscribe(
            solaceTopic,
            properties?.requestConfirm || true,
            subscriptionId,
            10000 // 10 second timeout
          );

          resolve({
            subject,
            subscriptionId,
          });
        } catch (error) {
          this.subscriptionMap.delete(subscriptionId);
          const err = error instanceof Error ? error : new Error(String(error));
          reject(err);
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        reject(err);
      }
    });
  }

  /**
   * Unsubscribe from a topic
   *
   * @param subscriptionId - Subscription ID returned from subscribe()
   * @param topic - Topic name (optional, will be retrieved from subscription map if not provided)
   */
  async unsubscribe(subscriptionId: string, topic?: string): Promise<void> {
    if (!this.session) {
      throw new Error('Not connected to Solace broker. Call connect() first.');
    }

    try {
      // Get topic from subscription map if not provided
      const subscriptionInfo = this.subscriptionMap.get(subscriptionId);
      const topicToUnsubscribe = topic || subscriptionInfo?.topic;

      if (!topicToUnsubscribe) {
        throw new Error(`Topic not found for subscription ID: ${subscriptionId}`);
      }

      // Unsubscribe from topic
      const solaceTopic = solace.SolclientFactory.createTopicDestination(topicToUnsubscribe);
      this.session.unsubscribe(solaceTopic, true, subscriptionId, 10000);

      // Complete and remove RxJS subject
      if (subscriptionInfo) {
        subscriptionInfo.subject.complete();
        this.subscriptionMap.delete(subscriptionId);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw err;
    }
  }

  /**
   * Set error handler
   *
   * @param handler - Error handler callback
   * @returns This client instance for method chaining
   */
  errorHandler(handler: SolaceErrorHandler): SolaceClient {
    this.errorHandlerCallback = handler;
    return this;
  }

  /**
   * Set event handler for connection events
   *
   * @param handler - Event handler callback (receives event name and optional details)
   * @returns This client instance for method chaining
   */
  eventHandler(handler: SolaceEventHandler): SolaceClient {
    this.eventHandlerCallback = handler;
    return this;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.session !== null;
  }

  /**
   * Get the underlying Solace session instance
   * Useful for accessing advanced features not wrapped by this library
   */
  getSession(): solace.Session | null {
    return this.session;
  }

  /**
   * Get the solclientjs module instance
   */
  getSolace(): typeof solace {
    return solace;
  }

  /**
   * Get the Subject for a given subscription ID
   *
   * @param subscriptionId - Subscription ID
   * @returns The Subject associated with the subscription ID, or undefined if not found
   */
  getSubject(subscriptionId: string): Subject<solace.Message> | undefined {
    return this.subscriptionMap.get(subscriptionId)?.subject;
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

