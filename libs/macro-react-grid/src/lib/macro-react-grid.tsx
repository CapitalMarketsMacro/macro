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

ModuleRegistry.registerModules([
  AllCommunityModule,
  AllEnterpriseModule,
  IntegratedChartsModule.with(AgChartsEnterpriseModule)
]);

export type FormatType = 'number' | 'percent' | 'bps' | 'currency' | 'compact';
export interface ColumnFormatConfig { type: FormatType; decimals: number; }

function applyFormat(value: unknown, config: ColumnFormatConfig): string {
  if (value == null || typeof value !== 'number' || isNaN(value)) return String(value ?? '');
  let num = value, prefix = '', suffix = '';
  switch (config.type) {
    case 'percent': num = value * 100; suffix = '%'; break;
    case 'bps': num = value * 10000; suffix = ' bps'; break;
    case 'currency': prefix = '$'; break;
    case 'compact': {
      const abs = Math.abs(value);
      if (abs >= 1e9) return (value / 1e9).toFixed(config.decimals) + 'B';
      if (abs >= 1e6) return (value / 1e6).toFixed(config.decimals) + 'M';
      if (abs >= 1e3) return (value / 1e3).toFixed(config.decimals) + 'K';
      break;
    }
  }
  return prefix + num.toFixed(config.decimals) + suffix;
}

const FORMAT_TYPES: { value: FormatType; label: string }[] = [
  { value: 'number', label: 'Num' },
  { value: 'percent', label: '%' },
  { value: 'bps', label: 'bps' },
  { value: 'currency', label: '$' },
  { value: 'compact', label: 'K/M' },
];

