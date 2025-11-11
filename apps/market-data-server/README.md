# Market Data Server

A WebSocket server that publishes real-time FX market data for G10 currencies.

## Overview

This Node.js application hosts a WebSocket server that streams FX market data for G10 currencies:
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

## WebSocket Endpoint

**Path**: `/marketData/fx`

**URL**: `ws://localhost:3000/marketData/fx`

## Usage

### Start the server

```bash
nx serve market-data-server
```

Or in production mode:

```bash
nx build market-data-server
node dist/apps/market-data-server/main.js
```

### Connect to the WebSocket

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

## Message Format

### Connection Message

When a client connects, they receive:

```json
{
  "type": "connected",
  "message": "Connected to FX Market Data stream",
  "currencies": ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD", "SEK", "NOK"],
  "timestamp": "2025-11-11T16:30:00.000Z"
}
```

### Market Data Message

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

### Client Subscription

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

## Architecture

- **main.ts**: WebSocket server setup and connection handling
- **fx-market-data.service.ts**: Service that generates realistic FX market data with random walk price movements

## Currency Pairs

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

