import type { ColDef, ColGroupDef, GridOptions } from 'ag-grid-community';
import type { BlotterMode } from './blotter-source';
import { titleCase } from './column-inference';

/**
 * Aggregation applied to a measure column when the blotter is rolled up (AG Grid built-ins),
 * or `'none'` to exclude a numeric field from aggregation entirely — e.g. a per-currency
 * notional that must not be summed across books in different currencies.
 */
export type RollupAggFunc = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'first' | 'last' | 'none';

/**
 * Optional roll-up view for a blotter source: group the flat payload into a hierarchy
 * (e.g. desk → book → trader) with aggregated measure columns — the Risk/PnL dashboard pattern
 * as data-source config. Sources without one still get a suggestion inferred from the payload's
 * field names (see {@link suggestRollup}); users toggle the view from the blotter toolbar and can
 * refine it by dragging columns in the grid's row-group panel.
 */
export interface RollupConfig {
  /** Grouping hierarchy, coarsest first (e.g. `["desk", "book", "trader"]`). */
  groupBy: string[];
  /**
   * Per-field aggregation overrides. Numeric fields not listed are inferred by name:
   * price/rate/yield-like fields average, everything else (PnL, size, notional, …) sums.
   */
  aggregations?: Record<string, RollupAggFunc>;
  /** Open the blotter rolled up (default false — the toolbar toggle starts flat). */
  enabled?: boolean;
  /** Group levels expanded initially (default 1; -1 expands everything). */
  expandLevels?: number;
  /** Pin a grand-total row at the bottom (default true). */
  grandTotal?: boolean;
}

export interface SuggestRollupOptions {
  /** The source's key field — excluded from grouping on keyed modes (each group would hold one row). */
  keyField?: string;
  mode?: BlotterMode;
  /** Maximum grouping depth (default 3, like desk → book → trader). */
  maxLevels?: number;
}

/**
 * Grouping candidates by field name, coarsest first — the match order defines the suggested
 * hierarchy. One field per pattern (the shortest match wins, e.g. `book` over `bookName`).
 */
const GROUP_PRIORITY: RegExp[] = [
  /desk/,
  /book/,
  /portfolio/,
  /strategy/,
  /trader/,
  /account/,
  /counterparty|cpty/,
  /broker|dealer/,
  /sector|industry/,
  /region|country/,
  /asset_?class|category/,
  /instrument_?type|product_?type|security_?type/,
  /venue|exchange/,
  /tenor/,
  /(symbol|ticker|instrument|pair)$/,
  /side$/,
  /status$/,
  /(ccy|currency)$/,
];

/** Unambiguous per-unit quantities — always average (a summed discountRate is meaningless). */
const STRONG_AVG_RX = /(rate|yield|price|coupon|spread)/;
/** Fields that sum. Lookbehinds keep `discount`/`cashflow` out of the wrong bucket. */
const SUM_RX =
  /(pnl|p&l|qty|quantity|size|flow|volume|notional|amount|nominal|face|value|exposure|dv01|delta|gamma|vega|theta|position|balance|(?<!dis)count|fee|charge|commission)/;
/** Fields that average. `(?<!f)low` spares `cashflow`; `(?<!ex)change` spares `exchangeFee`. */
const AVG_RX =
  /(px|bid|ask|mid|last|open|high|(?<!f)low|close|nav|strike|factor|vol(atility|_?\d|$)|(?<!ex)change|pct|percent|score)/;

/**
 * Default aggregation for a numeric field, by name: unambiguous per-unit fields (rates, prices)
 * average, then explicit sums (sizes, flows), then remaining per-unit shapes, else sum.
 */
export function aggForField(field: string): RollupAggFunc {
  const n = field.toLowerCase();
  if (STRONG_AVG_RX.test(n)) return 'avg';
  if (SUM_RX.test(n)) return 'sum';
  if (AVG_RX.test(n)) return 'avg';
  return 'sum';
}

/**
 * Suggest a {@link RollupConfig} from the blotter's (inferred) columns using capital-markets
 * field-name heuristics: categorical fields become the grouping hierarchy (desk → book → trader
 * style, capped at `maxLevels`) and numeric columns become aggregated measures. Returns `null`
 * when the payload has no plausible grouping field.
 */
export function suggestRollup(columns: (ColDef | ColGroupDef)[], opts: SuggestRollupOptions = {}): RollupConfig | null {
  const maxLevels = opts.maxLevels ?? 3;
  const leaves: ColDef[] = [];
  forEachLeaf(columns, (c) => leaves.push(c));

  const candidates = leaves.filter((c) => isGroupCandidate(c, opts));
  const groupBy: string[] = [];
  for (const rx of GROUP_PRIORITY) {
    if (groupBy.length >= maxLevels) break;
    const matches = candidates.filter((c) => rx.test(c.field!.toLowerCase()) && !groupBy.includes(c.field!));
    if (!matches.length) continue;
    // Shortest name is the most canonical (`book` over `bookName`).
    matches.sort((a, b) => a.field!.length - b.field!.length);
    groupBy.push(matches[0].field!);
  }
  if (!groupBy.length) return null;

  const aggregations: Record<string, RollupAggFunc> = {};
  for (const c of leaves) {
    if (!c.field || groupBy.includes(c.field) || c.type !== 'numericColumn') continue;
    aggregations[c.field] = aggForField(c.field);
  }
  return { groupBy, aggregations };
}

