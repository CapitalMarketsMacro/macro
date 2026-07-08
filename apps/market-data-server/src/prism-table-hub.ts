import { IncomingMessage, ServerResponse } from 'http';
import { WebSocket } from 'ws';
import { UstMarketDataTable, UstTradesTable } from './prism-tables.service';
import { IrsRiskPnlTable } from './irs-risk-pnl.service';

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
 *
 * REST mirror (snapshot-only, for the blotters' REST source):
 *  GET /prism/tables         -> { tables: [...] }          (same catalog as the WS announce)
 *  GET /prism/tables/<name>  -> [ ...rows ]                (bare JSON array snapshot)
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
  {
    name: 'irs_risk_pnl',
    title: 'IRS Risk & PnL',
    description:
      'Interest Rate Swaps desk risk/PnL — one row per OIS position (SOFR/€STR/SONIA/TONA) with DV01, KR01 buckets and a tying P&L explain (carry / roll-down / curve / new trades / fees / residual); desk → book → trader hierarchy, keyed in-place repricing as the par curves move.',
    keyField: 'tradeId',
    mode: 'snapshot-update',
  },
];

const MARKET_DATA_TICK_MS = 500;
const IRS_RISK_TICK_MS = 1000;
const TRADE_MIN_GAP_MS = 600;
const TRADE_MAX_GAP_MS = 1800;

export class PrismTableHub {
  private readonly marketData = new UstMarketDataTable();
  private readonly trades = new UstTradesTable(this.marketData);
  private readonly irsRisk = new IrsRiskPnlTable();
  private readonly subscribers = new Map<string, Set<WebSocket>>(TABLES.map((t) => [t.name, new Set<WebSocket>()]));
  private tradeTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    // Global tickers: every subscriber sees the same table state.
    setInterval(() => this.tickMarketData(), MARKET_DATA_TICK_MS);
    setInterval(() => this.tickIrsRisk(), IRS_RISK_TICK_MS);
    this.scheduleNextTrade();
  }

  /** Current snapshot for a known table name (the source of truth for WS subscribe + REST). */
  private snapshotOf(name: string): unknown[] {
    switch (name) {
      case 'ust_trades':
        return this.trades.snapshot();
      case 'ust_market_data':
        return this.marketData.snapshot();
      case 'irs_risk_pnl':
        return this.irsRisk.snapshot();
      default:
        return [];
    }
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
    const rows = this.snapshotOf(meta.name);
    this.send(ws, { type: 'snapshot', table: meta.name, rows });
    console.log(`Client subscribed to /prism table "${meta.name}" (snapshot: ${rows.length} rows)`);
  }

  // ── streaming ──

  private tickMarketData(): void {
    // Tick unconditionally so REST snapshots keep evolving even with no WS subscribers.
    const updated = this.marketData.tick();
    const subs = this.subscribers.get('ust_market_data')!;
    if (subs.size === 0) return;
    // Mostly single-row updates; occasionally the whole tick as one batch array.
    if (updated.length > 1 && Math.random() < 0.25) {
      this.broadcast(subs, { type: 'update', table: 'ust_market_data', rows: updated });
    } else {
      for (const row of updated) {
        this.broadcast(subs, { type: 'update', table: 'ust_market_data', row });
      }
    }
  }

  private tickIrsRisk(): void {
    // Tick unconditionally so REST snapshots keep evolving even with no WS subscribers.
    const updated = this.irsRisk.tick();
    const subs = this.subscribers.get('irs_risk_pnl')!;
    if (subs.size === 0 || updated.length === 0) return;
    // A curve-point move reprices a set of positions at once — send it as one batch.
    this.broadcast(subs, { type: 'update', table: 'irs_risk_pnl', rows: updated });
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

  // ── REST mirror ──

  /**
   * Serve the snapshot-only REST endpoints. Returns false when the path is not ours so the
   * caller can 404. CORS is wide open — the blotters run on other localhost ports.
   */
  handleRest(req: IncomingMessage, res: ServerResponse): boolean {
    const url = new URL(req.url || '', `http://${req.headers.host ?? 'localhost'}`);
    const path = url.pathname.replace(/\/+$/, '');
    if (path !== '/prism/tables' && !path.startsWith('/prism/tables/')) return false;

    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, OPTIONS' });
      res.end();
      return true;
    }
    if (req.method !== 'GET') {
      this.sendJson(res, 405, { error: 'Only GET is supported' });
      return true;
    }
    if (path === '/prism/tables') {
      this.sendJson(res, 200, { tables: TABLES });
      return true;
    }
    let name: string;
    try {
      name = decodeURIComponent(path.slice('/prism/tables/'.length));
    } catch {
      // Malformed percent-encoding (e.g. /prism/tables/%zz) must not crash the process.
      this.sendJson(res, 400, { error: 'Malformed table name in URL' });
      return true;
    }
    const meta = TABLES.find((t) => t.name === name);
    if (!meta) {
      this.sendJson(res, 404, { error: `Unknown table: ${name}. Available: ${TABLES.map((t) => t.name).join(', ')}` });
      return true;
    }
    const rows = this.snapshotOf(meta.name);
    this.sendJson(res, 200, rows); // snapshots are bare JSON arrays
    console.log(`REST snapshot served for "${meta.name}" (${rows.length} rows)`);
    return true;
  }

  private sendJson(res: ServerResponse, status: number, payload: unknown): void {
    const body = JSON.stringify(payload);
    res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
    res.end(body);
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