export interface MacroReactGridProps {
  columns?: string | ColDef[];
  rowData?: unknown[];
  gridOptions?: GridOptions;
  getRowId?: (params: GetRowIdParams) => string;
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

/* ── Styles ── */

const css = {
  container: { height: '100%', width: '100%', position: 'relative' as const, display: 'flex', flexDirection: 'column' as const },
  trigger: (active: boolean): React.CSSProperties => ({
    position: 'absolute', top: 6, right: 6, zIndex: 3,
    width: 28, height: 22, padding: 0, fontSize: 11, fontWeight: 600, lineHeight: '20px',
    textAlign: 'center', borderRadius: 4, cursor: 'pointer', border: '1px solid',
    borderColor: active ? 'var(--ag-range-selection-border-color, #3b82f6)' : 'var(--ag-border-color, #dde2eb)',
    background: active ? 'var(--ag-range-selection-border-color, #3b82f6)' : 'var(--ag-background-color, #fff)',
    color: active ? '#fff' : 'var(--ag-secondary-foreground-color, #5f6b7a)',
    opacity: active ? 1 : 0.7, transition: 'all 0.15s', fontFamily: 'inherit',
  }),
  badge: (active: boolean): React.CSSProperties => ({
    position: 'absolute', top: -5, right: -5, minWidth: 14, height: 14,
    fontSize: 9, fontWeight: 600, lineHeight: '14px', textAlign: 'center', borderRadius: 7,
    background: active ? '#fff' : 'var(--ag-range-selection-border-color, #3b82f6)',
    color: active ? 'var(--ag-range-selection-border-color, #3b82f6)' : '#fff',
    pointerEvents: 'none',
  }),
  hint: {
    position: 'absolute' as const, top: 6, right: 42, zIndex: 3,
    padding: '3px 10px', fontSize: 11, borderRadius: 4, whiteSpace: 'nowrap' as const,
    background: 'var(--ag-range-selection-border-color, #3b82f6)', color: '#fff',
    pointerEvents: 'none' as const, animation: 'fp-hint-fade 3s ease-in-out forwards',
  },
  backdrop: { position: 'fixed' as const, inset: 0, zIndex: 100 },
  popover: (x: number, y: number): React.CSSProperties => ({
    position: 'fixed', left: x, top: y, zIndex: 101, width: 220, padding: '10px 12px',
    borderRadius: 8, border: '1px solid var(--ag-border-color, #dde2eb)',
    background: 'var(--ag-background-color, #fff)', color: 'var(--ag-foreground-color, #181d1f)',
    boxShadow: '0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)',
    fontFamily: 'inherit', fontSize: 12, animation: 'fp-in 0.12s ease-out',
  }),
  fpHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  fpTitle: { fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  fpClearLink: {
    background: 'none', border: 'none', fontSize: 11, padding: 0, cursor: 'pointer', opacity: 0.8,
    color: 'var(--ag-range-selection-border-color, #3b82f6)',
  },
  fpTypes: { display: 'flex', flexWrap: 'wrap' as const, gap: 4, marginBottom: 10 },
  fpPill: (active: boolean): React.CSSProperties => ({
    padding: '3px 8px', fontSize: 11, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
    border: '1px solid',
    borderColor: active ? 'var(--ag-range-selection-border-color, #3b82f6)' : 'var(--ag-border-color, #dde2eb)',
    background: active ? 'var(--ag-range-selection-border-color, #3b82f6)' : 'var(--ag-background-color, #fff)',
    color: active ? '#fff' : 'var(--ag-secondary-foreground-color, #5f6b7a)',
    transition: 'all 0.1s',
  }),
  fpRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  fpLabel: { fontSize: 11, color: 'var(--ag-secondary-foreground-color, #5f6b7a)' },
  fpStepper: {
    display: 'flex', alignItems: 'center', borderRadius: 5, overflow: 'hidden',
    border: '1px solid var(--ag-border-color, #dde2eb)',
  },
  fpStep: (disabled: boolean): React.CSSProperties => ({
    width: 26, height: 24, padding: 0, fontSize: 13, border: 'none', cursor: disabled ? 'default' : 'pointer',
    background: 'var(--ag-background-color, #fff)', color: 'var(--ag-foreground-color, #181d1f)',
    opacity: disabled ? 0.3 : 1, fontFamily: 'inherit',
  }),
  fpStepValue: {
    width: 28, textAlign: 'center' as const, fontSize: 12, fontWeight: 500, lineHeight: '24px',
    borderLeft: '1px solid var(--ag-border-color, #dde2eb)',
    borderRight: '1px solid var(--ag-border-color, #dde2eb)',
  },
  fpApply: {
    width: '100%', padding: 5, fontSize: 12, fontWeight: 500, borderRadius: 5,
    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
    background: 'var(--ag-range-selection-border-color, #3b82f6)', color: '#fff',
  },
};

// Inject keyframes once
if (typeof document !== 'undefined' && !document.getElementById('macro-grid-fp-styles')) {
  const style = document.createElement('style');
  style.id = 'macro-grid-fp-styles';
  style.textContent = `
    @keyframes fp-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes fp-hint-fade { 0%, 70% { opacity: 0.9; } 100% { opacity: 0; } }
  `;
  document.head.appendChild(style);
}

export const MacroReactGrid = forwardRef<MacroReactGridRef, MacroReactGridProps>(
  ({ columns = [], rowData = [], gridOptions = {}, getRowId }, ref) => {
    const [theme, setTheme] = useState<Theme | undefined>(undefined);
    const [gridApi, setGridApi] = useState<GridApi | undefined>(undefined);
    const containerRef = useRef<HTMLDivElement>(null);
    const subscriptionsRef = useRef<Subscription>(new Subscription());
    const addRows$ = useRef(new Subject<unknown[]>()).current;
    const updateRows$ = useRef(new Subject<unknown[]>()).current;
    const deleteRows$ = useRef(new Subject<unknown[]>()).current;

    // Format state
    const [formatMode, setFormatMode] = useState(false);
    const [popover, setPopover] = useState<{ colId: string; headerName: string; x: number; y: number } | null>(null);
    const [selectedType, setSelectedType] = useState<FormatType>('number');
    const [selectedDecimals, setSelectedDecimals] = useState(2);
    const columnFormatsRef = useRef(new Map<string, ColumnFormatConfig>());
    const originalFormattersRef = useRef(new Map<string, any>());
    const [formatCount, setFormatCount] = useState(0);

    const applyFormatterToColumn = useCallback((api: GridApi, colId: string, config: ColumnFormatConfig) => {
      const col = api.getColumn(colId);
      if (!col) return;
      const colDef = col.getColDef();
      if (!originalFormattersRef.current.has(colId)) {
        originalFormattersRef.current.set(colId, colDef.valueFormatter);
      }
      colDef.valueFormatter = (params: any) => applyFormat(params.value, config);
      api.refreshCells({ columns: [colId], force: true });
    }, []);

    const restoreOriginalFormatter = useCallback((api: GridApi, colId: string) => {
      const col = api.getColumn(colId);
      if (!col) return;
      const colDef = col.getColDef();
      if (originalFormattersRef.current.has(colId)) {
        colDef.valueFormatter = originalFormattersRef.current.get(colId);
        originalFormattersRef.current.delete(colId);
      }
      api.refreshCells({ columns: [colId], force: true });
    }, []);

    // Header click listener for format mode
    useEffect(() => {
      if (!formatMode || !gridApi) return;
      const handler = (e: MouseEvent) => {
        const headerCell = (e.target as HTMLElement).closest('.ag-header-cell') as HTMLElement | null;
        if (!headerCell) return;
        if ((e.target as HTMLElement).closest('.ag-header-cell-menu-button, .ag-header-cell-filter-button')) return;
        const colId = headerCell.getAttribute('col-id');
        if (!colId) return;
        e.stopPropagation();
        e.preventDefault();
        const col = gridApi.getColumn(colId);
        if (!col) return;
        const rect = headerCell.getBoundingClientRect();
        const existing = columnFormatsRef.current.get(colId);
        setSelectedType(existing?.type ?? 'number');
        setSelectedDecimals(existing?.decimals ?? 2);
        setPopover({ colId, headerName: col.getColDef().headerName ?? colId, x: rect.left, y: rect.bottom + 4 });
      };
      const el = containerRef.current;
      el?.addEventListener('click', handler, true);
      return () => { el?.removeEventListener('click', handler, true); };
    }, [formatMode, gridApi]);

    const defaultGridOptions: GridOptions = useMemo(() => ({
      defaultColDef: { sortable: true, filter: true, resizable: true },
      sideBar: { toolPanels: ['columns', 'filters'], hiddenByDefault: false },
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

    useImperativeHandle(ref, () => ({
      applyTransaction: (t: RowNodeTransaction) => {
        if (!gridApi) throw new Error('Grid API not available.');
        gridApi.applyTransactionAsync(t as any);
      },
      getGridApi: () => gridApi,
      getGridState: () => {
        const s = gridApi?.getState();
        if (!s) return undefined;
        return columnFormatsRef.current.size > 0
          ? { ...s, columnFormats: Object.fromEntries(columnFormatsRef.current) } : s;
      },
      applyGridState: (state: any) => {
        if (!gridApi) return;
        if (state?.columnFormats) {
          const { columnFormats, ...gs } = state;
          for (const [colId, config] of Object.entries(columnFormats as Record<string, ColumnFormatConfig>)) {
            columnFormatsRef.current.set(colId, config);
            setTimeout(() => applyFormatterToColumn(gridApi, colId, config), 0);
          }
          setFormatCount(columnFormatsRef.current.size);
          gridApi.setState(gs as GridState);
        } else {
          gridApi.setState(state as GridState);
        }
      },
      addRows$, updateRows$, deleteRows$,
    }), [gridApi, addRows$, updateRows$, deleteRows$, applyFormatterToColumn]);

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

    const handleApply = () => {
      if (!popover || !gridApi) return;
      const config: ColumnFormatConfig = { type: selectedType, decimals: selectedDecimals };
      columnFormatsRef.current.set(popover.colId, config);
      applyFormatterToColumn(gridApi, popover.colId, config);
      setFormatCount(columnFormatsRef.current.size);
      setPopover(null);
    };

    const handleClear = () => {
      if (!popover || !gridApi) return;
      columnFormatsRef.current.delete(popover.colId);
      restoreOriginalFormatter(gridApi, popover.colId);
      setFormatCount(columnFormatsRef.current.size);
      setSelectedType('number');
      setSelectedDecimals(2);
    };

    return (
      <div ref={containerRef} style={css.container}>
        <button style={css.trigger(formatMode)}
          onClick={() => { setFormatMode(!formatMode); setPopover(null); }}
          title={formatMode ? 'Exit format mode' : 'Format columns'}>
          Fx
          {formatCount > 0 && <span style={css.badge(formatMode)}>{formatCount}</span>}
        </button>

        {formatMode && !popover && <div key={Date.now()} style={css.hint}>Click a column header to format</div>}

        {popover && (
          <>
            <div style={css.backdrop} onClick={() => setPopover(null)} />
            <div style={css.popover(popover.x, popover.y)}>
              <div style={css.fpHeader}>
                <span style={css.fpTitle}>{popover.headerName}</span>
                {columnFormatsRef.current.has(popover.colId) && (
                  <button style={css.fpClearLink} onClick={handleClear}>Reset</button>
                )}
              </div>
              <div style={css.fpTypes}>
                {FORMAT_TYPES.map((ft) => (
                  <button key={ft.value} style={css.fpPill(selectedType === ft.value)}
                    onClick={() => setSelectedType(ft.value)}>{ft.label}</button>
                ))}
              </div>
              <div style={css.fpRow}>
                <span style={css.fpLabel}>Decimals</span>
                <div style={css.fpStepper}>
                  <button style={css.fpStep(selectedDecimals <= 0)}
                    onClick={() => setSelectedDecimals(Math.max(0, selectedDecimals - 1))}
                    disabled={selectedDecimals <= 0}>&minus;</button>
                  <span style={css.fpStepValue}>{selectedDecimals}</span>
                  <button style={css.fpStep(selectedDecimals >= 10)}
                    onClick={() => setSelectedDecimals(Math.min(10, selectedDecimals + 1))}
                    disabled={selectedDecimals >= 10}>+</button>
                </div>
              </div>
              <button style={css.fpApply} onClick={handleApply}>Apply</button>
            </div>
          </>
        )}

        <div style={{ flex: 1, minHeight: 0 }}>
          <AgGridReact theme={theme} columnDefs={columnDefs} enableCharts rowData={rowData}
            gridOptions={mergedGridOptions} getRowId={getRowId}
            onGridReady={(e: GridReadyEvent) => setGridApi(e.api)} />
        </div>
      </div>
    );
  }
);

MacroReactGrid.displayName = 'MacroReactGrid';
export default MacroReactGrid;
