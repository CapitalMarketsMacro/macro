import {
  mergeCalculatedColumns,
  sameCalcSchema,
  schemaToColDef,
  serializeCalculatedColumns,
  type CalcColumnSchema,
} from './calculated-columns';
import type { ColDef, ColGroupDef } from 'ag-grid-community';

describe('serializeCalculatedColumns', () => {
  it('extracts only colDefs with a calculatedExpression', () => {
    const defs: ColDef[] = [
      { field: 'bid' },
      { colId: 'spread', headerName: 'Spread', calculatedExpression: '[bid] - [ask]', cellDataType: 'number' },
      { field: 'ask', calculatedExpression: '' }, // empty expression ignored
    ];
    expect(serializeCalculatedColumns(defs)).toEqual([
      { colId: 'spread', headerName: 'Spread', calculatedExpression: '[bid] - [ask]', cellDataType: 'number' },
    ]);
  });

  it('falls back to field as colId and skips groups', () => {
    const defs: (ColDef | ColGroupDef)[] = [
      { children: [{ field: 'x' }] } as ColGroupDef,
      { field: 'mid', calculatedExpression: '[bid]+[ask]' },
    ];
    expect(serializeCalculatedColumns(defs)).toEqual([{ colId: 'mid', calculatedExpression: '[bid]+[ask]' }]);
  });

  it('handles undefined', () => {
    expect(serializeCalculatedColumns(undefined)).toEqual([]);
  });
});

describe('schemaToColDef', () => {
  it('builds a minimal calc colDef', () => {
    const s: CalcColumnSchema = { colId: 'pnl', calculatedExpression: '[qty]*[px]', cellDataType: 'number', headerName: 'PnL' };
    expect(schemaToColDef(s)).toEqual({
      colId: 'pnl',
      calculatedExpression: '[qty]*[px]',
      cellDataType: 'number',
      headerName: 'PnL',
    });
  });
});

describe('sameCalcSchema', () => {
  const base: CalcColumnSchema = { colId: 'm', calculatedExpression: '[a]+[b]', headerName: 'M', cellDataType: 'number' };
  it('is true for equivalent schemas, false on any field change', () => {
    expect(sameCalcSchema(base, { ...base })).toBe(true);
    expect(sameCalcSchema(base, { ...base, calculatedExpression: '[a]-[b]' })).toBe(false);
    expect(sameCalcSchema(base, { ...base, headerName: 'X' })).toBe(false);
    expect(sameCalcSchema(base, { ...base, cellDataType: 'text' })).toBe(false);
    expect(sameCalcSchema(base, undefined)).toBe(false);
    expect(sameCalcSchema(undefined, undefined)).toBe(true);
  });
});

describe('mergeCalculatedColumns', () => {
  const base: ColDef[] = [
    { field: 'bid' },
    { field: 'ask' },
    { colId: 'spread', headerName: 'Spread', calculatedExpression: '[ask] - [bid]', cellDataType: 'number' },
  ];

  it('appends a user-created calc column with a new colId', () => {
    const merged = mergeCalculatedColumns(base, [{ colId: 'mid', calculatedExpression: '([bid]+[ask])/2' }]);
    expect(merged).toHaveLength(4);
    expect(merged[3]).toEqual({ colId: 'mid', calculatedExpression: '([bid]+[ask])/2' });
    // base preset untouched
    expect((merged[2] as ColDef).calculatedExpression).toBe('[ask] - [bid]');
  });

  it('overrides a pre-defined calc column when a schema shares its colId (edited expression)', () => {
    const merged = mergeCalculatedColumns(base, [{ colId: 'spread', calculatedExpression: '[bid] - [ask]' }]);
    expect(merged).toHaveLength(3);
    const spread = merged.find((d) => (d as ColDef).colId === 'spread') as ColDef;
    expect(spread.calculatedExpression).toBe('[bid] - [ask]'); // overridden
    expect(spread.headerName).toBe('Spread'); // base props preserved
  });

  it('drops a removed pre-defined calc column', () => {
    const merged = mergeCalculatedColumns(base, [], new Set(['spread']));
    expect(merged.map((d) => (d as ColDef).colId ?? (d as ColDef).field)).toEqual(['bid', 'ask']);
  });

  it('does not re-append a removed user column even if a stale schema exists', () => {
    const merged = mergeCalculatedColumns(base, [{ colId: 'mid', calculatedExpression: '[bid]' }], new Set(['mid']));
    expect(merged.find((d) => (d as ColDef).colId === 'mid')).toBeUndefined();
  });

  it('is idempotent and does not mutate inputs', () => {
    const schemas: CalcColumnSchema[] = [{ colId: 'mid', calculatedExpression: '[bid]' }];
    const once = mergeCalculatedColumns(base, schemas);
    const twice = mergeCalculatedColumns(once, schemas);
    expect(twice).toEqual(once);
    expect(base).toHaveLength(3); // unchanged
  });

  it('preserves column groups as-is', () => {
    const withGroup: (ColDef | ColGroupDef)[] = [{ headerName: 'G', children: [{ field: 'a' }] } as ColGroupDef];
    const merged = mergeCalculatedColumns(withGroup, [{ colId: 'c', calculatedExpression: '[a]+1' }]);
    expect(merged[0]).toBe(withGroup[0]);
    expect(merged[1]).toEqual({ colId: 'c', calculatedExpression: '[a]+1' });
  });
});
