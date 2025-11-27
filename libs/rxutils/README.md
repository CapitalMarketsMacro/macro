# @macro/rxutils

A TypeScript utility library for RxJS with conflation support.

## Overview

This library provides RxJS utilities, including conflation functionality to reduce the frequency of updates by batching multiple updates over a time interval, keeping only the latest value for each key.

Based on: [angular-fintech/Conflation](https://github.com/angular-fintech/Conflation/blob/main/ConflationJavaScript/apps/ConflationJS/src/main.ts)

## Installation

```bash
npm install @macro/rxutils
```

**Note**: This library requires `rxjs` as a peer dependency. Install it separately:

```bash
npm install rxjs
```

## Usage

### Basic Conflation

```typescript
import { conflateByKey } from '@macro/rxutils';
import { Subject } from 'rxjs';

const subject = new Subject<{ key: string; value: number }>();
const conflated$ = conflateByKey(subject, 1000); // Conflate every 1000ms

conflated$.subscribe(value => {
  console.log('Conflated value:', value);
});

// Emit multiple values rapidly
subject.next({ key: 'Key1', value: 1 });
subject.next({ key: 'Key1', value: 2 });
subject.next({ key: 'Key2', value: 3 });

// After 1 second, will emit:
// { key: 'Key1', value: 2 }  (only latest value for Key1)
// { key: 'Key2', value: 3 }
```

### Using ConflationSubject

```typescript
import { ConflationSubject } from '@macro/rxutils';

const conflatedSubject = new ConflationSubject<string, number>(1000);

// Subscribe to conflated values
conflatedSubject.subscribeToConflated(value => {
  console.log('Conflated value:', value);
});

// Emit values (they will be conflated)
conflatedSubject.next({ key: 'Key1', value: 1 });
conflatedSubject.next({ key: 'Key1', value: 2 });
conflatedSubject.next({ key: 'Key2', value: 3 });

// After 1 second, conflated$ will emit:
// { key: 'Key1', value: 2 }
// { key: 'Key2', value: 3 }
```

### Getting the Conflated Observable

```typescript
import { ConflationSubject } from '@macro/rxutils';

const conflatedSubject = new ConflationSubject<string, number>(1000);
const conflated$ = conflatedSubject.getConflatedObservable();

conflated$.subscribe(value => {
  console.log('Conflated value:', value);
});
```

### Piping to Another Subject

```typescript
import { ConflationSubject } from '@macro/rxutils';
import { Subject } from 'rxjs';

const conflatedSubject = new ConflationSubject<string, number>(1000);
const targetSubject = new Subject<{ key: string; value: number }>();

// Pipe conflated values to target subject
conflatedSubject.pipeToSubject(targetSubject);

targetSubject.subscribe(value => {
  console.log('Received conflated value:', value);
});
```

### Real-World Example: Market Data Conflation

```typescript
import { ConflationSubject } from '@macro/rxutils';

interface MarketData {
  symbol: string;
  price: number;
  volume: number;
}

// Create a conflation subject that conflates every 500ms
const marketDataSubject = new ConflationSubject<string, MarketData>(500);

// Subscribe to conflated market data
marketDataSubject.subscribeToConflated(({ key, value }) => {
  console.log(`Symbol: ${key}, Price: ${value.price}, Volume: ${value.volume}`);
});

// Simulate rapid market data updates
setInterval(() => {
  marketDataSubject.next({
    key: 'AAPL',
    value: {
      symbol: 'AAPL',
      price: Math.random() * 200,
      volume: Math.floor(Math.random() * 1000000),
    },
  });
}, 50); // Emit every 50ms, but will be conflated to every 500ms
```

## API Reference

### `conflateByKey<TKey, TValue>`

Conflates values by key over a specified interval.

**Parameters:**
- `source$: Observable<ConflatedValue<TKey, TValue>>` - The source observable emitting objects with a key and value
- `intervalMs: number` - The interval in milliseconds to emit conflated values

**Returns:** `Observable<ConflatedValue<TKey, TValue>>` - An observable that emits conflated values by key

### `ConflationSubject<TKey, TValue>`

A Subject that automatically conflates values by key.

**Constructor:**
- `new ConflationSubject<TKey, TValue>(intervalMs: number)` - Creates a new ConflationSubject with the specified interval

**Methods:**
- `subscribeToConflated(observerOrNext?, error?, complete?): Subscription` - Subscribe to the conflated values
- `getConflatedObservable(): Observable<ConflatedValue<TKey, TValue>>` - Get the conflated observable
- `pipeToSubject(targetSubject: Subject<ConflatedValue<TKey, TValue>>): Subscription` - Automatically subscribe to conflated values and forward them to a subject
- `unsubscribeFromConflated(): void` - Unsubscribe from conflated values if a subscription exists
- `complete(): void` - Complete the subject and clean up subscriptions
- `unsubscribe(): void` - Unsubscribe and clean up

**Inherited from Subject:**
- `next(value: ConflatedValue<TKey, TValue>): void` - Emit a value to be conflated
- `error(err: any): void` - Emit an error
- `asObservable(): Observable<ConflatedValue<TKey, TValue>>` - Get the observable representation

### Types

#### `ConflatedValue<TKey, TValue>`

```typescript
interface ConflatedValue<TKey = string, TValue = unknown> {
  key: TKey;
  value: TValue;
}
```

## How Conflation Works

Conflation uses a double-buffering technique:

1. Values are collected in a buffer as they arrive
2. At regular intervals, the buffer is swapped
3. All values in the old buffer are emitted
4. The old buffer is cleared and reused
5. Only the latest value for each key is kept

This ensures that:
- Rapid updates are batched together
- Only the most recent value for each key is emitted
- The emission frequency is controlled by the interval
- Memory usage is bounded by the number of unique keys

## References

- [RxJS Documentation](https://rxjs.dev/)
- [Conflation Implementation](https://github.com/angular-fintech/Conflation/blob/main/ConflationJavaScript/apps/ConflationJS/src/main.ts)

## License

MIT

