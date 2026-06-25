import { SHOW_VALUES_AS_KEY, serializeShowValuesAs, type ShowValuesAsEntry } from './show-values-as';

describe('SHOW_VALUES_AS_KEY', () => {
  it('is the stable side-channel key', () => {
    expect(SHOW_VALUES_AS_KEY).toBe('showValuesAs');
  });
});

describe('serializeShowValuesAs', () => {
  it('keeps only columns with a string Show Values As mode', () => {
    const result = serializeShowValuesAs([
      { colId: 'pnl', showValuesAs: 'percentOfGrandTotal' },
      { colId: 'dv01', showValuesAs: 'percentOfParentRowTotal' },
      { colId: 'notional' }, // no mode
      { colId: 'instrument', showValuesAs: null }, // explicitly cleared
    ]);
    expect(result).toEqual<ShowValuesAsEntry[]>([
      { colId: 'pnl', showValuesAs: 'percentOfGrandTotal' },
      { colId: 'dv01', showValuesAs: 'percentOfParentRowTotal' },
    ]);
  });

  it('drops non-string (custom transform object) modes — they are not JSON-safe', () => {
    const result = serializeShowValuesAs([
      { colId: 'pnl', showValuesAs: { transform: () => 0 } as unknown },
      { colId: 'dv01', showValuesAs: 'percentOfColumnTotal' },
    ]);
    expect(result).toEqual([{ colId: 'dv01', showValuesAs: 'percentOfColumnTotal' }]);
  });

  it('returns undefined when nothing is set (so the wrapper omits the key)', () => {
    expect(serializeShowValuesAs([{ colId: 'a' }, { colId: 'b', showValuesAs: null }])).toBeUndefined();
    expect(serializeShowValuesAs([])).toBeUndefined();
    expect(serializeShowValuesAs(undefined)).toBeUndefined();
  });

  it('produces an applyColumnState-shaped array (round-trips as plain JSON)', () => {
    const result = serializeShowValuesAs([{ colId: 'pnl', showValuesAs: 'percentOfGrandTotal' }]);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
});
