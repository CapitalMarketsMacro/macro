# Market Data Server

A WebSocket server that publishes real-time market data for FX and US Treasury securities.

## Overview

This Node.js application hosts WebSocket servers that stream:
1. **FX Market Data** for G10 currencies
2. **US Treasury Market Data** for various maturities

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

