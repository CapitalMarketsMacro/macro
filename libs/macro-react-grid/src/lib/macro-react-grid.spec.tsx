import { render, act, cleanup, fireEvent } from '@testing-library/react';
import { createRef, type ComponentType } from 'react';
import { vi, describe, it, expect, beforeEach, afterEach, type Mock } from 'vitest';
import { GridApi, GridState, GridReadyEvent, ColDef } from 'ag-grid-community';

// ── Mocks ────────────────────────────────────────────────────────────────────

// Track the onGridReady callback passed to AgGridReact so we can fire it
let capturedOnGridReady: ((event: GridReadyEvent) => void) | undefined;
let capturedProps: Record<string, unknown> = {};

vi.mock('ag-grid-react', () => ({
  AgGridReact: (props: Record<string, unknown>) => {
    capturedOnGridReady = props.onGridReady as any;
    capturedProps = props;
    return <div data-testid="ag-grid-mock" />;
  },
}));

vi.mock('ag-grid-community', async () => {
  return {
    ModuleRegistry: { registerModules: vi.fn() },
    AllCommunityModule: {},
    ColDef: {},
    GridOptions: {},
    GridReadyEvent: {},
    GridApi: vi.fn(),
    GridState: {},
    GetRowIdParams: {},
    RowNodeTransaction: {},
    Theme: {},
  };
});

vi.mock('ag-grid-enterprise', () => ({
  AllEnterpriseModule: {},
  IntegratedChartsModule: { with: vi.fn().mockReturnValue({}) },
}));

vi.mock('ag-charts-enterprise', () => ({
  AgChartsEnterpriseModule: {},
}));

const mockBuildTheme = vi.fn().mockReturnValue('mock-theme');
vi.mock('@macro/macro-design', () => ({
  buildAgGridTheme: (...args: unknown[]) => mockBuildTheme(...args),
}));

// ── Global MutationObserver mock ─────────────────────────────────────────────

let mutationCallback: MutationCallback | undefined;
let observerDisconnectSpy: Mock;
let observerObserveSpy: Mock;

class MockMutationObserver {
  observe: Mock;
  disconnect: Mock;
  takeRecords = vi.fn().mockReturnValue([]);
  constructor(cb: MutationCallback) {
    mutationCallback = cb;
    this.observe = vi.fn();
    this.disconnect = vi.fn();
    observerObserveSpy = this.observe;
    observerDisconnectSpy = this.disconnect;
  }
}

vi.stubGlobal('MutationObserver', MockMutationObserver);

// ── Imports (after mocks) ────────────────────────────────────────────────────

import MacroReactGrid, { MacroReactGridRef } from './macro-react-grid';

// ── Helpers ──────────────────────────────────────────────────────────────────

function createMockGridApi(overrides: Partial<GridApi> = {}): GridApi {
  return {
    applyTransactionAsync: vi.fn(),
    getState: vi.fn().mockReturnValue({ columnOrder: ['a'] } as unknown as GridState),
    setState: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    refreshCells: vi.fn(),
    getColumn: vi.fn().mockReturnValue(null),
    getColumns: vi.fn().mockReturnValue([]),
    getColumnDefs: vi.fn().mockReturnValue([]),
    getColumnState: vi.fn().mockReturnValue([]),
    applyColumnState: vi.fn(),
    setGridOption: vi.fn(),
    ...overrides,
  } as unknown as GridApi;
}

