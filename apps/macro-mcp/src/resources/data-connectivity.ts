import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const DATA_CONNECTIVITY_DOC = `# Data Connectivity

## Transport Libraries

### @macro/amps — AMPS Client Wrapper
60East AMPS pub/sub messaging for real-time data.

\`\`\`typescript
import { AmpsClient, AmpsMessage } from '@macro/amps';

const client = new AmpsClient('my-app');
await client.connect('ws://localhost:9100/amps/json');

// Callback-based subscribe
const subId = await client.subscribe(
  (msg: AmpsMessage) => console.log(msg.data),
  'orders',
  "/symbol='AAPL'"   // optional AMPS filter
);

// RxJS Observable-based subscribe
const { observable, subId } = await client.subscribeAsObservable('orders');
observable.subscribe(msg => console.log(msg.data));

// RxJS Subject-based subscribe
const { subject, subId } = await client.subscribeAsSubject('orders');
subject.subscribe(msg => console.log(msg.data));

// SOW (State-of-the-World) query
await client.sow(msg => console.log(msg.data), 'orders', "/status='active'");

// Publish
client.publish('orders', { symbol: 'AAPL', qty: 100 });

// Cleanup
await client.unsubscribe(subId);
await client.disconnect();
\`\`\`

Key types: \`AmpsClient\`, \`AmpsMessage\`, \`AmpsSowOptions\`, \`AmpsMessageHandler\`, \`AmpsErrorHandler\`

### @macro/solace — Solace PubSub+ Client Wrapper
Solace broker for event-driven messaging.

\`\`\`typescript
import { SolaceClient, SolaceMessage } from '@macro/solace';

const client = new SolaceClient();
await client.connect({
  hostUrl: 'ws://localhost:8008',
  vpnName: 'default',
  userName: 'default',
  password: 'default',
});

// Callback-based subscribe
const subId = await client.subscribe(
  (msg: SolaceMessage) => console.log(msg.getBinaryAttachment()),
  'orders/stock'
);

// RxJS Observable subscribe
const { observable, subscriptionId } = await client.subscribeAsObservable('orders/*');
observable.subscribe(msg => console.log(msg));

// RxJS Subject subscribe
const { subject, subscriptionId } = await client.subscribeAsSubject('orders/*');

// Publish
client.publish('orders/stock', { symbol: 'TSLA', qty: 50 });

// Cleanup
await client.unsubscribe(subscriptionId);
await client.disconnect();
\`\`\`

Key types: \`SolaceClient\`, \`SolaceMessage\`, \`SolaceConnectionProperties\`, \`SolaceMessageHandler\`

### WebSocket market-data-server
Node.js mock data server providing FX and Treasury market data:
\`\`\`
ws://localhost:3000/marketData/fx   — G10 FX rates (1s interval)
ws://localhost:3000/marketData/tsy  — US Treasury prices (1s interval)
\`\`\`
Start with: \`npx nx serve market-data-server\`

## @macro/rxutils — Conflation Utilities

Reduces high-frequency updates by batching by key:

\`\`\`typescript
import { ConflationSubject, conflateByKey, ConflatedValue } from '@macro/rxutils';

// Option 1: ConflationSubject (recommended)
const conflated = new ConflationSubject<string, MarketData>(100); // 100ms interval

// Feed raw data in
conflated.next({ key: 'EUR/USD', value: { bid: 1.0850, ask: 1.0852 } });
conflated.next({ key: 'EUR/USD', value: { bid: 1.0851, ask: 1.0853 } });

// Subscribe to conflated output (only latest per key per interval)
conflated.subscribeToConflated(({ key, value }) => {
  console.log(key, value); // EUR/USD { bid: 1.0851, ask: 1.0853 }
});

// Pipe to another subject
conflated.pipeToSubject(anotherSubject);

// Option 2: conflateByKey function
const conflated$ = conflateByKey(source$, 100);
\`\`\`

## Integration Pattern: Transport → Conflation → Grid

The standard data flow for real-time grid updates:

\`\`\`typescript
// 1. Connect to data source
const ampsClient = new AmpsClient('fx-app');
await ampsClient.connect('ws://localhost:9100/amps/json');

// 2. Subscribe and get observable
const { observable } = await ampsClient.subscribeAsObservable('fx-rates');

// 3. Conflate by key
const conflated = new ConflationSubject<string, FxRate>(100);
observable.subscribe(msg => {
  const data = msg.data as FxRate;
  conflated.next({ key: data.ccyPair, value: data });
});

// 4. Wire to grid's updateRows$ subject
conflated.subscribeToConflated(({ value }) => {
  grid.updateRows$.next([value]);
});
\`\`\`

This pattern works identically for both Angular (\`MacroAngularGrid\`) and React (\`MacroReactGrid\`).
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
