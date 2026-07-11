# Market Data Server

A WebSocket server that publishes real-time market data for FX and US Treasury securities.

## Overview

This Node.js application hosts WebSocket servers that stream:
1. **FX Market Data** for G10 currencies
2. **US Treasury Market Data** for various maturities
3. **Prism tables** — a JSON *table protocol* endpoint (`/prism`) for the Prism blotters' plain-WebSocket source

It also hosts the **Workspace Storage API (reference)** — a REST service at `/workspace/v1` used to verify the OpenFin workspace storage client before the phase-2 Java service exists.

### FX Market Data - G10 Currencies:
- USD (US Dollar)
- EUR (Euro)
- GBP (British Pound)
- JPY (Japanese Yen)
- AUD (Australian Dollar)
- CAD (Canadian Dollar)
- CHF (Swiss Franc)
- NZD (New Zealand Dollar)
- SEK (Swedish Krona)
- NOK (Norwegian Krone)

## WebSocket Endpoints

### FX Market Data

**Path**: `/marketData/fx`

**URL**: `ws://localhost:3000/marketData/fx`

### US Treasury Market Data

**Path**: `/marketData/tsy`

**URL**: `ws://localhost:3000/marketData/tsy`

### Prism Tables (table protocol)

**Path**: `/prism`

**URL**: `ws://localhost:3000/prism`

On connect the server announces its tables; the client subscribes to one, gets a snapshot
(JSON array), then live updates (single row or array):

```
server → { "type": "tables", "tables": [{ "name", "title", "description", "keyField", "mode" }] }
client → { "type": "subscribe", "table": "ust_market_data" }     (also: listTables / unsubscribe)
server → { "type": "subscribed", "table", "keyField", "mode" }
server → { "type": "snapshot", "table", "rows": [ ... ] }
server → { "type": "update", "table", "row": { ... } }           (or "rows": [ ... ] batches)
server → { "type": "error", "message": "..." }                   (e.g. unknown table)
```

The same tables are also served over **REST** (snapshot-only, CORS enabled, for the blotters' REST
source — rows as **bare JSON arrays**):

```
GET http://localhost:3000/prism/tables            -> { "tables": [ ...catalog... ] }
GET http://localhost:3000/prism/tables/<name>     -> [ ...rows ]        (404 for unknown tables)
```

Two tables over a shared US-rates universe — 7 cash **OTR Treasuries** (2Y–30Y) + 8 **CME
Treasury futures** (ZT/Z3N/ZF/ZN/TN/TWE/ZB/UB, Sep-26):

| Table | Mode | Key | Contents |
| --- | --- | --- | --- |
| `ust_market_data` | snapshot-update | `symbol` | Top-of-book: bid/ask/mid/last (decimals + dealer 32nds displays), sizes, yields (cash), open interest (futures) — ticks every 500ms |
| `ust_trades` | append | `tradeId` | Trade prints: side, price, size ($MM cash / contracts futures), yield, venue (BrokerTec / Dealerweb / Fenics UST / CME Globex), counterparty — a print every 0.6–1.8s, occasional bursts as arrays |

## Workspace Storage API (reference)

Phase-1 **reference implementation** of the Macro Workspace Storage contract
(spec: `docs/api/workspace-storage-api.openapi.yaml`; client:
`RestWorkspaceStorageClient` in `@macro/openfin`). Phase 2 replaces it with a Java
Spring Boot + MongoDB service speaking the same wire contract.

**Base URL**: `http://localhost:3000/workspace/v1`