function fireGridReady(api: GridApi) {
  act(() => {
    capturedOnGridReady?.({ api, type: 'gridReady' } as unknown as GridReadyEvent);
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('MacroReactGrid', () => {
  beforeEach(() => {
    capturedOnGridReady = undefined;
    capturedProps = {};
    mutationCallback = undefined;
    mockBuildTheme.mockClear();
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    cleanup();
  });

  // ── Basic rendering ─────────────────────────────────────────────────────

  it('should render successfully', () => {
    const { baseElement } = render(<MacroReactGrid />);
    expect(baseElement).toBeTruthy();
  });

  it('should render the mock AgGridReact', () => {
    const { getByTestId } = render(<MacroReactGrid />);
    expect(getByTestId('ag-grid-mock')).toBeTruthy();
  });

  it('should have displayName set', () => {
    expect(MacroReactGrid.displayName).toBe('MacroReactGrid');
  });

  // ── Column parsing ────────────────────────────────────────────────────────

  describe('column parsing', () => {
    it('should parse a valid JSON string into an array of ColDef', () => {
      const cols: ColDef[] = [
        { field: 'name', headerName: 'Name' },
        { field: 'age', headerName: 'Age' },
      ];
      render(<MacroReactGrid columns={JSON.stringify(cols)} />);

      expect(capturedProps.columnDefs).toEqual(cols);
    });

    it('should wrap a single JSON object in an array', () => {
      const col: ColDef = { field: 'name' };
      render(<MacroReactGrid columns={JSON.stringify(col)} />);

      expect(capturedProps.columnDefs).toEqual([col]);
    });

    it('should return empty array for invalid JSON string', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      render(<MacroReactGrid columns="{ broken json !!!" />);

      expect(capturedProps.columnDefs).toEqual([]);
      consoleSpy.mockRestore();
    });

    it('should use a ColDef array directly', () => {
      const cols: ColDef[] = [{ field: 'price' }];
      render(<MacroReactGrid columns={cols} />);

      expect(capturedProps.columnDefs).toEqual(cols);
    });

    it('should wrap a single ColDef object in an array', () => {
      // Force a single object through the non-array non-string path
      const col = { field: 'single' } as unknown as ColDef[];
      render(<MacroReactGrid columns={col} />);

      expect(capturedProps.columnDefs).toEqual([col]);
    });

    it('should produce empty array when columns is empty string', () => {
      render(<MacroReactGrid columns="" />);

      expect(capturedProps.columnDefs).toEqual([]);
    });

    it('should produce empty array when columns is undefined', () => {
      render(<MacroReactGrid />);

      expect(capturedProps.columnDefs).toEqual([]);
    });
  });

  // ── AG Grid 36 auto-generation passthrough ────────────────────────────────

  describe('autoGenerateColumnDefs passthrough', () => {
    it('omits columnDefs (prop + gridOptions) when auto-gen is on and no columns are supplied', () => {
      render(<MacroReactGrid gridOptions={{ autoGenerateColumnDefs: true }} rowData={[{ a: 1 }]} />);

      expect(capturedProps.columnDefs).toBeUndefined();
      const opts = capturedProps.gridOptions as Record<string, unknown>;
      expect(opts.columnDefs).toBeUndefined();
      expect(opts.autoGenerateColumnDefs).toBe(true);
    });

    it('still binds columnDefs when columns ARE supplied (auto-gen gate requires empty columns)', () => {
      render(<MacroReactGrid gridOptions={{ autoGenerateColumnDefs: true }} columns={[{ field: 'a' }]} />);

      expect(capturedProps.columnDefs).toEqual([{ field: 'a' }]);
    });

    it('binds columnDefs normally when auto-gen is off (default — unchanged)', () => {
      render(<MacroReactGrid columns={[{ field: 'a' }]} rowData={[{ a: 1 }]} />);

      expect(capturedProps.columnDefs).toEqual([{ field: 'a' }]);
    });
  });

  // ── Options merging ───────────────────────────────────────────────────────

  describe('options merging', () => {
    it('should include default options when no user options are provided', () => {
      render(<MacroReactGrid columns={[{ field: 'a' }]} rowData={[{ a: 1 }]} />);

      const opts = capturedProps.gridOptions as Record<string, unknown>;
      expect(opts.pagination).toBe(false);
      expect(opts.paginationPageSize).toBe(10);
      expect(opts.animateRows).toBe(true);
      expect(opts.cellSelection).toBe(true);
      expect(opts.rowSelection).toEqual({ mode: 'multiRow', checkboxes: false, enableClickSelection: false });
      expect(opts.defaultColDef).toEqual({
        sortable: true,
        filter: true,
        resizable: true,
        enableRowGroup: true,
        enableValue: true,
        enablePivot: true,
        enableShowValuesAs: true,
      });
      // Pagination/grouping/pivot default OFF, with status-bar toggles to enable them — plus
      // native row-count and aggregation (Count/Sum/Min/Max/Avg) status panels.
      expect(opts.rowGroupPanelShow).toBe('never');
      expect(opts.pivotPanelShow).toBe('always');
      const panels = (opts.statusBar as { statusPanels: { statusPanel: string }[] }).statusPanels.map(
        (p) => p.statusPanel,
      );
      expect(panels).toEqual(
        expect.arrayContaining([
          'agTotalAndFilteredRowCountComponent',
          'agSelectedRowCountComponent',
          'agAggregationComponent',
          'macroQuickFilterToggle',
          'macroAdvancedFilterToggle',
          'macroGroupingToggle',
          'macroPivotToggle',
          'macroPaginationToggle',
        ]),
      );
      const components = capturedProps.components as Record<string, unknown>;
      expect(components['macroGroupingToggle']).toBeDefined();
      expect(components['macroPivotToggle']).toBeDefined();
      expect(components['macroQuickFilterToggle']).toBeDefined();
      expect(components['macroAdvancedFilterToggle']).toBeDefined();
    });

    it('adds Excel-style decimal step items to the column + context menus for numeric columns only', () => {
      render(<MacroReactGrid />);
      const opts = capturedProps.gridOptions as Record<string, any>;

      const numericApi = createMockGridApi({
        forEachNodeAfterFilterAndSort: vi.fn((cb: any) => cb({ group: false, data: { px: 1.5 } })),
        getCellValue: vi.fn(({ useFormatter }: any) => (useFormatter ? '1.50' : 1.5)),
      } as Partial<GridApi>);
      const column = { getColId: () => 'px' };

      const main = opts.getMainMenuItems({ api: numericApi, column, defaultItems: ['pinSubMenu'] });
      expect(main[0]).toBe('pinSubMenu');
      expect(main).toContain('separator');
      expect(main.map((i: any) => i?.name)).toEqual(
        expect.arrayContaining(['Increase Decimals', 'Decrease Decimals']),
      );

      const ctx = opts.getContextMenuItems({ api: numericApi, column, defaultItems: ['copy'] });
      expect((ctx[0] as any).name).toBe('Increase Decimals');
      expect(ctx).toContain('copy');

      const textApi = createMockGridApi({
        forEachNodeAfterFilterAndSort: vi.fn((cb: any) => cb({ group: false, data: { sym: 'EURUSD' } })),
        getCellValue: vi.fn(() => 'EURUSD'),
      } as Partial<GridApi>);
      const mainText = opts.getMainMenuItems({
        api: textApi, column: { getColId: () => 'sym' }, defaultItems: ['pinSubMenu'],
      });
      expect(mainText).toEqual(['pinSubMenu']);
    });

    it('should let user gridOptions override defaults', () => {
      render(
        <MacroReactGrid
          columns={[{ field: 'x' }]}
          gridOptions={{ pagination: true, paginationPageSize: 50 }}
        />
      );

      const opts = capturedProps.gridOptions as Record<string, unknown>;
      expect(opts.pagination).toBe(true);
      expect(opts.paginationPageSize).toBe(50);
      // Non-overridden default
      expect(opts.animateRows).toBe(true);
    });

    it('should always use columnDefs and rowData from props, not gridOptions', () => {
      const userCols: ColDef[] = [{ field: 'mine' }];
      const userData = [{ mine: 1 }];
      render(
        <MacroReactGrid
          columns={userCols}
          rowData={userData}
          gridOptions={{
            columnDefs: [{ field: 'ignored' }],
            rowData: [{ ignored: true }],
          }}
        />
      );

      const opts = capturedProps.gridOptions as Record<string, unknown>;
      expect(opts.columnDefs).toEqual(userCols);
      expect(opts.rowData).toBe(userData);
    });

    it('should include getRowId when provided', () => {
      const getRowId = (params: any) => params.data.id;
      render(<MacroReactGrid getRowId={getRowId} />);

      const opts = capturedProps.gridOptions as Record<string, unknown>;
      expect(opts.getRowId).toBe(getRowId);
    });

    it('should not include getRowId when not provided', () => {
      render(<MacroReactGrid />);

      const opts = capturedProps.gridOptions as Record<string, unknown>;
      expect(opts.getRowId).toBeUndefined();
    });
  });

  // ── Theme detection ───────────────────────────────────────────────────────

  describe('theme detection', () => {
    it('should call buildAgGridTheme with false for light mode', () => {
      document.documentElement.classList.remove('dark');
      render(<MacroReactGrid />);

      expect(mockBuildTheme).toHaveBeenCalledWith(false);
    });

    it('should call buildAgGridTheme with true for dark mode', () => {
      document.documentElement.classList.add('dark');
      render(<MacroReactGrid />);

      expect(mockBuildTheme).toHaveBeenCalledWith(true);
    });

    it('should set up a MutationObserver on mount', () => {
      render(<MacroReactGrid />);

      expect(mutationCallback).toBeDefined();
    });

    it('should update theme when MutationObserver fires a class change', () => {
      document.documentElement.classList.remove('dark');
      render(<MacroReactGrid />);
      mockBuildTheme.mockClear();

      // Simulate the observer detecting a class change to dark
      document.documentElement.classList.add('dark');
      act(() => {
        mutationCallback!(
          [{ type: 'attributes', attributeName: 'class' }] as unknown as MutationRecord[],
          {} as MutationObserver
        );
      });

      expect(mockBuildTheme).toHaveBeenCalledWith(true);
    });

    it('should observe only class attribute changes via attributeFilter', () => {
      render(<MacroReactGrid />);

      // The observer is configured with attributeFilter: ['class'],
      // so only class mutations are delivered by the browser.
      // Verify the observer was set up with the correct config.
      expect(observerObserveSpy).toHaveBeenCalledWith(
        document.documentElement,
        expect.objectContaining({ attributes: true, attributeFilter: ['class'] })
      );
    });

    it('should pass theme to AgGridReact', () => {
      render(<MacroReactGrid />);

      expect(capturedProps.theme).toBe('mock-theme');
    });
  });

  // ── Ref methods ───────────────────────────────────────────────────────────

  describe('ref methods', () => {
    it('should expose getGridApi that returns undefined before grid is ready', () => {
      const ref = createRef<MacroReactGridRef>();
      render(<MacroReactGrid ref={ref} />);

      expect(ref.current?.getGridApi()).toBeUndefined();
    });

    it('should expose getGridApi that returns the API after grid is ready', () => {
      const ref = createRef<MacroReactGridRef>();
      render(<MacroReactGrid ref={ref} />);

      const mockApi = createMockGridApi();
      fireGridReady(mockApi);

      expect(ref.current?.getGridApi()).toBe(mockApi);
    });

    it('should expose applyTransaction that calls applyTransactionAsync', () => {
      const ref = createRef<MacroReactGridRef>();
      render(<MacroReactGrid ref={ref} />);

      const mockApi = createMockGridApi();
      fireGridReady(mockApi);

      const transaction = { add: [{ id: 1 }] } as any;
      ref.current?.applyTransaction(transaction);

      expect(mockApi.applyTransactionAsync).toHaveBeenCalledWith(transaction);
    });

    it('should throw from applyTransaction when grid is not ready', () => {
      const ref = createRef<MacroReactGridRef>();
      render(<MacroReactGrid ref={ref} />);

      expect(() =>
        ref.current?.applyTransaction({ add: [{ id: 1 }] } as any)
      ).toThrow('Grid API not available');
    });

    it('should expose getGridState that delegates to gridApi.getState', () => {
      const ref = createRef<MacroReactGridRef>();
      render(<MacroReactGrid ref={ref} />);

      const mockApi = createMockGridApi();
      fireGridReady(mockApi);

      const state = ref.current?.getGridState();
      expect(mockApi.getState).toHaveBeenCalled();
      expect(state).toEqual({ columnOrder: ['a'] });
    });

    it('should return undefined from getGridState when grid is not ready', () => {
      const ref = createRef<MacroReactGridRef>();
      render(<MacroReactGrid ref={ref} />);

      expect(ref.current?.getGridState()).toBeUndefined();
    });

    it('should expose applyGridState that delegates to gridApi.setState', () => {
      const ref = createRef<MacroReactGridRef>();
      render(<MacroReactGrid ref={ref} />);

      const mockApi = createMockGridApi();
      fireGridReady(mockApi);

      const state = { columnOrder: ['b', 'c'] } as unknown as GridState;
      ref.current?.applyGridState(state);

      expect(mockApi.setState).toHaveBeenCalledWith(state);
    });

    it('should not throw from applyGridState when grid is not ready', () => {
      const ref = createRef<MacroReactGridRef>();
      render(<MacroReactGrid ref={ref} />);

      const state = { columnOrder: ['x'] } as unknown as GridState;
      expect(() => ref.current?.applyGridState(state)).not.toThrow();
    });

    it('round-trips calculated columns through applyGridState/getGridState', () => {
      const ref = createRef<MacroReactGridRef>();
      render(<MacroReactGrid ref={ref} />);
      const mockApi = createMockGridApi();
      fireGridReady(mockApi);

      act(() => {
        ref.current?.applyGridState({
          columnOrder: ['a'],
          calculatedColumns: { defs: [{ colId: 'spread', calculatedExpression: '[bid] - [ask]' }] },
        });
      });

      expect(mockApi.setGridOption).toHaveBeenCalledWith(
        'columnDefs',
        expect.arrayContaining([
          expect.objectContaining({ colId: 'spread', calculatedExpression: '[bid] - [ask]' }),
        ]),
      );
      expect(ref.current?.getGridState().calculatedColumns).toEqual({
        defs: [{ colId: 'spread', calculatedExpression: '[bid] - [ask]' }],
      });
    });

    it('captures Show Values As selections from column state into getGridState', () => {
      const ref = createRef<MacroReactGridRef>();
      render(<MacroReactGrid ref={ref} />);
      const mockApi = createMockGridApi({
        getColumnState: vi.fn().mockReturnValue([
          { colId: 'pnl', showValuesAs: 'percentOfGrandTotal' },
          { colId: 'dv01' },
        ]),
      } as Partial<GridApi>);
      fireGridReady(mockApi);

      expect(ref.current?.getGridState().showValuesAs).toEqual([
        { colId: 'pnl', showValuesAs: 'percentOfGrandTotal' },
      ]);
    });

    it('re-applies persisted Show Values As selections via applyColumnState', () => {
      const ref = createRef<MacroReactGridRef>();
      render(<MacroReactGrid ref={ref} />);
      const mockApi = createMockGridApi();
      fireGridReady(mockApi);

      act(() => {
        ref.current?.applyGridState({
          columnOrder: ['a'],
          showValuesAs: [{ colId: 'pnl', showValuesAs: 'percentOfParentRowTotal' }],
        });
      });

      expect(mockApi.applyColumnState).toHaveBeenCalledWith({
        state: [{ colId: 'pnl', showValuesAs: 'percentOfParentRowTotal' }],
      });
      expect((mockApi.setState as ReturnType<typeof vi.fn>).mock.calls[0][0]).not.toHaveProperty('showValuesAs');
    });
  });

  // ── RxJS Subjects on ref ──────────────────────────────────────────────────

  describe('RxJS Subjects on ref', () => {
    it('should expose addRows$, updateRows$, deleteRows$ subjects', () => {
      const ref = createRef<MacroReactGridRef>();
      render(<MacroReactGrid ref={ref} />);

      expect(ref.current?.addRows$).toBeDefined();
      expect(ref.current?.updateRows$).toBeDefined();
      expect(ref.current?.deleteRows$).toBeDefined();
    });

    it('should apply add transaction when addRows$ emits and grid is ready', () => {
      const ref = createRef<MacroReactGridRef>();
      render(<MacroReactGrid ref={ref} />);

      const mockApi = createMockGridApi();
      fireGridReady(mockApi);

      act(() => {
        ref.current?.addRows$.next([{ id: 1 }, { id: 2 }]);
      });

      expect(mockApi.applyTransactionAsync).toHaveBeenCalledWith({
        add: [{ id: 1 }, { id: 2 }],
      });
    });

    it('should apply update transaction when updateRows$ emits and grid is ready', () => {
      const ref = createRef<MacroReactGridRef>();
      render(<MacroReactGrid ref={ref} />);

      const mockApi = createMockGridApi();
      fireGridReady(mockApi);

      act(() => {
        ref.current?.updateRows$.next([{ id: 1, name: 'updated' }]);
      });

      expect(mockApi.applyTransactionAsync).toHaveBeenCalledWith({
        update: [{ id: 1, name: 'updated' }],
      });
    });

    it('should apply remove transaction when deleteRows$ emits and grid is ready', () => {
      const ref = createRef<MacroReactGridRef>();
      render(<MacroReactGrid ref={ref} />);

      const mockApi = createMockGridApi();
      fireGridReady(mockApi);

      act(() => {
        ref.current?.deleteRows$.next([{ id: 1 }]);
      });

      expect(mockApi.applyTransactionAsync).toHaveBeenCalledWith({
        remove: [{ id: 1 }],
      });
    });

    it('should not apply transaction when addRows$ emits an empty array', () => {
      const ref = createRef<MacroReactGridRef>();
      render(<MacroReactGrid ref={ref} />);

      const mockApi = createMockGridApi();
      fireGridReady(mockApi);
      (mockApi.applyTransactionAsync as Mock).mockClear();

      act(() => {
        ref.current?.addRows$.next([]);
      });

      expect(mockApi.applyTransactionAsync).not.toHaveBeenCalled();
    });

    it('should not apply transaction when subject emits but grid is not ready', () => {
      const ref = createRef<MacroReactGridRef>();
      render(<MacroReactGrid ref={ref} />);

      // Do NOT fire grid ready
      act(() => {
        ref.current?.addRows$.next([{ id: 1 }]);
      });

      // No API to call since grid is not ready
      // This test just verifies no error is thrown
      expect(true).toBe(true);
    });
  });

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  describe('cleanup on unmount', () => {
    it('should disconnect the MutationObserver on unmount', () => {
      const { unmount } = render(<MacroReactGrid />);

      unmount();

      expect(observerDisconnectSpy).toHaveBeenCalled();
    });

    it('should unsubscribe RxJS subscriptions on unmount so subjects stop triggering', () => {
      const ref = createRef<MacroReactGridRef>();
      const { unmount } = render(<MacroReactGrid ref={ref} />);

      const mockApi = createMockGridApi();
      fireGridReady(mockApi);
      (mockApi.applyTransactionAsync as Mock).mockClear();

      // Capture subjects before unmount
      const addSubject = ref.current?.addRows$;

      unmount();

      // Emissions after unmount should not trigger transactions
      // (subscriptions have been cleaned up)
      act(() => {
        addSubject?.next([{ id: 999 }]);
      });

      expect(mockApi.applyTransactionAsync).not.toHaveBeenCalled();
    });
  });

  // ── onGridReady callback ──────────────────────────────────────────────────

  describe('onGridReady', () => {
    it('should pass an onGridReady callback to AgGridReact', () => {
      render(<MacroReactGrid />);

      expect(capturedOnGridReady).toBeDefined();
      expect(typeof capturedOnGridReady).toBe('function');
    });

    it('should set gridApi when onGridReady fires', () => {
      const ref = createRef<MacroReactGridRef>();
      render(<MacroReactGrid ref={ref} />);

      expect(ref.current?.getGridApi()).toBeUndefined();

      const mockApi = createMockGridApi();
      fireGridReady(mockApi);

      expect(ref.current?.getGridApi()).toBe(mockApi);
    });
  });

  // ── Status-bar grouping / pivot toggles ───────────────────────────────────

  describe('status-bar grouping / pivot toggles', () => {
    type PanelComponent = ComponentType<{ api: GridApi }>;

    /** Render the grid once to capture the registered status-panel components. */
    function getPanel(key: string): PanelComponent {
      render(<MacroReactGrid />);
      return (capturedProps.components as Record<string, PanelComponent>)[key];
    }

    it('grouping toggle shows the row-group panel when checked (without touching existing groups)', () => {
      const Panel = getPanel('macroGroupingToggle');
      const api = createMockGridApi({ getGridOption: vi.fn().mockReturnValue('never') } as Partial<GridApi>);
      const { getByLabelText } = render(<Panel api={api} />);

      const checkbox = getByLabelText('Toggle row grouping') as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
      fireEvent.click(checkbox);

      expect(api.setGridOption).toHaveBeenCalledWith('rowGroupPanelShow', 'always');
      expect(api.applyColumnState).not.toHaveBeenCalled();
    });

    it('grouping toggle hides the panel AND clears active row groups when unchecked', () => {
      const Panel = getPanel('macroGroupingToggle');
      const api = createMockGridApi({ getGridOption: vi.fn().mockReturnValue('always') } as Partial<GridApi>);
      const { getByLabelText } = render(<Panel api={api} />);

      const checkbox = getByLabelText('Toggle row grouping') as HTMLInputElement;
      expect(checkbox.checked).toBe(true); // initialized from rowGroupPanelShow 'always'
      fireEvent.click(checkbox);

      expect(api.setGridOption).toHaveBeenCalledWith('rowGroupPanelShow', 'never');
      expect(api.applyColumnState).toHaveBeenCalledWith({ defaultState: { rowGroup: false } });
    });

    it('pivot toggle flips pivotMode', () => {
      const Panel = getPanel('macroPivotToggle');
      const api = createMockGridApi({
        getGridOption: vi.fn().mockReturnValue(false),
        isDestroyed: vi.fn().mockReturnValue(false),
      } as Partial<GridApi>);
      const { getByLabelText } = render(<Panel api={api} />);

      const checkbox = getByLabelText('Toggle pivot mode') as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
      fireEvent.click(checkbox);

      expect(api.setGridOption).toHaveBeenCalledWith('pivotMode', true);
    });

    it('pivot toggle stays in sync when pivot mode is flipped elsewhere (e.g. the columns tool panel)', () => {
      const Panel = getPanel('macroPivotToggle');
      let pivotMode = false;
      const api = createMockGridApi({
        getGridOption: vi.fn(() => pivotMode),
        isDestroyed: vi.fn().mockReturnValue(false),
      } as Partial<GridApi>);
      const { getByLabelText } = render(<Panel api={api} />);

      const [eventName, handler] = (api.addEventListener as Mock).mock.calls[0];
      expect(eventName).toBe('columnPivotModeChanged');
      pivotMode = true;
      act(() => handler());

      expect((getByLabelText('Toggle pivot mode') as HTMLInputElement).checked).toBe(true);
    });

    it('pivot toggle removes its grid event listener on unmount', () => {
      const Panel = getPanel('macroPivotToggle');
      const api = createMockGridApi({
        getGridOption: vi.fn().mockReturnValue(false),
        isDestroyed: vi.fn().mockReturnValue(false),
      } as Partial<GridApi>);
      const { unmount } = render(<Panel api={api} />);

      unmount();

      const [eventName, handler] = (api.addEventListener as Mock).mock.calls[0];
      expect(api.removeEventListener).toHaveBeenCalledWith(eventName, handler);
    });
  });

  // ── Props passed to AgGridReact ───────────────────────────────────────────

  describe('props passed to AgGridReact', () => {
    it('should pass enableCharts as true', () => {
      render(<MacroReactGrid />);

      expect(capturedProps.enableCharts).toBe(true);
    });

    it('should pass rowData to AgGridReact', () => {
      const data = [{ id: 1 }, { id: 2 }];
      render(<MacroReactGrid rowData={data} />);

      expect(capturedProps.rowData).toBe(data);
    });

    it('should pass getRowId to AgGridReact when provided', () => {
      const getRowId = (params: any) => params.data.id;
      render(<MacroReactGrid getRowId={getRowId} />);

      expect(capturedProps.getRowId).toBe(getRowId);
    });
  });
});
