import { useEffect, useMemo, useState, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { Subject, Subscription } from 'rxjs';
import {
  ColDef,
  GridOptions,
  GridReadyEvent,
  GridApi,
  GridState,
  GetRowIdParams,
  RowNodeTransaction,
  ModuleRegistry,
  AllCommunityModule,
  Theme,
} from 'ag-grid-community';
import {
  AllEnterpriseModule,
  IntegratedChartsModule,
} from 'ag-grid-enterprise';
import { AgChartsEnterpriseModule } from 'ag-charts-enterprise';
import { buildAgGridTheme } from '@macro/macro-design';
import {
  ColumnFormatStore,
  FORMAT_TOOL_PANEL_COMPONENT,
  migrateMap,
  withFormatPanel,
  type ColumnFormatMap,
} from '@macro/macro-grid-format';
import { MacroFormatToolPanel } from '@macro/macro-grid-format/react';

ModuleRegistry.registerModules([
  AllCommunityModule,
  AllEnterpriseModule,
  IntegratedChartsModule.with(AgChartsEnterpriseModule)
]);

export interface MacroReactGridProps {
  columns?: string | ColDef[];
  rowData?: unknown[];
  gridOptions?: GridOptions;
  getRowId?: (params: GetRowIdParams) => string;
  /**
   * Optional initial column formats (colId -> spec), applied on grid ready. Lets an app seed
   * capital-markets formats declaratively; the user can change them via the Format tool panel,
   * and saved view state overrides these on restore.
   */
  columnFormats?: ColumnFormatMap;
}

export interface MacroReactGridRef {
  applyTransaction: (transaction: RowNodeTransaction) => void;
  getGridApi: () => GridApi | undefined;
  getGridState: () => any;
  applyGridState: (state: any) => void;
  addRows$: Subject<unknown[]>;
  updateRows$: Subject<unknown[]>;
  deleteRows$: Subject<unknown[]>;
}

export const MacroReactGrid = forwardRef<MacroReactGridRef, MacroReactGridProps>(
  ({ columns = [], rowData = [], gridOptions = {}, getRowId, columnFormats }, ref) => {
    const [theme, setTheme] = useState<Theme | undefined>(undefined);
    const [gridApi, setGridApi] = useState<GridApi | undefined>(undefined);
    const gridApiRef = useRef<GridApi | undefined>(undefined);
    const subscriptionsRef = useRef<Subscription>(new Subscription());
    const addRows$ = useRef(new Subject<unknown[]>()).current;
    const updateRows$ = useRef(new Subject<unknown[]>()).current;
    const deleteRows$ = useRef(new Subject<unknown[]>()).current;

    // The format store + sideBar/components are created ONCE (stable refs) so the Format tool
    // panel is never torn down on re-render.
    const storeRef = useRef<ColumnFormatStore>(undefined);
    if (!storeRef.current) storeRef.current = new ColumnFormatStore(() => gridApiRef.current);
    const store = storeRef.current;

    const reconcile = useCallback(() => store.reconcile(), [store]);

    const sideBar = useMemo(
      () => withFormatPanel({ toolPanels: ['columns', 'filters'], hiddenByDefault: false }, { store }),
      [store],
    );
    const components = useMemo(() => ({ [FORMAT_TOOL_PANEL_COMPONENT]: MacroFormatToolPanel }), []);

    const defaultGridOptions: GridOptions = useMemo(() => ({
      defaultColDef: { sortable: true, filter: true, resizable: true },
      pagination: true, paginationPageSize: 10, paginationPageSizeSelector: [10, 25, 50, 100],
      animateRows: true, rowSelection: 'multiple', suppressRowClickSelection: true,
      enableRangeSelection: true, suppressCellFocus: true,
    }), []);

    const columnDefs: ColDef[] = useMemo(() => {
      if (!columns) return [];
      if (typeof columns === 'string') {
        try { const p = JSON.parse(columns); return Array.isArray(p) ? p : [p]; }
        catch { return []; }
      }
      return Array.isArray(columns) ? columns : [columns];
    }, [columns]);

    const mergedGridOptions: GridOptions = useMemo(() => ({
      ...defaultGridOptions, ...gridOptions,
      columnDefs, rowData,
      ...(getRowId && { getRowId }),
    }), [defaultGridOptions, gridOptions, columnDefs, rowData, getRowId]);

    const onGridReady = useCallback((e: GridReadyEvent) => {
      gridApiRef.current = e.api;
      setGridApi(e.api);
      // Re-apply user formats whenever AG Grid rebuilds the column defs (e.g. the app's
      // useMemo columns change); the in-place valueFormatter mutation would otherwise be lost.
      e.api.addEventListener('displayedColumnsChanged', reconcile);
      e.api.addEventListener('newColumnsLoaded', reconcile);
      // Seed declarative initial formats (saved view state overrides these on restore).
      if (columnFormats) store.restore(migrateMap(columnFormats));
    }, [reconcile, store, columnFormats]);

    useImperativeHandle(ref, () => ({
      applyTransaction: (t: RowNodeTransaction) => {
        const api = gridApiRef.current;
        if (!api) throw new Error('Grid API not available.');
        api.applyTransactionAsync(t as any);
      },
      getGridApi: () => gridApiRef.current,
      getGridState: () => {
        const s = gridApiRef.current?.getState();
        if (!s) return undefined;
        const formats = store.serialize();
        return formats ? { ...s, columnFormats: formats } : s;
      },
      applyGridState: (state: any) => {
        const api = gridApiRef.current;
        if (!api) return;
        // Always drive the store from the saved blob — including the empty case. A saved view
        // with no `columnFormats` (user cleared every format) must REMOVE any declaratively
        // seeded formats, not let them survive; restore([]) clears them.
        const { columnFormats: cf, ...gs } = state ?? {};
        api.setState(gs as GridState);
        const map = migrateMap(cf ?? {});
        store.restore(map);
        if (Object.keys(map).some((id) => !api.getColumn(id))) {
          const handler = () => {
            store.reconcile();
            api.removeEventListener('firstDataRendered', handler);
          };
          api.addEventListener('firstDataRendered', handler);
        }
      },
      addRows$, updateRows$, deleteRows$,
    }), [store, addRows$, updateRows$, deleteRows$]);

    useEffect(() => {
      const update = () => setTheme(buildAgGridTheme(document.documentElement.classList.contains('dark')));
      update();
      const obs = new MutationObserver(() => update());
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      return () => obs.disconnect();
    }, []);

    useEffect(() => {
      const sub = subscriptionsRef.current;
      sub.add(addRows$.subscribe((r) => { if (r?.length && gridApi) gridApi.applyTransactionAsync({ add: r as any[] } as any); }));
      sub.add(updateRows$.subscribe((r) => { if (r?.length && gridApi) gridApi.applyTransactionAsync({ update: r as any[] } as any); }));
      sub.add(deleteRows$.subscribe((r) => { if (r?.length && gridApi) gridApi.applyTransactionAsync({ remove: r as any[] } as any); }));
      return () => { sub.unsubscribe(); subscriptionsRef.current = new Subscription(); };
    }, [gridApi, addRows$, updateRows$, deleteRows$]);

    return (
      <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, minHeight: 0 }}>
          <AgGridReact theme={theme} columnDefs={columnDefs} enableCharts rowData={rowData}
            gridOptions={mergedGridOptions} getRowId={getRowId}
            sideBar={sideBar} components={components}
            onGridReady={onGridReady} />
        </div>
      </div>
    );
  }
);

MacroReactGrid.displayName = 'MacroReactGrid';
export default MacroReactGrid;
