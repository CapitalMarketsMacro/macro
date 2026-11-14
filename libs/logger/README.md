# @macro/logger

Pino-based structured logging for the monorepo — one API that works in Node **and** the browser, with Java-style output (`[yyyy-MM-dd HH:mm:ss.SSS] LEVEL [context] message`) and SLF4J-style levels (`TRACE`/`DEBUG`/`INFO`/`WARN`/`ERROR`/`FATAL`).

## Usage

```typescript
import { Logger, LogLevel } from '@macro/logger';

const log = Logger.getLogger('MyComponent'); // cached per context

log.info('Connected to market data');
log.debug('Tick received', { symbol: 'EURUSD', bid: 1.085 }); // objects pretty-printed
log.error('Subscription failed', err);
```

- `Logger.getLogger(context)` returns a cached instance per context (a Pino child logger).
- The optional `data` argument accepts any JSON-serializable value: strings are appended to the message, objects/arrays are logged structurally, primitives are wrapped as `{ value }`.
- Levels filter per logger (`setLevel`); the global level defaults to the `LOG_LEVEL` env var, else `TRACE`, and can be changed at runtime for all cached loggers.

## Building

`npx nx build logger` — built with `tsc` for npm publishing (`npm run build:logger` at the repo root).

## Running unit tests

`npx nx test logger` (Jest 30).
