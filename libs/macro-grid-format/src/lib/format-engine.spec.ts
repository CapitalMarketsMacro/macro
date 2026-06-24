import { buildCellStyle, buildValueFormatter, formatValue, previewStyle } from './format-engine';
import type { ColumnFormatSpec } from './format-spec';

/** Normalise NBSP that Intl inserts (e.g. before currency codes) so assertions are stable. */
const norm = (s: string) => s.replace(/[\u00A0\u202F]/g, ' ');
const fmt = (value: unknown, spec: ColumnFormatSpec, row?: Record<string, unknown>) =>
  norm(formatValue(value, spec, row));

describe('format-engine formatValue', () => {
  describe('null / zero handling', () => {
    it('returns nullText for null/undefined/NaN', () => {
      expect(fmt(null, { kind: 'number' })).toBe('');
      expect(fmt(undefined, { kind: 'number' })).toBe('');
      expect(fmt(NaN, { kind: 'number' })).toBe('');
      expect(fmt(null, { kind: 'number', nullText: 'n/a' })).toBe('n/a');
    });

    it('honours zeroText for an exact zero', () => {
      expect(fmt(0, { kind: 'currency', decimals: 0, zeroText: '-' })).toBe('-');
      expect(fmt(0, { kind: 'number' })).toBe('0.00');
    });
  });

  describe('number / integer', () => {
    it('formats decimals with grouping on by default', () => {
      expect(fmt(1234.5, { kind: 'number', decimals: 2 })).toBe('1,234.50');
      expect(fmt(-0.04, { kind: 'number', decimals: 2 })).toBe('-0.04');
    });

    it('formats integer at 0dp grouped', () => {
      expect(fmt(1234, { kind: 'integer' })).toBe('1,234');
    });

    it('can disable grouping', () => {
      expect(fmt(1234.5, { kind: 'number', decimals: 1, thousands: false })).toBe('1234.5');
    });

    it('applies scale and suffix ($mm)', () => {
      expect(fmt(1_234_567, { kind: 'number', decimals: 2, scale: 1e-6, suffix: ' mm' })).toBe('1.23 mm');
    });

    it('signDisplay always prefixes + on positives only (not zero)', () => {
      expect(fmt(5, { kind: 'integer', signDisplay: 'always' })).toBe('+5');
      expect(fmt(-5, { kind: 'integer', signDisplay: 'always' })).toBe('-5');
      expect(fmt(0, { kind: 'number', decimals: 2, signDisplay: 'always' })).toBe('0.00');
    });
  });

  describe('percent / basis points', () => {
    it('formats percent as value x 100 with %', () => {
      expect(fmt(0.0425, { kind: 'percent', decimals: 2 })).toBe('4.25%');
      expect(fmt(-0.013, { kind: 'percent', decimals: 2 })).toBe('-1.30%');
    });

    it('wraps negative percent in parentheses inside the %', () => {
      expect(fmt(-0.0425, { kind: 'percent', decimals: 2, negativeStyle: 'parentheses' })).toBe('(4.25%)');
    });

    it('formats basis points as value x 10000 with bps', () => {
      expect(fmt(0.00125, { kind: 'basisPoints', decimals: 1 })).toBe('12.5 bps');
      expect(fmt(0.000025, { kind: 'basisPoints', decimals: 2 })).toBe('0.25 bps');
    });
  });

  describe('currency', () => {
    it('formats with symbol and grouping', () => {
      expect(fmt(1234.5, { kind: 'currency', currency: 'USD', decimals: 2 })).toBe('$1,234.50');
    });

    it('uses parentheses for negative currency keeping the symbol inside', () => {
      expect(fmt(-500, { kind: 'currency', currency: 'EUR', decimals: 2, negativeStyle: 'parentheses' })).toBe(
        '(€500.00)',
      );
    });

    it('supports currency code display', () => {
      expect(fmt(1234, { kind: 'currency', currency: 'USD', currencyDisplay: 'code', decimals: 0 })).toContain(
        'USD',
      );
      expect(fmt(1234, { kind: 'currency', currency: 'USD', currencyDisplay: 'code', decimals: 0 })).toContain(
        '1,234',
      );
    });

    it('supports no currency display (plain grouped number)', () => {
      expect(fmt(1234.5, { kind: 'currency', currencyDisplay: 'none', decimals: 2 })).toBe('1,234.50');
    });
  });

  describe('compact', () => {
    it('abbreviates with K/M/B', () => {
      expect(fmt(2_500_000, { kind: 'compact', decimals: 1 })).toBe('2.5M');
      expect(fmt(1.2e9, { kind: 'compact', decimals: 1 })).toBe('1.2B');
      expect(fmt(950, { kind: 'compact', decimals: 0 })).toBe('950');
    });

    it('abbreviates with MM/BN notation and a prefix', () => {
      expect(fmt(2_500_000, { kind: 'compact', notation: 'mmbn', decimals: 1, prefix: '$' })).toBe('$2.5MM');
      expect(fmt(1.2e9, { kind: 'compact', notation: 'mmbn', decimals: 1 })).toBe('1.2BN');
    });
  });

  describe('multiplier', () => {
    it('appends x by default', () => {
      expect(fmt(1.25, { kind: 'multiplier', decimals: 2 })).toBe('1.25x');
    });
  });

  describe('text', () => {
    it('passes the value through unchanged (no value formatter)', () => {
      expect(buildValueFormatter({ kind: 'text', weight: 'bold' })).toBeUndefined();
      expect(formatValue('AAPL', { kind: 'text', weight: 'bold' })).toBe('AAPL');
      expect(formatValue(null, { kind: 'text', nullText: '-' })).toBe('-');
    });

    it('previewStyle returns font weight + italic', () => {
      expect(previewStyle({ kind: 'text', weight: 'bold', italic: true })).toEqual({
        fontWeight: 'bold',
        fontStyle: 'italic',
      });
      expect(previewStyle({ kind: 'text' })).toEqual({ fontWeight: 'normal', fontStyle: 'normal' });
    });

    it('buildCellStyle merges font over the base cellStyle', () => {
      const styleFn = buildCellStyle({ kind: 'text', weight: 'bolder' }, { textAlign: 'left' }) as (
        p: unknown,
      ) => Record<string, unknown>;
      expect(styleFn({ value: 'x' })).toEqual({ textAlign: 'left', fontWeight: 'bolder', fontStyle: 'normal' });
    });
  });

  describe('treasury / fxRate dispatch', () => {
    it('formats treasury via the tick formatter', () => {
      expect(fmt(99.5, { kind: 'treasury', fraction: 32, plusTick: true })).toBe('99-16');
      expect(fmt(99.515625, { kind: 'treasury', fraction: 32, plusTick: true })).toBe('99-16+');
    });

    it('formats fxRate at 5dp, JPY pairs at 3dp from the row symbol', () => {
      const spec: ColumnFormatSpec = { kind: 'fxRate', pipDecimals: 5, jpyConvention: true, symbolField: 'symbol' };
      expect(fmt(1.08745, spec, { symbol: 'EURUSD' })).toBe('1.08745');
      expect(fmt(149.502, spec, { symbol: 'USDJPY' })).toBe('149.502');
      expect(fmt(1.08745, spec)).toBe('1.08745'); // no row context -> pip default
    });
  });
});

