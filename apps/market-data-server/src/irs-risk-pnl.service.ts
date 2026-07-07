/**
 * IRS Risk & PnL Service
 * Simulated risk/PnL blotter for an Interest Rate Swaps desk, served over the Prism table
 * protocol (WebSocket `/prism` + REST `/prism/tables`) as the keyed table `irs_risk_pnl`.
 *
 * Modeled on how IR swaps desks actually report intraday risk and P&L:
 *  - One row per live swap position (vanilla OIS: SOFR / €STR / SONIA / TONA), keyed by tradeId,
 *    booked into a desk → book → trader hierarchy — the natural roll-up axes.
 *  - Risk in DV01 terms (dollar P&L per 1bp rate move, bond-style sign: receive-fixed is long
 *    duration → positive DV01, pay-fixed negative) plus KR01 key-rate buckets (2Y/5Y/10Y/30Y
 *    partial DV01s that sum to the total) and gamma (convexity, $ per bp²).
 *  - P&L explain that TIES OUT: dayPnl === carryPnl + rollDownPnl + curvePnl + newTradePnl +
 *    feesPnl + residualPnl, the standard desk attribution (carry accrual + PAI, curve roll-down,
 *    delta P&L from market moves, day-one P&L on new trades, brokerage/clearing fees, unexplained).
 *  - All P&L and risk in USD so cross-currency books aggregate; notional stays in trade currency.
 *
 * The engine random-walks the par curves (per currency × tenor), then reprices every position on
 * a moved curve point: curvePnl moves by -Δbp × dv01, NPV drifts with it, and carry accrues
 * slowly — so a rolled-up blotter shows books/desks re-aggregating in real time.
 */

// ── Desk universe ───────────────────────────────────────────────────

type Ccy = 'USD' | 'EUR' | 'GBP' | 'JPY';
type PayReceive = 'PAY' | 'RCV';

/** Compounded overnight index per currency (post-LIBOR OIS standard). */
const INDEX_BY_CCY: Record<Ccy, string> = { USD: 'SOFR', EUR: 'ESTR', GBP: 'SONIA', JPY: 'TONA' };

/** Clearing venues by currency (LCH SwapClear dominates; CME clears USD; JSCC clears TONA). */
const CLEARING_BY_CCY: Record<Ccy, string[]> = {
  USD: ['LCH SwapClear', 'CME'],
  EUR: ['LCH SwapClear', 'EUREX'],
  GBP: ['LCH SwapClear'],
  JPY: ['JSCC', 'LCH SwapClear'],
};

const COUNTERPARTIES = ['JPM', 'GS', 'MS', 'CITI', 'BOFA', 'BARC', 'DB', 'BNP', 'SOCGEN', 'NOMURA', 'UBS', 'HSBC'];

/** Desk → book → traders. Books follow desk strategy naming (outright / curve / basis / flow). */
const STRUCTURE: Record<string, Record<string, { ccy: Ccy; traders: string[] }>> = {
  'USD Swaps': {
    'SOFR Outright': { ccy: 'USD', traders: ['A. Patel', 'M. Chen'] },
    'SOFR Curve': { ccy: 'USD', traders: ['J. Smith'] },
    'UST Swap Spreads': { ccy: 'USD', traders: ['K. Olsen', 'R. Diaz'] },
  },
  'EUR Swaps': {
    'ESTR Outright': { ccy: 'EUR', traders: ['L. Rossi', 'F. Mueller'] },
    'EUR Basis': { ccy: 'EUR', traders: ['P. Novak'] },
  },
  'Sterling & Yen': {
    'SONIA Outright': { ccy: 'GBP', traders: ['S. Khan'] },
    'TONA Outright': { ccy: 'JPY', traders: ['T. Mori', 'H. Costa'] },
  },
};

const TENORS = ['2Y', '3Y', '5Y', '7Y', '10Y', '15Y', '20Y', '30Y'] as const;
type Tenor = (typeof TENORS)[number];
const TENOR_YEARS: Record<Tenor, number> = { '2Y': 2, '3Y': 3, '5Y': 5, '7Y': 7, '10Y': 10, '15Y': 15, '20Y': 20, '30Y': 30 };

