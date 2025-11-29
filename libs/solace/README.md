# @macro/solace

A TypeScript wrapper library for Solace PubSub+ JavaScript API with RxJS support for Angular and React applications.

## Features

- **Type-safe**: Full TypeScript support with comprehensive type definitions
- **RxJS Integration**: Subscribe to topics as Observables or Subjects for reactive programming
- **Framework Agnostic**: Works with both Angular and React applications
- **Simple API**: High-level wrapper around the Solace JavaScript API
- **Error Handling**: Built-in error handling with customizable error callbacks
- **Connection Management**: Automatic connection state management

## Installation

```bash
npm install @macro/solace
```

**Peer Dependencies:**
- `solclientjs` - Solace JavaScript API client library (https://www.npmjs.com/package/solclientjs)
- `rxjs` - Reactive Extensions for JavaScript (^7.0.0)

Install solclientjs separately:
```bash
npm install solclientjs
```

### Importing solclientjs

The `solclientjs` package provides different variants. Choose based on your needs:

**For production (recommended):**
```typescript
import solace from 'solclientjs';
```

**For development with full logging (not minified):**
```typescript
import solace from 'solclientjs/lib-browser/solclient-full';
```

**For debugging (all logs, not minified):**
```typescript
import solace from 'solclientjs/lib-browser/solclient-debug';
```

**CommonJS (Node.js):**
```typescript
const solace = require('solclientjs');
// OR
const solace = require('solclientjs/lib-browser/solclient-debug');
```

## Usage

### Basic Setup

```typescript
import { SolaceClient } from '@macro/solace';
// Import solclientjs - choose the appropriate variant:
import solace from 'solclientjs'; // Production (minified, INFO/WARN/ERROR/FATAL logs)
// OR import solace from 'solclientjs/lib-browser/solclient-full'; // Full (not minified)
// OR import solace from 'solclientjs/lib-browser/solclient-debug'; // Debug (all logs)

// Create a new client instance
// The client will automatically initialize SolclientFactory if not already initialized
const client = new SolaceClient(solace, {
  profile: 'version10', // Optional: 'version10' (recommended) or 'version7' (default, for compatibility)
  logLevel: 'INFO' // Optional: 'TRACE', 'DEBUG', 'INFO' (default), 'WARN', 'ERROR', 'FATAL'
});

// Connect to Solace broker
await client.connect({
  url: 'ws://localhost:8008',
  vpnName: 'default',
  userName: 'default',
  password: 'default',
  clientName: 'my-app-client'
});

// Set up error handling
client.errorHandler((error) => {
  console.error('Solace error:', error);
});

// Set up event handling
client.eventHandler((event, details) => {
  console.log('Solace event:', event, details);
});
```

### Publishing Messages

```typescript
// Publish a simple string message
client.publish('orders/stock', 'Order placed');

// Publish an object (will be JSON stringified)
client.publish('orders/stock', {
  symbol: 'TSLA',
  quantity: 100,
  price: 250.50
});

// Publish with additional properties
client.publish('orders/stock', { order: 'BUY' }, {
  correlationId: 'order-123',
  replyTo: 'orders/replies',
  userProperties: {
    priority: 'high',
    source: 'web-app'
  }
});
```

### Subscribing with Callbacks

```typescript
// Subscribe with a message handler
const subscriptionId = await client.subscribe(
  (message) => {
    console.log('Received message:', message.data);
  },
  'orders/stock'
);
```

### Subscribing with RxJS Observable

```typescript
import { SolaceClient } from '@macro/solace';

const client = new SolaceClient();
await client.connect({ /* ... */ });

// Subscribe and get an Observable
const { observable, subscriptionId } = await client.subscribeAsObservable('orders/stock');

// Use RxJS operators
observable.subscribe({
  next: (message) => {
    console.log('Received:', message.data);
  },
  error: (error) => {
    console.error('Subscription error:', error);
  },
  complete: () => {
    console.log('Subscription completed');
  }
});

// Use with RxJS operators
import { map, filter } from 'rxjs/operators';

observable
  .pipe(
    map(msg => msg.data),
    filter(data => data.symbol === 'TSLA')
  )
  .subscribe(data => console.log('TSLA order:', data));
```

### Subscribing with RxJS Subject

```typescript
// Subscribe and get a Subject (for manual control)
const { subject, subscriptionId } = await client.subscribeAsSubject('orders/stock');

subject.subscribe(message => {
  console.log('Received:', message.data);
});

// You can also manually emit to the subject if needed
// (though typically you'd just use the observable)
```

### Unsubscribing

```typescript
// Unsubscribe from a topic
await client.unsubscribe(subscriptionId);

// Or specify the topic explicitly
await client.unsubscribe(subscriptionId, 'orders/stock');
```

### Disconnecting

```typescript
// Disconnect from the broker
// This will automatically unsubscribe from all topics and complete all RxJS subjects
await client.disconnect();
```

### Advanced Usage

```typescript
// Get the underlying Solace session for advanced features
const session = client.getSession();

// Get the solclientjs module instance
const solace = client.getSolace();

// Get all active subscription IDs
const subscriptionIds = client.getSubscriptionIds();

// Get a specific Subject by subscription ID
const subject = client.getSubject(subscriptionId);

// Check connection status
if (client.isConnected()) {
  console.log('Connected to Solace broker');
}
```

## API Reference

### SolaceClient

#### Constructor

```typescript
constructor(solaceMessagingFactory?: () => any)
```

Creates a new Solace client instance. If `solaceMessagingFactory` is not provided, it will try to use the global `solace` object.

#### Methods

- `connect(properties: SolaceConnectionProperties): Promise<void>` - Connect to Solace broker
- `disconnect(): Promise<void>` - Disconnect from broker
- `publish(topic: string, data: string | Record<string, unknown> | ArrayBuffer, properties?: {...}): void` - Publish a message
- `subscribe(handler: SolaceMessageHandler, topic: string, properties?: SolaceSubscriptionProperties): Promise<string>` - Subscribe with callback
- `subscribeAsObservable(topic: string, properties?: SolaceSubscriptionProperties): Promise<{ observable: Observable<SolaceMessage>; subscriptionId: string }>` - Subscribe as RxJS Observable
- `subscribeAsSubject(topic: string, properties?: SolaceSubscriptionProperties): Promise<{ subject: Subject<SolaceMessage>; subscriptionId: string }>` - Subscribe as RxJS Subject
- `unsubscribe(subscriptionId: string, topic?: string): Promise<void>` - Unsubscribe from topic
- `errorHandler(handler: SolaceErrorHandler): SolaceClient` - Set error handler
- `eventHandler(handler: SolaceEventHandler): SolaceClient` - Set event handler
- `isConnected(): boolean` - Check if connected
- `getSession(): any` - Get underlying Solace session
- `getSolaceMessaging(): any` - Get SolaceMessaging instance
- `getSubject(subscriptionId: string): Subject<SolaceMessage> | undefined` - Get Subject by subscription ID
- `getSubscriptionIds(): string[]` - Get all active subscription IDs

### Types

#### SolaceMessage

```typescript
interface SolaceMessage {
  data: string | ArrayBuffer | Record<string, unknown>;
  destination?: string;
  properties?: Record<string, unknown>;
  correlationId?: string;
  replyTo?: string;
  userProperties?: Record<string, unknown>;
  binaryAttachment?: ArrayBuffer;
  sequenceNumber?: number;
  timestamp?: number;
  [key: string]: unknown;
}
```

#### SolaceConnectionProperties

```typescript
interface SolaceConnectionProperties {
  url: string;
  vpnName: string;
  userName: string;
  password: string;
  clientName?: string;
  connectTimeoutInMsecs?: number;
  reconnectRetries?: number;
  reconnectRetryWaitInMsecs?: number;
  [key: string]: unknown;
}
```

#### SolaceSubscriptionProperties

```typescript
interface SolaceSubscriptionProperties {
  requestConfirm?: boolean;
  [key: string]: unknown;
}
```

## Angular Example

```typescript
import { Injectable, OnDestroy } from '@angular/core';
import { SolaceClient, SolaceMessage } from '@macro/solace';
import solace from 'solclientjs'; // or 'solclientjs/lib-browser/solclient-debug' for debugging
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class SolaceService implements OnDestroy {
  private client = new SolaceClient(solace, {
    profile: 'version10',
    logLevel: 'INFO'
  });
  private destroy$ = new Subject<void>();

  async connect(): Promise<void> {
    await this.client.connect({
      url: 'ws://localhost:8008',
      vpnName: 'default',
      userName: 'default',
      password: 'default'
    });
  }

  subscribeToOrders(): Observable<SolaceMessage> {
    const { observable } = await this.client.subscribeAsObservable('orders/stock');
    return observable.pipe(takeUntil(this.destroy$));
  }

  publishOrder(order: any): void {
    this.client.publish('orders/stock', order);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.client.disconnect();
  }
}
```

## React Example

```typescript
import { useEffect, useState } from 'react';
import { SolaceClient, SolaceMessage } from '@macro/solace';
import solace from 'solclientjs'; // or 'solclientjs/lib-browser/solclient-debug' for debugging
import { Observable } from 'rxjs';

function useSolaceOrders() {
  const [orders, setOrders] = useState<SolaceMessage[]>([]);
  const [client, setClient] = useState<SolaceClient | null>(null);

  useEffect(() => {
    const solaceClient = new SolaceClient(solace, {
      profile: 'version10',
      logLevel: 'INFO'
    });
    
    solaceClient.connect({
      url: 'ws://localhost:8008',
      vpnName: 'default',
      userName: 'default',
      password: 'default'
    }).then(() => {
      setClient(solaceClient);
      
      solaceClient.subscribeAsObservable('orders/stock').then(({ observable }) => {
        const subscription = observable.subscribe(message => {
          setOrders(prev => [...prev, message]);
        });
        
        return () => subscription.unsubscribe();
      });
    });

    return () => {
      solaceClient.disconnect();
    };
  }, []);

  return { orders, client };
}
```

## License

MIT

