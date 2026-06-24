import { formatFxRate, isJpyPair } from './fx-rate';
import type { FxRateSpec } from './format-spec';

const base: FxRateSpec = { kind: 'fxRate', pipDecimals: 5, jpyConvention: true, symbolField: 'symbol' };

describe('isJpyPair', () => {
  it('detects JPY terms currency', () => {
    expect(isJpyPair('USDJPY')).toBe(true);
    expect(isJpyPair('eurjpy')).toBe(true);
    expect(isJpyPair('EURUSD')).toBe(false);
    expect(isJpyPair(undefined)).toBe(false);
  });
});

describe('formatFxRate', () => {
  it('uses 5 dp by default for non-JPY pairs', () => {
    expect(formatFxRate(1.08745, base, 'EURUSD')).toBe('1.08745');
  });

  it('uses 3 dp for JPY pairs when jpyConvention is on', () => {
    expect(formatFxRate(149.502, base, 'USDJPY')).toBe('149.502');
  });

  it('falls back to pipDecimals when no symbol is supplied', () => {
    expect(formatFxRate(1.2, base)).toBe('1.20000');
  });

  it('respects a custom pipDecimals', () => {
    expect(formatFxRate(1.2345, { ...base, pipDecimals: 4 }, 'GBPUSD')).toBe('1.2345');
  });

  it('does not apply the JPY rule when jpyConvention is off', () => {
    expect(formatFxRate(149.5, { ...base, jpyConvention: false }, 'USDJPY')).toBe('149.50000');
  });

  it('returns nullText for non-numbers', () => {
    expect(formatFxRate(NaN, base, 'EURUSD')).toBe('');
    expect(formatFxRate(null as unknown as number, { ...base, nullText: '-' }, 'EURUSD')).toBe('-');
  });
});
