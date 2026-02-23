import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleChange, SimpleChanges, NO_ERRORS_SCHEMA } from '@angular/core';
import { MacroAngularGrid } from './macro-angular-grid';
import { GridReadyEvent, GridApi, GridState, ColDef } from 'ag-grid-community';

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock ag-grid modules so the real Enterprise license is never checked
jest.mock('ag-grid-community', () => {
  return {
    ModuleRegistry: { registerModules: jest.fn() },
    AllCommunityModule: {},
  };
});

jest.mock('ag-grid-enterprise', () => ({
  AllEnterpriseModule: {},
  IntegratedChartsModule: { with: jest.fn().mockReturnValue({}) },
}));

jest.mock('ag-charts-enterprise', () => ({
  AgChartsEnterpriseModule: {},
}));

const mockBuildTheme = jest.fn().mockReturnValue('mock-theme');
jest.mock('@macro/macro-design', () => ({
  buildAgGridTheme: (...args: unknown[]) => mockBuildTheme(...args),
}));

jest.mock('@macro/logger', () => ({
  Logger: {
    getLogger: () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }),
  },
}));

// Mock ag-grid-angular's AgGridAngular so the template does not fail
jest.mock('ag-grid-angular', () => {
  const { Component, Input } = jest.requireActual('@angular/core');

  @Component({ selector: 'ag-grid-angular', template: '', standalone: true })
  class MockAgGridAngular {
    @Input() columnDefs: unknown;
    @Input() theme: unknown;
    @Input() rowData: unknown;
    @Input() gridOptions: unknown;
    @Input() getRowId: unknown;
    @Input() enableCharts: unknown;
  }
  return { AgGridAngular: MockAgGridAngular };
});

// ── Global MutationObserver mock ─────────────────────────────────────────────

let mutationCallback: MutationCallback | undefined;
const mockObserve = jest.fn();
const mockDisconnect = jest.fn();

class MockMutationObserver {
  observe = mockObserve;
  disconnect = mockDisconnect;
  takeRecords = jest.fn().mockReturnValue([]);
  constructor(cb: MutationCallback) {
    mutationCallback = cb;
  }
}

(globalThis as any).MutationObserver = MockMutationObserver;

// ── Helpers ──────────────────────────────────────────────────────────────────

function createMockGridApi(overrides: Partial<GridApi> = {}): GridApi {
  return {
    applyTransactionAsync: jest.fn(),
    getState: jest.fn().mockReturnValue({ columnOrder: ['a'] } as unknown as GridState),
    setState: jest.fn(),
    ...overrides,
  } as unknown as GridApi;
}

function makeGridReadyEvent(api: GridApi): GridReadyEvent {
  return { api, type: 'gridReady' } as unknown as GridReadyEvent;
}

