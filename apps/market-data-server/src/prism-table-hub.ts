import { WebSocket } from 'ws';
import { UstMarketDataTable, UstTradesTable } from './prism-tables.service';

/**
 * Prism Table Hub — plain-WebSocket "table" protocol handler for /prism.
 *
 * Protocol (all JSON text frames):
 *  server -> client on connect:  { type: 'tables', tables: [{ name, title, description, keyField, mode }] }
 *  client -> server:             { type: 'listTables' }
 *                                { type: 'subscribe', table: '<name>' }
 *                                { type: 'unsubscribe', table: '<name>' }
 *  server -> client on subscribe:{ type: 'subscribed', table, keyField, mode }
 *                                { type: 'snapshot', table, rows: [...] }        // always a JSON array
 *  server -> client streaming:   { type: 'update', table, row: {...} }           // single row…
 *                                { type: 'update', table, rows: [...] }          // …or a batch array
 *  server -> client on problems: { type: 'error', message }
 */

interface TableMeta {
  name: string;
  title: string;
  description: string;
  keyField: string;
  /** Suggested blotter mode: keyed upserts vs append-only prints. */
  mode: 'snapshot-update' | 'append';
}

const TABLES: TableMeta[] = [
  {
    name: 'ust_trades',
    title: 'US Treasury Trades',
    description: 'Trade prints for cash OTR Treasuries and CME Treasury futures — snapshot of recent history, then live prints.',
    keyField: 'tradeId',
    mode: 'append',
  },
  {
    name: 'ust_market_data',
    title: 'UST Market Data',
    description: 'Top-of-book for cash OTR Treasuries and CME Treasury futures — full snapshot, then keyed in-place updates.',
    keyField: 'symbol',
    mode: 'snapshot-update',
  },
];

const MARKET_DATA_TICK_MS = 500;
const TRADE_MIN_GAP_MS = 600;
const TRADE_MAX_GAP_MS = 1800;

export class PrismTableHub {
  private readonly marketData = new UstMarketDataTable();
  private readonly trades = new UstTradesTable(this.marketData);
  private readonly subscribers = new Map<string, Set<WebSocket>>(TABLES.map((t) => [t.name, new Set<WebSocket>()]));
  private tradeTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    // Global tickers: every subscriber sees the same table state.
    setInterval(() => this.tickMarketData(), MARKET_DATA_TICK_MS);
    this.scheduleNextTrade();
  }

  handleConnection(ws: WebSocket): void {
    console.log('New client connected to /prism');
    this.send(ws, { type: 'tables', tables: TABLES, timestamp: new Date().toISOString() });

    ws.on('message', (message: Buffer) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(message.toString());
      } catch {
        this.send(ws, { type: 'error', message: 'Messages must be JSON, e.g. {"type":"subscribe","table":"ust_trades"}' });
        return;
      }
      // Valid JSON is not necessarily an object ('null', '42', '[...]') — never crash on it.
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        this.send(ws, { type: 'error', message: 'Messages must be JSON objects, e.g. {"type":"subscribe","table":"ust_trades"}' });
        return;
      }
      const data = parsed as { type?: string; table?: string };
      switch (data.type) {
        case 'listTables':
          this.send(ws, { type: 'tables', tables: TABLES, timestamp: new Date().toISOString() });
          break;
        case 'subscribe':
          this.subscribe(ws, data.table);
          break;
        case 'unsubscribe':
          if (data.table) this.subscribers.get(data.table)?.delete(ws);
          break;
        default:
          this.send(ws, { type: 'error', message: `Unknown message type: ${String(data.type)}` });
      }
    });

    const drop = () => {
      console.log('Client disconnected from /prism');
      for (const subs of this.subscribers.values()) subs.delete(ws);
    };
    ws.on('close', drop);
    ws.on('error', (error) => {
      console.error('WebSocket error on /prism:', error);
      drop();
    });
  }

  private subscribe(ws: WebSocket, table: string | undefined): void {
    const meta = TABLES.find((t) => t.name === table);
    if (!meta) {
      this.send(ws, { type: 'error', message: `Unknown table: ${String(table)}. Available: ${TABLES.map((t) => t.name).join(', ')}` });
      return;
    }
    this.subscribers.get(meta.name)!.add(ws);
    this.send(ws, { type: 'subscribed', table: meta.name, keyField: meta.keyField, mode: meta.mode });
    const rows = meta.name === 'ust_trades' ? this.trades.snapshot() : this.marketData.snapshot();
    this.send(ws, { type: 'snapshot', table: meta.name, rows });
    console.log(`Client subscribed to /prism table "${meta.name}" (snapshot: ${rows.length} rows)`);
  }

  // ── streaming ──

  private tickMarketData(): void {
    const subs = this.subscribers.get('ust_market_data')!;
    if (subs.size === 0) return;
    const updated = this.marketData.tick();
    // Mostly single-row updates; occasionally the whole tick as one batch array.
    if (updated.length > 1 && Math.random() < 0.25) {
      this.broadcast(subs, { type: 'update', table: 'ust_market_data', rows: updated });
    } else {
      for (const row of updated) {
        this.broadcast(subs, { type: 'update', table: 'ust_market_data', row });
      }
    }
  }

  private scheduleNextTrade(): void {
    const gap = TRADE_MIN_GAP_MS + Math.random() * (TRADE_MAX_GAP_MS - TRADE_MIN_GAP_MS);
    this.tradeTimer = setTimeout(() => {
      const trades = this.trades.nextTrades(); // keeps history warm even with no subscribers
      const subs = this.subscribers.get('ust_trades')!;
      if (subs.size > 0) {
        if (trades.length === 1) {
          this.broadcast(subs, { type: 'update', table: 'ust_trades', row: trades[0] });
        } else {
          this.broadcast(subs, { type: 'update', table: 'ust_trades', rows: trades });
        }
      }
      this.scheduleNextTrade();
    }, gap);
  }

  // ── plumbing ──

  private send(ws: WebSocket, payload: unknown): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload), { binary: false, compress: false });
    }
  }

  private broadcast(subs: Set<WebSocket>, payload: unknown): void {
    const text = JSON.stringify(payload);
    for (const ws of subs) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(text, { binary: false, compress: false });
      }
    }
  }
}
