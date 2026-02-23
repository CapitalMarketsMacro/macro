import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID, NO_ERRORS_SCHEMA } from '@angular/core';

// ---------------------------------------------------------------------------
// Mocks - declared before jest.mock to avoid TDZ issues
// ---------------------------------------------------------------------------

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

// Mock ag-charts-angular
jest.mock('ag-charts-angular', () => ({
  AgCharts: class MockAgCharts {},
}));

// Mock clone
jest.mock('clone', () => ({
  __esModule: true,
  default: jest.fn((obj: unknown) => JSON.parse(JSON.stringify(obj))),
}));

import { TreasuryMicrostructureComponent } from './treasury-microstructure.component';
import { Logger } from '@macro/logger';

const mockLoggerInstance = (Logger as any).__mockInstance;

describe('TreasuryMicrostructureComponent', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Ensure the real document starts without .dark
    document.documentElement.classList.remove('dark');

    await TestBed.configureTestingModule({
      imports: [TreasuryMicrostructureComponent],
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(TreasuryMicrostructureComponent, {
        set: {
          imports: [],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();
  });

  afterEach(() => {
    jest.useRealTimers();
    // Clean up
    document.documentElement.classList.remove('dark');
    localStorage.removeItem('theme');
  });

  function createComponent(): TreasuryMicrostructureComponent {
    const fixture = TestBed.createComponent(
      TreasuryMicrostructureComponent
    );
    return fixture.componentInstance;
  }

  // -----------------------------------------------------------------------
  // Creation
  // -----------------------------------------------------------------------
  it('should create the component', () => {
    const comp = createComponent();
    expect(comp).toBeTruthy();
  });

  // -----------------------------------------------------------------------
  // ngOnInit
  // -----------------------------------------------------------------------
  it('should log initialization message on ngOnInit', () => {
    const comp = createComponent();
    comp.ngOnInit();
    expect(mockLoggerInstance.info).toHaveBeenCalledWith(
      'Treasury Microstructure component initialized'
    );
  });

  it('should detect light theme by default', () => {
    const comp = createComponent();
    comp.ngOnInit();
    expect((comp as any).currentTheme).toBe('ag-default');
  });

  it('should detect dark theme when html has .dark class', () => {
    document.documentElement.classList.add('dark');
    const comp = createComponent();
    comp.ngOnInit();
    expect((comp as any).currentTheme).toBe('ag-default-dark');
  });

  it('should detect dark theme from localStorage', () => {
    localStorage.setItem('theme', 'dark');
    const comp = createComponent();
    comp.ngOnInit();
    expect((comp as any).currentTheme).toBe('ag-default-dark');
  });

  it('should generate 50 initial data points', () => {
    const comp = createComponent();
    comp.ngOnInit();
    const data: unknown[] = (comp as any).microstructureData;
    expect(data).toHaveLength(50);
  });

  it('should initialize all four chart options', () => {
    const comp = createComponent();
    comp.ngOnInit();

    expect(comp.tradeFrequencyOptions).toBeDefined();
    expect(comp.tradeFrequencyOptions.series).toBeDefined();

    expect(comp.orderToTradeRatioOptions).toBeDefined();
    expect(comp.orderToTradeRatioOptions.series).toBeDefined();

    expect(comp.quoteUpdateFrequencyOptions).toBeDefined();
    expect(comp.quoteUpdateFrequencyOptions.series).toBeDefined();

    expect(comp.timeBetweenTradesOptions).toBeDefined();
    expect(comp.timeBetweenTradesOptions.series).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // Chart initialization details
  // -----------------------------------------------------------------------
  describe('initializeCharts', () => {
    it('should set tradeFrequencyOptions with bar series type', () => {
      const comp = createComponent();
      comp.ngOnInit();

      const series = comp.tradeFrequencyOptions.series as any[];
      expect(series).toHaveLength(1);
      expect(series[0].type).toBe('bar');
      expect(series[0].xKey).toBe('timestamp');
      expect(series[0].yKey).toBe('tradeCount');
    });

    it('should set orderToTradeRatioOptions with line series type', () => {
      const comp = createComponent();
      comp.ngOnInit();

      const series = comp.orderToTradeRatioOptions.series as any[];
      expect(series).toHaveLength(1);
      expect(series[0].type).toBe('line');
      expect(series[0].yKey).toBe('orderToTradeRatio');
    });

    it('should set quoteUpdateFrequencyOptions with line series type', () => {
      const comp = createComponent();
      comp.ngOnInit();

      const series = comp.quoteUpdateFrequencyOptions.series as any[];
      expect(series).toHaveLength(1);
      expect(series[0].type).toBe('line');
      expect(series[0].yKey).toBe('quoteUpdates');
    });

    it('should set timeBetweenTradesOptions with line series type', () => {
      const comp = createComponent();
      comp.ngOnInit();

      const series = comp.timeBetweenTradesOptions.series as any[];
      expect(series).toHaveLength(1);
      expect(series[0].type).toBe('line');
      expect(series[0].yKey).toBe('timeBetweenTrades');
    });

    it('should disable animation on all charts', () => {
      const comp = createComponent();
      comp.ngOnInit();

      expect(comp.tradeFrequencyOptions.animation).toEqual({
        enabled: false,
      });
      expect(comp.orderToTradeRatioOptions.animation).toEqual({
        enabled: false,
      });
      expect(comp.quoteUpdateFrequencyOptions.animation).toEqual({
        enabled: false,
      });
      expect(comp.timeBetweenTradesOptions.animation).toEqual({
        enabled: false,
      });
    });

    it('should disable legend on all charts', () => {
      const comp = createComponent();
      comp.ngOnInit();

      expect(comp.tradeFrequencyOptions.legend).toEqual({
        enabled: false,
      });
      expect(comp.orderToTradeRatioOptions.legend).toEqual({
        enabled: false,
      });
      expect(comp.quoteUpdateFrequencyOptions.legend).toEqual({
        enabled: false,
      });
      expect(comp.timeBetweenTradesOptions.legend).toEqual({
        enabled: false,
      });
    });

    it('should set correct chart titles', () => {
      const comp = createComponent();
      comp.ngOnInit();

      expect(comp.tradeFrequencyOptions.title).toEqual({
        text: 'Trade Frequency per Interval',
      });
      expect(comp.orderToTradeRatioOptions.title).toEqual({
        text: 'Order-to-Trade Ratio',
      });
      expect(comp.quoteUpdateFrequencyOptions.title).toEqual({
        text: 'Quote Update Frequency',
      });
      expect(comp.timeBetweenTradesOptions.title).toEqual({
        text: 'Time Between Trades',
      });
    });

    it('should set correct chart subtitles', () => {
      const comp = createComponent();
      comp.ngOnInit();

      expect(comp.tradeFrequencyOptions.subtitle).toEqual({
        text: 'Number of trades per 1-second interval',
      });
      expect(comp.orderToTradeRatioOptions.subtitle).toEqual({
        text: 'Ratio of orders to executed trades',
      });
      expect(comp.quoteUpdateFrequencyOptions.subtitle).toEqual({
        text: 'Number of quote updates per interval',
      });
      expect(comp.timeBetweenTradesOptions.subtitle).toEqual({
        text: 'Average time between trades (milliseconds)',
      });
    });

    it('should apply the current theme to all charts', () => {
      const comp = createComponent();
      comp.ngOnInit();

      expect(comp.tradeFrequencyOptions.theme).toBe('ag-default');
      expect(comp.orderToTradeRatioOptions.theme).toBe('ag-default');
      expect(comp.quoteUpdateFrequencyOptions.theme).toBe('ag-default');
      expect(comp.timeBetweenTradesOptions.theme).toBe('ag-default');
    });

    it('should apply dark theme when dark mode is detected', () => {
      document.documentElement.classList.add('dark');
      const comp = createComponent();
      comp.ngOnInit();

      expect(comp.tradeFrequencyOptions.theme).toBe('ag-default-dark');
      expect(comp.orderToTradeRatioOptions.theme).toBe('ag-default-dark');
      expect(comp.quoteUpdateFrequencyOptions.theme).toBe('ag-default-dark');
      expect(comp.timeBetweenTradesOptions.theme).toBe('ag-default-dark');
    });
  });

  // -----------------------------------------------------------------------
  // generateDataPoint (private)
  // -----------------------------------------------------------------------
  describe('generateDataPoint', () => {
    it('should return a valid data point with all required fields', () => {
      const comp = createComponent();
      const timestamp = new Date('2025-01-15T12:00:00Z');
      const dp: any = (comp as any).generateDataPoint(timestamp);

      expect(dp.timestamp).toEqual(timestamp);
      expect(typeof dp.tradeCount).toBe('number');
      expect(typeof dp.orderToTradeRatio).toBe('number');
      expect(typeof dp.quoteUpdates).toBe('number');
      expect(typeof dp.timeBetweenTrades).toBe('number');
    });

    it('should generate tradeCount >= 0', () => {
      const comp = createComponent();
      for (let i = 0; i < 100; i++) {
        const dp: any = (comp as any).generateDataPoint(new Date());
        expect(dp.tradeCount).toBeGreaterThanOrEqual(0);
      }
    });

    it('should generate quoteUpdates >= 0', () => {
      const comp = createComponent();
      for (let i = 0; i < 100; i++) {
        const dp: any = (comp as any).generateDataPoint(new Date());
        expect(dp.quoteUpdates).toBeGreaterThanOrEqual(0);
      }
    });

    it('should generate timeBetweenTrades >= 10', () => {
      const comp = createComponent();
      for (let i = 0; i < 100; i++) {
        const dp: any = (comp as any).generateDataPoint(new Date());
        expect(dp.timeBetweenTrades).toBeGreaterThanOrEqual(10);
      }
    });

    it('should generate positive orderToTradeRatio', () => {
      const comp = createComponent();
      for (let i = 0; i < 100; i++) {
        const dp: any = (comp as any).generateDataPoint(new Date());
        expect(dp.orderToTradeRatio).toBeGreaterThan(0);
      }
    });

    it('should round orderToTradeRatio to 2 decimal places', () => {
      const comp = createComponent();
      for (let i = 0; i < 20; i++) {
        const dp: any = (comp as any).generateDataPoint(new Date());
        const decimals =
          dp.orderToTradeRatio.toString().split('.')[1]?.length ?? 0;
        expect(decimals).toBeLessThanOrEqual(2);
      }
    });

    it('should produce integer tradeCount', () => {
      const comp = createComponent();
      for (let i = 0; i < 20; i++) {
        const dp: any = (comp as any).generateDataPoint(new Date());
        expect(Number.isInteger(dp.tradeCount)).toBe(true);
      }
    });

    it('should produce integer quoteUpdates', () => {
      const comp = createComponent();
      for (let i = 0; i < 20; i++) {
        const dp: any = (comp as any).generateDataPoint(new Date());
        expect(Number.isInteger(dp.quoteUpdates)).toBe(true);
      }
    });

    it('should produce integer timeBetweenTrades', () => {
      const comp = createComponent();
      for (let i = 0; i < 20; i++) {
        const dp: any = (comp as any).generateDataPoint(new Date());
        expect(Number.isInteger(dp.timeBetweenTrades)).toBe(true);
      }
    });
  });

  // -----------------------------------------------------------------------
  // generateInitialData (private)
  // -----------------------------------------------------------------------
  describe('generateInitialData', () => {
    it('should populate microstructureData with 50 data points', () => {
      const comp = createComponent();
      (comp as any).initializeCharts();
      (comp as any).generateInitialData();

      const data: any[] = (comp as any).microstructureData;
      expect(data).toHaveLength(50);
    });

    it('should have timestamps in chronological order', () => {
      const comp = createComponent();
      (comp as any).initializeCharts();
      (comp as any).generateInitialData();

      const data: any[] = (comp as any).microstructureData;
      for (let i = 1; i < data.length; i++) {
        expect(data[i].timestamp.getTime()).toBeGreaterThan(
          data[i - 1].timestamp.getTime()
        );
      }
    });

    it('should have timestamps spaced approximately 1 second apart', () => {
      const comp = createComponent();
      (comp as any).initializeCharts();
      (comp as any).generateInitialData();

      const data: any[] = (comp as any).microstructureData;
      for (let i = 1; i < data.length; i++) {
        const diff =
          data[i].timestamp.getTime() - data[i - 1].timestamp.getTime();
        expect(diff).toBe(1000);
      }
    });
  });

  // -----------------------------------------------------------------------
  // startDataUpdates / interval behavior
  // -----------------------------------------------------------------------
  describe('startDataUpdates', () => {
    it('should add new data points when interval fires', () => {
      const comp = createComponent();
      comp.ngOnInit();

      // We start with 50 points (maxDataPoints). Record the last timestamp.
      const lastTimestampBefore =
        (comp as any).microstructureData[(comp as any).microstructureData.length - 1].timestamp;

      // Advance timer by 1 second (one update)
      jest.advanceTimersByTime(1000);

      // Because we're already at max, length stays 50 after shift+push
      expect((comp as any).microstructureData.length).toBe(50);

      // But the last element should be newer
      const lastTimestampAfter =
        (comp as any).microstructureData[(comp as any).microstructureData.length - 1].timestamp;
      expect(lastTimestampAfter.getTime()).toBeGreaterThan(
        lastTimestampBefore.getTime()
      );
    });

    it('should not exceed maxDataPoints', () => {
      const comp = createComponent();
      comp.ngOnInit();

      // Advance by 10 seconds (10 more data points)
      jest.advanceTimersByTime(10000);

      expect((comp as any).microstructureData.length).toBeLessThanOrEqual(
        50
      );
    });

    it('should remove oldest data point when exceeding max', () => {
      const comp = createComponent();
      comp.ngOnInit();

      const firstTimestamp = (comp as any).microstructureData[0].timestamp;

      // Advance by 1 second to add one more (51st point), triggering shift
      jest.advanceTimersByTime(1000);

      const newFirstTimestamp =
        (comp as any).microstructureData[0].timestamp;
      expect(newFirstTimestamp.getTime()).toBeGreaterThan(
        firstTimestamp.getTime()
      );
    });
  });

  // -----------------------------------------------------------------------
  // updateChartData (private)
  // -----------------------------------------------------------------------
  describe('updateChartData', () => {
    it('should update all chart options with data', () => {
      const comp = createComponent();
      comp.ngOnInit();

      expect(comp.tradeFrequencyOptions.data).toBeDefined();
      expect(comp.tradeFrequencyOptions.data!.length).toBe(50);

      expect(comp.orderToTradeRatioOptions.data).toBeDefined();
      expect(comp.orderToTradeRatioOptions.data!.length).toBe(50);

      expect(comp.quoteUpdateFrequencyOptions.data).toBeDefined();
      expect(comp.quoteUpdateFrequencyOptions.data!.length).toBe(50);

      expect(comp.timeBetweenTradesOptions.data).toBeDefined();
      expect(comp.timeBetweenTradesOptions.data!.length).toBe(50);
    });

    it('should create new option objects (immutable update via clone)', () => {
      const comp = createComponent();
      comp.ngOnInit();

      const originalRef = comp.tradeFrequencyOptions;

      // Trigger an update cycle
      jest.advanceTimersByTime(1000);

      // The options object should be a new reference (clone)
      expect(comp.tradeFrequencyOptions).not.toBe(originalRef);
    });
  });

  // -----------------------------------------------------------------------
  // Theme observation
  // -----------------------------------------------------------------------
  describe('setupThemeObserver', () => {
    it('should create a MutationObserver that watches document root', () => {
      const observeSpy = jest.fn();
      const disconnectSpy = jest.fn();
      const MockMO = jest.fn().mockImplementation(() => ({
        observe: observeSpy,
        disconnect: disconnectSpy,
      }));

      const original = global.MutationObserver;
      global.MutationObserver = MockMO as any;

      const comp = createComponent();
      comp.ngOnInit();

      expect(MockMO).toHaveBeenCalled();
      expect(observeSpy).toHaveBeenCalledWith(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
      });

      global.MutationObserver = original;
    });
  });

  // -----------------------------------------------------------------------
  // updateChartThemes (private)
  // -----------------------------------------------------------------------
  describe('updateChartThemes', () => {
    it('should update theme on all chart options', () => {
      const comp = createComponent();
      comp.ngOnInit();

      (comp as any).currentTheme = 'ag-default-dark';
      (comp as any).updateChartThemes();

      expect(comp.tradeFrequencyOptions.theme).toBe('ag-default-dark');
      expect(comp.orderToTradeRatioOptions.theme).toBe('ag-default-dark');
      expect(comp.quoteUpdateFrequencyOptions.theme).toBe('ag-default-dark');
      expect(comp.timeBetweenTradesOptions.theme).toBe('ag-default-dark');
    });

    it('should switch back to light theme', () => {
      document.documentElement.classList.add('dark');
      const comp = createComponent();
      comp.ngOnInit();

      expect(comp.tradeFrequencyOptions.theme).toBe('ag-default-dark');

      (comp as any).currentTheme = 'ag-default';
      (comp as any).updateChartThemes();

      expect(comp.tradeFrequencyOptions.theme).toBe('ag-default');
    });
  });

  // -----------------------------------------------------------------------
  // detectTheme (private)
  // -----------------------------------------------------------------------
  describe('detectTheme', () => {
    it('should set ag-default when not dark', () => {
      const comp = createComponent();
      (comp as any).detectTheme();
      expect((comp as any).currentTheme).toBe('ag-default');
    });

    it('should set ag-default-dark when classList contains dark', () => {
      document.documentElement.classList.add('dark');
      const comp = createComponent();
      (comp as any).detectTheme();
      expect((comp as any).currentTheme).toBe('ag-default-dark');
    });

    it('should set ag-default-dark when localStorage has dark theme', () => {
      localStorage.setItem('theme', 'dark');
      const comp = createComponent();
      (comp as any).detectTheme();
      expect((comp as any).currentTheme).toBe('ag-default-dark');
    });
  });

  // -----------------------------------------------------------------------
  // ngOnDestroy
  // -----------------------------------------------------------------------
  describe('ngOnDestroy', () => {
    it('should clear update interval', () => {
      const comp = createComponent();
      comp.ngOnInit();

      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      comp.ngOnDestroy();

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });

    it('should disconnect themeObserver', () => {
      const disconnectSpy = jest.fn();
      const MockMO = jest.fn().mockImplementation(() => ({
        observe: jest.fn(),
        disconnect: disconnectSpy,
      }));

      const original = global.MutationObserver;
      global.MutationObserver = MockMO as any;

      const comp = createComponent();
      comp.ngOnInit();
      comp.ngOnDestroy();

      expect(disconnectSpy).toHaveBeenCalledTimes(1);
      global.MutationObserver = original;
    });

    it('should not throw if updateInterval is undefined', () => {
      const comp = createComponent();
      (comp as any).updateInterval = undefined;
      (comp as any).themeObserver = undefined;

      expect(() => comp.ngOnDestroy()).not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // Server platform
  // -----------------------------------------------------------------------
  describe('when platform is server', () => {
    beforeEach(async () => {
      await TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [TreasuryMicrostructureComponent],
        providers: [
          { provide: PLATFORM_ID, useValue: 'server' },
        ],
        schemas: [NO_ERRORS_SCHEMA],
      })
        .overrideComponent(TreasuryMicrostructureComponent, {
          set: {
            imports: [],
            schemas: [NO_ERRORS_SCHEMA],
          },
        })
        .compileComponents();
    });

    it('should skip theme detection on server', () => {
      const fixture = TestBed.createComponent(
        TreasuryMicrostructureComponent
      );
      const comp = fixture.componentInstance;

      (comp as any).detectTheme();
      // Theme stays at the default initial value
      expect((comp as any).currentTheme).toBe('ag-default');
    });

    it('should skip theme observer setup on server', () => {
      const fixture = TestBed.createComponent(
        TreasuryMicrostructureComponent
      );
      const comp = fixture.componentInstance;

      (comp as any).setupThemeObserver();
      expect((comp as any).themeObserver).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // Constants
  // -----------------------------------------------------------------------
  describe('constants', () => {
    it('should have maxDataPoints of 50', () => {
      const comp = createComponent();
      expect((comp as any).maxDataPoints).toBe(50);
    });

    it('should have updateIntervalMs of 1000', () => {
      const comp = createComponent();
      expect((comp as any).updateIntervalMs).toBe(1000);
    });
  });
});