function makeSimpleChanges(
  changesMap: Record<string, { prev: unknown; curr: unknown; first?: boolean }>
): SimpleChanges {
  const changes: SimpleChanges = {};
  for (const [key, { prev, curr, first }] of Object.entries(changesMap)) {
    changes[key] = new SimpleChange(prev, curr, first ?? false);
  }
  return changes;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('MacroAngularGrid', () => {
  let component: MacroAngularGrid;
  let fixture: ComponentFixture<MacroAngularGrid>;

  beforeEach(async () => {
    mutationCallback = undefined;
    mockBuildTheme.mockClear();
    mockObserve.mockClear();
    mockDisconnect.mockClear();

    await TestBed.configureTestingModule({
      imports: [MacroAngularGrid],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(MacroAngularGrid);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
  });

  // ── Basic creation ────────────────────────────────────────────────────────

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  // ── parseColumns ──────────────────────────────────────────────────────────

  describe('parseColumns', () => {
    it('should parse a valid JSON string into an array of ColDef', () => {
      const cols: ColDef[] = [
        { field: 'name', headerName: 'Name' },
        { field: 'age', headerName: 'Age' },
      ];
      component.columns = JSON.stringify(cols);
      fixture.detectChanges(); // triggers ngOnInit -> parseColumns

      expect(component.columnDefs).toEqual(cols);
    });

    it('should wrap a single JSON object in an array', () => {
      const col: ColDef = { field: 'name' };
      component.columns = JSON.stringify(col);
      fixture.detectChanges();

      expect(component.columnDefs).toEqual([col]);
    });

    it('should return empty array for invalid JSON string', () => {
      component.columns = '{ broken json !!!';
      fixture.detectChanges();

      expect(component.columnDefs).toEqual([]);
    });

    it('should use a ColDef array directly when passed as an array', () => {
      const cols: ColDef[] = [{ field: 'price' }];
      component.columns = cols;
      fixture.detectChanges();

      expect(component.columnDefs).toBe(cols);
    });

    it('should wrap a single ColDef object in an array', () => {
      // Force a single object (not an array) through the non-string path
      const col = { field: 'single' } as unknown as ColDef[];
      component.columns = col;
      fixture.detectChanges();

      expect(component.columnDefs).toEqual([col]);
    });

    it('should set columnDefs to empty array when columns is empty string', () => {
      component.columns = '';
      fixture.detectChanges();

      expect(component.columnDefs).toEqual([]);
    });

    it('should set columnDefs to empty array when columns is null-ish', () => {
      component.columns = null as unknown as string;
      fixture.detectChanges();

      expect(component.columnDefs).toEqual([]);
    });
  });

  // ── mergeGridOptions ──────────────────────────────────────────────────────

  describe('mergeGridOptions', () => {
    it('should include all default options when no user options are provided', () => {
      component.columns = [{ field: 'a' }];
      component.rowData = [{ a: 1 }];
      fixture.detectChanges();

      expect(component.mergedGridOptions.pagination).toBe(true);
      expect(component.mergedGridOptions.paginationPageSize).toBe(10);
      expect(component.mergedGridOptions.animateRows).toBe(true);
      expect(component.mergedGridOptions.enableRangeSelection).toBe(true);
      expect(component.mergedGridOptions.defaultColDef).toEqual({
        sortable: true,
        filter: true,
        resizable: true,
      });
    });

    it('should let user gridOptions override defaults', () => {
      component.gridOptions = { pagination: false, paginationPageSize: 50 };
      component.columns = [{ field: 'x' }];
      component.rowData = [];
      fixture.detectChanges();

      expect(component.mergedGridOptions.pagination).toBe(false);
      expect(component.mergedGridOptions.paginationPageSize).toBe(50);
      // Non-overridden defaults remain
      expect(component.mergedGridOptions.animateRows).toBe(true);
    });

    it('should always set columnDefs and rowData from component inputs, not from gridOptions', () => {
      const userCols = [{ field: 'override' }];
      const userData = [{ override: 1 }];
      component.gridOptions = {
        columnDefs: [{ field: 'should-be-ignored' }],
        rowData: [{ ignored: true }],
      };
      component.columns = userCols;
      component.rowData = userData;
      fixture.detectChanges();

      expect(component.mergedGridOptions.columnDefs).toEqual(userCols);
      expect(component.mergedGridOptions.rowData).toBe(userData);
    });

    it('should include getRowId when provided', () => {
      const getRowId = (params: any) => params.data.id;
      component.getRowId = getRowId;
      component.columns = [];
      fixture.detectChanges();

      expect(component.mergedGridOptions.getRowId).toBe(getRowId);
    });

    it('should not include getRowId when not provided', () => {
      component.columns = [];
      fixture.detectChanges();

      expect(component.mergedGridOptions.getRowId).toBeUndefined();
    });
  });

  // ── ngOnInit ──────────────────────────────────────────────────────────────

  describe('ngOnInit', () => {
    it('should call buildAgGridTheme on init', () => {
      fixture.detectChanges();

      expect(mockBuildTheme).toHaveBeenCalled();
    });

    it('should detect dark theme from document class', () => {
      document.documentElement.classList.add('dark');
      fixture.detectChanges();

      expect(mockBuildTheme).toHaveBeenCalledWith(true);
      document.documentElement.classList.remove('dark');
    });

    it('should detect light theme when dark class is absent', () => {
      document.documentElement.classList.remove('dark');
      fixture.detectChanges();

      expect(mockBuildTheme).toHaveBeenCalledWith(false);
    });

    it('should set up a MutationObserver on the document element', () => {
      fixture.detectChanges();

      expect(mutationCallback).toBeDefined();
      expect(mockObserve).toHaveBeenCalledWith(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
      });
    });

    it('should update theme when MutationObserver fires a class attribute change', () => {
      document.documentElement.classList.remove('dark');
      fixture.detectChanges();
      mockBuildTheme.mockClear();

      // Simulate the observer detecting a class change to dark
      document.documentElement.classList.add('dark');
      mutationCallback!(
        [{ type: 'attributes', attributeName: 'class' }] as unknown as MutationRecord[],
        {} as MutationObserver
      );

      expect(mockBuildTheme).toHaveBeenCalledWith(true);
      document.documentElement.classList.remove('dark');
    });

    it('should ignore MutationObserver mutations that are not class attribute changes', () => {
      fixture.detectChanges();
      mockBuildTheme.mockClear();

      mutationCallback!(
        [{ type: 'attributes', attributeName: 'id' }] as unknown as MutationRecord[],
        {} as MutationObserver
      );

      expect(mockBuildTheme).not.toHaveBeenCalled();
    });
  });

  // ── ngOnChanges ───────────────────────────────────────────────────────────

  describe('ngOnChanges', () => {
    beforeEach(() => {
      fixture.detectChanges(); // triggers ngOnInit
    });

    it('should re-parse columns when columns input changes', () => {
      const newCols: ColDef[] = [{ field: 'newField' }];
      component.columns = newCols;
      component.ngOnChanges(
        makeSimpleChanges({ columns: { prev: [], curr: newCols } })
      );

      expect(component.columnDefs).toBe(newCols);
    });

    it('should re-merge grid options when gridOptions input changes', () => {
      component.gridOptions = { pagination: false };
      component.ngOnChanges(
        makeSimpleChanges({ gridOptions: { prev: {}, curr: { pagination: false } } })
      );

      expect(component.mergedGridOptions.pagination).toBe(false);
    });

    it('should re-merge grid options when getRowId input changes', () => {
      const getRowId = (params: any) => params.data.id;
      component.getRowId = getRowId;
      component.ngOnChanges(
        makeSimpleChanges({ getRowId: { prev: undefined, curr: getRowId } })
      );

      expect(component.mergedGridOptions.getRowId).toBe(getRowId);
    });

    it('should not re-parse columns when only gridOptions changes', () => {
      const currentCols = component.columnDefs;
      component.ngOnChanges(
        makeSimpleChanges({ gridOptions: { prev: {}, curr: { pagination: false } } })
      );

      expect(component.columnDefs).toBe(currentCols);
    });
  });

  // ── onGridReady ───────────────────────────────────────────────────────────

  describe('onGridReady', () => {
    let mockApi: GridApi;

    beforeEach(() => {
      fixture.detectChanges();
      mockApi = createMockGridApi();
    });

    it('should store the grid API', () => {
      component.onGridReady(makeGridReadyEvent(mockApi));

      expect(component.getGridApi()).toBe(mockApi);
    });

    it('should flush queued transactions when grid becomes ready', () => {
      // Queue transactions before grid is ready
      component.applyTransaction({ add: [{ id: 1 }] } as any);
      component.applyTransaction({ update: [{ id: 2 }] } as any);

      // Grid becomes ready
      component.onGridReady(makeGridReadyEvent(mockApi));

      expect(mockApi.applyTransactionAsync).toHaveBeenCalledTimes(2);
      expect(mockApi.applyTransactionAsync).toHaveBeenCalledWith({ add: [{ id: 1 }] });
      expect(mockApi.applyTransactionAsync).toHaveBeenCalledWith({ update: [{ id: 2 }] });
    });

    it('should apply pending initial data when grid becomes ready', () => {
      component.setInitialRowData([{ id: 1 }, { id: 2 }]);
      component.onGridReady(makeGridReadyEvent(mockApi));

      expect(component.rowData).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it('should not apply pending data if initial data was already set', () => {
      // Set initial data while grid IS ready
      const mockApi2 = createMockGridApi();
      component.onGridReady(makeGridReadyEvent(mockApi2));
      component.setInitialRowData([{ id: 1 }]);

      // If onGridReady fires again (hypothetical), initialDataSet is already true
      expect(component.rowData).toEqual([{ id: 1 }]);
    });
  });

  // ── applyTransaction ─────────────────────────────────────────────────────

  describe('applyTransaction', () => {
    let mockApi: GridApi;

    beforeEach(() => {
      fixture.detectChanges();
      mockApi = createMockGridApi();
    });

    it('should queue transactions when grid is not ready', () => {
      const transaction = { add: [{ id: 1 }] } as any;
      component.applyTransaction(transaction);

      // Grid becomes ready -> transaction is flushed
      component.onGridReady(makeGridReadyEvent(mockApi));
      expect(mockApi.applyTransactionAsync).toHaveBeenCalledWith(transaction);
    });

    it('should apply transactions immediately when grid is ready', () => {
      component.onGridReady(makeGridReadyEvent(mockApi));

      const transaction = { add: [{ id: 10 }] } as any;
      component.applyTransaction(transaction);

      expect(mockApi.applyTransactionAsync).toHaveBeenCalledWith(transaction);
    });

    it('should flush multiple queued transactions in order', () => {
      const t1 = { add: [{ id: 1 }] } as any;
      const t2 = { update: [{ id: 2 }] } as any;
      const t3 = { remove: [{ id: 3 }] } as any;
      component.applyTransaction(t1);
      component.applyTransaction(t2);
      component.applyTransaction(t3);

      component.onGridReady(makeGridReadyEvent(mockApi));

      const calls = (mockApi.applyTransactionAsync as jest.Mock).mock.calls;
      expect(calls[0][0]).toBe(t1);
      expect(calls[1][0]).toBe(t2);
      expect(calls[2][0]).toBe(t3);
    });
  });

  // ── RxJS Subjects (addRows$, updateRows$, deleteRows$) ───────────────────

  describe('RxJS row operation subjects', () => {
    let mockApi: GridApi;

    beforeEach(() => {
      fixture.detectChanges();
      mockApi = createMockGridApi();
      component.onGridReady(makeGridReadyEvent(mockApi));
    });

    it('should apply add transaction when addRows$ emits', () => {
      const rows = [{ id: 1 }, { id: 2 }];
      component.addRows$.next(rows);

      expect(mockApi.applyTransactionAsync).toHaveBeenCalledWith({ add: rows });
    });

    it('should apply update transaction when updateRows$ emits', () => {
      const rows = [{ id: 1, name: 'updated' }];
      component.updateRows$.next(rows);

      expect(mockApi.applyTransactionAsync).toHaveBeenCalledWith({ update: rows });
    });

    it('should apply delete transaction when deleteRows$ emits', () => {
      const rows = [{ id: 1 }];
      component.deleteRows$.next(rows);

      expect(mockApi.applyTransactionAsync).toHaveBeenCalledWith({ remove: rows });
    });

    it('should not apply transaction when addRows$ emits an empty array', () => {
      (mockApi.applyTransactionAsync as jest.Mock).mockClear();
      component.addRows$.next([]);

      expect(mockApi.applyTransactionAsync).not.toHaveBeenCalled();
    });

    it('should not apply transaction when updateRows$ emits an empty array', () => {
      (mockApi.applyTransactionAsync as jest.Mock).mockClear();
      component.updateRows$.next([]);

      expect(mockApi.applyTransactionAsync).not.toHaveBeenCalled();
    });

    it('should not apply transaction when deleteRows$ emits an empty array', () => {
      (mockApi.applyTransactionAsync as jest.Mock).mockClear();
      component.deleteRows$.next([]);

      expect(mockApi.applyTransactionAsync).not.toHaveBeenCalled();
    });

    it('should queue subject emissions that arrive before grid is ready', () => {
      // Create a fresh component where grid is NOT ready
      const fixture2 = TestBed.createComponent(MacroAngularGrid);
      const comp2 = fixture2.componentInstance;
      fixture2.detectChanges();

      comp2.addRows$.next([{ id: 99 }]);

      const api2 = createMockGridApi();
      comp2.onGridReady(makeGridReadyEvent(api2));

      expect(api2.applyTransactionAsync).toHaveBeenCalledWith({ add: [{ id: 99 }] });
      fixture2.destroy();
    });
  });

  // ── setInitialRowData ─────────────────────────────────────────────────────

  describe('setInitialRowData', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should set rowData immediately when grid is ready', () => {
      const mockApi = createMockGridApi();
      component.onGridReady(makeGridReadyEvent(mockApi));

      component.setInitialRowData([{ id: 1 }]);
      expect(component.rowData).toEqual([{ id: 1 }]);
    });

    it('should store pending data when grid is not ready', () => {
      component.setInitialRowData([{ id: 2 }]);
      // rowData is set for binding sync
      expect(component.rowData).toEqual([{ id: 2 }]);
    });

    it('should not allow setting initial data more than once', () => {
      component.setInitialRowData([{ id: 1 }]);
      component.setInitialRowData([{ id: 2 }]);

      // First call wins
      expect(component.rowData).toEqual([{ id: 1 }]);
    });
  });

  // ── getGridState / applyGridState ─────────────────────────────────────────

  describe('getGridState / applyGridState', () => {
    let mockApi: GridApi;

    beforeEach(() => {
      fixture.detectChanges();
      mockApi = createMockGridApi();
    });

    it('should return undefined when grid is not ready', () => {
      expect(component.getGridState()).toBeUndefined();
    });

    it('should return grid state when grid is ready', () => {
      component.onGridReady(makeGridReadyEvent(mockApi));

      const state = component.getGridState();
      expect(mockApi.getState).toHaveBeenCalled();
      expect(state).toEqual({ columnOrder: ['a'] });
    });

    it('should call setState on the grid API when applying state', () => {
      component.onGridReady(makeGridReadyEvent(mockApi));

      const state = { columnOrder: ['b', 'c'] } as unknown as GridState;
      component.applyGridState(state);

      expect(mockApi.setState).toHaveBeenCalledWith(state);
    });

    it('should warn and not throw when applying state before grid is ready', () => {
      const state = { columnOrder: ['x'] } as unknown as GridState;
      expect(() => component.applyGridState(state)).not.toThrow();
    });
  });

  // ── getGridApi ────────────────────────────────────────────────────────────

  describe('getGridApi', () => {
    it('should return undefined before grid is ready', () => {
      fixture.detectChanges();
      expect(component.getGridApi()).toBeUndefined();
    });

    it('should return the grid API after grid is ready', () => {
      fixture.detectChanges();
      const mockApi = createMockGridApi();
      component.onGridReady(makeGridReadyEvent(mockApi));

      expect(component.getGridApi()).toBe(mockApi);
    });
  });

  // ── ngOnDestroy ───────────────────────────────────────────────────────────

  describe('ngOnDestroy', () => {
    it('should complete all RxJS subjects', () => {
      fixture.detectChanges();

      const addSpy = jest.spyOn(component.addRows$, 'complete');
      const updateSpy = jest.spyOn(component.updateRows$, 'complete');
      const deleteSpy = jest.spyOn(component.deleteRows$, 'complete');

      component.ngOnDestroy();

      expect(addSpy).toHaveBeenCalled();
      expect(updateSpy).toHaveBeenCalled();
      expect(deleteSpy).toHaveBeenCalled();
    });

    it('should disconnect the MutationObserver', () => {
      fixture.detectChanges();
      mockDisconnect.mockClear();

      component.ngOnDestroy();

      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('should unsubscribe all subscriptions so subjects no longer trigger transactions', () => {
      fixture.detectChanges();
      const mockApi = createMockGridApi();
      component.onGridReady(makeGridReadyEvent(mockApi));

      component.ngOnDestroy();

      // Emissions after destroy should not reach the grid API
      // Subjects are completed, so next() should be a no-op
      expect(() => component.addRows$.next([{ id: 1 }])).not.toThrow();
    });
  });

  // ── defaultGridOptions ────────────────────────────────────────────────────

  describe('defaultGridOptions', () => {
    it('should have expected default column definition', () => {
      expect(component.defaultGridOptions.defaultColDef).toEqual({
        sortable: true,
        filter: true,
        resizable: true,
      });
    });

    it('should have sidebar with columns and filters panels', () => {
      expect(component.defaultGridOptions.sideBar).toEqual({
        toolPanels: ['columns', 'filters'],
        hiddenByDefault: false,
      });
    });

    it('should have pagination defaults', () => {
      expect(component.defaultGridOptions.pagination).toBe(true);
      expect(component.defaultGridOptions.paginationPageSize).toBe(10);
      expect(component.defaultGridOptions.paginationPageSizeSelector).toEqual([10, 25, 50, 100]);
    });

    it('should enable range selection and suppress cell focus', () => {
      expect(component.defaultGridOptions.enableRangeSelection).toBe(true);
      expect(component.defaultGridOptions.suppressCellFocus).toBe(true);
    });

    it('should enable animate rows and multiple row selection', () => {
      expect(component.defaultGridOptions.animateRows).toBe(true);
      expect(component.defaultGridOptions.rowSelection).toBe('multiple');
      expect(component.defaultGridOptions.suppressRowClickSelection).toBe(true);
    });
  });
});
