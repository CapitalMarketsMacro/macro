// ---------------------------------------------------------------------------
// Mocks - must be declared before any imports that use them.
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

const mockViewStateInstance = {
  restoreState: jest.fn().mockResolvedValue({}),
  setCollector: jest.fn(),
  destroy: jest.fn(),
};

class MockViewStateService {
  restoreState = mockViewStateInstance.restoreState;
  setCollector = mockViewStateInstance.setCollector;
  destroy = mockViewStateInstance.destroy;
}

jest.mock('@macro/openfin', () => ({
  ViewStateService: MockViewStateService,
}));

jest.mock('@macro/macro-angular-grid', () => ({
  MacroAngularGrid: class MockMacroAngularGrid {},
}));

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
import { RiskPnlComponent } from './risk-pnl.component';
import { ViewStateService } from '@macro/openfin';

describe('RiskPnlComponent', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    await TestBed.configureTestingModule({
      imports: [RiskPnlComponent],
      providers: [{ provide: ViewStateService, useValue: new MockViewStateService() }],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(RiskPnlComponent, {
        set: { imports: [], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function createComponent(): RiskPnlComponent {
    return TestBed.createComponent(RiskPnlComponent).componentInstance;
  }

  // -----------------------------------------------------------------------
  // Construction
  // -----------------------------------------------------------------------
  it('should create the component', () => {
    expect(createComponent()).toBeTruthy();
  });

  // -----------------------------------------------------------------------
  // Grouping hierarchy
  // -----------------------------------------------------------------------
  it('should group by desk -> book -> trader (hidden rowGroup columns)', () => {
    const comp = createComponent();
    for (const field of ['desk', 'book', 'trader']) {
      const col = comp.columns.find((c: any) => c.field === field) as any;
      expect(col).toBeDefined();
      expect(col.rowGroup).toBe(true);
      expect(col.hide).toBe(true);
    }
  });

  it('should pin the auto group column on the left', () => {
    const comp = createComponent();
    expect(comp.gridOptions.autoGroupColumnDef?.pinned).toBe('left');
    expect(comp.gridOptions.autoGroupColumnDef?.headerName).toBe('Desk / Book / Trader');
  });

  // -----------------------------------------------------------------------
  // Aggregation
  // -----------------------------------------------------------------------
  it('should sum-aggregate the numeric metric columns', () => {
    const comp = createComponent();
    for (const field of ['pnl', 'dayPnl', 'dv01', 'notional']) {
      const col = comp.columns.find((c: any) => c.field === field && !c.colId) as any;
      expect(col).toBeDefined();
      expect(col.aggFunc).toBe('sum');
      expect(col.enableValue).toBe(true);
    }
  });

  it('should show a grand total row at the bottom and the group panel', () => {
    const comp = createComponent();
    expect(comp.gridOptions.grandTotalRow).toBe('bottom');
    expect(comp.gridOptions.rowGroupPanelShow).toBe('always');
  });

  // -----------------------------------------------------------------------
  // Show Values As (AG Grid 36)
  // -----------------------------------------------------------------------
  it('should expose a PnL "% of grand total" Show Values As column', () => {
    const comp = createComponent();
    const col = comp.columns.find((c: any) => c.colId === 'pnlPctGrand') as any;
    expect(col).toBeDefined();
    expect(col.field).toBe('pnl');
    expect(col.aggFunc).toBe('sum');
    expect(col.showValuesAs).toBe('percentOfGrandTotal');
    expect(col.enableShowValuesAs).toBe(true);
  });

  it('should expose a Notional "% of parent" Show Values As column', () => {
    const comp = createComponent();
    const col = comp.columns.find((c: any) => c.colId === 'notionalPctParent') as any;
    expect(col).toBeDefined();
    expect(col.field).toBe('notional');
    expect(col.showValuesAs).toBe('percentOfParentRowTotal');
    expect(col.enableShowValuesAs).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Column formats (seeded into the grid wrapper's format store)
  // -----------------------------------------------------------------------
  it('should seed CM formats on the absolute metric columns only', () => {
    const comp = createComponent();
    expect(comp.initialColumnFormats['pnl']).toMatchObject({ kind: 'currency', colorMode: 'posneg' });
    expect(comp.initialColumnFormats['notional']).toMatchObject({ kind: 'compact' });
    // The % columns are left to Show Values As — they must NOT carry a baked format.
    expect(comp.initialColumnFormats['pnlPctGrand']).toBeUndefined();
    expect(comp.initialColumnFormats['notionalPctParent']).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // getRowId
  // -----------------------------------------------------------------------
  it('should return data.id from getRowId', () => {
    const comp = createComponent();
    expect(comp.getRowId({ data: { id: 'Rates|USD Swaps|A. Patel|UST 2Y|0' } } as any)).toBe(
      'Rates|USD Swaps|A. Patel|UST 2Y|0'
    );
  });

  // -----------------------------------------------------------------------
  // generatePositions
  // -----------------------------------------------------------------------
  describe('generatePositions', () => {
    it('should generate well-formed positions across multiple desks', () => {
      const comp = createComponent();
      const data: any[] = (comp as any).initialData;
      expect(data.length).toBeGreaterThan(0);

      const desks = new Set(data.map((d) => d.desk));
      expect(desks.size).toBeGreaterThanOrEqual(3);

      for (const pos of data) {
        for (const key of ['id', 'desk', 'book', 'trader', 'instrument', 'pnl', 'dayPnl', 'dv01', 'notional']) {
          expect(pos).toHaveProperty(key);
        }
        expect(typeof pos.pnl).toBe('number');
        expect(pos.notional).toBeGreaterThan(0);
      }
    });

    it('should produce unique row ids', () => {
      const comp = createComponent();
      const data: any[] = (comp as any).initialData;
      const ids = data.map((d) => d.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  // -----------------------------------------------------------------------
  // tickPnl - live aggregation updates
  // -----------------------------------------------------------------------
  it('should push row updates through updateRows$ on tick', () => {
    const comp = createComponent();
    const updateSubject = new Subject<unknown[]>();
    (comp as any).gridComponent = { updateRows$: updateSubject };
    const nextSpy = jest.spyOn(updateSubject, 'next');

    // Force a deterministic subset by stubbing Math.random low (so the 0.18 gate passes).
    const randSpy = jest.spyOn(Math, 'random').mockReturnValue(0.05);
    (comp as any).tickPnl();
    randSpy.mockRestore();

    expect(nextSpy).toHaveBeenCalledTimes(1);
    const rows = nextSpy.mock.calls[0][0] as any[];
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(typeof r.pnl).toBe('number');
      expect(typeof r.dayPnl).toBe('number');
    }
  });

  // -----------------------------------------------------------------------
  // ngOnDestroy
  // -----------------------------------------------------------------------
  describe('ngOnDestroy', () => {
    it('should call viewState.destroy()', () => {
      const comp = createComponent();
      comp.ngOnDestroy();
      expect(mockViewStateInstance.destroy).toHaveBeenCalledTimes(1);
    });

    it('should clear the update interval', () => {
      const comp = createComponent();
      (comp as any).updateInterval = setInterval(() => undefined, 1000) as unknown as number;
      const clearSpy = jest.spyOn(global, 'clearInterval');
      comp.ngOnDestroy();
      expect(clearSpy).toHaveBeenCalled();
      clearSpy.mockRestore();
    });
  });
});
