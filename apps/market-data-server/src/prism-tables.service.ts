/**
 * Prism Tables Service
 * Data engine for the plain-WebSocket "table" endpoint (/prism) consumed by the Prism blotter.
 *
 * Two tables over a shared US-rates instrument universe (cash OTR Treasuries + CME futures):
 *  - `ust_market_data`: keyed top-of-book rows (snapshot = all instruments, then in-place updates)
 *  - `ust_trades`:      trade prints (snapshot = recent trade history, then appended prints)
 */

// ── Instrument universe ─────────────────────────────────────────────

export type InstrumentType = 'CASH' | 'FUTURE';

interface Instrument {
  /** Row key for market data (e.g. "UST 10Y", "ZNU6") */
  symbol: string;
  instrumentType: InstrumentType;
  tenor: string;
  description: string;
  cusip: string | null; // cash only
  exchange: string | null; // futures only
  coupon: number | null; // cash only
  maturity: string | null; // cash only (YYYY-MM-DD)
  basePrice: number;
  baseYield: number | null; // cash only
  volatility: number; // random-walk step size (points)
  /** Minimum price increment in points (32nds fractions per contract spec) */
  tickSize: number;
}

const T32 = 1 / 32;

/** On-the-run US Treasuries (2Y–30Y). Cash trades in 1/8ths of a 32nd. */
const CASH_OTRS: Instrument[] = [
  { symbol: 'UST 2Y',  instrumentType: 'CASH', tenor: '2Y',  description: 'US Treasury 2-Year OTR 3.875% 30-Jun-2028',  cusip: '91282CND2', exchange: null, coupon: 3.875, maturity: '2028-06-30', basePrice: 99.8125,  baseYield: 3.97, volatility: 0.02,  tickSize: T32 / 8 },
  { symbol: 'UST 3Y',  instrumentType: 'CASH', tenor: '3Y',  description: 'US Treasury 3-Year OTR 3.875% 15-Jun-2029',  cusip: '91282CNC4', exchange: null, coupon: 3.875, maturity: '2029-06-15', basePrice: 99.6875,  baseYield: 3.99, volatility: 0.03,  tickSize: T32 / 8 },
  { symbol: 'UST 5Y',  instrumentType: 'CASH', tenor: '5Y',  description: 'US Treasury 5-Year OTR 4.000% 30-Jun-2031',  cusip: '91282CNE0', exchange: null, coupon: 4.0,   maturity: '2031-06-30', basePrice: 99.5,     baseYield: 4.11, volatility: 0.05,  tickSize: T32 / 8 },
  { symbol: 'UST 7Y',  instrumentType: 'CASH', tenor: '7Y',  description: 'US Treasury 7-Year OTR 4.125% 30-Jun-2033',  cusip: '91282CNF7', exchange: null, coupon: 4.125, maturity: '2033-06-30', basePrice: 99.28125, baseYield: 4.25, volatility: 0.07,  tickSize: T32 / 8 },
  { symbol: 'UST 10Y', instrumentType: 'CASH', tenor: '10Y', description: 'US Treasury 10-Year OTR 4.250% 15-May-2036', cusip: '91282CNB6', exchange: null, coupon: 4.25,  maturity: '2036-05-15', basePrice: 98.9375,  baseYield: 4.38, volatility: 0.09,  tickSize: T32 / 8 },
  { symbol: 'UST 20Y', instrumentType: 'CASH', tenor: '20Y', description: 'US Treasury 20-Year OTR 4.625% 15-May-2046', cusip: '912810UK7', exchange: null, coupon: 4.625, maturity: '2046-05-15', basePrice: 97.75,    baseYield: 4.80, volatility: 0.14,  tickSize: T32 / 8 },
  { symbol: 'UST 30Y', instrumentType: 'CASH', tenor: '30Y', description: 'US Treasury 30-Year OTR 4.500% 15-May-2056', cusip: '912810UJ0', exchange: null, coupon: 4.5,   maturity: '2056-05-15', basePrice: 95.9375,  baseYield: 4.75, volatility: 0.18,  tickSize: T32 / 8 },
];

