import { useEffect, useMemo, useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { Subject, Subscription } from 'rxjs';
import {
  ColDef,
  GridOptions,
  GridReadyEvent,
  GridApi,
  GetRowIdParams,
  RowNodeTransaction,
  ModuleRegistry,
  AllCommunityModule,
  Theme,
  colorSchemeDarkBlue,
  colorSchemeLight,
  iconSetAlpine,
  themeAlpine,
} from 'ag-grid-community';
import {
  AllEnterpriseModule,
  IntegratedChartsModule,
} from 'ag-grid-enterprise';
import { AgChartsEnterpriseModule } from 'ag-charts-enterprise';

// Register all ag-Grid modules (Community and Enterprise)
// This ensures all features are available without requiring registration in the application
ModuleRegistry.registerModules([
  AllCommunityModule,
  AllEnterpriseModule,
  IntegratedChartsModule.with(AgChartsEnterpriseModule)
]);

export interface MacroReactGridProps {
  /**
   * Column definitions in JSON format
   * Can be a JSON string or an array of column definition objects
   */
  columns?: string | ColDef[];

  /**
   * Row data for the grid
   */
  rowData?: unknown[];

  /**
   * Grid options (optional)
   */
  gridOptions?: GridOptions;

  /**
   * Function to get row ID for each row
   * This is useful for tracking rows when data changes
   */
  getRowId?: (params: GetRowIdParams) => string;
}

export interface MacroReactGridRef {
  /**
   * Apply transaction to update grid data
   */
  applyTransaction: (transaction: RowNodeTransaction) => void;

  /**
   * Get the grid API instance
   */
  getGridApi: () => GridApi | undefined;

  /**
   * RxJS Subjects for row operations
   */
  addRows$: Subject<unknown[]>;
  updateRows$: Subject<unknown[]>;
  deleteRows$: Subject<unknown[]>;
}

/**
 * Macro React Grid Component
 * Wraps ag-Grid with support for JSON column configuration
 */
export const MacroReactGrid = forwardRef<MacroReactGridRef, MacroReactGridProps>(
  ({ columns = [], rowData = [], gridOptions = {}, getRowId }, ref) => {
    const [theme, setTheme] = useState<Theme | undefined>(undefined);
    const [gridApi, setGridApi] = useState<GridApi | undefined>(undefined);
    const subscriptionsRef = useRef<Subscription>(new Subscription());

    // RxJS Subjects for row operations
    const addRows$ = useRef(new Subject<unknown[]>()).current;
    const updateRows$ = useRef(new Subject<unknown[]>()).current;
    const deleteRows$ = useRef(new Subject<unknown[]>()).current;

  // Default grid options
  const defaultGridOptions: GridOptions = useMemo(
    () => ({
      defaultColDef: {
        sortable: true,
        filter: true,
        resizable: true,
      },
      pagination: true,
      paginationPageSize: 10,
      paginationPageSizeSelector: [10, 25, 50, 100],
      animateRows: true,
      rowSelection: 'multiple',
      suppressRowClickSelection: true,
      enableRangeSelection: true,
      suppressCellFocus: true,
    }),
    []
  );

  // Parse columns from JSON string or use array directly
  const columnDefs: ColDef[] = useMemo(() => {
    if (!columns) {
      return [];
    }

    if (typeof columns === 'string') {
      try {
        const parsed = JSON.parse(columns);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch (error) {
        console.error('Error parsing columns JSON:', error);
        return [];
      }
    } else if (Array.isArray(columns)) {
      return columns;
    } else {
      return [columns];
    }
  }, [columns]);

  // Merge user-provided grid options with defaults
  const mergedGridOptions: GridOptions = useMemo(
    () => ({
      ...defaultGridOptions,
      ...gridOptions,
      // Ensure columnDefs and rowData are not overridden by gridOptions
      columnDefs: columnDefs,
      rowData: rowData,
      // Add getRowId if provided
      ...(getRowId && { getRowId: getRowId }),
    }),
    [defaultGridOptions, gridOptions, columnDefs, rowData, getRowId]
  );

  // Expose methods and subjects via ref
  useImperativeHandle(ref, () => ({
    applyTransaction: (transaction: RowNodeTransaction) => {
      if (!gridApi) {
        throw new Error('Grid API is not available. Ensure the grid is ready before calling applyTransaction.');
      }
      gridApi.applyTransactionAsync(transaction as any);
    },
    getGridApi: () => gridApi,
    addRows$,
    updateRows$,
    deleteRows$,
  }), [gridApi, addRows$, updateRows$, deleteRows$]);

  // Initialize and update theme based on dark mode
  useEffect(() => {
    const updateTheme = () => {
      const root = document.documentElement;
      const isDark = root.classList.contains('dark');
      
      const baseTheme = themeAlpine;
      let currentTheme: Theme = baseTheme;
      currentTheme = currentTheme.withPart(iconSetAlpine);
      currentTheme = currentTheme.withPart(isDark ? colorSchemeDarkBlue : colorSchemeLight);
      currentTheme = currentTheme.withParams({
        fontFamily: 'Noto Sans',
        headerFontFamily: 'Roboto',
        cellFontFamily: 'Ubuntu',
      });
      setTheme(currentTheme);
    };

    // Initialize theme
    updateTheme();

    // Watch for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          updateTheme();
        }
      });
    });

    const root = document.documentElement;
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  // Setup subscriptions for row operations
  useEffect(() => {
    // Subscribe to addRows$ subject
    subscriptionsRef.current.add(
      addRows$.subscribe((rows) => {
        if (rows && rows.length > 0 && gridApi) {
          gridApi.applyTransactionAsync({
            add: rows as any[],
          } as RowNodeTransaction);
        }
      })
    );

    // Subscribe to updateRows$ subject
    subscriptionsRef.current.add(
      updateRows$.subscribe((rows) => {
        if (rows && rows.length > 0 && gridApi) {
          gridApi.applyTransactionAsync({
            update: rows as any[],
          } as RowNodeTransaction);
        }
      })
    );

    // Subscribe to deleteRows$ subject
    subscriptionsRef.current.add(
      deleteRows$.subscribe((rows) => {
        if (rows && rows.length > 0 && gridApi) {
          gridApi.applyTransactionAsync({
            remove: rows as any[],
          } as RowNodeTransaction);
        }
      })
    );

    // Cleanup subscriptions
    return () => {
      subscriptionsRef.current.unsubscribe();
      subscriptionsRef.current = new Subscription();
    };
  }, [gridApi, addRows$, updateRows$, deleteRows$]);

  /**
   * Grid ready event handler
   */
  const onGridReady = (event: GridReadyEvent): void => {
    setGridApi(event.api);
    console.log('AG Grid is ready', event);
  };

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <AgGridReact
        theme={theme}
        columnDefs={columnDefs}
        enableCharts={true}
        rowData={rowData}
        gridOptions={mergedGridOptions}
        getRowId={getRowId}
        onGridReady={onGridReady}
      />
    </div>
  );
  }
);

MacroReactGrid.displayName = 'MacroReactGrid';

export default MacroReactGrid;
