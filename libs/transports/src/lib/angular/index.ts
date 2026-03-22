import { Injectable } from '@angular/core';
import { AmpsTransport } from '../amps/amps-transport';
import { SolaceTransport } from '../solace/solace-transport';
import { NatsTransport } from '../nats/nats-transport';

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