describe('format-engine buildValueFormatter', () => {
  it('reads value and data from value-formatter params', () => {
    const vf = buildValueFormatter({ kind: 'fxRate', symbolField: 'sym' });
    expect(vf).toBeDefined();
    expect(norm(String(vf!({ value: 150.0, data: { sym: 'USDJPY' } } as never)))).toBe('150.000');
  });
});

describe('format-engine buildCellStyle', () => {
  it('returns base unchanged when no colour mode', () => {
    const base = { textAlign: 'right' as const };
    expect(buildCellStyle({ kind: 'number' }, base)).toBe(base);
  });

  it('colours positive green / negative red over the base style (posneg)', () => {
    const styleFn = buildCellStyle({ kind: 'number', colorMode: 'posneg' }, { textAlign: 'right' }) as (
      p: unknown,
    ) => Record<string, unknown>;
    expect(styleFn({ value: 5 })).toEqual({ textAlign: 'right', color: 'var(--mkt-up, #16a34a)' });
    expect(styleFn({ value: -5 })).toEqual({ textAlign: 'right', color: 'var(--mkt-down, #dc2626)' });
    expect(styleFn({ value: 0 })).toEqual({ textAlign: 'right' });
  });

  it('merges over a base cellStyle function', () => {
    const base = (p: { value: number }) => ({ fontWeight: p.value > 0 ? 700 : 400 });
    const styleFn = buildCellStyle({ kind: 'number', colorMode: 'negative' }, base) as (
      p: unknown,
    ) => Record<string, unknown>;
    expect(styleFn({ value: -1 })).toEqual({ fontWeight: 400, color: 'var(--mkt-down, #dc2626)' });
    expect(styleFn({ value: 1 })).toEqual({ fontWeight: 700 });
  });
});
