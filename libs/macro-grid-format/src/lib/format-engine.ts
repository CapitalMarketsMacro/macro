/**
 * The pure format engine: turns a {@link ColumnFormatSpec} into displayed text and,
 * for colour-by-sign, an AG Grid `cellStyle`. No grid/runtime dependencies beyond
 * AG Grid types — everything here is deterministic and unit-testable.
 */

import type { CellStyle, CellStyleFunc, ColDef, ValueFormatterFunc, ValueFormatterParams } from 'ag-grid-community';
import type {
  ColorMode,
  ColumnFormatSpec,
  CompactSpec,
  CurrencySpec,
  FormatKind,
  FxRateSpec,
  NumericModifiers,
} from './format-spec';
import { formatTreasury } from './treasury';
import { formatFxRate } from './fx-rate';

/** Market up/down colours, themed via `@macro/macro-design` tokens with hex fallbacks. */
const POSITIVE_COLOR = 'var(--mkt-up, #16a34a)';
const NEGATIVE_COLOR = 'var(--mkt-down, #dc2626)';

const DEFAULT_LOCALE = 'en-US';

function defaultDecimals(kind: FormatKind): number {
  switch (kind) {
    case 'integer':
      return 0;
    case 'basisPoints':
      return 1;
    case 'compact':
      return 1;
    case 'fxRate':
      return 5;
    default:
      return 2;
  }
}

/** Grouping defaults: on for money-ish magnitudes, off for rates/percent/bps. */
function defaultThousands(kind: FormatKind): boolean {
  return kind === 'number' || kind === 'integer' || kind === 'currency';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

function nf(locale: string, decimals: number, useGrouping: boolean): Intl.NumberFormat {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping,
  });
}

function formatCompact(abs: number, spec: CompactSpec): string {
  const locale = spec.locale ?? DEFAULT_LOCALE;
  const decimals = spec.decimals ?? defaultDecimals('compact');
  const units: [number, string][] =
    spec.notation === 'mmbn'
      ? [
          [1e12, 'T'],
          [1e9, 'BN'],
          [1e6, 'MM'],
          [1e3, 'K'],
        ]
      : [
          [1e12, 'T'],
          [1e9, 'B'],
          [1e6, 'M'],
          [1e3, 'K'],
        ];
  for (const [threshold, unit] of units) {
    if (abs >= threshold) {
      return nf(locale, decimals, false).format(abs / threshold) + unit;
    }
  }
  return nf(locale, decimals, spec.thousands ?? false).format(abs);
}

function formatCurrencyCore(abs: number, spec: CurrencySpec, decimals: number, useGrouping: boolean): string {
  const locale = spec.locale ?? DEFAULT_LOCALE;
  const display = spec.currencyDisplay ?? 'symbol';
  if (display === 'none') {
    return nf(locale, decimals, useGrouping).format(abs);
  }
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: spec.currency ?? 'USD',
    currencyDisplay: display,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping,
  }).format(abs);
}

/** Format the numeric `kind`s (everything except treasury/fxRate/date). */
function formatNumeric(value: number, spec: ColumnFormatSpec): string {
  const mods = spec as NumericModifiers & { kind: FormatKind };
  const kind = spec.kind;
  const scale = mods.scale ?? 1;
  const kindMultiplier = kind === 'percent' ? 100 : kind === 'basisPoints' ? 10000 : 1;
  const n = value * scale * kindMultiplier;

  const decimals = mods.decimals ?? defaultDecimals(kind);
  const useGrouping = mods.thousands ?? defaultThousands(kind);
  const locale = mods.locale ?? DEFAULT_LOCALE;

  const neg = n < 0;
  const abs = Math.abs(n);

  let core: string;
  if (kind === 'currency') {
    core = formatCurrencyCore(abs, spec as CurrencySpec, decimals, useGrouping);
  } else if (kind === 'compact') {
    core = formatCompact(abs, spec as CompactSpec);
  } else {
    core = nf(locale, decimals, useGrouping).format(abs);
  }

  // Kind-specific auto suffix (kept INSIDE any parentheses / sign).
  let autoSuffix = '';
  if (kind === 'percent') autoSuffix = '%';
  else if (kind === 'basisPoints') autoSuffix = ' bps';
  else if (kind === 'multiplier' && mods.suffix == null) autoSuffix = 'x';

  const body = (mods.prefix ?? '') + core + autoSuffix + (mods.suffix ?? '');

  if (neg) {
    return mods.negativeStyle === 'parentheses' ? `(${body})` : `-${body}`;
  }
  // `always` flags positives with a leading '+', but an exact 0 is neither sign.
  return n > 0 && mods.signDisplay === 'always' ? `+${body}` : body;
}

