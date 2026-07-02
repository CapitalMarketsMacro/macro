import type { GridApi, IRowNode } from 'ag-grid-community';
import { ColumnFormatStore } from './column-format-store';
import {
  MAX_STEP_DECIMALS,
  buildDecimalStepMenuItems,
  canStepDecimals,
  inferNumberSpec,
  stepColumnDecimals,
} from './decimal-steps';
import type { FxRateSpec, NumberSpec, PercentSpec, TreasurySpec } from './format-spec';

/** Mock api exposing one leaf row whose values come from `row`; getCellValue mimics v36. */
function mockApi(row: Record<string, unknown>, formattedOverrides: Record<string, string> = {}): GridApi {
  const node = { group: false, data: row } as unknown as IRowNode;
  return {
    forEachNodeAfterFilterAndSort: (cb: (n: IRowNode) => void) => cb(node),
    getCellValue: ({ colKey, useFormatter }: { colKey: string; useFormatter?: boolean }) =>
      useFormatter ? formattedOverrides[colKey] ?? String(row[colKey] ?? '') : row[colKey],
    getColumn: () => null,
    refreshCells: () => undefined,
  } as unknown as GridApi;
}

function makeStore(): ColumnFormatStore {
  const store = new ColumnFormatStore(() => undefined);
  store.setBakeMode(true); // pure spec registry, like both grid wrappers
  return store;
}

describe('inferNumberSpec', () => {
  it('reads fraction digits from a plain decimal', () => {
    expect(inferNumberSpec('1.08501', 1.08501)).toEqual({ kind: 'number', decimals: 5, thousands: false });
  });

  it('captures forced +, suffix and decimals from a signed percent string', () => {
    expect(inferNumberSpec('+0.0123%', 0.0123)).toEqual({
      kind: 'number',
      decimals: 4,
      thousands: false,
      signDisplay: 'always',
      suffix: '%',
    });
  });

  it('captures prefix and thousands grouping from a currency-like string', () => {
    expect(inferNumberSpec('$1,234.50', 1234.5)).toEqual({
      kind: 'number',
      decimals: 2,
      thousands: true,
      prefix: '$',
    });
  });

  it('captures a unit suffix like bps', () => {
    expect(inferNumberSpec('4.0 bps', 4)).toEqual({
      kind: 'number',
      decimals: 1,
      thousands: false,
      suffix: ' bps',
    });
  });

  it('falls back to the raw value decimals when the string has no digits', () => {
    expect(inferNumberSpec('n/a', 1.25)).toEqual({ kind: 'number', decimals: 2, thousands: false });
  });
});

describe('stepColumnDecimals', () => {
  it('bumps decimals on an existing numeric spec', () => {
    const store = makeStore();
    store.apply('px', { kind: 'number', decimals: 2 } as NumberSpec);

    expect(stepColumnDecimals(store, mockApi({}), 'px', 1)).toBe(true);
    expect((store.get('px') as NumberSpec).decimals).toBe(3);

    expect(stepColumnDecimals(store, mockApi({}), 'px', -1)).toBe(true);
    expect((store.get('px') as NumberSpec).decimals).toBe(2);
  });

  it('uses the per-kind default when the spec has no explicit decimals', () => {
    const store = makeStore();
    store.apply('pct', { kind: 'percent' } as PercentSpec); // percent default = 2

    expect(stepColumnDecimals(store, mockApi({}), 'pct', 1)).toBe(true);
    expect((store.get('pct') as PercentSpec).decimals).toBe(3);
  });

  it('clamps at the bounds and reports no-op', () => {
    const store = makeStore();
    store.apply('a', { kind: 'number', decimals: 0 } as NumberSpec);
    expect(stepColumnDecimals(store, mockApi({}), 'a', -1)).toBe(false);
    expect((store.get('a') as NumberSpec).decimals).toBe(0);

    store.apply('b', { kind: 'number', decimals: MAX_STEP_DECIMALS } as NumberSpec);
    expect(stepColumnDecimals(store, mockApi({}), 'b', 1)).toBe(false);
  });

  it('steps pipDecimals on an fxRate spec', () => {
    const store = makeStore();
    store.apply('bid', { kind: 'fxRate', symbolField: 'symbol' } as FxRateSpec); // default 5

    expect(stepColumnDecimals(store, mockApi({}), 'bid', -1)).toBe(true);
    expect((store.get('bid') as FxRateSpec).pipDecimals).toBe(4);
  });

  it('refuses kinds with no decimal knob', () => {
    const store = makeStore();
    store.apply('price', { kind: 'treasury' } as TreasurySpec);
    expect(stepColumnDecimals(store, mockApi({}), 'price', 1)).toBe(false);
    expect(canStepDecimals(store, mockApi({}), 'price')).toBe(false);
  });

  it('creates an inferred spec (preserving the displayed look) for an unformatted numeric column', () => {
    const store = makeStore();
    const api = mockApi({ change: 0.0123 }, { change: '+0.0123%' });

    expect(stepColumnDecimals(store, api, 'change', 1)).toBe(true);
    expect(store.get('change')).toEqual({
      kind: 'number',
      decimals: 5,
      thousands: false,
      signDisplay: 'always',
      suffix: '%',
    });
  });

  it('refuses non-numeric columns with no spec', () => {
    const store = makeStore();
    const api = mockApi({ symbol: 'EURUSD' });
    expect(stepColumnDecimals(store, api, 'symbol', 1)).toBe(false);
    expect(canStepDecimals(store, api, 'symbol')).toBe(false);
  });
});

describe('buildDecimalStepMenuItems', () => {
  it('returns increase/decrease items for a numeric column and wires them to the store', () => {
    const store = makeStore();
    const api = mockApi({ mid: 1.085 }, { mid: '1.08500' });

    const items = buildDecimalStepMenuItems(store, api, 'mid');
    expect(items.map((i) => i.name)).toEqual(['Increase Decimals', 'Decrease Decimals']);

    items[0].action?.(undefined as never);
    expect((store.get('mid') as NumberSpec).decimals).toBe(6);
    items[1].action?.(undefined as never);
    expect((store.get('mid') as NumberSpec).decimals).toBe(5);
  });

  it('returns [] for non-steppable columns and missing colId', () => {
    const store = makeStore();
    expect(buildDecimalStepMenuItems(store, mockApi({ name: 'x' }), 'name')).toEqual([]);
    expect(buildDecimalStepMenuItems(store, mockApi({}), undefined)).toEqual([]);
  });
});
