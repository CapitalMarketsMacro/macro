import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { URL } from 'url';
import { FxMarketDataService } from './fx-market-data.service';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Create HTTP server
const server = createServer();

// Create WebSocket server
const wss = new WebSocketServer({
  server,
  path: '/marketData/fx',
});

// FX Market Data Service
const fxMarketDataService = new FxMarketDataService();

// G10 currencies: USD, EUR, GBP, JPY, AUD, CAD, CHF, NZD, SEK, NOK
const G10_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'AUD',
  'CAD', 'CHF', 'NZD', 'SEK', 'NOK'
];

// Store active connections
const clients = new Set<WebSocket>();

wss.on('connection', (ws: WebSocket, request) => {
  const url = new URL(request.url || '', `http://${request.headers.host}`);
  
  // Only accept connections to /marketData/fx
  if (url.pathname !== '/marketData/fx') {
    ws.close(1008, 'Invalid path. Use /marketData/fx');
    return;
  }

  console.log('New client connected to /marketData/fx');
  clients.add(ws);

  // Send initial connection message
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Connected to FX Market Data stream',
    currencies: G10_CURRENCIES,
    timestamp: new Date().toISOString(),
  }));

  // Start publishing market data for this client
  const publishInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      const marketData = fxMarketDataService.getMarketData();
      ws.send(JSON.stringify({
        type: 'marketData',
        data: marketData,
        timestamp: new Date().toISOString(),
      }));
    }
  }, 1000); // Publish every 1 second

  // Handle client disconnect
  ws.on('close', () => {
    console.log('Client disconnected from /marketData/fx');
    clients.delete(ws);
    clearInterval(publishInterval);
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
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
        }));
      }
    } catch (error) {
      console.error('Error parsing client message:', error);
    }
  });
});

// Start the HTTP server
server.listen(PORT, () => {
  console.log(`Market Data Server running on port ${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/marketData/fx`);
  console.log(`Publishing FX market data for G10 currencies: ${G10_CURRENCIES.join(', ')}`);
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
