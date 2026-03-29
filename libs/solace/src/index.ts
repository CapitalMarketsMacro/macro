/**
 * @macro/solace — now re-exports from @macro/transports for backward compatibility.
 * New code should import directly from '@macro/transports'.
 */
export {
  SolaceTransport as SolaceClient,
  type SolaceConnectionOptions as SolaceConnectionProperties,
  type SolacePublishOptions,
  type TransportMessage as SolaceMessage,
  type MessageHandler as SolaceMessageHandler,
  type ErrorHandler as SolaceErrorHandler,
  type EventHandler as SolaceEventHandler,
} from '@macro/transports';