/** Base par OIS rates (fractions) per currency curve, roughly mid-2026 levels. */
const BASE_CURVES: Record<Ccy, Record<Tenor, number>> = {
  USD: { '2Y': 0.0378, '3Y': 0.0371, '5Y': 0.0368, '7Y': 0.0372, '10Y': 0.0381, '15Y': 0.0394, '20Y': 0.0401, '30Y': 0.0397 },
  EUR: { '2Y': 0.0212, '3Y': 0.0219, '5Y': 0.0231, '7Y': 0.0242, '10Y': 0.0256, '15Y': 0.0269, '20Y': 0.0272, '30Y': 0.0264 },
  GBP: { '2Y': 0.0392, '3Y': 0.0388, '5Y': 0.0391, '7Y': 0.0398, '10Y': 0.0409, '15Y': 0.0424, '20Y': 0.0431, '30Y': 0.0428 },
  JPY: { '2Y': 0.0081, '3Y': 0.0093, '5Y': 0.0112, '7Y': 0.0131, '10Y': 0.0152, '15Y': 0.0178, '20Y': 0.0194, '30Y': 0.0208 },
};

/** USD per unit of trade currency (fixed for the sim — good enough to aggregate risk in USD). */
const FX_TO_USD: Record<Ccy, number> = { USD: 1, EUR: 1.09, GBP: 1.27, JPY: 0.0064 };

/** KR01 bucket a tenor's risk rolls into (2Y / 5Y / 10Y / 30Y key rates). */
function kr01Bucket(tenor: Tenor): 'kr01_2y' | 'kr01_5y' | 'kr01_10y' | 'kr01_30y' {
  const y = TENOR_YEARS[tenor];
  if (y <= 3) return 'kr01_2y';
  if (y <= 7) return 'kr01_5y';
  if (y <= 15) return 'kr01_10y';
  return 'kr01_30y';
}

// ── Row shape ───────────────────────────────────────────────────────

export interface IrsRiskPnlRow {
  tradeId: string;
  desk: string;
  book: string;
  trader: string;
  strategy: string;

  product: string; // 'IRS OIS'
  ccy: Ccy;
  index: string; // SOFR / ESTR / SONIA / TONA
  tenor: Tenor;
  payReceive: PayReceive; // fixed leg direction
  notional: number; // in trade ccy
  fixedRate: number; // fraction (0.0381 = 3.81%)
  parRate: number; // current market par rate for the ccy/tenor, fraction
  effectiveDate: string; // YYYY-MM-DD
  maturityDate: string; // YYYY-MM-DD
  counterparty: string;
  clearingHouse: string;

  // Risk (USD). Bond-style sign: receive-fixed positive DV01.
  npv: number;
  dv01: number; // $ per 1bp parallel move
  gamma: number; // $ per bp² (convexity)
  kr01_2y: number; // key-rate partial DV01s; buckets sum to dv01
  kr01_5y: number;
  kr01_10y: number;
  kr01_30y: number;

  // P&L (USD). dayPnl always equals the sum of the six explain components.
  dayPnl: number;
  mtdPnl: number;
  ytdPnl: number;
  carryPnl: number; // coupon accrual + price alignment interest
  rollDownPnl: number; // curve roll-down
  curvePnl: number; // delta P&L from market moves
  newTradePnl: number; // day-one P&L on today's trades
  feesPnl: number; // brokerage / clearing fees (≤ 0)
  residualPnl: number; // unexplained

  updated: string; // ISO timestamp
}

// ── Helpers ─────────────────────────────────────────────────────────

