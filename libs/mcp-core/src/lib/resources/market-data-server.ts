import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const MARKET_DATA_SERVER_DOC = `# Market Data Server

A standalone Node.js WebSocket server that publishes simulated market data at 1-second intervals.
Supports path-based routing for different data streams.

## Running

\`\`\`bash
npx nx serve market-data-server
\`\`\`

**Port:** 3000

## Endpoints

| Endpoint | Data |
|----------|------|
| \`ws://localhost:3000/marketData/fx\` | 15 G10 FX currency pairs |
| \`ws://localhost:3000/marketData/tsy\` | 11 Treasury securities + benchmark rates |

## Message Protocol

### Connection Welcome
\`\`\`jsonc
{ "type": "connected", "message": "...", "currencies": [...], "timestamp": "..." }
\`\`\`

### Market Data Tick (every 1 second)
\`\`\`jsonc
{ "type": "marketData", "data": { "pairs": [...] }, "timestamp": "..." }
\`\`\`

### Client Subscription
\`\`\`jsonc
// Client sends:
{ "type": "subscribe" }

// Server responds:
{ "type": "subscribed", "message": "...", "timestamp": "..." }
\`\`\`

## FX Data Shape

15 G10 currency pairs with 1-second simulated updates:

**Majors:** EURUSD, GBPUSD, USDJPY, AUDUSD, USDCAD, USDCHF, NZDUSD
**Exotics:** USDSEK, USDNOK
**Crosses:** EURGBP, EURJPY, GBPJPY, AUDJPY, EURCHF, GBPCHF

Each pair provides:
- Symbol, Base, Quote
- Bid, Ask, Mid, Spread
- Change, Change%

**Precision:** 5 decimal places (2 for JPY pairs)

## Treasury Data Shape

11 US Treasury securities with 1-second updates:

**T-Bills (3):** 3-month, 6-month, 1-year (zero coupon)
**T-Notes (6):** 2, 3, 5, 7, 10-year maturities
**T-Bonds (2):** 20-year, 30-year

Prices displayed in **Treasury 32nd notation** (e.g., \`99-16\` = 99 + 16/32, \`99-16+\` = 99 + 16.5/32).

Columns: CUSIP, Type, Maturity, YTM, Coupon, Price, Yield, Bid, Ask, Spread, Change, Volume, Duration, Convexity.

**Benchmark rates included:**
\`\`\`json
{ "benchmarkRates": { "2Y": 4.30, "5Y": 4.45, "10Y": 4.55, "30Y": 4.65 } }
\`\`\`

## Connecting from an App

\`\`\`typescript
// Browser WebSocket client
const ws = new WebSocket('ws://localhost:3000/marketData/fx');

ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'subscribe' }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'marketData') {
    const pairs = msg.data.pairs;
    // Update grid: grid.updateRows$.next(pairs);
  }
};
\`\`\`

## Source Files

- \`apps/market-data-server/src/main.ts\` — WebSocket server with path routing
- \`apps/market-data-server/src/fx-market-data.service.ts\` — 15 FX pairs data generator
- \`apps/market-data-server/src/tsy-market-data.service.ts\` — 11 Treasury securities generator
`;

export function registerMarketDataServer(server: McpServer): void {
  server.resource('market-data-server', 'macro://market-data-server', { mimeType: 'text/markdown' }, async () => ({
    contents: [
      {
        uri: 'macro://market-data-server',
        text: MARKET_DATA_SERVER_DOC,
        mimeType: 'text/markdown',
      },
    ],
  }));
}
