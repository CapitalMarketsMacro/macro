// ---------------------------------------------------------------------------
// Mocks - must be declared before any imports that use them.
// jest.mock is hoisted above imports, but the factory function is evaluated
// lazily when the module is first required.
// ---------------------------------------------------------------------------

// Mock @macro/logger - use inline object to avoid TDZ issues
jest.mock('@macro/logger', () => {
  const instance = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  return {
    Logger: {
      getLogger: jest.fn(() => instance),
      __mockInstance: instance,
    },
  };
});

// Mock the entire @macro/openfin to avoid pulling @openfin/workspace ESM
// We provide a mock ViewStateService class so Angular DI can resolve it.
const mockViewStateInstance = {
  restoreState: jest.fn().mockResolvedValue({}),
  enableAutoSave: jest.fn(),
  destroy: jest.fn(),
  saveState: jest.fn(),
  getState: jest.fn(),
  disableAutoSave: jest.fn(),
};

class MockViewStateService {
  restoreState = mockViewStateInstance.restoreState;
  enableAutoSave = mockViewStateInstance.enableAutoSave;
  destroy = mockViewStateInstance.destroy;
  saveState = mockViewStateInstance.saveState;
  getState = mockViewStateInstance.getState;
  disableAutoSave = mockViewStateInstance.disableAutoSave;
}

class MockNotificationsService {
  create = jest.fn();
  register = jest.fn().mockResolvedValue(undefined);
  deregister = jest.fn().mockResolvedValue(undefined);
  observeNotificationActions = jest.fn();
}

jest.mock('@macro/openfin', () => ({
  ViewStateService: MockViewStateService,
  NotificationsService: MockNotificationsService,
}));

// Mock @macro/macro-angular-grid so the import resolves
jest.mock('@macro/macro-angular-grid', () => ({
  MacroAngularGrid: class MockMacroAngularGrid {},
}));