function round(value: number, decimals: number): number {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ── Engine ──────────────────────────────────────────────────────────

/**
 * Keyed IRS position table. One global instance; `snapshot()` returns every position and
 * `tick()` moves 1–2 curve points then reprices (and returns) the affected positions.
 */
export class IrsRiskPnlTable {
  private readonly rows = new Map<string, IrsRiskPnlRow>();
  /** Live par curves the sim walks, keyed `${ccy}:${tenor}`, as fractions. */
  private readonly curves = new Map<string, number>();
  private tradeSeq = 700_000;

  constructor() {
    for (const ccy of Object.keys(BASE_CURVES) as Ccy[]) {
      for (const tenor of TENORS) this.curves.set(`${ccy}:${tenor}`, BASE_CURVES[ccy][tenor]);
    }
    for (const [desk, books] of Object.entries(STRUCTURE)) {
      for (const [book, { ccy, traders }] of Object.entries(books)) {
        for (const trader of traders) {
          const positions = 3 + Math.floor(Math.random() * 3); // 3–5 swaps per trader
          for (let i = 0; i < positions; i++) {
            const row = this.mintPosition(desk, book, ccy, trader);
            this.rows.set(row.tradeId, row);
          }
        }
      }
    }
  }

  snapshot(): IrsRiskPnlRow[] {
    return [...this.rows.values()];
  }

  /**
   * Random-walk 1–2 curve points (±0.05–0.4bp) and reprice every position on those points:
   * curvePnl moves by -Δbp × dv01 (+ a convexity term), carry accrues, NPV drifts with the
   * total P&L move. Returns the repriced rows.
   */
  tick(): IrsRiskPnlRow[] {
    const moved = new Map<string, number>(); // `${ccy}:${tenor}` -> Δ (fraction)
    const points = 1 + Math.floor(Math.random() * 2);
    const keys = [...this.curves.keys()];
    for (let i = 0; i < points; i++) {
      const key = pick(keys);
      const [ccy, tenor] = key.split(':') as [Ccy, Tenor];
      const base = BASE_CURVES[ccy][tenor];
      const current = this.curves.get(key)!;
      // Mean-revert toward the base level so curves stay in a realistic band.
      const drift = (base - current) * 0.02;
      const delta = rand(-1, 1) * 0.00004 + drift; // ±0.4bp
      this.curves.set(key, current + delta);
      moved.set(key, delta);
    }

    const updated: IrsRiskPnlRow[] = [];
    for (const row of this.rows.values()) {
      const delta = moved.get(`${row.ccy}:${row.tenor}`);
      if (delta === undefined) continue;
      updated.push(this.reprice(row, delta));
    }
    return updated;
  }

  private reprice(row: IrsRiskPnlRow, curveDelta: number): IrsRiskPnlRow {
    const deltaBp = curveDelta * 10_000;
    // Bond-style DV01 sign: P&L = -Δbp × dv01, plus the gamma (convexity) term.
    const curveMove = -deltaBp * row.dv01 + 0.5 * row.gamma * deltaBp * deltaBp;
    const carryAccrual = Math.abs(row.dv01) * rand(0.001, 0.004); // slow positive accrual
    const rollAccrual = row.dv01 * rand(0, 0.0015);
    const residual = curveMove * rand(-0.01, 0.01);

    const carryPnl = round(row.carryPnl + carryAccrual, 0);
    const rollDownPnl = round(row.rollDownPnl + rollAccrual, 0);
    const curvePnl = round(row.curvePnl + curveMove, 0);
    const residualPnl = round(row.residualPnl + residual, 0);
    const dayPnl = round(carryPnl + rollDownPnl + curvePnl + row.newTradePnl + row.feesPnl + residualPnl, 0);
    const dayMove = dayPnl - row.dayPnl;

    const next: IrsRiskPnlRow = {
      ...row,
      parRate: round(this.curves.get(`${row.ccy}:${row.tenor}`)!, 6),
      npv: round(row.npv + dayMove, 0),
      carryPnl,
      rollDownPnl,
      curvePnl,
      residualPnl,
      dayPnl,
      mtdPnl: round(row.mtdPnl + dayMove, 0),
      ytdPnl: round(row.ytdPnl + dayMove, 0),
      updated: new Date().toISOString(),
    };
    this.rows.set(next.tradeId, next);
    return next;
  }

  private mintPosition(desk: string, book: string, ccy: Ccy, trader: string): IrsRiskPnlRow {
    const tenor = pick(TENORS);
    const payReceive: PayReceive = Math.random() < 0.5 ? 'PAY' : 'RCV';
    const parRate = this.curves.get(`${ccy}:${tenor}`)!;
    // Traded some time in the past year — fixed rate near where par was then.
    const fixedRate = round(parRate + rand(-0.004, 0.004), 6);
    const notional = Math.round(rand(25, 750)) * 1_000_000 * (ccy === 'JPY' ? 150 : 1);

    // DV01 ≈ notional × annuity (≈ tenor years × ~0.92 discounting haircut) × 1bp, in USD.
    const years = TENOR_YEARS[tenor];
    const dv01Abs = round(notional * FX_TO_USD[ccy] * years * 0.92 * 0.0001, 0);
    const sign = payReceive === 'RCV' ? 1 : -1; // receive-fixed = long duration
    const dv01 = sign * dv01Abs;
    const gamma = round(sign * dv01Abs * 0.0007 * years, 1);

    const kr01s = { kr01_2y: 0, kr01_5y: 0, kr01_10y: 0, kr01_30y: 0 };
    // Bulk of the risk in the position's own bucket, a sliver in the neighbours (curve shape risk).
    const own = kr01Bucket(tenor);
    kr01s[own] = round(dv01 * rand(0.88, 0.96), 0);
    const spill = dv01 - kr01s[own];
    const others = (Object.keys(kr01s) as (keyof typeof kr01s)[]).filter((k) => k !== own);
    kr01s[pick(others)] = round(spill, 0);

    // NPV: off-market by (par - fixed) × dv01-per-bp, receiver gains when par < fixed.
    const offMarketBp = (parRate - fixedRate) * 10_000;
    const npv = round(-sign * offMarketBp * dv01Abs + rand(-1, 1) * dv01Abs * 0.5, 0);

    const isNewToday = Math.random() < 0.2;
    const carryPnl = round(dv01Abs * rand(0.05, 0.4), 0);
    const rollDownPnl = round(dv01 * rand(0, 0.15), 0);
    const curvePnl = round(dv01 * rand(-0.8, 0.8), 0);
    const newTradePnl = isNewToday ? round(dv01Abs * rand(0.02, 0.12), 0) : 0;
    const feesPnl = isNewToday ? -round(dv01Abs * rand(0.005, 0.03), 0) : 0;
    const residualPnl = round(dv01Abs * rand(-0.02, 0.02), 0);
    const dayPnl = carryPnl + rollDownPnl + curvePnl + newTradePnl + feesPnl + residualPnl;

    const effective = new Date(Date.now() - rand(5, 360) * 24 * 3600 * 1000);
    const maturity = new Date(effective.getTime());
    maturity.setFullYear(maturity.getFullYear() + years);

    return {
      tradeId: `IRS-${this.tradeSeq++}`,
      desk,
      book,
      trader,
      strategy: book.includes('Curve') ? 'Curve' : book.includes('Basis') || book.includes('Spread') ? 'Basis' : 'Outright',
      product: 'IRS OIS',
      ccy,
      index: INDEX_BY_CCY[ccy],
      tenor,
      payReceive,
      notional,
      fixedRate,
      parRate: round(parRate, 6),
      effectiveDate: isoDate(effective),
      maturityDate: isoDate(maturity),
      counterparty: pick(COUNTERPARTIES),
      clearingHouse: pick(CLEARING_BY_CCY[ccy]),
      npv,
      dv01,
      gamma,
      ...kr01s,
      dayPnl: round(dayPnl, 0),
      mtdPnl: round(dayPnl + dv01 * rand(-3, 3), 0),
      ytdPnl: round(dayPnl + dv01 * rand(-12, 12), 0),
      carryPnl,
      rollDownPnl,
      curvePnl,
      newTradePnl,
      feesPnl,
      residualPnl,
      updated: new Date().toISOString(),
    };
  }
}
