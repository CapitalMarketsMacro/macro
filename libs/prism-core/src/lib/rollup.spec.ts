import type { ColDef, ColGroupDef } from 'ag-grid-community';
import {
  aggForField,
  applyRollupToColumns,
  completeRollup,
  rollupGridOptions,
  rollupGroupHeader,
  suggestRollup,
  type RollupConfig,
} from './rollup';

const col = (field: string, numeric = false): ColDef => ({
  field,
  headerName: field,
  ...(numeric ? { type: 'numericColumn' } : {}),
});

/** Columns shaped like the Risk/PnL dashboard payload. */
const riskColumns: ColDef[] = [
  col('desk'),
  col('book'),
  col('trader'),
  col('instrument'),
  col('pnl', true),
  col('dayPnl', true),
  col('dv01', true),
  col('notional', true),
];

describe('aggForField', () => {
  it('sums size/pnl/notional-like fields', () => {
    for (const f of ['pnl', 'dayPnl', 'size', 'notional', 'qty', 'volume', 'dv01']) {
      expect(aggForField(f)).toBe('sum');
    }
  });

  it('averages price/yield/rate-like fields', () => {
    for (const f of ['price', 'bid', 'ask', 'mid', 'yield', 'rate', 'spread', 'changePercent']) {
      expect(aggForField(f)).toBe('avg');
    }
  });

  it('prefers sum when a name matches both (volume vs vol)', () => {
    expect(aggForField('volume')).toBe('sum');
    expect(aggForField('volatility')).toBe('avg');
  });

  it('defaults unknown numerics to sum', () => {
    expect(aggForField('foo')).toBe('sum');
  });

  it('classifies substring look-alikes correctly', () => {
    expect(aggForField('discountRate')).toBe('avg'); // 'rate' beats the 'count' inside 'discount'
    expect(aggForField('discountFactor')).toBe('avg');
    expect(aggForField('cashflow')).toBe('sum'); // not caught by 'low'
    expect(aggForField('exchangeFee')).toBe('sum'); // not caught by 'change'
    expect(aggForField('netChange')).toBe('avg');
    expect(aggForField('dayLow')).toBe('avg');
    expect(aggForField('vol30d')).toBe('avg');
    expect(aggForField('implVol')).toBe('avg');
    expect(aggForField('orderCount')).toBe('sum');
  });
});

describe('suggestRollup', () => {
  it('builds a desk → book → trader hierarchy with summed measures', () => {
    const r = suggestRollup(riskColumns);
    expect(r).not.toBeNull();
    expect(r!.groupBy).toEqual(['desk', 'book', 'trader']);
    expect(r!.aggregations).toEqual({ pnl: 'sum', dayPnl: 'sum', dv01: 'sum', notional: 'sum' });
  });

  it('caps the hierarchy at maxLevels', () => {
    const r = suggestRollup(riskColumns, { maxLevels: 2 });
    expect(r!.groupBy).toEqual(['desk', 'book']);
  });

  it('excludes the key field on keyed modes but keeps it for append', () => {
    const cols = [col('symbol'), col('side'), col('price', true), col('size', true)];
    const keyed = suggestRollup(cols, { keyField: 'symbol', mode: 'snapshot-update' });
    expect(keyed!.groupBy).not.toContain('symbol');
    const append = suggestRollup(cols, { keyField: 'symbol', mode: 'append' });
    expect(append!.groupBy).toContain('symbol');
  });

  it('never groups by ids, timestamps, dates, or numeric columns', () => {
    const cols = [
      col('tradeId'),
      col('order_id'),
      col('id'),
      col('bookingID'), // uppercase suffix — must not surface via the /book/ pattern
      col('tradeDate'),
      col('timestamp'),
      col('maturity'),
      col('price', true),
    ];
    expect(suggestRollup(cols)).toBeNull();
  });

  it('picks the shortest field per pattern (book over bookName)', () => {
    const cols = [col('bookName'), col('book'), col('pnl', true)];
    expect(suggestRollup(cols)!.groupBy).toEqual(['book']);
  });

  it('suggests instrumentType/tenor/symbol for a trades tape', () => {
    const cols = [
      col('tradeId'),
      col('symbol'),
      col('instrumentType'),
      col('tenor'),
      col('side'),
      col('price', true),
      col('size', true),
      col('time'),
    ];
    const r = suggestRollup(cols, { keyField: 'tradeId', mode: 'append' });
    expect(r!.groupBy).toEqual(['instrumentType', 'tenor', 'symbol']);
    expect(r!.aggregations).toEqual({ price: 'avg', size: 'sum' });
  });

  it('returns null when there is nothing to group by', () => {
    expect(suggestRollup([col('price', true), col('qty', true)])).toBeNull();
    expect(suggestRollup([])).toBeNull();
  });
});

