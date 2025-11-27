# @macro/amps

A TypeScript wrapper library for 60East AMPS (Advanced Message Processing System) JavaScript client.

## Overview

This library provides a clean, type-safe interface for interacting with AMPS servers. It wraps the [60East AMPS JavaScript Client 5.3.4](https://crankuptheamps.com/clients/amps-client-javascript) and offers:

- **Connection Management**: Easy connection/disconnection
- **Publish/Subscribe**: Publish messages and subscribe to topics with filtering
- **State-of-the-World (SOW)**: Query existing data from topics
- **Error Handling**: Built-in error handler support
- **Type Safety**: Full TypeScript support with comprehensive type definitions

## Installation

```bash
npm install @macro/amps
```

**Note**: This library requires the `amps` package from 60East. Install it separately:

```bash
npm install amps
```

## Usage

### Basic Connection and Subscribe

```typescript
import { AmpsClient } from '@macro/amps';

const client = new AmpsClient('my-application');

try {
  await client.connect('ws://localhost:9100/amps/json');

  // Subscribe to a topic
  const subscriptionId = await client.subscribe(
    message => console.log(message.data),
    'orders'
  );

  console.log('Subscribed with ID:', subscriptionId);
} catch (err) {
  console.error('Error:', err);
}
```

### Publishing Messages

```typescript
// Publish a message (synchronous)
client.publish('orders', { order: 'Tesla 3', qty: 10 });

// Publish a JSON string
client.publish('messages', JSON.stringify({ key: 'value' }));
```

### Multiple Subscriptions

```typescript
const onMessage = message => console.log('message: ', message);

try {
  // Subscribe to multiple topics
  await client.subscribe(onMessage, 'orders');
  await client.subscribe(onMessage, 'reservations');
  await client.subscribe(onMessage, 'notifications');
} catch (err) {
  console.error('Subscription error:', err);
}
```

### Subscribing with Filters

```typescript
// Subscribe with a filter
await client.subscribe(
  message => console.log(message.data),
  'orders',
  "/symbol='ROL'" // AMPS filter expression
);
```

### Querying Data (State-of-the-World)

```typescript
try {
  await client.sow(
    message => {
      if (message.header?.command() === 'sow') {
        console.log(message.data);
      }
    },
    'orders',
    "/symbol='ROL'",
    {
      batchSize: 100,
      timeout: 5000
    }
  );
} catch (err) {
  console.error('Error:', err);
}
```

### Error Handling

```typescript
const client = new AmpsClient('my-app').errorHandler(async err => {
  // Error handler is only called if an error occurred after
  // a successful connection has been established.
  console.error('AMPS error:', err);
  
  // Disconnect and reconnect logic
  await client.disconnect();
  // ... reconnect logic
});

await client.connect('ws://localhost:9100/amps/json');
```

### Disconnect Handling with Reconnection

```typescript
import { AmpsClient } from '@macro/amps';

const sleep = (interval: number) => new Promise(resolve => setTimeout(resolve, interval));

const client = new AmpsClient('my-app').errorHandler(async err => {
  client.disconnect();
  console.error(err, 'Reconnecting after 5 seconds...');
  await sleep(5000);
  reconnect();
});

async function reconnect() {
  try {
    await client.connect('ws://localhost:9100/amps/json');
    
    try {
      await client.subscribe(
        message => console.log('message: ', message),
        'orders'
      );
    } catch (err) {
      console.error('Subscription error: ', err);
    }
  } catch (err) {
    console.error('Connection error: ', err);
    await sleep(5000);
    reconnect();
  }
}

reconnect();
```

### Cleanup

```typescript
// Disconnect when done
await client.disconnect();
```

## API Reference

### AmpsClient

Main client class for interacting with AMPS servers.

#### Constructor

- `new AmpsClient(clientName?: string)` - Create a new AMPS client instance

#### Methods

- `connect(url: string): Promise<void>` - Connect to AMPS server
- `disconnect(): Promise<void>` - Disconnect from AMPS server
- `publish(topic: string, data: string | Record<string, unknown>): void` - Publish a message (synchronous)
- `subscribe(handler: AmpsMessageHandler, topic: string, filter?: string): Promise<string>` - Subscribe to a topic (returns subscription ID)
- `unsubscribe(subId: string): Promise<void>` - Unsubscribe from a subscription
- `sow(handler: AmpsMessageHandler, topic: string, filter?: string, options?: AmpsSowOptions): Promise<void>` - Query data from a topic (State-of-the-World)
- `errorHandler(handler: AmpsErrorHandler): AmpsClient` - Set error handler (returns client for chaining)
- `isConnected(): boolean` - Check if connected
- `getClient(): any` - Get the underlying AMPS client instance
- `getClientName(): string` - Get client name

### Types

- `AmpsMessage` - Message structure with data, header, topic, etc.
- `AmpsSowOptions` - Options for SOW queries (batchSize, timeout, etc.)
- `AmpsMessageHandler` - Callback for message handling: `(message: AmpsMessage) => void`
- `AmpsErrorHandler` - Callback for error handling: `(error: Error) => void`

## Connection Strings

AMPS supports various connection string formats:

- WebSocket: `ws://localhost:9100/amps/json`
- WebSocket (secure): `wss://localhost:9100/amps/json`
- With authentication: `wss://user:password@localhost:9100/amps/json`

The format is: `protocol://host:port/amps/messageType`

Common message types: `json`, `xml`, `nvfix`, `fix`, `binary`

## Advanced Usage

### Accessing the Underlying Client

For advanced features not wrapped by this library, you can access the underlying AMPS client:

```typescript
const underlyingClient = client.getClient();
// Use underlyingClient for advanced AMPS features
```

### Using Commands

The AMPS client also supports a Command interface for more advanced scenarios:

```typescript
import { Command } from 'amps';

const subCmd = new Command('subscribe')
  .topic('messages')
  .filter('/id > 20');

await client.getClient().execute(subCmd, message => console.log('message: ', message.data));
```

## References

- [AMPS JavaScript Client Documentation](https://crankuptheamps.com/clients/amps-client-javascript)
- [60East Technologies](https://crankuptheamps.com/)

## License

MIT

