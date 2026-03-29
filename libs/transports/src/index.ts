// Unified transport interface
export type {
  TransportClient,
  TransportMessage,
  MessageHandler,
  ErrorHandler,
  EventHandler,
} from './lib/transport';

// AMPS transport
export { AmpsTransport } from './lib/amps/amps-transport';
export { AmpsTransport as AmpsClient } from './lib/amps/amps-transport';
export type { AmpsConnectionOptions, AmpsSowOptions } from './lib/amps/amps-transport';

// Solace transport
export { SolaceTransport } from './lib/solace/solace-transport';
export { SolaceTransport as SolaceClient } from './lib/solace/solace-transport';
export type { SolaceConnectionOptions, SolacePublishOptions } from './lib/solace/solace-transport';

// NATS transport
export { NatsTransport } from './lib/nats/nats-transport';
export { NatsTransport as NatsClient } from './lib/nats/nats-transport';
export type { NatsConnectionOptions } from './lib/nats/nats-transport';
