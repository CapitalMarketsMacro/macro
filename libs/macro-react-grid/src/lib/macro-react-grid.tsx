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
  type CalculatedColumnCreatedEvent,
  type CalculatedColumnExpressionChangedEvent,
  type CalculatedColumnRemovedEvent,
} from 'ag-grid-community';
import {
  AllEnterpriseModule,
  IntegratedChartsModule,
} from 'ag-grid-enterprise';
import { AgChartsEnterpriseModule } from 'ag-charts-enterprise';
import { buildAgGridTheme } from '@macro/macro-design';
import {
  CALCULATED_COLUMNS_KEY,
  ColumnFormatStore,
  FORMAT_TOOL_PANEL_COMPONENT,
  buildCellStyle,
  buildValueFormatter,
  mergeCalculatedColumns,
  migrateMap,
  sameCalcSchema,
  withFormatPanel,
  type CalcColumnSchema,
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
      // AG Grid 36 calculated columns: 'deferred' = validate + Apply/Cancel in the dialog.
      calculatedColumns: { applyMode: 'deferred' },
    }), []);

    const columnDefs: ColDef[] = useMemo(() => {
      if (!columns) return [];
      if (typeof columns === 'string') {
        try { const p = JSON.parse(columns); return Array.isArray(p) ? p : [p]; }
        catch { return []; }
      }
      return Array.isArray(columns) ? columns : [columns];
    }, [columns]);

    // Runtime-tracked calculated columns (created/edited/removed via the dialog). Refs + a
    // version counter so changes recompute the effective columnDefs without per-keystroke churn.
    const calcDefsRef = useRef(new Map<string, CalcColumnSchema>());
    const calcRemovedRef = useRef(new Set<string>());
    const calcColIdsRef = useRef<string[]>([]);
    // Re-entrancy guard: true while pushing columnDefs, so the resulting reconcile→emit is ignored.
    const applyingCalcDefsRef = useRef(false);
    const [calcVersion, setCalcVersion] = useState(0);
    // Set by applyGridState / the store-change subscription so the next render hands AG Grid the
    // SAME array reference passed to setGridOption('columnDefs', ...) — AG Grid then short-circuits
    // (identical ref) and doesn't re-apply columnDefs after setState. Matches the Angular wrapper.
    const pinnedDefsRef = useRef<ReturnType<typeof mergeCalculatedColumns> | null>(null);

    // Build effective columnDefs = app base + tracked calc columns, with any user format BAKED into
    // each calc column's colDef (calc cols carry cellDataType, so AG Grid ignores a post-hoc
    // valueFormatter mutation — the format must live on the colDef). Records the calc colIds so they
    // can be marked externally-managed in the store.
    const buildEffective = useCallback(() => {
      const merged = mergeCalculatedColumns(columnDefs, [...calcDefsRef.current.values()], calcRemovedRef.current);
      const ids: string[] = [];
      const out = merged.map((def) => {
        const d = def as ColDef;
        if (!d.calculatedExpression || !d.colId) return def;
        ids.push(d.colId);
        const spec = store.get(d.colId);
        if (!spec) return def;
        const baked: ColDef = { ...d };
        const vf = buildValueFormatter(spec);
        if (vf) baked.valueFormatter = vf;
        const cs = buildCellStyle(spec, d.cellStyle);
        if (cs) baked.cellStyle = cs;
        return baked;
      });
      calcColIdsRef.current = ids;
      return out;
    }, [columnDefs, store]);

    const effectiveColumnDefs = useMemo(() => {
      if (pinnedDefsRef.current) {
        const pinned = pinnedDefsRef.current;
        pinnedDefsRef.current = null;
        return pinned;
      }
      return buildEffective();
    }, [buildEffective, calcVersion]);

    // Keep the store's externally-managed set in sync with the current calc columns.
    useEffect(() => {
      store.setExternallyManaged(calcColIdsRef.current);
    }, [store, effectiveColumnDefs]);

    // Re-bake + re-apply calc-column formats when the store changes. Only CALC columns need this
    // (regular columns use the store's in-place mutation). Re-pushing columnDefs resets the regular
    // columns (AG Grid clones colDefs, so the store's mutations live on the clones, not our base
    // defs) and triggers a reconcile→emit; the re-entrancy guard stops that from looping.
    useEffect(() => {
      const off = store.onChange(() => {
        if (applyingCalcDefsRef.current) return;
        if (!calcColIdsRef.current.some((id) => store.has(id))) return;
        applyingCalcDefsRef.current = true;
        try {
          const built = buildEffective();
          pinnedDefsRef.current = built;
          setCalcVersion((v) => v + 1);
          gridApiRef.current?.setGridOption('columnDefs', built);
        } finally {
          applyingCalcDefsRef.current = false;
        }
      });
      return off;
    }, [store, buildEffective]);

    const onCalcUpserted = useCallback(
      (e: CalculatedColumnCreatedEvent | CalculatedColumnExpressionChangedEvent) => {
        const colId = e.column.getColId();
        const def = e.column.getColDef();
        const next: CalcColumnSchema = {
          colId,
          calculatedExpression: e.expression,
          ...(def.headerName != null ? { headerName: def.headerName } : {}),
          ...(typeof def.cellDataType === 'string' ? { cellDataType: def.cellDataType } : {}),
        };
        // Idempotency guard: feeding a user-created calc column back into columnDefs can make AG Grid
        // re-emit the create event; bail when nothing changed, else the re-feed cycle freezes the grid.
        const prev = calcDefsRef.current.get(colId);
        if (prev && !calcRemovedRef.current.has(colId) && sameCalcSchema(prev, next)) return;
        calcDefsRef.current.set(colId, next);
        calcRemovedRef.current.delete(colId);
        setCalcVersion((v) => v + 1);
        store.reconcile();
      },
      [store],
    );

    const onCalcRemoved = useCallback((e: CalculatedColumnRemovedEvent) => {
      const colId = e.column.getColId();
      calcDefsRef.current.delete(colId);
      calcRemovedRef.current.add(colId);
      // Drop any user format on the removed calc column so it isn't persisted as a dangling
      // columnFormats entry (which would resurrect if a same-colId calc column is recreated).
      store.clear(colId);
      setCalcVersion((v) => v + 1);
      store.reconcile();
    }, [store]);

    const mergedGridOptions: GridOptions = useMemo(() => ({
      ...defaultGridOptions, ...gridOptions,
      columnDefs: effectiveColumnDefs, rowData,
      ...(getRowId && { getRowId }),
    }), [defaultGridOptions, gridOptions, effectiveColumnDefs, rowData, getRowId]);

    const onGridReady = useCallback((e: GridReadyEvent) => {
      gridApiRef.current = e.api;
      setGridApi(e.api);
      // Re-apply user formats whenever AG Grid rebuilds the column defs (e.g. the app's
      // useMemo columns change); the in-place valueFormatter mutation would otherwise be lost.
      e.api.addEventListener('displayedColumnsChanged', reconcile);
      e.api.addEventListener('newColumnsLoaded', reconcile);
      // Track calculated columns the user adds/edits/removes via the dialog (for persistence).
      e.api.addEventListener('calculatedColumnCreated', onCalcUpserted);
      e.api.addEventListener('calculatedColumnExpressionChanged', onCalcUpserted);
      e.api.addEventListener('calculatedColumnRemoved', onCalcRemoved);
      // Seed declarative initial formats (saved view state overrides these on restore).
      if (columnFormats) store.restore(migrateMap(columnFormats));
    }, [reconcile, store, columnFormats, onCalcUpserted, onCalcRemoved]);

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
        const defs = [...calcDefsRef.current.values()];
        const removed = [...calcRemovedRef.current];
        const calc = defs.length || removed.length ? (removed.length ? { defs, removed } : { defs }) : undefined;
        return {
          ...s,
          ...(formats ? { columnFormats: formats } : {}),
          ...(calc ? { [CALCULATED_COLUMNS_KEY]: calc } : {}),
        };
      },
      applyGridState: (state: any) => {
        const api = gridApiRef.current;
        if (!api) return;
        const { columnFormats: cf, [CALCULATED_COLUMNS_KEY]: calc, ...gs } = state ?? {};
        // 1. Recreate calculated columns (reset the tracked set, so a saved "no calc columns"
        //    view removes any added at runtime) BEFORE setState so column-state can bind by colId.
        calcDefsRef.current = new Map((calc?.defs ?? []).map((s: CalcColumnSchema) => [s.colId, s]));
        calcRemovedRef.current = new Set<string>(calc?.removed ?? []);
        const merged = buildEffective();
        // Pin so the re-render's effectiveColumnDefs is THIS exact reference (no post-setState re-apply).
        pinnedDefsRef.current = merged;
        setCalcVersion((v) => v + 1);
        api.setGridOption('columnDefs', merged);
        // 2. Native state.
        api.setState(gs as GridState);
        // 3. Column formats. store.restore emits -> our store-change subscription re-bakes calc
        //    column formats into the colDefs and re-applies; regular columns are mutated in place.
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
    }), [store, columnDefs, buildEffective, addRows$, updateRows$, deleteRows$]);

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
          <AgGridReact theme={theme} columnDefs={effectiveColumnDefs} enableCharts rowData={rowData}
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