| Endpoint | Description |
| --- | --- |
| `GET /health` | Liveness: `{ status: 'ok', service, uptimeSec, users, persistedTo }` (no user scope) |
| `GET /workspaces?query=` | List workspaces; optional case-insensitive substring filter on title / workspaceId |
| `GET /workspaces/{id}` | One workspace (200 + `ETag`) or 404 |
| `PUT /workspaces/{id}` | Save workspace — 201 created / 200 replaced; 400 when body `workspaceId` ≠ path id |
| `DELETE /workspaces/{id}` | 204, or 404 when absent |
| `GET /pages` · `GET/PUT/DELETE /pages/{id}` | Same semantics, keyed by `pageId` |
| `GET/PUT/DELETE /dock/{dockProviderId}` | Dock provider config, keyed by `id` |
| `GET /favorites` | `{ appIds: string[] }` — empty list when never saved (never 404) |
| `PUT /favorites` | Replace the favorites list — 200 |
| `GET /preferences` | All preferences as `[ { key, value } ]` |
| `GET/PUT/DELETE /preferences/{key}` | One preference: PUT body `{ value: <any JSON> }` → 201/200 |
| `GET /config/{name}` | Platform config JSON (not user-scoped): `settings` \| `apps` \| `dock-config` \| `storefront-config` \| `snap-config` \| `entitlements` |
| `PUT /config/{name}` | 501 — admin operation reserved for phase 2 |
| `GET /dock-apps` | LOB dock apps (**not user-scoped** — publisher-facing, shared across all users): list sorted by `sortOrder` ascending, undefined last (stable); empty array when none (never 404) |
| `GET /dock-apps/{id}` | One LOB dock app (200 + `ETag`) or 404 |
| `PUT /dock-apps/{id}` | Publish/replace a LOB dock app — 201/200; 400 unless `id`/`label`/`iconUrl` are non-empty and `type` is `icon` (with `url`) or `dropdown` (with non-empty `children`, each with `id`/`label`/`url`) |
| `DELETE /dock-apps/{id}` | 204, or 404 when absent |
| `GET /store-apps` | LOB store apps (**not user-scoped** — publisher-facing, shared across all users): list sorted by `sortOrder` ascending, undefined last (stable); empty array when none (never 404) |
| `GET /store-apps/{appId}` | One LOB store app (200 + `ETag`) or 404 |
| `PUT /store-apps/{appId}` | Publish/replace a LOB store app — 201/200; 400 unless `appId`/`title`/`manifest` are non-empty, `manifestType` is `view` \| `manifest`, and `icons` is a non-empty array of `{ src }`; optional `description`/`images[{src}]`/`publisher`/`contactEmail`/`supportEmail`/`tags[]`/`category`/`lob`/`sortOrder` are type-checked; unknown fields rejected |
| `DELETE /store-apps/{appId}` | 204, or 404 when absent |

Conventions: errors are `application/problem+json` (RFC 9457); single-resource GETs
carry an `ETag`, and an optional `If-Match` on PUT/DELETE returns 412 on mismatch;
CORS is wide open (the OpenFin workspace runs on another localhost port).

**User scoping**: every user-scoped route reads the `X-User-Id` request header
(default `anonymous`). This is an interim scheme — phase 2 replaces it with a real
identity token (OAuth2/JWT).

**Environment variables**:

- `WORKSPACE_STORE_FILE` — JSON persistence file for the in-memory store (debounced
  atomic writes; survives restarts). Default: `<cwd>/.workspace-store.json` (gitignored).
- `WORKSPACE_CONFIG_DIR` — directory the `/config/{name}` files are served from
  (read fresh per request). Default: `<cwd>/apps/macro-workspace/public/local`.

**Postman**: import `docs/api/workspace-storage-api.postman_collection.json` —
covers every endpoint plus scenario flows (ETag/If-Match 412, per-user isolation)
with assertions on each request. Variables: `baseUrl` (defaults to this server),
`userId` (the `X-User-Id` value). Run top-to-bottom (Collection Runner or
`npx newman run docs/api/workspace-storage-api.postman_collection.json`) — later
requests reuse ETags captured by earlier ones.

## Usage

### Start the server

```bash
npm run start:market-data-server   # or: nx serve market-data-server
```

Or build + run the compiled output directly (production mode):

```bash
npm run exec:market-data-server
# equivalent to:
#   nx build market-data-server
#   node dist/apps/market-data-server/apps/market-data-server/src/main.js
```

### Connect to FX Market Data WebSocket

```javascript
const ws = new WebSocket('ws://localhost:3000/marketData/fx');

ws.onopen = () => {
  console.log('Connected to FX Market Data stream');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Market Data:', data);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Connection closed');
};
```

### Connect to Treasury Market Data WebSocket

```javascript
const ws = new WebSocket('ws://localhost:3000/marketData/tsy');

ws.onopen = () => {
  console.log('Connected to US Treasury Market Data stream');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Treasury Market Data:', data);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Connection closed');
};
```

## Message Format

### FX Market Data

#### Connection Message

When a client connects to `/marketData/fx`, they receive:

```json
{
  "type": "connected",
  "message": "Connected to FX Market Data stream",
  "currencies": ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD", "SEK", "NOK"],
  "timestamp": "2025-11-11T16:30:00.000Z"
}
```

