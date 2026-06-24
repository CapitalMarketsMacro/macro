import { migrateMap, migrateSpec, type ColumnFormatMap } from './format-spec';

describe('format-spec migration', () => {
  describe('migrateSpec', () => {
    it('passes through an already-current spec unchanged', () => {
      const current = { kind: 'percent', decimals: 4 } as const;
      expect(migrateSpec(current)).toBe(current);
    });

    it('migrates legacy number', () => {
      expect(migrateSpec({ type: 'number', decimals: 2 })).toEqual({ kind: 'number', decimals: 2 });
    });

    it('migrates legacy percent', () => {
      expect(migrateSpec({ type: 'percent', decimals: 3 })).toEqual({ kind: 'percent', decimals: 3 });
    });

    it('migrates legacy bps -> basisPoints', () => {
      expect(migrateSpec({ type: 'bps', decimals: 1 })).toEqual({ kind: 'basisPoints', decimals: 1 });
    });

    it('migrates legacy currency with USD/symbol defaults', () => {
      expect(migrateSpec({ type: 'currency', decimals: 2 })).toEqual({
        kind: 'currency',
        decimals: 2,
        currency: 'USD',
        currencyDisplay: 'symbol',
      });
    });

    it('migrates legacy compact with KMB notation', () => {
      expect(migrateSpec({ type: 'compact', decimals: 1 })).toEqual({
        kind: 'compact',
        decimals: 1,
        notation: 'KMB',
      });
    });

    it('returns undefined for unrecognised input', () => {
      expect(migrateSpec(null)).toBeUndefined();
      expect(migrateSpec(42)).toBeUndefined();
      expect(migrateSpec({})).toBeUndefined();
      expect(migrateSpec({ foo: 'bar' })).toBeUndefined();
    });
  });

  describe('migrateMap', () => {
    it('migrates a whole legacy map and drops bad entries', () => {
      const raw = {
        bid: { type: 'number', decimals: 5 },
        spread: { type: 'bps', decimals: 1 },
        junk: { nope: true },
      };
      expect(migrateMap(raw)).toEqual({
        bid: { kind: 'number', decimals: 5 },
        spread: { kind: 'basisPoints', decimals: 1 },
      });
    });

    it('round-trips a current bare map (idempotent)', () => {
      const map: ColumnFormatMap = {
        price: { kind: 'treasury', fraction: 32, plusTick: true },
        pnl: { kind: 'currency', currency: 'USD', decimals: 0, negativeStyle: 'parentheses' },
      };
      expect(migrateMap(map)).toEqual(map);
    });

    it('returns an empty map for non-objects', () => {
      expect(migrateMap(null)).toEqual({});
      expect(migrateMap('nope')).toEqual({});
    });
  });
});
