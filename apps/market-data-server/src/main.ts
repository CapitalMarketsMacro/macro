import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { URL } from 'url';
import { FxMarketDataService } from './fx-market-data.service';
import { TsyMarketDataService } from './tsy-market-data.service';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Create HTTP server
const server = createServer();

// Create a single WebSocket server and handle routing manually
const wss = new WebSocketServer({
  server,
  perMessageDeflate: false, // Disable compression to avoid RSV1 errors
  clientTracking: false,
});

// FX Market Data Service
const fxMarketDataService = new FxMarketDataService();

// Treasury Market Data Service
const tsyMarketDataService = new TsyMarketDataService();

// G10 currencies: USD, EUR, GBP, JPY, AUD, CAD, CHF, NZD, SEK, NOK
const G10_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'AUD',
  'CAD', 'CHF', 'NZD', 'SEK', 'NOK'
];

// Store active connections for FX
const fxClients = new Set<WebSocket>();

// Store active connections for Treasury
const tsyClients = new Set<WebSocket>();

// Single WebSocket handler with path-based routing
wss.on('connection', (ws: WebSocket, request) => {
  const url = new URL(request.url || '', `http://${request.headers.host}`);
  const pathname = url.pathname;

  // Route to FX market data handler
  if (pathname === '/marketData/fx') {
    handleFxConnection(ws);
  }
  // Route to Treasury market data handler
  else if (pathname === '/marketData/tsy') {
    handleTsyConnection(ws);
  }
  // Invalid path
  else {
    console.log(`Invalid path: ${pathname}`);
    ws.close(1008, 'Invalid path. Use /marketData/fx or /marketData/tsy');
  }
});

// FX Market Data connection handler
function handleFxConnection(ws: WebSocket) {
  console.log('New client connected to /marketData/fx');
  fxClients.add(ws);

  // Send initial connection message
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Connected to FX Market Data stream',
    currencies: G10_CURRENCIES,
    timestamp: new Date().toISOString(),
  }), { binary: false, compress: false });

  // Start publishing market data for this client
  const publishInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      const marketData = fxMarketDataService.getMarketData();
      ws.send(JSON.stringify({
        type: 'marketData',
        data: marketData,
        timestamp: new Date().toISOString(),
      }), { binary: false, compress: false });
    }
  }, 1000); // Publish every 1 second

  // Handle client disconnect
  ws.on('close', () => {
    console.log('Client disconnected from /marketData/fx');
    fxClients.delete(ws);
    clearInterval(publishInterval);
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    fxClients.delete(ws);
    clearInterval(publishInterval);
  });

  // Handle incoming messages (optional - for client requests)
  ws.on('message', (message: Buffer) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('Received message from client:', data);

      // Handle subscription requests
      if (data.type === 'subscribe') {
        ws.send(JSON.stringify({
          type: 'subscribed',
          message: 'Subscribed to FX Market Data',
          timestamp: new Date().toISOString(),
        }), { binary: false, compress: false });
      }
    } catch (error) {
      console.error('Error parsing client message:', error);
    }
  });
}

// Treasury Market Data connection handler
function handleTsyConnection(ws: WebSocket) {
  console.log('New client connected to /marketData/tsy');
  tsyClients.add(ws);

  // Get list of securities
  const securities = tsyMarketDataService.getSecurities();

  // Send initial connection message
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Connected to US Treasury Market Data stream',
    securities: securities,
    timestamp: new Date().toISOString(),
  }), { binary: false, compress: false });

  // Start publishing market data for this client
  const publishInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      const marketData = tsyMarketDataService.getMarketData();
      ws.send(JSON.stringify({
        type: 'marketData',
        data: marketData,
        timestamp: new Date().toISOString(),
      }), { binary: false, compress: false });
    }
  }, 1000); // Publish every 1 second

  // Handle client disconnect
  ws.on('close', () => {
    console.log('Client disconnected from /marketData/tsy');
    tsyClients.delete(ws);
    clearInterval(publishInterval);
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    tsyClients.delete(ws);
    clearInterval(publishInterval);
  });

  // Handle incoming messages (optional - for client requests)
  ws.on('message', (message: Buffer) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('Received message from client:', data);

      // Handle subscription requests
      if (data.type === 'subscribe') {
        ws.send(JSON.stringify({
          type: 'subscribed',
          message: 'Subscribed to US Treasury Market Data',
          timestamp: new Date().toISOString(),
        }), { binary: false, compress: false });
      }
    } catch (error) {
      console.error('Error parsing client message:', error);
    }
  });
}

// Start the HTTP server
server.listen(PORT, () => {
  console.log(`Market Data Server running on port ${PORT}`);
  console.log(`WebSocket endpoints:`);
  console.log(`  - FX Market Data: ws://localhost:${PORT}/marketData/fx`);
  console.log(`  - Treasury Market Data: ws://localhost:${PORT}/marketData/tsy`);
  console.log(`Publishing FX market data for G10 currencies: ${G10_CURRENCIES.join(', ')}`);
  console.log(`Publishing US Treasury market data for various maturities`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  wss.close(() => {
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing server...');
  wss.close(() => {
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
});