describe('applyRollupToColumns', () => {
  const rollup: RollupConfig = { groupBy: ['desk', 'book'], aggregations: { pnl: 'sum', price: 'avg' } };

  it('turns group fields into hidden rowGroup columns in hierarchy order', () => {
    const out = applyRollupToColumns([col('book'), col('desk')], rollup);
    expect(out[0]).toMatchObject({ field: 'book', rowGroup: true, rowGroupIndex: 1, hide: true });
    expect(out[1]).toMatchObject({ field: 'desk', rowGroup: true, rowGroupIndex: 0, hide: true });
  });

  it('applies explicit aggregation overrides and infers the rest by name', () => {
    const out = applyRollupToColumns([col('price', true), col('size', true)], rollup);
    expect(out[0]).toMatchObject({ aggFunc: 'avg', enableValue: true }); // override
    expect(out[1]).toMatchObject({ aggFunc: 'sum', enableValue: true }); // inferred
  });

  it('leaves non-measure leaves groupable but un-aggregated', () => {
    const [out] = applyRollupToColumns([col('trader')], rollup);
    expect(out).toMatchObject({ enableRowGroup: true });
    expect((out as ColDef).aggFunc).toBeUndefined();
    expect((out as ColDef).rowGroup).toBeUndefined();
  });

  it('ignores groupBy fields missing from the defs and does not mutate inputs', () => {
    const input = [col('trader'), col('pnl', true)];
    const out = applyRollupToColumns(input, { groupBy: ['desk'] });
    expect(out.every((c) => !(c as ColDef).rowGroup)).toBe(true);
    expect(input[1].aggFunc).toBeUndefined();
    expect((out[1] as ColDef).aggFunc).toBe('sum');
  });

  it('recurses into column groups (auto-gen can emit ColGroupDefs)', () => {
    const grouped: (ColDef | ColGroupDef)[] = [
      { headerName: 'grp', children: [col('desk'), col('pnl', true)] } as ColGroupDef,
    ];
    const out = applyRollupToColumns(grouped, rollup);
    const children = (out[0] as ColGroupDef).children as ColDef[];
    expect(children[0]).toMatchObject({ rowGroup: true, rowGroupIndex: 0 });
    expect(children[1]).toMatchObject({ aggFunc: 'sum' });
  });
});

describe('completeRollup', () => {
  it('fills inferred aggregations for numeric columns the config does not cover', () => {
    const config: RollupConfig = { groupBy: ['symbol'], aggregations: { size: 'sum' }, enabled: true };
    const out = completeRollup(config, [col('symbol'), col('size', true), col('yield', true), col('side')]);
    expect(out.aggregations).toEqual({ size: 'sum', yield: 'avg' });
    expect(out.groupBy).toEqual(['symbol']);
    expect(out.enabled).toBe(true);
    expect(config.aggregations).toEqual({ size: 'sum' }); // input untouched
  });

  it('never overrides explicit aggregations and skips grouped fields', () => {
    const out = completeRollup({ groupBy: ['desk'], aggregations: { price: 'max' } }, [
      col('desk'),
      col('price', true),
    ]);
    expect(out.aggregations).toEqual({ price: 'max' });
  });
});

describe('rollupGridOptions / rollupGroupHeader', () => {
  it('names the auto group column after the hierarchy', () => {
    expect(rollupGroupHeader({ groupBy: ['desk', 'book', 'trader'] })).toBe('Desk / Book / Trader');
    expect(rollupGroupHeader({ groupBy: ['instrumentType'] })).toBe('Instrument Type');
  });

  it('defaults to one expanded level and a bottom grand-total row', () => {
    const o = rollupGridOptions({ groupBy: ['desk'] });
    expect(o.groupDefaultExpanded).toBe(1);
    expect(o.grandTotalRow).toBe('bottom');
    expect(o.rowGroupPanelShow).toBe('always');
    expect(o.autoGroupColumnDef?.headerName).toBe('Desk');
  });

  it('honors expandLevels and grandTotal: false', () => {
    const o = rollupGridOptions({ groupBy: ['desk'], expandLevels: -1, grandTotal: false });
    expect(o.groupDefaultExpanded).toBe(-1);
    expect(o.grandTotalRow).toBeUndefined();
  });
});
