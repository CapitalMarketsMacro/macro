import { Injectable } from '@angular/core';
import { AmpsTransport } from '../amps/amps-transport';
import { SolaceTransport } from '../solace/solace-transport';
import { NatsTransport } from '../nats/nats-transport';
import { NatsJetStreamTransport } from '../nats/nats-jetstream-transport';

/**
 * Angular injectable wrappers for transport clients.
 * Provided in root — inject directly into components/services.
 *
 * @example
 * ```typescript
 * private nats = inject(NatsTransportService);
 *
 * async ngOnInit() {
 *   await this.nats.connect({ servers: 'ws://localhost:8224' });
 *   const { observable } = await this.nats.subscribeAsObservable('prices.>');
 *   observable.subscribe(msg => console.log(msg.json()));
 * }
 * ```
 */

@Injectable({ providedIn: 'root' })
export class AmpsTransportService extends AmpsTransport {
  constructor() {
    super('angular-amps-client');
  }
}

@Injectable({ providedIn: 'root' })
export class SolaceTransportService extends SolaceTransport {
  constructor() {
    super();
  }
}

@Injectable({ providedIn: 'root' })
export class NatsTransportService extends NatsTransport {
  constructor() {
    super('angular-nats-client');
  }
}

/**
 * Root-singleton JetStream client. Convenient for a single shared connection; for multiple
 * per-source connections (e.g. the Prism blotter) instantiate `NatsJetStreamTransport` directly,
 * since a singleton's `connect()` throws once already connected.
 */
@Injectable({ providedIn: 'root' })
export class NatsJetStreamTransportService extends NatsJetStreamTransport {
  constructor() {
    super('angular-nats-jetstream-client');
  }
}