/**
 * CME Treasury futures, front quarterly month Sep-2026 (U6).
 * Tick sizes per contract spec: ZT/Z3N/ZF quarter-32nds, ZN/TN half-32nds, TWE/ZB/UB full 32nds.
 */
const CME_FUTURES: Instrument[] = [
  { symbol: 'ZTU6',  instrumentType: 'FUTURE', tenor: '2Y',  description: '2-Year T-Note Future Sep-2026',       cusip: null, exchange: 'CME', coupon: null, maturity: null, basePrice: 103.40625, baseYield: null, volatility: 0.02, tickSize: T32 / 4 },
  { symbol: 'Z3NU6', instrumentType: 'FUTURE', tenor: '3Y',  description: '3-Year T-Note Future Sep-2026',       cusip: null, exchange: 'CME', coupon: null, maturity: null, basePrice: 104.15625, baseYield: null, volatility: 0.03, tickSize: T32 / 4 },
  { symbol: 'ZFU6',  instrumentType: 'FUTURE', tenor: '5Y',  description: '5-Year T-Note Future Sep-2026',       cusip: null, exchange: 'CME', coupon: null, maturity: null, basePrice: 106.828125, baseYield: null, volatility: 0.05, tickSize: T32 / 4 },
  { symbol: 'ZNU6',  instrumentType: 'FUTURE', tenor: '10Y', description: '10-Year T-Note Future Sep-2026',      cusip: null, exchange: 'CME', coupon: null, maturity: null, basePrice: 111.28125,  baseYield: null, volatility: 0.09, tickSize: T32 / 2 },
  { symbol: 'TNU6',  instrumentType: 'FUTURE', tenor: '10Y', description: 'Ultra 10-Year T-Note Future Sep-2026', cusip: null, exchange: 'CME', coupon: null, maturity: null, basePrice: 113.5,      baseYield: null, volatility: 0.11, tickSize: T32 / 2 },
  { symbol: 'TWEU6', instrumentType: 'FUTURE', tenor: '20Y', description: '20-Year T-Bond Future Sep-2026',      cusip: null, exchange: 'CME', coupon: null, maturity: null, basePrice: 116.09375,  baseYield: null, volatility: 0.15, tickSize: T32 },
  { symbol: 'ZBU6',  instrumentType: 'FUTURE', tenor: '30Y', description: '30-Year T-Bond Future Sep-2026',      cusip: null, exchange: 'CME', coupon: null, maturity: null, basePrice: 117.65625,  baseYield: null, volatility: 0.18, tickSize: T32 },
  { symbol: 'UBU6',  instrumentType: 'FUTURE', tenor: '30Y', description: 'Ultra T-Bond Future Sep-2026',        cusip: null, exchange: 'CME', coupon: null, maturity: null, basePrice: 122.28125,  baseYield: null, volatility: 0.22, tickSize: T32 },
];

const UNIVERSE: Instrument[] = [...CASH_OTRS, ...CME_FUTURES];

// ── Row shapes ──────────────────────────────────────────────────────
// Both tables emit a homogeneous field set across cash and futures (null where not
// applicable) so the blotter's first-record column inference sees every column.

export interface UstMarketDataRow {
  symbol: string;
  instrumentType: InstrumentType;
  tenor: string;
  description: string;
  cusip: string | null;
  exchange: string | null;
  coupon: number | null;
  maturity: string | null;
  bid: number;
  ask: number;
  mid: number;
  last: number;
  bidDisplay: string; // dealer 32nds display, e.g. "99-16+"
  askDisplay: string;
  bidSize: number; // $MM for cash, contracts for futures
  askSize: number;
  yield: number | null; // cash only, as a fraction (0.0397 = 3.97%)
  change: number; // vs previous tick
  changePercent: number; // as a fraction (0.0001 = 0.01%)
  volume: number; // $MM for cash, contracts for futures
  openInterest: number | null; // futures only
  updated: string; // ISO timestamp
}

export interface UstTradeRow {
  tradeId: string;
  time: string; // ISO timestamp
  symbol: string;
  instrumentType: InstrumentType;
  tenor: string;
  cusip: string | null;
  side: 'BUY' | 'SELL';
  price: number;
  priceDisplay: string; // dealer 32nds display
  size: number; // $MM for cash, contracts for futures
  sizeUnit: 'MM' | 'CT';
  yield: number | null; // cash only, as a fraction (0.0397 = 3.97%)
  venue: string;
  counterparty: string;
}