// Mock @macro/macro-design (required transitively)
jest.mock('@macro/macro-design', () => ({
  buildAgGridTheme: jest.fn(),
  getInitialIsDark: jest.fn().mockReturnValue(false),
  applyDarkMode: jest.fn(),
  onSystemThemeChange: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Imports - AFTER mock declarations
// ---------------------------------------------------------------------------
import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Subject } from 'rxjs';
import { FxMarketDataComponent } from './fx-market-data.component';
import { Logger } from '@macro/logger';
import { ViewStateService, NotificationsService } from '@macro/openfin';

// Get a reference to the mock logger instance
const mockLoggerInstance = (Logger as any).__mockInstance;

describe('FxMarketDataComponent', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    await TestBed.configureTestingModule({
      imports: [FxMarketDataComponent],
      providers: [
        { provide: ViewStateService, useValue: new MockViewStateService() },
        { provide: NotificationsService, useValue: new MockNotificationsService() },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(FxMarketDataComponent, {
        set: {
          imports: [],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function createComponent(): FxMarketDataComponent {
    const fixture = TestBed.createComponent(FxMarketDataComponent);
    return fixture.componentInstance;
  }

  // -----------------------------------------------------------------------
  // Construction
  // -----------------------------------------------------------------------
  it('should create the component via TestBed', () => {
    const comp = createComponent();
    expect(comp).toBeTruthy();
  });

  // -----------------------------------------------------------------------
  // Column definitions
  // -----------------------------------------------------------------------
  it('should define 9 columns', () => {
    const comp = createComponent();
    expect(comp.columns).toHaveLength(9);
  });

  it('should have Symbol column pinned left', () => {
    const comp = createComponent();
    const symbolCol = comp.columns.find(
      (c: any) => c.field === 'symbol'
    ) as any;
    expect(symbolCol).toBeDefined();
    expect(symbolCol.pinned).toBe('left');
    expect(symbolCol.headerName).toBe('Symbol');
  });

  it('should have Base and Quote columns', () => {
    const comp = createComponent();
    const baseCol = comp.columns.find((c: any) => c.field === 'base') as any;
    const quoteCol = comp.columns.find((c: any) => c.field === 'quote') as any;
    expect(baseCol).toBeDefined();
    expect(baseCol.headerName).toBe('Base');
    expect(quoteCol).toBeDefined();
    expect(quoteCol.headerName).toBe('Quote');
  });

  it('should have Bid, Ask, Mid columns with right-aligned cellStyle', () => {
    const comp = createComponent();
    for (const field of ['bid', 'ask', 'mid']) {
      const col = comp.columns.find((c: any) => c.field === field) as any;
      expect(col).toBeDefined();
      expect(col.cellStyle).toEqual({ textAlign: 'right' });
    }
  });

  it('should have Change column with dynamic cellStyle function', () => {
    const comp = createComponent();
    const changeCol = comp.columns.find(
      (c: any) => c.field === 'change'
    ) as any;
    expect(changeCol).toBeDefined();
    expect(typeof changeCol.cellStyle).toBe('function');

    // Positive change -> green
    const positiveStyle = changeCol.cellStyle({ value: 0.01 });
    expect(positiveStyle.color).toBe('green');
    expect(positiveStyle.textAlign).toBe('right');

    // Negative change -> red
    const negativeStyle = changeCol.cellStyle({ value: -0.01 });
    expect(negativeStyle.color).toBe('red');
    expect(negativeStyle.textAlign).toBe('right');

    // Zero change -> no color key
    const zeroStyle = changeCol.cellStyle({ value: 0 });
    expect(zeroStyle.color).toBeUndefined();
    expect(zeroStyle.textAlign).toBe('right');
  });

  it('should have Change % column with dynamic cellStyle function', () => {
    const comp = createComponent();
    const changePctCol = comp.columns.find(
      (c: any) => c.field === 'changePercent'
    ) as any;
    expect(changePctCol).toBeDefined();
    expect(typeof changePctCol.cellStyle).toBe('function');

    expect(changePctCol.cellStyle({ value: 1.5 }).color).toBe('green');
    expect(changePctCol.cellStyle({ value: -1.5 }).color).toBe('red');
    expect(changePctCol.cellStyle({ value: 0 }).color).toBeUndefined();
  });

  it('should have Spread column with right-aligned cellStyle', () => {
    const comp = createComponent();
    const spreadCol = comp.columns.find(
      (c: any) => c.field === 'spread'
    ) as any;
    expect(spreadCol).toBeDefined();
    expect(spreadCol.cellStyle).toEqual({ textAlign: 'right' });
  });

  // -----------------------------------------------------------------------
  // Value formatters
  // -----------------------------------------------------------------------
  describe('value formatters', () => {
    it('should format Bid with 5 decimals for non-JPY pairs', () => {
      const comp = createComponent();
      const bidCol = comp.columns.find((c: any) => c.field === 'bid') as any;
      const formatted = bidCol.valueFormatter({
        value: 1.085,
        data: { symbol: 'EURUSD' },
      });
      expect(formatted).toBe('1.08500');
    });

    it('should format Bid with 2 decimals for JPY pairs', () => {
      const comp = createComponent();
      const bidCol = comp.columns.find((c: any) => c.field === 'bid') as any;
      const formatted = bidCol.valueFormatter({
        value: 149.5,
        data: { symbol: 'USDJPY' },
      });
      expect(formatted).toBe('149.50');
    });

    it('should format Ask with 5 decimals for non-JPY pairs', () => {
      const comp = createComponent();
      const askCol = comp.columns.find((c: any) => c.field === 'ask') as any;
      const formatted = askCol.valueFormatter({
        value: 1.08512,
        data: { symbol: 'EURUSD' },
      });
      expect(formatted).toBe('1.08512');
    });

    it('should format Ask with 2 decimals for JPY pairs', () => {
      const comp = createComponent();
      const askCol = comp.columns.find((c: any) => c.field === 'ask') as any;
      const formatted = askCol.valueFormatter({
        value: 162.35,
        data: { symbol: 'EURJPY' },
      });
      expect(formatted).toBe('162.35');
    });

    it('should format Mid correctly for both pair types', () => {
      const comp = createComponent();
      const midCol = comp.columns.find((c: any) => c.field === 'mid') as any;

      expect(
        midCol.valueFormatter({ value: 1.085, data: { symbol: 'EURUSD' } })
      ).toBe('1.08500');
      expect(
        midCol.valueFormatter({ value: 149.5, data: { symbol: 'USDJPY' } })
      ).toBe('149.50');
    });

    it('should format Spread with correct decimals', () => {
      const comp = createComponent();
      const spreadCol = comp.columns.find(
        (c: any) => c.field === 'spread'
      ) as any;

      expect(
        spreadCol.valueFormatter({
          value: 0.00023,
          data: { symbol: 'EURUSD' },
        })
      ).toBe('0.00023');

      expect(
        spreadCol.valueFormatter({
          value: 0.03,
          data: { symbol: 'USDJPY' },
        })
      ).toBe('0.03');
    });

    it('should format Change with sign prefix', () => {
      const comp = createComponent();
      const changeCol = comp.columns.find(
        (c: any) => c.field === 'change'
      ) as any;

      expect(
        changeCol.valueFormatter({
          value: 0.0002,
          data: { symbol: 'EURUSD' },
        })
      ).toBe('+0.00020');

      expect(
        changeCol.valueFormatter({
          value: -0.0003,
          data: { symbol: 'EURUSD' },
        })
      ).toBe('-0.00030');

      expect(
        changeCol.valueFormatter({
          value: 0,
          data: { symbol: 'EURUSD' },
        })
      ).toBe('+0.00000');
    });

    it('should format Change for JPY pairs with 2 decimals', () => {
      const comp = createComponent();
      const changeCol = comp.columns.find(
        (c: any) => c.field === 'change'
      ) as any;

      expect(
        changeCol.valueFormatter({
          value: 0.15,
          data: { symbol: 'USDJPY' },
        })
      ).toBe('+0.15');

      expect(
        changeCol.valueFormatter({
          value: -0.25,
          data: { symbol: 'GBPJPY' },
        })
      ).toBe('-0.25');
    });

    it('should format Change % with sign and 4 decimals', () => {
      const comp = createComponent();
      const changePctCol = comp.columns.find(
        (c: any) => c.field === 'changePercent'
      ) as any;

      expect(changePctCol.valueFormatter({ value: 0.1234 })).toBe('+0.1234%');
      expect(changePctCol.valueFormatter({ value: -0.5678 })).toBe(
        '-0.5678%'
      );
      expect(changePctCol.valueFormatter({ value: 0 })).toBe('+0.0000%');
    });
  });

  // -----------------------------------------------------------------------
  // getRowId
  // -----------------------------------------------------------------------
  it('should return data.id from getRowId', () => {
    const comp = createComponent();
    const result = comp.getRowId({ data: { id: 'EURUSD' } } as any);
    expect(result).toBe('EURUSD');
  });

  // -----------------------------------------------------------------------
  // generateInitialData (private, tested via ngOnInit side-effects)
  // -----------------------------------------------------------------------
  describe('ngOnInit / generateInitialData', () => {
    it('should generate initial data with 15 pairs after ngOnInit', () => {
      const comp = createComponent();
      comp.ngOnInit();
      const initialData = (comp as any).initialData;
      expect(initialData).toHaveLength(15);
    });

    it('should generate data with correct structure for all 15 pairs', () => {
      const comp = createComponent();
      comp.ngOnInit();

      const data: any[] = (comp as any).initialData;
      for (const pair of data) {
        expect(pair).toHaveProperty('id');
        expect(pair).toHaveProperty('symbol');
        expect(pair).toHaveProperty('base');
        expect(pair).toHaveProperty('quote');
        expect(pair).toHaveProperty('bid');
        expect(pair).toHaveProperty('ask');
        expect(pair).toHaveProperty('mid');
        expect(pair).toHaveProperty('spread');
        expect(pair).toHaveProperty('change');
        expect(pair).toHaveProperty('changePercent');
      }
    });

    it('should set initial change and changePercent to 0', () => {
      const comp = createComponent();
      comp.ngOnInit();

      const data: any[] = (comp as any).initialData;
      for (const pair of data) {
        expect(pair.change).toBe(0);
        expect(pair.changePercent).toBe(0);
      }
    });

    it('should correctly split base and quote from symbol', () => {
      const comp = createComponent();
      comp.ngOnInit();

      const data: any[] = (comp as any).initialData;
      const eurusd = data.find((d: any) => d.symbol === 'EURUSD');
      expect(eurusd).toBeDefined();
      expect(eurusd.base).toBe('EUR');
      expect(eurusd.quote).toBe('USD');

      const usdjpy = data.find((d: any) => d.symbol === 'USDJPY');
      expect(usdjpy).toBeDefined();
      expect(usdjpy.base).toBe('USD');
      expect(usdjpy.quote).toBe('JPY');
    });

    it('should generate bid < mid < ask for each pair', () => {
      const comp = createComponent();
      comp.ngOnInit();

      const data: any[] = (comp as any).initialData;
      for (const pair of data) {
        expect(pair.bid).toBeLessThan(pair.mid);
        expect(pair.ask).toBeGreaterThan(pair.mid);
        expect(pair.bid).toBeLessThan(pair.ask);
      }
    });

    it('should round JPY pairs to 2 decimals', () => {
      const comp = createComponent();
      comp.ngOnInit();

      const data: any[] = (comp as any).initialData;
      const jpyPairs = data.filter((d: any) => d.symbol.includes('JPY'));
      expect(jpyPairs.length).toBeGreaterThan(0);

      for (const pair of jpyPairs) {
        const bidDecimals = pair.bid.toString().split('.')[1]?.length ?? 0;
        const askDecimals = pair.ask.toString().split('.')[1]?.length ?? 0;
        const midDecimals = pair.mid.toString().split('.')[1]?.length ?? 0;
        expect(bidDecimals).toBeLessThanOrEqual(2);
        expect(askDecimals).toBeLessThanOrEqual(2);
        expect(midDecimals).toBeLessThanOrEqual(2);
      }
    });

    it('should round non-JPY pairs to 5 decimals', () => {
      const comp = createComponent();
      comp.ngOnInit();

      const data: any[] = (comp as any).initialData;
      const nonJpyPairs = data.filter(
        (d: any) => !d.symbol.includes('JPY')
      );
      expect(nonJpyPairs.length).toBeGreaterThan(0);

      for (const pair of nonJpyPairs) {
        const bidDecimals = pair.bid.toString().split('.')[1]?.length ?? 0;
        const askDecimals = pair.ask.toString().split('.')[1]?.length ?? 0;
        expect(bidDecimals).toBeLessThanOrEqual(5);
        expect(askDecimals).toBeLessThanOrEqual(5);
      }
    });

    it('should include all 15 expected currency pairs', () => {
      const comp = createComponent();
      comp.ngOnInit();

      const data: any[] = (comp as any).initialData;
      const symbols = data.map((d: any) => d.symbol);
      const expected = [
        'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD',
        'USDCHF', 'NZDUSD', 'USDSEK', 'USDNOK', 'EURGBP',
        'EURJPY', 'GBPJPY', 'AUDJPY', 'EURCHF', 'GBPCHF',
      ];
      for (const sym of expected) {
        expect(symbols).toContain(sym);
      }
    });

    it('should log initialization message', () => {
      const comp = createComponent();
      comp.ngOnInit();
      expect(mockLoggerInstance.info).toHaveBeenCalledWith(
        'FX Market Data component initialized'
      );
    });
  });

  // -----------------------------------------------------------------------
  // calculateBidAsk (private, tested via reflection)
  // -----------------------------------------------------------------------
  describe('calculateBidAsk', () => {
    it('should return bid and ask symmetrically around mid', () => {
      const comp = createComponent();
      const result = (comp as any).calculateBidAsk(1.085, 0.001);
      expect(result.bid).toBeCloseTo(1.0845, 5);
      expect(result.ask).toBeCloseTo(1.0855, 5);
    });

    it('should produce spread equal to ask - bid', () => {
      const comp = createComponent();
      const spread = 0.002;
      const result = (comp as any).calculateBidAsk(100, spread);
      expect(result.ask - result.bid).toBeCloseTo(spread, 10);
    });

    it('should place mid exactly between bid and ask', () => {
      const comp = createComponent();
      const mid = 150.5;
      const spread = 0.04;
      const result = (comp as any).calculateBidAsk(mid, spread);
      const calculatedMid = (result.bid + result.ask) / 2;
      expect(calculatedMid).toBeCloseTo(mid, 10);
    });

    it('should handle zero spread', () => {
      const comp = createComponent();
      const result = (comp as any).calculateBidAsk(1.085, 0);
      expect(result.bid).toBe(1.085);
      expect(result.ask).toBe(1.085);
    });

    it('should handle large mid values', () => {
      const comp = createComponent();
      const result = (comp as any).calculateBidAsk(10000, 2);
      expect(result.bid).toBeCloseTo(9999, 5);
      expect(result.ask).toBeCloseTo(10001, 5);
    });
  });

  // -----------------------------------------------------------------------
  // round (private)
  // -----------------------------------------------------------------------
  describe('round', () => {
    it('should round to 2 decimal places', () => {
      const comp = createComponent();
      expect((comp as any).round(149.5049, 2)).toBe(149.5);
      expect((comp as any).round(149.505, 2)).toBe(149.51);
    });

    it('should round to 5 decimal places', () => {
      const comp = createComponent();
      expect((comp as any).round(1.085004, 5)).toBe(1.085);
      expect((comp as any).round(1.085005, 5)).toBe(1.08501);
    });

    it('should round to 0 decimal places', () => {
      const comp = createComponent();
      expect((comp as any).round(3.6, 0)).toBe(4);
      expect((comp as any).round(3.4, 0)).toBe(3);
    });

    it('should handle negative numbers', () => {
      const comp = createComponent();
      expect((comp as any).round(-1.085004, 5)).toBe(-1.085);
    });

    it('should round to 4 decimal places', () => {
      const comp = createComponent();
      expect((comp as any).round(0.12345, 4)).toBe(0.1235);
    });
  });

  // -----------------------------------------------------------------------
  // formatPrice (private)
  // -----------------------------------------------------------------------
  describe('formatPrice', () => {
    it('should format non-JPY to 5 decimal places', () => {
      const comp = createComponent();
      expect((comp as any).formatPrice(1.085, 'EURUSD')).toBe('1.08500');
      expect((comp as any).formatPrice(1.26501, 'GBPUSD')).toBe('1.26501');
    });

    it('should format JPY to 2 decimal places', () => {
      const comp = createComponent();
      expect((comp as any).formatPrice(149.5, 'USDJPY')).toBe('149.50');
      expect((comp as any).formatPrice(162.301, 'EURJPY')).toBe('162.30');
    });
  });

  // -----------------------------------------------------------------------
  // formatSpread (private)
  // -----------------------------------------------------------------------
  describe('formatSpread', () => {
    it('should format non-JPY spread to 5 decimal places', () => {
      const comp = createComponent();
      expect((comp as any).formatSpread(0.0002, 'EURUSD')).toBe('0.00020');
    });

    it('should format JPY spread to 2 decimal places', () => {
      const comp = createComponent();
      expect((comp as any).formatSpread(0.03, 'USDJPY')).toBe('0.03');
    });
  });

  // -----------------------------------------------------------------------
  // formatChange (private)
  // -----------------------------------------------------------------------
  describe('formatChange', () => {
    it('should prefix positive values with +', () => {
      const comp = createComponent();
      expect((comp as any).formatChange(0.0002, 'EURUSD')).toBe('+0.00020');
    });

    it('should show negative sign for negative values', () => {
      const comp = createComponent();
      expect((comp as any).formatChange(-0.0003, 'EURUSD')).toBe('-0.00030');
    });

    it('should prefix zero with +', () => {
      const comp = createComponent();
      expect((comp as any).formatChange(0, 'EURUSD')).toBe('+0.00000');
    });

    it('should use 2 decimals for JPY', () => {
      const comp = createComponent();
      expect((comp as any).formatChange(0.15, 'USDJPY')).toBe('+0.15');
      expect((comp as any).formatChange(-0.25, 'GBPJPY')).toBe('-0.25');
    });
  });

  // -----------------------------------------------------------------------
  // ngOnDestroy - cleanup
  // -----------------------------------------------------------------------
  describe('ngOnDestroy', () => {
    it('should call viewState.destroy()', () => {
      const comp = createComponent();
      comp.ngOnInit();
      comp.ngOnDestroy();
      expect(mockViewStateInstance.destroy).toHaveBeenCalledTimes(1);
    });

    it('should clear the update interval', () => {
      const comp = createComponent();
      comp.ngOnInit();

      (comp as any).updateInterval = setInterval(() => {}, 1000);
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      comp.ngOnDestroy();
      expect(clearIntervalSpy).toHaveBeenCalled();

      clearIntervalSpy.mockRestore();
    });

    it('should not throw if updateInterval is undefined', () => {
      const comp = createComponent();
      comp.ngOnInit();
      (comp as any).updateInterval = undefined;
      expect(() => comp.ngOnDestroy()).not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // updateMarketData (private)
  // -----------------------------------------------------------------------
  describe('updateMarketData', () => {
    it('should generate updated rows for all 15 pairs', () => {
      const comp = createComponent();
      comp.ngOnInit();

      const updateSubject = new Subject<unknown[]>();
      (comp as any).gridComponent = {
        updateRows$: updateSubject,
        getGridApi: jest.fn(),
        setInitialRowData: jest.fn(),
      };

      const nextSpy = jest.spyOn(updateSubject, 'next');
      (comp as any).updateMarketData();

      expect(nextSpy).toHaveBeenCalledTimes(1);
      const updatedRows = nextSpy.mock.calls[0][0] as any[];
      expect(updatedRows).toHaveLength(15);
    });

    it('should produce updated rows with all required fields', () => {
      const comp = createComponent();
      comp.ngOnInit();

      const updateSubject = new Subject<unknown[]>();
      (comp as any).gridComponent = {
        updateRows$: updateSubject,
        getGridApi: jest.fn(),
        setInitialRowData: jest.fn(),
      };

      const nextSpy = jest.spyOn(updateSubject, 'next');
      (comp as any).updateMarketData();

      const updatedRows = nextSpy.mock.calls[0][0] as any[];
      for (const row of updatedRows) {
        expect(row).toHaveProperty('id');
        expect(row).toHaveProperty('symbol');
        expect(row).toHaveProperty('base');
        expect(row).toHaveProperty('quote');
        expect(row).toHaveProperty('bid');
        expect(row).toHaveProperty('ask');
        expect(row).toHaveProperty('mid');
        expect(row).toHaveProperty('spread');
        expect(row).toHaveProperty('change');
        expect(row).toHaveProperty('changePercent');
      }
    });

    it('should maintain bid < ask for all updated rows', () => {
      const comp = createComponent();
      comp.ngOnInit();

      const updateSubject = new Subject<unknown[]>();
      (comp as any).gridComponent = {
        updateRows$: updateSubject,
        getGridApi: jest.fn(),
        setInitialRowData: jest.fn(),
      };

      const nextSpy = jest.spyOn(updateSubject, 'next');

      for (let i = 0; i < 5; i++) {
        (comp as any).updateMarketData();
      }

      const lastCall = nextSpy.mock.calls[nextSpy.mock.calls.length - 1];
      const updatedRows = lastCall[0] as any[];
      for (const row of updatedRows) {
        expect(row.bid).toBeLessThan(row.ask);
      }
    });

    it('should compute numeric change and changePercent', () => {
      const comp = createComponent();
      comp.ngOnInit();

      const updateSubject = new Subject<unknown[]>();
      (comp as any).gridComponent = {
        updateRows$: updateSubject,
        getGridApi: jest.fn(),
        setInitialRowData: jest.fn(),
      };

      const nextSpy = jest.spyOn(updateSubject, 'next');
      (comp as any).updateMarketData();

      const updatedRows = nextSpy.mock.calls[0][0] as any[];
      for (const row of updatedRows) {
        expect(typeof row.change).toBe('number');
        expect(typeof row.changePercent).toBe('number');
      }
    });
  });

  // -----------------------------------------------------------------------
  // Base rates & volatility maps
  // -----------------------------------------------------------------------
  describe('base rate maps', () => {
    it('should have 15 entries in baseRates', () => {
      const comp = createComponent();
      const baseRates: Map<string, number> = (comp as any).baseRates;
      expect(baseRates.size).toBe(15);
    });

    it('should have 15 entries in volatility', () => {
      const comp = createComponent();
      const volatility: Map<string, number> = (comp as any).volatility;
      expect(volatility.size).toBe(15);
    });

    it('should have the same keys in baseRates and volatility', () => {
      const comp = createComponent();
      const baseKeys = [...(comp as any).baseRates.keys()].sort();
      const volKeys = [...(comp as any).volatility.keys()].sort();
      expect(baseKeys).toEqual(volKeys);
    });

    it('should have known base rates for key pairs', () => {
      const comp = createComponent();
      const baseRates: Map<string, number> = (comp as any).baseRates;
      expect(baseRates.get('EURUSD')).toBe(1.085);
      expect(baseRates.get('USDJPY')).toBe(149.5);
      expect(baseRates.get('GBPUSD')).toBe(1.265);
    });

    it('should have positive volatility for all pairs', () => {
      const comp = createComponent();
      const volatility: Map<string, number> = (comp as any).volatility;
      for (const [, vol] of volatility.entries()) {
        expect(vol).toBeGreaterThan(0);
      }
    });

    it('should have higher volatility for JPY pairs than non-JPY G7 pairs', () => {
      const comp = createComponent();
      const volatility: Map<string, number> = (comp as any).volatility;
      const jpyVol = volatility.get('USDJPY')!;
      const eurVol = volatility.get('EURUSD')!;
      expect(jpyVol).toBeGreaterThan(eurVol);
    });
  });

  // -----------------------------------------------------------------------
  // rowData initial state
  // -----------------------------------------------------------------------
  it('should have empty rowData initially', () => {
    const comp = createComponent();
    expect(comp.rowData).toEqual([]);
  });
});
