import { ColumnFormatStore } from './column-format-store';
import type { ColDef, GridApi } from 'ag-grid-community';

/** A minimal in-memory GridApi double exposing just what the store touches. */
function makeApi(initial: Record<string, ColDef>) {
  const colDefs = new Map<string, ColDef>(Object.entries(initial).map(([id, def]) => [id, { ...def }]));
  const refreshCalls: unknown[] = [];

  const column = (id: string) => ({
    getColId: () => id,
    getColDef: () => colDefs.get(id)!,
  });

  const api = {
    getColumn: (id: string) => (colDefs.has(id) ? column(id) : null),
    getColumns: () => [...colDefs.keys()].map(column),
    refreshCells: (p: unknown) => refreshCalls.push(p),
  } as unknown as GridApi;

  return {
    api,
    refreshCalls,
    colDef: (id: string) => colDefs.get(id)!,
    /** Simulate the app rebuilding columnDefs (drops the runtime valueFormatter we installed). */
    rebuild: (id: string, def: ColDef) => colDefs.set(id, { ...def }),
  };
}

describe('ColumnFormatStore', () => {
  it('applies a format and installs a valueFormatter that renders the spec', () => {
    const h = makeApi({ price: { field: 'price' } });
    const store = new ColumnFormatStore(() => h.api);

    store.apply('price', { kind: 'percent', decimals: 2 });

    expect(store.has('price')).toBe(true);
    const vf = h.colDef('price').valueFormatter as (p: unknown) => string;
    expect(vf({ value: 0.0425 })).toBe('4.25%');
    expect(h.refreshCalls.length).toBeGreaterThan(0);
  });

  it('backs up the original app formatter once and restores it on clear', () => {
    const original = () => 'APP';
    const h = makeApi({ bid: { field: 'bid', valueFormatter: original } });
    const store = new ColumnFormatStore(() => h.api);

    store.apply('bid', { kind: 'number', decimals: 2 });
    expect(h.colDef('bid').valueFormatter).not.toBe(original);

    // re-apply a different spec must NOT overwrite the saved original
    store.apply('bid', { kind: 'number', decimals: 5 });

    store.clear('bid');
    expect(h.colDef('bid').valueFormatter).toBe(original);
    expect(store.has('bid')).toBe(false);
  });

  it('restores both valueFormatter and cellStyle when colour mode was applied', () => {
    const baseStyle = { textAlign: 'right' as const };
    const h = makeApi({ chg: { field: 'chg', cellStyle: baseStyle } });
    const store = new ColumnFormatStore(() => h.api);

    store.apply('chg', { kind: 'number', decimals: 2, colorMode: 'posneg' });
    const styled = h.colDef('chg').cellStyle as (p: unknown) => Record<string, unknown>;
    expect(styled({ value: 5 })).toEqual({ textAlign: 'right', color: 'var(--mkt-up, #16a34a)' });

    store.clear('chg');
    expect(h.colDef('chg').cellStyle).toBe(baseStyle);
  });

  it('removes colour styling when a re-apply drops the colour mode', () => {
    const baseStyle = { textAlign: 'right' as const };
    const h = makeApi({ chg: { field: 'chg', cellStyle: baseStyle } });
    const store = new ColumnFormatStore(() => h.api);

    store.apply('chg', { kind: 'number', colorMode: 'posneg' });
    expect(typeof h.colDef('chg').cellStyle).toBe('function');

    store.apply('chg', { kind: 'number', colorMode: 'none' });
    expect(h.colDef('chg').cellStyle).toBe(baseStyle);
  });

  it('reconciles after a columnDefs rebuild without poisoning the saved original', () => {
    const original = () => 'APP';
    const h = makeApi({ bid: { field: 'bid', valueFormatter: original } });
    const store = new ColumnFormatStore(() => h.api);

    store.apply('bid', { kind: 'number', decimals: 2 });

    // App rebuilds columnDefs: our installed formatter is gone, app's is back.
    h.rebuild('bid', { field: 'bid', valueFormatter: original });
    expect(h.colDef('bid').valueFormatter).toBe(original);

    store.reconcile();

    // Our formatter is re-installed...
    const vf = h.colDef('bid').valueFormatter as (p: unknown) => string;
    expect(vf({ value: 1234.5 })).toBe('1,234.50');

    // ...and clear still restores the app original (backup wasn't poisoned).
    store.clear('bid');
    expect(h.colDef('bid').valueFormatter).toBe(original);
  });

  it('text format styles the cell without replacing the value formatter, and clear restores both', () => {
    const original = () => 'APP';
    const h = makeApi({ name: { field: 'name', valueFormatter: original, cellStyle: { textAlign: 'left' } } });
    const store = new ColumnFormatStore(() => h.api);

    store.apply('name', { kind: 'text', weight: 'bold', italic: true });
    expect(h.colDef('name').valueFormatter).toBe(original); // value display untouched
    const cs = h.colDef('name').cellStyle as (p: unknown) => Record<string, unknown>;
    expect(cs({ value: 'x' })).toEqual({ textAlign: 'left', fontWeight: 'bold', fontStyle: 'italic' });

    store.clear('name');
    expect(h.colDef('name').valueFormatter).toBe(original);
    expect(h.colDef('name').cellStyle).toEqual({ textAlign: 'left' });
  });

  it('switching a numeric format to text removes the installed value formatter', () => {
    const h = makeApi({ x: { field: 'x' } });
    const store = new ColumnFormatStore(() => h.api);
    store.apply('x', { kind: 'number', decimals: 2 });
    expect(typeof h.colDef('x').valueFormatter).toBe('function');
    store.apply('x', { kind: 'text', weight: 'bold' });
    expect(h.colDef('x').valueFormatter).toBeUndefined();
    expect(typeof h.colDef('x').cellStyle).toBe('function');
  });

  it('serializes to a bare map and restores it', () => {
    const h = makeApi({ a: { field: 'a' }, b: { field: 'b' } });
    const store = new ColumnFormatStore(() => h.api);
    store.apply('a', { kind: 'percent', decimals: 2 });
    store.apply('b', { kind: 'treasury', fraction: 32 });

    const serialized = store.serialize();
    expect(serialized).toEqual({
      a: { kind: 'percent', decimals: 2 },
      b: { kind: 'treasury', fraction: 32 },
    });

    const h2 = makeApi({ a: { field: 'a' }, b: { field: 'b' } });
    const store2 = new ColumnFormatStore(() => h2.api);
    store2.restore(serialized!);
    expect(store2.entries()).toEqual(store.entries());
    expect((h2.colDef('a').valueFormatter as (p: unknown) => string)({ value: 0.01 })).toBe('1.00%');
  });

  it('restore with an empty map clears existing (seeded) formats and restores originals', () => {
    const original = () => 'APP';
    const h = makeApi({ price: { field: 'price', valueFormatter: original } });
    const store = new ColumnFormatStore(() => h.api);
    store.apply('price', { kind: 'percent', decimals: 2 });
    expect(store.size()).toBe(1);

    store.restore({});
    expect(store.size()).toBe(0);
    expect(h.colDef('price').valueFormatter).toBe(original);
  });

  it('does not mutate the colDef for externally-managed (calc) columns, but still tracks the spec', () => {
    const h = makeApi({ calc: { colId: 'calc', calculatedExpression: '[a] + [b]' } });
    const store = new ColumnFormatStore(() => h.api);
    store.setExternallyManaged(['calc']);

    store.apply('calc', { kind: 'number', decimals: 2 });
    // The store does NOT install a valueFormatter (the wrapper bakes it into the colDef instead)...
    expect(h.colDef('calc').valueFormatter).toBeUndefined();
    // ...but the spec is tracked + serialized (persistence) and listed (panel).
    expect(store.has('calc')).toBe(true);
    expect(store.serialize()).toEqual({ calc: { kind: 'number', decimals: 2 } });

    store.clear('calc');
    expect(store.has('calc')).toBe(false);
    expect(h.colDef('calc').valueFormatter).toBeUndefined();
  });

  it('returns undefined from serialize when nothing is formatted', () => {
    const h = makeApi({ a: { field: 'a' } });
    const store = new ColumnFormatStore(() => h.api);
    expect(store.serialize()).toBeUndefined();
  });

  it('lists formattable columns marking active ones', () => {
    const h = makeApi({ a: { field: 'a', headerName: 'Alpha' }, b: { field: 'b' } });
    const store = new ColumnFormatStore(() => h.api);
    store.apply('a', { kind: 'number' });
    expect(store.listFormattableColumns()).toEqual([
      { colId: 'a', headerName: 'Alpha', active: true },
      { colId: 'b', headerName: 'b', active: false },
    ]);
  });

  it('notifies subscribers and supports unsubscribe', () => {
    const h = makeApi({ a: { field: 'a' } });
    const store = new ColumnFormatStore(() => h.api);
    let count = 0;
    const off = store.onChange(() => (count += 1));
    store.apply('a', { kind: 'number' });
    expect(count).toBe(1);
    off();
    store.clear('a');
    expect(count).toBe(1);
  });
});
