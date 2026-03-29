/**
 * @macro/nats — now re-exports from @macro/transports for backward compatibility.
 * New code should import directly from '@macro/transports'.
 */
export {
  NatsTransport as NatsClient,
  type NatsConnectionOptions,
  type TransportMessage as NatsMessage,
  type MessageHandler as NatsMessageHandler,
  type ErrorHandler as NatsErrorHandler,
} from '@macro/transports';