const CASH_VENUES = ['BrokerTec', 'Dealerweb', 'Fenics UST'];
const COUNTERPARTIES = ['JPM', 'GS', 'MS', 'CITI', 'BOFA', 'BARC', 'DB', 'CITADEL', 'JANE ST', 'SIG'];

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Dealer 32nds display: handle, dash, whole 32nds, then eighths of a 32nd as a
 * trailing digit ('+' for a half). e.g. 99.515625 -> "99-16+", 110.28125 -> "110-09".
 */
export function to32nds(price: number): string {
  const sign = price < 0 ? '-' : '';
  const abs = Math.abs(price);
  const handle = Math.floor(abs);
  const eighths = Math.round((abs - handle) * 256); // 32nds * 8
  const whole32 = Math.floor(eighths / 8);
  const rem = eighths % 8;
  // Rounding can push 32/32 -> next handle
  if (whole32 >= 32) return `${sign}${handle + 1}-00`;
  const frac = rem === 0 ? '' : rem === 4 ? '+' : `${rem}`;
  return `${sign}${handle}-${String(whole32).padStart(2, '0')}${frac}`;
}

function round(value: number, decimals: number): number {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

function roundToTick(price: number, tick: number): number {
  return Math.round(price / tick) * tick;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Simplified yield-from-price for coupon Treasuries (math mirrors the tsy service), returned as a
 * FRACTION (0.0397 = 3.97%) — the blotter's inferred `percent` format multiplies by 100.
 */
function approxYield(price: number, coupon: number, maturity: string): number {
  const years = Math.max(0.25, (new Date(maturity).getTime() - Date.now()) / (365.25 * 24 * 3600 * 1000));
  const currentYield = (coupon / price) * 100;
  const capitalGain = ((100 - price) / price) * (100 / years);
  return round((currentYield + capitalGain) / 100, 6);
}

// ── Market data engine ──────────────────────────────────────────────

/**
 * Keyed top-of-book state for the whole universe. One global instance: every subscriber
 * sees the same table. `snapshot()` returns all rows; `tick()` moves 1–4 random
 * instruments and returns just the changed rows.
 */
export class UstMarketDataTable {
  private readonly rows = new Map<string, UstMarketDataRow>();
  private readonly openInterest = new Map<string, number>();

  constructor() {
    for (const inst of UNIVERSE) {
      if (inst.instrumentType === 'FUTURE') {
        this.openInterest.set(inst.symbol, Math.floor(200_000 + Math.random() * 4_000_000));
      }
      this.rows.set(inst.symbol, this.buildRow(inst, inst.basePrice, inst.basePrice));
    }
  }

  snapshot(): UstMarketDataRow[] {
    return [...this.rows.values()];
  }

  /** Random-walk 1–4 random instruments; returns the updated rows. */
  tick(): UstMarketDataRow[] {
    const count = 1 + Math.floor(Math.random() * 4);
    const shuffled = [...UNIVERSE].sort(() => Math.random() - 0.5);
    const updated: UstMarketDataRow[] = [];
    for (const inst of shuffled.slice(0, count)) {
      const prev = this.rows.get(inst.symbol)!;
      // Mean-revert gently toward basePrice so prices stay in a realistic band.
      const drift = (inst.basePrice - prev.mid) * 0.02;
      const step = (Math.random() - 0.5) * 2 * inst.volatility + drift;
      const next = this.buildRow(inst, prev.mid + step, prev.mid);
      this.rows.set(inst.symbol, next);
      updated.push(next);
    }
    return updated;
  }

  /** Current mid for an instrument (trade generator prints around it). */
  midOf(symbol: string): number {
    return this.rows.get(symbol)?.mid ?? 100;
  }

  private buildRow(inst: Instrument, rawMid: number, prevMid: number): UstMarketDataRow {
    const mid = roundToTick(rawMid, inst.tickSize);
    const spreadTicks = 1 + Math.floor(Math.random() * 2); // 1–2 ticks wide
    const half = (spreadTicks * inst.tickSize) / 2;
    const bid = roundToTick(mid - half, inst.tickSize);
    const ask = roundToTick(mid + half, inst.tickSize);
    const last = Math.random() < 0.5 ? bid : ask;
    const change = round(mid - prevMid, 6);
    const isCash = inst.instrumentType === 'CASH';
    const oi = this.openInterest.get(inst.symbol);
    return {
      symbol: inst.symbol,
      instrumentType: inst.instrumentType,
      tenor: inst.tenor,
      description: inst.description,
      cusip: inst.cusip,
      exchange: inst.exchange,
      coupon: inst.coupon != null ? inst.coupon / 100 : null, // fraction — inferred percent format is value*100
      maturity: inst.maturity,
      bid: round(bid, 6),
      ask: round(ask, 6),
      mid: round(mid, 6),
      last: round(last, 6),
      bidDisplay: to32nds(bid),
      askDisplay: to32nds(ask),
      bidSize: isCash ? Math.floor(1 + Math.random() * 250) : Math.floor(50 + Math.random() * 2000),
      askSize: isCash ? Math.floor(1 + Math.random() * 250) : Math.floor(50 + Math.random() * 2000),
      yield: isCash ? approxYield(mid, inst.coupon!, inst.maturity!) : null,
      change,
      changePercent: prevMid ? round(change / prevMid, 6) : 0,
      volume: isCash ? Math.floor(50 + Math.random() * 5000) : Math.floor(10_000 + Math.random() * 1_500_000),
      openInterest: oi != null ? oi + Math.floor((Math.random() - 0.4) * 500) : null,
      updated: new Date().toISOString(),
    };
  }
}

// ── Trade generator ─────────────────────────────────────────────────

/**
 * Trade prints for the same universe. Keeps a bounded history so late subscribers get a
 * meaningful snapshot; `nextTrades()` mints 1 (usually) to 4 (burst) new prints around
 * the market-data engine's current mid.
 */
export class UstTradesTable {
  private readonly history: UstTradeRow[] = [];
  private tradeSeq = 100_000;

  constructor(
    private readonly marketData: UstMarketDataTable,
    private readonly maxHistory = 200,
  ) {
    // Seed some history so the first snapshot isn't empty.
    for (let i = 0; i < 40; i++) this.record(this.mintTrade());
  }

  snapshot(): UstTradeRow[] {
    return [...this.history];
  }

  /** Mint 1–4 new prints (single print ~80% of the time, else a burst). */
  nextTrades(): UstTradeRow[] {
    const count = Math.random() < 0.8 ? 1 : 2 + Math.floor(Math.random() * 3);
    const trades: UstTradeRow[] = [];
    for (let i = 0; i < count; i++) {
      const t = this.mintTrade();
      this.record(t);
      trades.push(t);
    }
    return trades;
  }

  private mintTrade(): UstTradeRow {
    const inst = pick(UNIVERSE);
    const isCash = inst.instrumentType === 'CASH';
    // Print within a tick or two of the current mid.
    const mid = this.marketData.midOf(inst.symbol);
    const offset = (Math.floor(Math.random() * 5) - 2) * inst.tickSize;
    const price = roundToTick(mid + offset, inst.tickSize);
    return {
      tradeId: `T-${this.tradeSeq++}`,
      time: new Date().toISOString(),
      symbol: inst.symbol,
      instrumentType: inst.instrumentType,
      tenor: inst.tenor,
      cusip: inst.cusip,
      side: Math.random() < 0.5 ? 'BUY' : 'SELL',
      price: round(price, 6),
      priceDisplay: to32nds(price),
      size: isCash ? Math.floor(1 + Math.random() * 100) : Math.floor(1 + Math.random() * 500),
      sizeUnit: isCash ? 'MM' : 'CT',
      yield: isCash ? approxYield(price, inst.coupon!, inst.maturity!) : null,
      venue: isCash ? pick(CASH_VENUES) : 'CME Globex',
      counterparty: pick(COUNTERPARTIES),
    };
  }

  private record(t: UstTradeRow): void {
    this.history.push(t);
    if (this.history.length > this.maxHistory) {
      this.history.splice(0, this.history.length - this.maxHistory);
    }
  }
}
