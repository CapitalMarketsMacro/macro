import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const DATA_CONNECTIVITY_DOC = `# Data Connectivity

## Unified Transports (@macro/transports) — RECOMMENDED

The unified transports library provides a single \`TransportClient\` interface for AMPS, Solace, and NATS.

### Framework-Agnostic
\`\`\`typescript
import { NatsTransport, type TransportMessage } from '@macro/transports';

const client = new NatsTransport('my-app');
await client.connect({ servers: 'ws://localhost:8224' });

// Subscribe (Observable)
const { observable } = await client.subscribeAsObservable('prices.>');
observable.subscribe(msg => console.log(msg.json()));

// Publish
client.publish('orders.new', { symbol: 'AAPL', qty: 100 });

// Request/Reply (NATS only)
const reply = await client.request('service.ping', { ts: Date.now() });

await client.disconnect();
\`\`\`

### Angular (DI Injectable)
\`\`\`typescript
import { NatsTransportService } from '@macro/transports/angular';

@Component({ ... })
export class MyComponent {
  private transport = inject(NatsTransportService);

  async ngOnInit() {
    await this.transport.connect({ servers: 'ws://localhost:8224' });
    const { observable } = await this.transport.subscribeAsObservable('prices.>');
    observable.subscribe(msg => this.processData(msg.json()));
  }

  ngOnDestroy() {
    this.transport.disconnect();
  }
}
\`\`\`

### React (Hooks)
\`\`\`tsx
import { useNatsTransport, useTransportSubscription } from '@macro/transports/react';

function MyComponent() {
  const { client, connected, connect } = useNatsTransport('my-app');

  useEffect(() => {
    connect({ servers: 'ws://localhost:8224' });
  }, []);

  // Auto-managed subscription
  const messages = useTransportSubscription(client, 'prices.>', connected);

  return <div>{messages.map(m => <p>{m.json().price}</p>)}</div>;
}
\`\`\`

### Connection Options by Transport

| Transport | Constructor | Connect Options |
|-----------|-----------|----------------|
| AMPS | \`new AmpsTransport('name')\` | \`{ url: 'ws://host:9100/amps/json' }\` |
| Solace | \`new SolaceTransport()\` | \`{ hostUrl: 'ws://host:8008', vpnName, userName, password }\` |
| NATS | \`new NatsTransport('name')\` | \`{ servers: 'ws://host:8224' }\` |

---

## Standalone Transport Libraries (legacy)

### @macro/amps
\`\`\`typescript
import { AmpsClient } from '@macro/amps';
const client = new AmpsClient('my-app');
await client.connect('ws://localhost:9100/amps/json');
await client.subscribe(msg => console.log(msg.data), 'orders', "/symbol='AAPL'");
client.publish('orders', { symbol: 'AAPL', qty: 100 });
\`\`\`

### @macro/solace
\`\`\`typescript
import { SolaceClient } from '@macro/solace';
const client = new SolaceClient();
await client.connect({ hostUrl: 'ws://localhost:8008', vpnName: 'default', userName: 'default', password: 'default' });
const { observable } = await client.subscribeAsObservable('orders/*');
\`\`\`

### @macro/nats
\`\`\`typescript
import { NatsClient } from '@macro/nats';
const client = new NatsClient('my-app');
await client.connect({ servers: 'ws://localhost:8224' });
\`\`\`

---

## WebSocket market-data-server
Node.js mock data server providing FX and Treasury market data:
\`\`\`
ws://localhost:3000/marketData/fx   — 15 G10 FX rates (1s interval)
ws://localhost:3000/marketData/tsy  — 11 US Treasury prices (1s interval)
\`\`\`
Start with: \`npx nx serve market-data-server\`

---

## @macro/rxutils — Conflation Utilities
\`\`\`typescript
import { ConflationSubject } from '@macro/rxutils';
const conflated = new ConflationSubject<string, MarketData>(100);
conflated.next({ key: 'EUR/USD', value: { bid: 1.0850 } });
conflated.subscribeToConflated(({ key, value }) => grid.updateRows$.next([value]));
\`\`\`

---

## Integration Pattern: Transport -> Conflation -> Grid

\`\`\`typescript
// 1. Connect transport
const transport = new NatsTransport('fx-app');
await transport.connect({ servers: 'ws://localhost:8224' });

// 2. Subscribe
const { observable } = await transport.subscribeAsObservable('fx.rates.>');

// 3. Conflate
const conflated = new ConflationSubject<string, FxRate>(100);
observable.subscribe(msg => {
  const data = msg.json<FxRate>();
  conflated.next({ key: data.ccyPair, value: data });
});

// 4. Wire to grid
conflated.subscribeToConflated(({ value }) => {
  grid.updateRows$.next([value]);
});
\`\`\`

Works identically for Angular (\`MacroAngularGrid\`) and React (\`MacroReactGrid\`).

---

## Analytics via NATS

Workspace analytics events are published to NATS automatically. Subscribe to monitor:
\`\`\`bash
nats subscribe "macro.analytics.>"               # All events
nats subscribe "macro.analytics.<user>.>"        # Single user
\`\`\`

Topic format: \`macro.analytics.<user>.<source>.<type>.<action>\`

The Analytics Dashboard view (\`macro-analytics-dashboard\`) provides a real-time UI for monitoring these events.
`;

export function registerDataConnectivity(server: McpServer): void {
  server.resource('data-connectivity', 'macro://data-connectivity', { mimeType: 'text/markdown' }, async () => ({
    contents: [
      {
        uri: 'macro://data-connectivity',
        text: DATA_CONNECTIVITY_DOC,
        mimeType: 'text/markdown',
      },
    ],
  }));
}
