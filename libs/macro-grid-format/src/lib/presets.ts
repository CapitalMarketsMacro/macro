/**
 * Named capital-markets format presets, grouped by business area. A preset SEEDS the
 * tool-panel editor (the user can tweak any knob before applying), giving one-click
 * access to the conventions used across Rates / FX / Commodities / Risk-PnL.
 */

import type { ColumnFormatSpec } from './format-spec';

export type PresetGroup = 'Rates' | 'FX' | 'Commodities' | 'Risk / PnL' | 'General';

export interface FormatPreset {
  id: string;
  label: string;
  group: PresetGroup;
  /** Short hint shown under the preset in the gallery. */
  hint?: string;
  spec: ColumnFormatSpec;
}

export const FORMAT_PRESETS: FormatPreset[] = [
  // ── Rates ──
  { id: 'rates-yield', label: 'Yield %', group: 'Rates', hint: '4 dp percent',
    spec: { kind: 'percent', decimals: 4 } },
  { id: 'rates-spread-bps', label: 'Spread (bps)', group: 'Rates', hint: 'signed, coloured',
    spec: { kind: 'basisPoints', decimals: 1, signDisplay: 'always', colorMode: 'posneg' } },
  { id: 'rates-dv01-mm', label: 'DV01 ($mm)', group: 'Rates', hint: 'scaled to millions',
    spec: { kind: 'number', decimals: 2, scale: 1e-6, suffix: ' mm' } },
  { id: 'rates-ust-32', label: 'UST Price (32nds)', group: 'Rates', hint: '99-16+',
    spec: { kind: 'treasury', fraction: 32, plusTick: true } },
  { id: 'rates-ust-64', label: 'UST Price (64ths)', group: 'Rates', hint: '99-49',
    spec: { kind: 'treasury', fraction: 64, plusTick: false } },
  { id: 'rates-convexity', label: 'Convexity', group: 'Rates', hint: '4 dp',
    spec: { kind: 'number', decimals: 4 } },

  // ── FX ──
  { id: 'fx-rate', label: 'FX Rate (5dp / JPY)', group: 'FX', hint: 'pip precision, JPY → 3dp',
    spec: { kind: 'fxRate', pipDecimals: 5, jpyConvention: true, symbolField: 'symbol' } },
  { id: 'fx-points', label: 'FX Points', group: 'FX', hint: 'signed 1 dp',
    spec: { kind: 'number', decimals: 1, signDisplay: 'always' } },
  { id: 'fx-pips-bps', label: 'Pips (bps)', group: 'FX', hint: 'value × 10000',
    spec: { kind: 'basisPoints', decimals: 1 } },

  // ── Commodities ──
  { id: 'cmdty-price', label: 'Price ($)', group: 'Commodities', hint: '2 dp currency',
    spec: { kind: 'currency', currency: 'USD', currencyDisplay: 'symbol', decimals: 2 } },
  { id: 'cmdty-spread', label: 'Spread', group: 'Commodities', hint: '4 dp',
    spec: { kind: 'number', decimals: 4 } },
  { id: 'cmdty-per-unit', label: '$/unit', group: 'Commodities', hint: 'currency 2 dp',
    spec: { kind: 'currency', currency: 'USD', currencyDisplay: 'symbol', decimals: 2 } },

  // ── Risk / PnL ──
  { id: 'pnl-accounting', label: 'PnL $ (accounting)', group: 'Risk / PnL', hint: '(1,234) red/green, 0 dp',
    spec: { kind: 'currency', currency: 'USD', currencyDisplay: 'symbol', decimals: 0,
      negativeStyle: 'parentheses', colorMode: 'posneg', zeroText: '-' } },
  { id: 'pnl-notional-mm', label: 'Notional ($mm)', group: 'Risk / PnL', hint: 'compact MM/BN',
    spec: { kind: 'compact', notation: 'mmbn', decimals: 1, prefix: '$' } },
  { id: 'pnl-change-pct', label: 'Change %', group: 'Risk / PnL', hint: 'signed, coloured',
    spec: { kind: 'percent', decimals: 2, signDisplay: 'always', colorMode: 'posneg' } },
  { id: 'pnl-greeks', label: 'Greeks', group: 'Risk / PnL', hint: '4 dp, coloured',
    spec: { kind: 'number', decimals: 4, colorMode: 'posneg' } },
  { id: 'pnl-var', label: 'VaR', group: 'Risk / PnL', hint: '(1,234) 0 dp',
    spec: { kind: 'currency', currency: 'USD', currencyDisplay: 'symbol', decimals: 0,
      negativeStyle: 'parentheses' } },

  // ── General ──
  { id: 'gen-integer', label: 'Integer', group: 'General', hint: 'grouped, 0 dp',
    spec: { kind: 'integer' } },
  { id: 'gen-decimal', label: 'Decimal (2dp)', group: 'General', hint: 'grouped, 2 dp',
    spec: { kind: 'number', decimals: 2 } },
  { id: 'gen-percent', label: 'Percent (2dp)', group: 'General', hint: 'value × 100',
    spec: { kind: 'percent', decimals: 2 } },
  { id: 'gen-date', label: 'Date', group: 'General', hint: 'locale date',
    spec: { kind: 'date', dateStyle: 'date' } },
  { id: 'gen-datetime', label: 'Date & time', group: 'General', hint: 'locale datetime',
    spec: { kind: 'date', dateStyle: 'datetime' } },
];

/** Presets grouped for rendering a gallery, preserving declaration order within a group. */
export function presetsByGroup(): { group: PresetGroup; presets: FormatPreset[] }[] {
  const order: PresetGroup[] = ['Rates', 'FX', 'Commodities', 'Risk / PnL', 'General'];
  return order
    .map((group) => ({ group, presets: FORMAT_PRESETS.filter((p) => p.group === group) }))
    .filter((g) => g.presets.length > 0);
}
