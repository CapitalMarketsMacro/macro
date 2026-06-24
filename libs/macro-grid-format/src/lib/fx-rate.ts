/**
 * FX spot-rate formatting with pip precision and the JPY 3-dp convention.
 *
 * Most G10 pairs quote to 5 dp (fractional pips), while pairs quoted in JPY quote to
 * 3 dp. The pair symbol is read from the row (`params.data[symbolField]`) so a single
 * format applied across a blotter renders each row at its correct precision.
 */

import type { FxRateSpec } from './format-spec';

/** True when a pair symbol is quoted in JPY (terms currency JPY). */
export function isJpyPair(symbol: string | undefined): boolean {
  return !!symbol && symbol.toUpperCase().endsWith('JPY');
}

/**
 * Format an FX rate. When `jpyConvention` is on and the row's symbol ends in `JPY`,
 * renders at 3 dp; otherwise at `pipDecimals` (default 5). Grouping is off by default
 * (spot rates aren't grouped). `rowSymbol` is the value read from the configured
 * `symbolField` for the current row, when available.
 */
export function formatFxRate(value: number, spec: FxRateSpec, rowSymbol?: string): string {
  if (value == null || typeof value !== 'number' || isNaN(value)) {
    return spec.nullText ?? '';
  }
  const pipDecimals = spec.pipDecimals ?? 5;
  const jpy = spec.jpyConvention !== false && isJpyPair(rowSymbol);
  const decimals = jpy ? 3 : pipDecimals;
  const useGrouping = spec.thousands ?? false;
  const core = new Intl.NumberFormat(spec.locale ?? 'en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping,
  }).format(value);
  return (spec.prefix ?? '') + core + (spec.suffix ?? '');
}
