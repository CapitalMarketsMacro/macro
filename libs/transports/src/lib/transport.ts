import { Observable, Subject } from 'rxjs';

/**
 * Unified message envelope returned by all transports.
 */
export interface TransportMessage<T = unknown> {
  /** Topic/subject the message was received on */
  topic: string;
  /** Raw string data */
  data: string;
  /** Parse data as JSON */
  json<R = T>(): R;
  /** Reply-to subject (for request/reply patterns) */
  reply?: string;
  /** Transport-specific raw message (amps Message, solace Message, nats Msg) */
  raw?: unknown;
}

/** Callback handler for subscriptions */
export type MessageHandler<T = unknown> = (message: TransportMessage<T>) => void;

/** Error handler callback */
export type ErrorHandler = (error: Error) => void;

/** Event handler for transport-level events (connected, disconnected, etc.) */
export type EventHandler = (event: string, details?: unknown) => void;

/**
 * Unified transport client interface.
 * All messaging transports (AMPS, Solace, NATS) implement this contract.
 */
export interface TransportClient {
  /** Transport name for identification */
  readonly transportName: string;

  /** Connect to the messaging server */
  connect(options: unknown): Promise<void>;

  /** Disconnect and clean up all subscriptions */
  disconnect(): Promise<void>;

  /** Publish a message to a topic */
  publish(topic: string, data: string | Record<string, unknown>): void;

  /** Subscribe with a callback handler, returns subscription ID */
  subscribe(handler: MessageHandler, topic: string): Promise<string>;

  /** Subscribe and return an RxJS Observable */
  subscribeAsObservable(topic: string): Promise<{ observable: Observable<TransportMessage>; subscriptionId: string }>;

  /** Subscribe and return an RxJS Subject (writable) */
  subscribeAsSubject(topic: string): Promise<{ subject: Subject<TransportMessage>; subscriptionId: string }>;

  /** Unsubscribe by subscription ID */
  unsubscribe(subscriptionId: string): Promise<void>;

  /** Check if connected */
  readonly isConnected: boolean;

  /** Register a global error handler */
  onError(handler: ErrorHandler): void;

  /** Register an event handler */
  onEvent?(handler: EventHandler): void;

  /** Get all active subscription IDs */
  getSubscriptionIds(): string[];
}