/**
 * Decorate column defs for a rolled-up view: grouping fields become hidden `rowGroup` columns (in
 * hierarchy order), measure columns get their `aggFunc` (explicit override, else inferred by name),
 * and remaining leaves become draggable into the grid's row-group panel. Pure — returns new defs;
 * fields in `groupBy` that don't exist in `defs` are simply ignored. Works on both explicitly
 * inferred columns and the defs AG Grid v36 auto-generation produces (via
 * `processAutoGeneratedColumnDefs`).
 */
export function applyRollupToColumns<T extends ColDef | ColGroupDef>(defs: T[], rollup: RollupConfig): T[] {
  return defs.map((d) => {
    const children = (d as ColGroupDef).children;
    if (Array.isArray(children)) {
      return { ...d, children: applyRollupToColumns(children, rollup) };
    }
    return decorateLeaf(d as ColDef, rollup) as T;
  });
}

/**
 * Fill a (possibly partial) source-authored config with name-inferred aggregations for numeric
 * columns it doesn't cover. Keeps configured roll-ups consistent between the infer and v36
 * auto-gen column paths: auto-generated defs are bare `{ field }` objects with no numeric type,
 * so {@link applyRollupToColumns}' type-based fallback never fires there — a complete
 * aggregation map (from the inferred columns, which always exist) closes that gap.
 */
export function completeRollup(rollup: RollupConfig, columns: (ColDef | ColGroupDef)[]): RollupConfig {
  const aggregations: Record<string, RollupAggFunc> = { ...(rollup.aggregations ?? {}) };
  forEachLeaf(columns, (c) => {
    if (!c.field || rollup.groupBy.includes(c.field) || c.type !== 'numericColumn') return;
    aggregations[c.field] ??= aggForField(c.field);
  });
  return { ...rollup, aggregations };
}

/** `'Desk / Book / Trader'` — the auto group column header for a roll-up. */
export function rollupGroupHeader(rollup: RollupConfig): string {
  return rollup.groupBy.map(titleCase).join(' / ');
}

/**
 * Grid options for a rolled-up blotter: the auto group column (named after the hierarchy), the
 * row-group panel for ad-hoc refinement, initial expansion, and a bottom grand-total row. Spread
 * these into the blotter's `gridOptions` when the roll-up view is on.
 */
export function rollupGridOptions(rollup: RollupConfig): GridOptions {
  return {
    rowGroupPanelShow: 'always',
    groupDefaultExpanded: rollup.expandLevels ?? 1,
    suppressAggFuncInHeader: true,
    ...(rollup.grandTotal !== false ? { grandTotalRow: 'bottom' as const } : {}),
    autoGroupColumnDef: {
      headerName: rollupGroupHeader(rollup),
      minWidth: 250,
      pinned: 'left',
      cellRendererParams: { suppressCount: false },
    },
  };
}

// ── internals ──

function decorateLeaf(c: ColDef, rollup: RollupConfig): ColDef {
  const field = c.field;
  if (!field) return c;
  const groupIndex = rollup.groupBy.indexOf(field);
  if (groupIndex >= 0) {
    return { ...c, rowGroup: true, rowGroupIndex: groupIndex, hide: true, enableRowGroup: true };
  }
  const agg = rollup.aggregations?.[field] ?? (c.type === 'numericColumn' ? aggForField(field) : undefined);
  // An explicit 'none' opts a numeric field out of aggregation (blank at group level).
  if (agg && agg !== 'none') return { ...c, aggFunc: agg, enableValue: true };
  return { ...c, enableRowGroup: true };
}

function isGroupCandidate(c: ColDef, opts: SuggestRollupOptions): boolean {
  const field = c.field;
  if (!field || c.type === 'numericColumn') return false;
  if (field === '__id') return false;
  const n = field.toLowerCase();
  // Ids and timestamps never group meaningfully (`Id`/`ID` suffix on the original casing so
  // `bid`/`grid`/`mid` survive but `bookingID` is caught).
  if (/(Id|ID)$/.test(field) || n === 'id' || n.endsWith('_id')) return false;
  if (isDateLike(n)) return false;
  // On keyed modes every leaf is unique per key — grouping by the key yields one row per group.
  if (opts.mode !== 'append' && opts.keyField && field === opts.keyField) return false;
  return true;
}

function isDateLike(n: string): boolean {
  return (
    n.includes('timestamp') ||
    /(^|[^a-z])time([^a-z]|$)/.test(n) ||
    n.endsWith('time') ||
    n.includes('date') ||
    n.includes('maturity') ||
    n.includes('expiry') ||
    n.includes('settle')
  );
}

function forEachLeaf(defs: (ColDef | ColGroupDef)[], fn: (c: ColDef) => void): void {
  for (const d of defs) {
    const children = (d as ColGroupDef).children;
    if (Array.isArray(children)) forEachLeaf(children, fn);
    else fn(d as ColDef);
  }
}