#### Market Data Message

Published every 1 second:

```json
{
  "type": "marketData",
  "data": {
    "pairs": [
      {
        "base": "EUR",
        "quote": "USD",
        "symbol": "EURUSD",
        "bid": 1.08495,
        "ask": 1.08505,
        "mid": 1.08500,
        "spread": 0.00010,
        "change": 0.00015,
        "changePercent": 0.0138
      },
      // ... more pairs
    ],
    "timestamp": "2025-11-11T16:30:00.000Z"
  },
  "timestamp": "2025-11-11T16:30:00.000Z"
}
```

#### Client Subscription

Clients can send subscription messages:

```json
{
  "type": "subscribe"
}
```

The server will respond with:

```json
{
  "type": "subscribed",
  "message": "Subscribed to FX Market Data",
  "timestamp": "2025-11-11T16:30:00.000Z"
}
```

## Configuration

The server runs on port 3000 by default. You can change this by setting the `PORT` environment variable:

```bash
PORT=8080 nx serve market-data-server
```

### US Treasury Market Data

#### Connection Message

When a client connects to `/marketData/tsy`, they receive:

```json
{
  "type": "connected",
  "message": "Connected to US Treasury Market Data stream",
  "securities": [
    {
      "cusip": "912797XZ8",
      "securityType": "T-Bill",
      "maturity": "2025-12-15"
    },
    // ... more securities
  ],
  "timestamp": "2025-11-11T16:30:00.000Z"
}
```

#### Market Data Message

Published every 1 second:

```json
{
  "type": "marketData",
  "data": {
    "securities": [
      {
        "cusip": "91282CJX8",
        "securityType": "T-Note",
        "maturity": "2026-11-15",
        "yearsToMaturity": 1.0,
        "coupon": 4.25,
        "price": 99.95,
        "yield": 4.28,
        "bid": 99.94,
        "ask": 99.96,
        "spread": 0.02,
        "change": 0.01,
        "changePercent": 0.01,
        "volume": 125.50,
        "duration": 0.98,
        "convexity": 0.96
      },
      // ... more securities
    ],
    "benchmarkRates": {
      "2Y": 4.30,
      "5Y": 4.45,
      "10Y": 4.55,
      "30Y": 4.65
    },
    "timestamp": "2025-11-11T16:30:00.000Z"
  },
  "timestamp": "2025-11-11T16:30:00.000Z"
}
```

#### Client Subscription

Clients can send subscription messages:

```json
{
  "type": "subscribe"
}
```

The server will respond with:

```json
{
  "type": "subscribed",
  "message": "Subscribed to US Treasury Market Data",
  "timestamp": "2025-11-11T16:30:00.000Z"
}
```

## Architecture

- **main.ts**: WebSocket server setup and connection handling for both FX and Treasury endpoints
- **fx-market-data.service.ts**: Service that generates realistic FX market data with random walk price movements
- **tsy-market-data.service.ts**: Service that generates realistic US Treasury market data with prices, yields, duration, and convexity
- **workspace-storage-api.service.ts**: Reference Workspace Storage API (`/workspace/v1`) — per-user in-memory store with debounced JSON-file persistence

## FX Currency Pairs

The server publishes data for the following major currency pairs:
- EUR/USD
- GBP/USD
- USD/JPY
- AUD/USD
- USD/CAD
- USD/CHF
- NZD/USD
- USD/SEK
- USD/NOK
- EUR/GBP
- EUR/JPY
- GBP/JPY
- AUD/JPY
- EUR/CHF
- GBP/CHF

## US Treasury Securities

The server publishes data for the following Treasury securities:
- **T-Bills**: 3-month, 6-month, 1-year maturities
- **T-Notes**: 2-year, 3-year, 5-year, 7-year, 10-year maturities
- **T-Bonds**: 20-year, 30-year maturities

Each security includes:
- CUSIP identifier
- Security type (T-Bill, T-Note, T-Bond)
- Maturity date
- Coupon rate
- Price (bid, ask, mid)
- Yield to maturity
- Spread
- Price change and percentage change
- Trading volume
- Duration (modified duration)
- Convexity

The service also provides benchmark rates for:
- 2-Year Treasury
- 5-Year Treasury
- 10-Year Treasury
- 30-Year Treasury

