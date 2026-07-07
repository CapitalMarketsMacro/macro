import { inferColumns, inferColumnsFromRows, specForField, titleCase } from './column-inference';

describe('column-inference', () => {
  describe('titleCase', () => {
    it('humanizes camelCase and snake/kebab', () => {
      expect(titleCase('changePercent')).toBe('Change Percent');
      expect(titleCase('order_id')).toBe('Order Id');
      expect(titleCase('years-to-maturity')).toBe('Years To Maturity');
      expect(titleCase('cusip')).toBe('Cusip');
    });
  });

  describe('specForField', () => {
    it('maps prices to 4-dp numbers', () => {
      expect(specForField('bid', 1.2345)).toEqual({ kind: 'number', decimals: 4 });
      expect(specForField('lastPrice', 99.5)).toEqual({ kind: 'number', decimals: 4 });
    });

    it('maps yields/coupons to percent', () => {
      expect(specForField('yield', 0.0425)).toEqual({ kind: 'percent', decimals: 3 });
      expect(specForField('coupon', 0.05)).toEqual({ kind: 'percent', decimals: 3 });
    });

    it('maps spreads and bps to basis points', () => {
      expect(specForField('spread', 0.0001)).toEqual({ kind: 'basisPoints', decimals: 1 });
      expect(specForField('spreadBps', 1.5)).toMatchObject({ kind: 'basisPoints', signDisplay: 'always' });
    });

    it('maps DV01/PV01/KR01 dollar sensitivities to signed integers, not basis points', () => {
      expect(specForField('dv01', 12500)).toEqual({ kind: 'integer', thousands: true, colorMode: 'posneg' });
      expect(specForField('pv01', -8200)).toMatchObject({ kind: 'integer' });
      expect(specForField('kr01_10y', 4100)).toMatchObject({ kind: 'integer' });
    });

    it('maps change-percent to a coloured percent', () => {
      expect(specForField('changePercent', -0.012)).toMatchObject({
        kind: 'percent',
        colorMode: 'posneg',
        signDisplay: 'always',
      });
    });

    it('maps quantity-like fields to grouped integers', () => {
      expect(specForField('volume', 1_000_000)).toEqual({ kind: 'integer', thousands: true });
      expect(specForField('notional', 5e6)).toEqual({ kind: 'integer', thousands: true });
    });

    it('maps pnl to a coloured number', () => {
      expect(specForField('pnl', -1234)).toMatchObject({ kind: 'number', colorMode: 'posneg' });
    });

    it('treats identifiers / categoricals as plain text (no spec)', () => {
      expect(specForField('cusip', '912810T](')).toBeUndefined();
      expect(specForField('symbol', 'EURUSD')).toBeUndefined();
      expect(specForField('side', 'BUY')).toBeUndefined();
      expect(specForField('orderId', 'O-1')).toBeUndefined();
    });

    it('maps date/time fields to date specs', () => {
      expect(specForField('tradeDate', '2026-01-01')).toEqual({ kind: 'date', dateStyle: 'date' });
      expect(specForField('timestamp', 1700000000)).toEqual({ kind: 'date', dateStyle: 'datetime' });
      expect(specForField('maturity', '2030-05-15')).toEqual({ kind: 'date', dateStyle: 'date' });
    });

    it('uses fxRate for prices on an FX-keyed source', () => {
      expect(specForField('bid', 1.0875, 'symbol')).toMatchObject({ kind: 'fxRate', symbolField: 'symbol' });
    });

    it('falls back to a 2-dp number for unknown numerics and undefined for unknown strings', () => {
      expect(specForField('whatever', 42)).toEqual({ kind: 'number', decimals: 2 });
      expect(specForField('whatever', 'abc')).toBeUndefined();
    });
  });

  describe('inferColumns', () => {
    it('builds columns + formats and pins the key field', () => {
      const { columns, formats } = inferColumns(
        { symbol: 'EURUSD', bid: 1.08, ask: 1.081, volume: 1000 },
        'symbol',
      );
      expect(columns.map((c) => c.field)).toEqual(['symbol', 'bid', 'ask', 'volume']);
      const symbolCol = columns.find((c) => c.field === 'symbol');
      expect(symbolCol?.pinned).toBe('left');
      expect(formats['symbol']).toBeUndefined(); // categorical
      expect(formats['volume']).toEqual({ kind: 'integer', thousands: true });
      // numeric columns are right-aligned numeric columns
      expect(columns.find((c) => c.field === 'volume')?.type).toBe('numericColumn');
    });
  });

  describe('inferColumnsFromRows', () => {
    it('discovers fields that are sparse on the first row', () => {
      const rows = [
        { symbol: 'EURUSD', bid: 1.08 },
        { symbol: 'USDJPY', bid: 150.2, ask: 150.3 },
      ];
      const { columns } = inferColumnsFromRows(rows, 'symbol');
      expect(columns.map((c) => c.field)).toEqual(['symbol', 'bid', 'ask']);
    });
  });
});