function formatDate(value: unknown, spec: Extract<ColumnFormatSpec, { kind: 'date' }>): string {
  if (value == null || value === '') return '';
  const date =
    value instanceof Date ? value : typeof value === 'number' ? new Date(value) : new Date(String(value));
  if (isNaN(date.getTime())) return String(value);
  const locale = spec.locale ?? DEFAULT_LOCALE;
  switch (spec.dateStyle ?? 'date') {
    case 'time':
      return date.toLocaleTimeString(locale);
    case 'datetime':
      return date.toLocaleString(locale);
    default:
      return date.toLocaleDateString(locale);
  }
}

/**
 * Format a single value according to `spec`. `rowData` is the row object (used by
 * `fxRate` to read the pair symbol); pass `params.data` from a value formatter.
 */
export function formatValue(value: unknown, spec: ColumnFormatSpec, rowData?: Record<string, unknown>): string {
  switch (spec.kind) {
    case 'treasury': {
      if (!isFiniteNumber(value)) return spec.nullText ?? '';
      if (value === 0 && spec.zeroText != null) return spec.zeroText;
      return formatTreasury(value, { fraction: spec.fraction, plusTick: spec.plusTick });
    }
    case 'fxRate': {
      const fx = spec as FxRateSpec;
      const symbol = rowData?.[fx.symbolField ?? 'symbol'];
      return formatFxRate(value as number, fx, typeof symbol === 'string' ? symbol : undefined);
    }
    case 'date':
      return formatDate(value, spec);
    case 'text':
      // Text formats only style the cell; the value passes through unchanged.
      return value == null ? spec.nullText ?? '' : String(value);
    default: {
      const mods = spec as NumericModifiers;
      if (!isFiniteNumber(value)) return mods.nullText ?? '';
      if (value === 0 && mods.zeroText != null) return mods.zeroText;
      return formatNumeric(value, spec);
    }
  }
}

/**
 * Build an AG Grid `valueFormatter` from a spec, or `undefined` when the kind does not change
 * the displayed value (`text` only styles the cell — its column keeps its own value display).
 */
export function buildValueFormatter(spec: ColumnFormatSpec): ValueFormatterFunc | undefined {
  if (spec.kind === 'text') return undefined;
  return (params: ValueFormatterParams) =>
    formatValue(params?.value, spec, params?.data as Record<string, unknown> | undefined);
}

function resolveSignColor(value: unknown, mode: ColorMode): string | undefined {
  if (!isFiniteNumber(value)) return undefined;
  if (mode === 'posneg') {
    if (value > 0) return POSITIVE_COLOR;
    if (value < 0) return NEGATIVE_COLOR;
    return undefined;
  }
  if (mode === 'negative') {
    return value < 0 ? NEGATIVE_COLOR : undefined;
  }
  return undefined;
}

function resolveBaseStyle(base: ColDef['cellStyle'], params: unknown): CellStyle {
  if (typeof base === 'function') {
    const result = (base as CellStyleFunc)(params as Parameters<CellStyleFunc>[0]);
    return (result as CellStyle) ?? {};
  }
  return (base as CellStyle) ?? {};
}

/** The concrete CSS props a format can overlay onto a cell (used for live cellStyle + preview). */
export interface FormatStyleOverlay {
  color?: string;
  fontWeight?: string;
  fontStyle?: string;
}

/**
 * The style overlay a spec contributes ON TOP of a column's own cellStyle: colour-by-sign for
 * numeric kinds, and font weight/italic for the `text` kind. Returns the props to merge (no
 * base), so it can drive both the live `cellStyle` and the tool-panel preview. Typed concretely
 * (not via `CellStyle`'s index signature) so consumers can read `.fontWeight` etc. directly.
 */
export function previewStyle(spec: ColumnFormatSpec, value?: unknown): FormatStyleOverlay {
  const overlay: FormatStyleOverlay = {};
  const mode = (spec as NumericModifiers).colorMode;
  if (mode && mode !== 'none') {
    const color = resolveSignColor(value, mode);
    if (color) overlay.color = color;
  }
  if (spec.kind === 'text') {
    overlay.fontWeight = spec.weight ?? 'normal';
    overlay.fontStyle = spec.italic ? 'italic' : 'normal';
  }
  return overlay;
}

/** True when a spec contributes any cellStyle overlay (colour or font). */
function hasStyleOverlay(spec: ColumnFormatSpec): boolean {
  const mode = (spec as NumericModifiers).colorMode;
  return (!!mode && mode !== 'none') || spec.kind === 'text';
}

/**
 * Build a `cellStyle` composed OVER the column's original `cellStyle` (so app-defined
 * `{ textAlign: 'right' }` etc. survive): colour-by-sign for numeric kinds, font weight/italic
 * for `text`. Returns `base` unchanged when the spec contributes no overlay.
 */
export function buildCellStyle(
  spec: ColumnFormatSpec,
  base?: ColDef['cellStyle'],
): ColDef['cellStyle'] | undefined {
  if (!hasStyleOverlay(spec)) return base;
  return (params: unknown): CellStyle => {
    const baseStyle = resolveBaseStyle(base, params);
    const overlay = previewStyle(spec, (params as { value?: unknown })?.value);
    return { ...baseStyle, ...overlay };
  };
}
