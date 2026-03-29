/**
 * @macro/amps — now re-exports from @macro/transports for backward compatibility.
 * New code should import directly from '@macro/transports'.
 */
export {
  AmpsTransport as AmpsClient,
  type AmpsConnectionOptions,
  type AmpsSowOptions,
  type TransportMessage as AmpsMessage,
  type MessageHandler as AmpsMessageHandler,
  type ErrorHandler as AmpsErrorHandler,
} from '@macro/transports';

// Re-export AMPS types for convenience
export { Client, Command } from 'amps';
