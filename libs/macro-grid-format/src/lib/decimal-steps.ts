/**
 * Excel-style "Increase / Decrease Decimals" quick actions for numeric columns.
 *
 * The step rides the same `ColumnFormatStore` the Format tool panel edits, so it obeys
 * bake mode, persists in the `columnFormats` side-channel, and the panel reflects the new
 * decimals when opened. Columns with no format yet get one INFERRED from the currently
 * displayed value (decimals, thousands, prefix/suffix, leading `+`), so the first click
 * only adds/removes one decimal instead of visibly re-formatting the column.
 *
 * Framework-free: AG Grid appears as type-only imports (erased at compile), keeping the
 * core's optional-peer contract intact.
 */

import type { GridApi, IRowNode, MenuItemDef } from 'ag-grid-community';
import type { ColumnFormatStore } from './column-format-store';
import type { NumberSpec } from './format-spec';
import { defaultDecimals } from './format-engine';

/** Decimal bounds — match the Format tool panel's `decimals` stepper (format-registry). */
export const MIN_STEP_DECIMALS = 0;
export const MAX_STEP_DECIMALS = 10;

/** Kinds with no decimal knob: ticks (32nds/64ths), dates, and style-only text. */
const NON_STEPPABLE_KINDS: ReadonlySet<string> = new Set(['treasury', 'date', 'text']);

function clampDecimals(n: number): number {
  return Math.min(MAX_STEP_DECIMALS, Math.max(MIN_STEP_DECIMALS, n));
}

/**
 * Find the first leaf row whose raw value for the column is a finite number, returning the
 * raw value and its CURRENT displayed text (through the column's live valueFormatter).
 * Group rows are skipped — their `data` is undefined and their value is aggregation-driven.
 */
function findNumericSample(
  api: GridApi,
  colId: string,
): { raw: number; formatted: string } | undefined {
  let sample: { raw: number; formatted: string } | undefined;
  api.forEachNodeAfterFilterAndSort((node: IRowNode) => {
    if (sample || node.group || !node.data) return;
    const raw = api.getCellValue({ rowNode: node, colKey: colId });
    if (typeof raw === 'number' && isFinite(raw)) {
      const formatted = api.getCellValue({ rowNode: node, colKey: colId, useFormatter: true });
      sample = { raw, formatted: typeof formatted === 'string' && formatted ? formatted : String(raw) };
    }
  });
  return sample;
}

/**
 * Derive a `number` spec that reproduces how a value is CURRENTLY displayed: fraction
 * digits, thousands grouping, literal prefix/suffix (`$`, `%`, ` bps`, `M`, `x`, …) and a
 * forced `+` on positives. en-US only — the engine pins that locale and the app formatters
 * use `toFixed`.
 */
export function inferNumberSpec(formatted: string, raw: number): NumberSpec {
  const text = (formatted ?? '').trim();
  const core = text.match(/[-+]?[\d,]+(?:\.(\d+))?/);
  if (!core) {
    const rawFraction = /\.(\d+)/.exec(String(raw))?.[1]?.length ?? 0;
    return { kind: 'number', decimals: clampDecimals(rawFraction), thousands: false };
  }
  const spec: NumberSpec = {
    kind: 'number',
    decimals: core[1]?.length ?? 0,
    thousands: core[0].includes(','),
  };
  const start = text.indexOf(core[0]);
  let prefix = text.slice(0, start);
  const suffix = text.slice(start + core[0].length);
  if (core[0].startsWith('+') || prefix.endsWith('+')) {
    spec.signDisplay = 'always';
    if (prefix.endsWith('+')) prefix = prefix.slice(0, -1);
  }
  if (prefix) spec.prefix = prefix;
  if (suffix) spec.suffix = suffix;
  return spec;
}

/** True when the column can take a decimal step (numeric spec, or raw numeric values). */
export function canStepDecimals(store: ColumnFormatStore, api: GridApi, colId: string): boolean {
  const spec = store.get(colId);
  if (spec) return !NON_STEPPABLE_KINDS.has(spec.kind);
  return !!findNumericSample(api, colId);
}

/**
 * Step the column's fraction digits by `delta` (±1). Returns false when the column is not
 * steppable or already at a bound. `fxRate` steps its `pipDecimals` knob (the JPY 3-dp
 * convention is fixed by design); every other numeric kind steps `decimals`.
 */
export function stepColumnDecimals(
  store: ColumnFormatStore,
  api: GridApi,
  colId: string,
  delta: 1 | -1,
): boolean {
  const spec = store.get(colId);
  if (spec) {
    // Literal checks (not the Set) so TypeScript narrows the union to kinds with `decimals`.
    if (spec.kind === 'treasury' || spec.kind === 'date' || spec.kind === 'text') return false;
    if (spec.kind === 'fxRate') {
      const current = spec.pipDecimals ?? 5;
      const next = clampDecimals(current + delta);
      if (next === current) return false;
      store.apply(colId, { ...spec, pipDecimals: next });
      return true;
    }
    const current = spec.decimals ?? defaultDecimals(spec.kind);
    const next = clampDecimals(current + delta);
    if (next === current) return false;
    store.apply(colId, { ...spec, decimals: next });
    return true;
  }
  const sample = findNumericSample(api, colId);
  if (!sample) return false;
  const inferred = inferNumberSpec(sample.formatted, sample.raw);
  const current = inferred.decimals ?? 0;
  const next = clampDecimals(current + delta);
  if (next === current) return false;
  store.apply(colId, { ...inferred, decimals: next });
  return true;
}

const INCREASE_ICON = '<span style="font-size:9px;font-weight:700;letter-spacing:-0.5px">.0&#8594;.00</span>';
const DECREASE_ICON = '<span style="font-size:9px;font-weight:700;letter-spacing:-0.5px">.00&#8594;.0</span>';

/**
 * Build the two Excel-style menu items for a column, or `[]` when the column is not
 * steppable (non-numeric values, or a treasury/date/text format is applied). Wire the
 * result into `getMainMenuItems` (column header menu) and/or `getContextMenuItems`
 * (cell right-click).
 */
export function buildDecimalStepMenuItems(
  store: ColumnFormatStore,
  api: GridApi,
  colId: string | undefined,
): MenuItemDef[] {
  if (!colId || !canStepDecimals(store, api, colId)) return [];
  return [
    {
      name: 'Increase Decimals',
      icon: INCREASE_ICON,
      action: () => {
        stepColumnDecimals(store, api, colId, 1);
      },
    },
    {
      name: 'Decrease Decimals',
      icon: DECREASE_ICON,
      action: () => {
        stepColumnDecimals(store, api, colId, -1);
      },
    },
  ];
}
