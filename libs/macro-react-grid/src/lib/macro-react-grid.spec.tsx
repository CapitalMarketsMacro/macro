import { render, act, cleanup } from '@testing-library/react';
import { createRef } from 'react';
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

  // ── Options merging ───────────────────────────────────────────────────────

  describe('options merging', () => {
    it('should include default options when no user options are provided', () => {
      render(<MacroReactGrid columns={[{ field: 'a' }]} rowData={[{ a: 1 }]} />);

      const opts = capturedProps.gridOptions as Record<string, unknown>;
      expect(opts.pagination).toBe(true);
      expect(opts.paginationPageSize).toBe(10);
      expect(opts.animateRows).toBe(true);
      expect(opts.enableRangeSelection).toBe(true);
      expect(opts.defaultColDef).toEqual({
        sortable: true,
        filter: true,
        resizable: true,
      });
    });

    it('should let user gridOptions override defaults', () => {
      render(
        <MacroReactGrid
          columns={[{ field: 'x' }]}
          gridOptions={{ pagination: false, paginationPageSize: 50 }}
        />
      );

      const opts = capturedProps.gridOptions as Record<string, unknown>;
      expect(opts.pagination).toBe(false);
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
