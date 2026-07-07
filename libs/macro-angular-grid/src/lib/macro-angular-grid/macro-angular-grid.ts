import { Component, Input, OnInit, OnChanges, OnDestroy, SimpleChanges, PLATFORM_ID, inject, signal } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import { Subject, Subscription } from 'rxjs';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import { Logger } from '@macro/logger';
import {
  ColDef,
  ColGroupDef,
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
  type GetContextMenuItemsParams,
  type GetMainMenuItemsParams,
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
  SHOW_VALUES_AS_KEY,
  buildCellStyle,
  buildDecimalStepMenuItems,
  buildValueFormatter,
  mergeCalculatedColumns,
  migrateMap,
  sameCalcSchema,
  serializeShowValuesAs,
  withFormatPanel,
  type CalcColumnSchema,
  type ColumnFormatMap,
  type ShowValuesAsEntry,
} from '@macro/macro-grid-format';
import { MacroFormatToolPanelComponent } from '@macro/macro-grid-format/angular';
import { MacroPaginationToggleComponent, MACRO_PAGINATION_TOGGLE } from '../pagination-toggle.component';
import {
  MacroGroupingToggleComponent,
  MacroPivotToggleComponent,
  MACRO_GROUPING_TOGGLE,
  MACRO_PIVOT_TOGGLE,
} from '../group-pivot-toggles.component';
import {
  MacroQuickFilterToggleComponent,
  MacroAdvancedFilterToggleComponent,
  MACRO_QUICK_FILTER_TOGGLE,
  MACRO_ADVANCED_FILTER_TOGGLE,
} from '../filter-toggles.component';

// Register all ag-Grid modules (Community and Enterprise)
ModuleRegistry.registerModules([
  AllCommunityModule,
  AllEnterpriseModule,
  IntegratedChartsModule.with(AgChartsEnterpriseModule)
]);

/**
 * Macro Angular Grid Component
 * Wraps ag-Grid with support for JSON column configuration
 */
@Component({
  selector: 'lib-macro-angular-grid',
  imports: [AgGridAngular],
  templateUrl: './macro-angular-grid.html',
  styleUrl: './macro-angular-grid.css',
})
export class MacroAngularGrid implements OnInit, OnChanges, OnDestroy {
  /**
   * Column definitions in JSON format
   * Can be a JSON string or an array of column definition objects
   */
  @Input() columns: string | ColDef[] = [];

  /**
   * Row data for the grid
   */
  @Input() rowData: unknown[] = [];

  /**
   * Grid options (optional)
   */
  @Input() gridOptions: GridOptions = {};

  /**
   * Function to get row ID for each row
   * This is useful for tracking rows when data changes
   */
  @Input() getRowId?: (params: GetRowIdParams) => string;

  /**
   * Optional initial column formats (colId -> spec), applied on grid ready. Lets an app
   * seed capital-markets formats declaratively; the user can still change them via the
   * Format tool panel, and saved view state overrides these on restore.
   */
  @Input() columnFormats?: ColumnFormatMap;

  /**
   * Parsed column definitions (the app's base columns).
   */
  public columnDefs: ColDef[] = [];

  /**
   * The columnDefs actually fed to the grid: the base columns with tracked calculated columns
   * merged in (so user-created calc columns survive Angular re-binding the [columns] input).
   */
  public effectiveColumnDefs: (ColDef | ColGroupDef)[] = [];

  /**
   * Grid API reference for programmatic access
   */
  private gridApi?: GridApi;

  /**
   * Queue for transactions that arrive before grid is ready
   */
  private transactionQueue: RowNodeTransaction[] = [];

  /**
   * Flag to track if grid is ready
   */
  private isGridReady = false;


  /**
   * Flag to track if initial data has been set
   */
  private initialDataSet = false;

  /**
   * RxJS Subjects for row operations
   * Consumers can publish to these subjects to add/update/delete rows
   */
  public readonly addRows$ = new Subject<unknown[]>();
  public readonly updateRows$ = new Subject<unknown[]>();
  public readonly deleteRows$ = new Subject<unknown[]>();

  /**
   * Subscription management
   */
  private subscriptions = new Subscription();

  /**
   * Theme observer for detecting theme changes
   */
  private themeObserver?: MutationObserver;

  /**
   * Inject dependencies
   */
  private document = inject(DOCUMENT);
  private platformId = inject(PLATFORM_ID);
  private logger = Logger.getLogger('MacroAngularGrid');

  /**
   * Owns all user column formats for this grid (apply/clear/serialize/restore). Created
   * ONCE as a field (never rebuilt in mergeGridOptions) so the tool-panel params ref stays
   * stable and the panel is not torn down on sideBar/option updates.
   */
  private readonly formatStore = new ColumnFormatStore(() => this.gridApi);

  /** Stable handler so we can add/remove it on the grid's column-change events. */
  private readonly reconcileFormats = (): void => this.formatStore.reconcile();

  /** A user created or edited a calculated column via the dialog — track it for persistence. */
  private readonly onCalcColumnUpserted = (
    e: CalculatedColumnCreatedEvent | CalculatedColumnExpressionChangedEvent,
  ): void => {
    const colId = e.column.getColId();
    const def = e.column.getColDef();
    const next: CalcColumnSchema = {
      colId,
      calculatedExpression: e.expression,
      ...(def.headerName != null ? { headerName: def.headerName } : {}),
      ...(typeof def.cellDataType === 'string' ? { cellDataType: def.cellDataType } : {}),
    };
    // Idempotency guard: when we feed a user-created calc column back into columnDefs, AG Grid can
    // re-emit the create event for the same column. Bail if nothing actually changed, otherwise the
    // re-feed → re-emit → re-feed cycle freezes the grid.
    const prev = this.userCalcCols.get(colId);
    if (prev && !this.removedCalcCols.has(colId) && sameCalcSchema(prev, next)) return;
    // Capture BEFORE recompute: adding the calc column makes effectiveColumnDefs non-empty,
    // which would flip useAutoGen and defeat the auto-gen guard in the push below.
    const wasAutoGen = this.useAutoGen;
    this.userCalcCols.set(colId, next);
    this.removedCalcCols.delete(colId);
    this.recomputeEffectiveColumns();
    this.formatStore.reconcile();
    if (!wasAutoGen) this.pushEffectiveColumnDefs();
  };

  /** A user removed a calculated column via the dialog. */
  private readonly onCalcColumnRemoved = (e: CalculatedColumnRemovedEvent): void => {
    const colId = e.column.getColId();
    this.userCalcCols.delete(colId);
    this.removedCalcCols.add(colId);
    // Drop any user format on the removed calc column so it isn't persisted as a dangling
    // columnFormats entry (which would resurrect if a same-colId calc column is recreated).
    this.formatStore.clear(colId);
    const wasAutoGen = this.useAutoGen;
    this.recomputeEffectiveColumns();
    this.formatStore.reconcile();
    if (!wasAutoGen) this.pushEffectiveColumnDefs();
  };

  /**
   * Zoneless-safe imperative push of the re-baked defs: AG Grid event callbacks schedule no
   * change detection, so the [columnDefs] binding won't flush on its own — apply through the
   * API exactly like onStoreFormatsChanged does.
   */
  private pushEffectiveColumnDefs(): void {
    if (this.applyingColumnDefs) return;
    this.applyingColumnDefs = true;
    try {
      this.gridApi?.setGridOption('columnDefs', this.effectiveColumnDefs);
    } finally {
      this.applyingColumnDefs = false;
    }
  }

  // ── Calculated columns (AG Grid 36) ──
  /** Runtime-tracked user calc columns (created/edited via the dialog), keyed by colId. */
  private userCalcCols = new Map<string, CalcColumnSchema>();
  /** colIds of pre-defined calc columns the user removed via the dialog (so we don't re-add them). */
  private removedCalcCols = new Set<string>();
  /** Unsubscribe from the format store's change emitter. */
  private formatStoreUnsub?: () => void;

  /**
   * Default grid options
   */
  public defaultGridOptions: GridOptions = {
    defaultColDef: {
      sortable: true,
      filter: true,
      resizable: true,
      // Every column can be dragged to Row Groups / Values / Pivot (tool panel + drag strips);
      // enableShowValuesAs only surfaces the column-menu submenu on numeric/value columns.
      enableRowGroup: true,
      enableValue: true,
      enablePivot: true,
      enableShowValuesAs: true,
    },
    components: {
      [FORMAT_TOOL_PANEL_COMPONENT]: MacroFormatToolPanelComponent,
      [MACRO_PAGINATION_TOGGLE]: MacroPaginationToggleComponent,
      [MACRO_GROUPING_TOGGLE]: MacroGroupingToggleComponent,
      [MACRO_PIVOT_TOGGLE]: MacroPivotToggleComponent,
      [MACRO_QUICK_FILTER_TOGGLE]: MacroQuickFilterToggleComponent,
      [MACRO_ADVANCED_FILTER_TOGGLE]: MacroAdvancedFilterToggleComponent,
    },
    sideBar: withFormatPanel(
      { toolPanels: ['columns', 'filters'], hiddenByDefault: false },
      { store: this.formatStore },
    ),
    // AG Grid 36 calculated columns: users add/edit/remove via the column header menu.
    // 'deferred' = the dialog validates the expression and applies on Apply (safer for desks).
    calculatedColumns: { applyMode: 'deferred' },
    // Excel-style quick decimal stepping on numeric columns — appended to the column header
    // menu and put first in the cell right-click menu. Rides the format store, so steps
    // persist in `columnFormats` and the Format tool panel reflects them.
    getMainMenuItems: (params: GetMainMenuItemsParams) => {
      const items = buildDecimalStepMenuItems(this.formatStore, params.api, params.column?.getColId());
      return items.length ? [...params.defaultItems, 'separator' as const, ...items] : params.defaultItems;
    },
    getContextMenuItems: (params: GetContextMenuItemsParams) => {
      const items = buildDecimalStepMenuItems(this.formatStore, params.api, params.column?.getColId());
      const defaults = params.defaultItems ?? [];
      return items.length ? [...items, 'separator' as const, ...defaults] : defaults;
    },
    // Pagination OFF by default; users flip it via the subtle status-bar toggle (feels native).
    pagination: false,
    paginationPageSize: 10,
    paginationPageSizeSelector: [10, 25, 50, 100],
    // Grouping/pivot OFF by default, flipped via the status-bar toggles. pivotPanelShow is
    // initial-only config so it's declared here; the strip only renders while pivot mode is on.
    rowGroupPanelShow: 'never',
    pivotPanelShow: 'always',
    // Status bar: native filtered-of-total row count, selected-row count, and cell-range
    // aggregations (Count/Sum/Min/Max/Avg) on the left/center; the search/filter/grouping/
    // pivot/pagination toggles on the right (Search first so its input expands into the
    // free center space without shoving the other toggles).
    statusBar: {
      statusPanels: [
        { statusPanel: 'agTotalAndFilteredRowCountComponent', align: 'left' },
        { statusPanel: 'agSelectedRowCountComponent', align: 'left' },
        {
          statusPanel: 'agAggregationComponent',
          statusPanelParams: { aggFuncs: ['count', 'sum', 'min', 'max', 'avg'] },
          align: 'center',
        },
        { statusPanel: MACRO_QUICK_FILTER_TOGGLE, align: 'right' },
        { statusPanel: MACRO_ADVANCED_FILTER_TOGGLE, align: 'right' },
        { statusPanel: MACRO_GROUPING_TOGGLE, align: 'right' },
        { statusPanel: MACRO_PIVOT_TOGGLE, align: 'right' },
        { statusPanel: MACRO_PAGINATION_TOGGLE, align: 'right' },
      ],
    },
    animateRows: true,
    // v36 selection API (string rowSelection / enableRangeSelection / suppressRowClickSelection
    // are deprecated). Preserves prior behaviour: multi-row mode, no checkbox column, no
    // click-to-select; cell-range selection enabled.
    rowSelection: { mode: 'multiRow', checkboxes: false, enableClickSelection: false },
    cellSelection: true,
    suppressCellFocus: true,
  };

  /**
   * Merged grid options
   */
  public mergedGridOptions: GridOptions = {};

  // Signal: updated from a MutationObserver callback, which schedules no CD under zoneless.
  theme = signal<Theme | undefined>(undefined);

  ngOnInit(): void {
    // Bake mode: the store is a pure spec registry; we bake every format into the colDefs (one
    // source of truth) — avoids the in-place-mutation ↔ columnDef-rebuild ↔ reconcile feedback loop.
    this.formatStore.setBakeMode(true);
    this.parseColumns();
    this.mergeGridOptions();
    this.initializeTheme();
    this.setupThemeObserver();

    this.logger.info('Macro Angular Grid initialized');
    // Subscribe to row operation subjects
    this.setupRowOperationSubscriptions();
  }

  /**
   * Initialize theme based on current dark mode state
   */
  private initializeTheme(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const root = this.document.documentElement;
    const isDark = root.classList.contains('dark');
    this.updateTheme(isDark);
  }

  /**
   * Update theme based on dark mode
   */
  private updateTheme(isDark: boolean): void {
    this.theme.set(buildAgGridTheme(isDark));
  }

  /**
   * Setup observer to watch for theme changes
   */
  private setupThemeObserver(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const root = this.document.documentElement;

    // Watch for class changes on document root
    this.themeObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const isDark = root.classList.contains('dark');
          this.updateTheme(isDark);
        }
      });
    });

    this.themeObserver.observe(root, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  /**
   * Setup subscriptions for row operations
   */
  private setupRowOperationSubscriptions(): void {
    // Subscribe to addRows$ subject
    this.subscriptions.add(
      this.addRows$.subscribe((rows) => {
        if (rows && rows.length > 0) {
          this.applyTransaction({
            add: rows as any[],
          } as RowNodeTransaction);
        }
      })
    );

    // Subscribe to updateRows$ subject
    this.subscriptions.add(
      this.updateRows$.subscribe((rows) => {
        if (rows && rows.length > 0) {
          this.applyTransaction({
            update: rows as any[],
          } as RowNodeTransaction);
        }
      })
    );

    // Subscribe to deleteRows$ subject
    this.subscriptions.add(
      this.deleteRows$.subscribe((rows) => {
        if (rows && rows.length > 0) {
          this.applyTransaction({
            remove: rows as any[],
          } as RowNodeTransaction);
        }
      })
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['columns']) {
      this.parseColumns();
    }
    if (changes['gridOptions'] || changes['getRowId']) {
      this.mergeGridOptions();
    }
    // Declarative formats that arrive AFTER grid-ready (e.g. a blotter inferring them from the
    // first live record) must still reach the store — onGridReady's seed only covers the value
    // present at creation. The React wrapper already restores on prop change; mirror it.
    if (changes['columnFormats'] && !changes['columnFormats'].firstChange && this.isGridReady && this.columnFormats) {
      this.formatStore.restore(migrateMap(this.columnFormats));
    }
  }

  /**
   * Parse columns from JSON string or use array directly
   */
  private parseColumns(): void {
    if (!this.columns) {
      this.columnDefs = [];
    } else if (typeof this.columns === 'string') {
      try {
        const parsed = JSON.parse(this.columns);
        this.columnDefs = Array.isArray(parsed) ? parsed : [parsed];
      } catch (error) {
        this.logger.error('Error parsing columns JSON', error);
        this.columnDefs = [];
      }
    } else if (Array.isArray(this.columns)) {
      this.columnDefs = this.columns;
    } else {
      this.columnDefs = [this.columns];
    }
    this.recomputeEffectiveColumns();
  }

  /** Re-entrancy guard: true while we are applying columnDefs. */
  private applyingColumnDefs = false;

  /**
   * Effective columnDefs = app base columns + tracked calculated columns (minus removed), with EVERY
   * user format BAKED into its column's colDef (valueFormatter + cellStyle from the store spec). In
   * bake mode this is the single source of truth for formatting — both regular and calculated
   * columns are formatted purely by their colDef (which is also how calc columns, whose cellDataType
   * caches a value formatter, must be formatted).
   */
  private recomputeEffectiveColumns(): void {
    const merged = mergeCalculatedColumns(this.columnDefs, [...this.userCalcCols.values()], this.removedCalcCols);
    this.effectiveColumnDefs = merged.map((def) => {
      const d = def as ColDef;
      const colId = d.colId ?? (typeof d.field === 'string' ? d.field : undefined);
      if (!colId) return def;
      const spec = this.formatStore.get(colId);
      if (!spec) return def;
      const baked: ColDef = { ...d };
      const vf = buildValueFormatter(spec);
      if (vf) baked.valueFormatter = vf;
      const cs = buildCellStyle(spec, d.cellStyle);
      if (cs) baked.cellStyle = cs;
      return baked;
    });
  }

  /**
   * A format changed in the store — re-bake the colDefs and re-apply. In bake mode the store doesn't
   * touch colDefs and reconcile is a no-op, so setGridOption can't trigger a reconcile→emit loop.
   */
  private readonly onStoreFormatsChanged = (): void => {
    // In auto-gen mode the grid owns its columnDefs; baking store specs into an empty
    // effectiveColumnDefs and pushing it would wipe the generated columns.
    if (this.applyingColumnDefs || this.useAutoGen) return;
    this.applyingColumnDefs = true;
    try {
      this.recomputeEffectiveColumns();
      this.gridApi?.setGridOption('columnDefs', this.effectiveColumnDefs);
    } finally {
      this.applyingColumnDefs = false;
    }
  };

  /**
   * AG Grid 36 automatic column generation. Active ONLY when the consumer opts in via
   * `gridOptions.autoGenerateColumnDefs` AND supplies no columns of their own. In that mode the
   * wrapper must stop force-binding `columnDefs` so AG Grid can infer them from the row data;
   * for every existing consumer (auto-gen falsy) this is `false` and behaviour is unchanged.
   */
  private get useAutoGen(): boolean {
    return !!this.gridOptions?.autoGenerateColumnDefs && this.effectiveColumnDefs.length === 0;
  }

  /**
   * What the template binds to `[columnDefs]`: `undefined` in auto-gen mode (let AG Grid own the
   * generated column defs), otherwise the baked effective column defs.
   */
  get gridColumnDefs(): (ColDef | ColGroupDef)[] | undefined {
    return this.useAutoGen ? undefined : this.effectiveColumnDefs;
  }

  /**
   * Merge user-provided grid options with defaults
   */
  private mergeGridOptions(): void {
    this.mergedGridOptions = {
      ...this.defaultGridOptions,
      ...this.gridOptions,
      // Force columnDefs/rowData so gridOptions can't override them — EXCEPT in auto-gen mode,
      // where we deliberately omit columnDefs so AG Grid generates them (autoGenerateColumnDefs /
      // processAutoGeneratedColumnDefs already flow through via the ...this.gridOptions spread).
      ...(this.useAutoGen ? {} : { columnDefs: this.effectiveColumnDefs }),
      rowData: this.rowData,
      // Add getRowId if provided
      ...(this.getRowId && { getRowId: this.getRowId }),
      // Re-apply the Format tool panel AFTER the gridOptions spread so a consumer-supplied
      // sideBar/components cannot clobber it — they are merged instead (mirrors how the React
      // wrapper passes sideBar/components as explicit, higher-precedence props).
      components: {
        ...this.gridOptions.components,
        [FORMAT_TOOL_PANEL_COMPONENT]: MacroFormatToolPanelComponent,
        [MACRO_PAGINATION_TOGGLE]: MacroPaginationToggleComponent,
        [MACRO_GROUPING_TOGGLE]: MacroGroupingToggleComponent,
        [MACRO_PIVOT_TOGGLE]: MacroPivotToggleComponent,
        [MACRO_QUICK_FILTER_TOGGLE]: MacroQuickFilterToggleComponent,
        [MACRO_ADVANCED_FILTER_TOGGLE]: MacroAdvancedFilterToggleComponent,
      },
      // Default the status bar (pagination toggle) unless the consumer supplies their own.
      statusBar: this.gridOptions.statusBar ?? this.defaultGridOptions.statusBar,
      sideBar: withFormatPanel(this.gridOptions.sideBar, { store: this.formatStore }),
    };
  }

  /**
   * Grid ready event handler
   */
  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
    this.isGridReady = true;
    this.logger.info('AG Grid is ready', { event });

    // Apply any queued transactions
    this.flushTransactionQueue();

    // Re-apply user column formats whenever AG Grid rebuilds the column defs (e.g. the app
    // re-passes [columns]); the in-place valueFormatter mutation would otherwise be lost.
    this.gridApi.addEventListener('displayedColumnsChanged', this.reconcileFormats);
    this.gridApi.addEventListener('newColumnsLoaded', this.reconcileFormats);

    // Track calculated columns the user adds/edits/removes via the dialog (for persistence).
    this.gridApi.addEventListener('calculatedColumnCreated', this.onCalcColumnUpserted);
    this.gridApi.addEventListener('calculatedColumnExpressionChanged', this.onCalcColumnUpserted);
    this.gridApi.addEventListener('calculatedColumnRemoved', this.onCalcColumnRemoved);

    // Re-bake + re-apply calc-column formats when the store changes (calc cols can't use the
    // store's post-hoc valueFormatter mutation; their format is baked into the colDef).
    this.formatStoreUnsub = this.formatStore.onChange(this.onStoreFormatsChanged);

    // Seed declarative initial formats (saved view state overrides these on restore).
    if (this.columnFormats) {
      this.formatStore.restore(migrateMap(this.columnFormats));
    }
  }

  /**
   * Apply transaction to update grid data
   * This method allows consumers to update grid data programmatically
   * If the grid is not ready, the transaction will be queued and applied when ready
   *
   * @param transaction - Transaction object with add, update, and/or remove arrays
   *
   * @example
   * ```typescript
   * // Add new rows
   * gridComponent.applyTransaction({
   *   add: [{ id: 5, name: 'New User', age: 25 }]
   * });
   *
   * // Update existing rows
   * gridComponent.applyTransaction({
   *   update: [{ id: 1, name: 'Updated Name', age: 31 }]
   * });
   *
   * // Remove rows
   * gridComponent.applyTransaction({
   *   remove: [{ id: 2 }]
   * });
   *
   * // Combined transaction
   * gridComponent.applyTransaction({
   *   add: [{ id: 6, name: 'New User 2', age: 30 }],
   *   update: [{ id: 1, name: 'Updated Name', age: 31 }],
   *   remove: [{ id: 2 }]
   * });
   * ```
   */
  public applyTransaction(transaction: RowNodeTransaction): void {
    if (!this.isGridReady || !this.gridApi) {
      // Queue the transaction to be applied when grid is ready
      this.transactionQueue.push(transaction);
      return;
    }
    this.gridApi.applyTransactionAsync(transaction);
  }

  /**
   * Flush queued transactions when grid becomes ready
   */
  private flushTransactionQueue(): void {
    if (!this.gridApi) {
      return;
    }

    // Apply all queued transactions
    while (this.transactionQueue.length > 0) {
      const transaction = this.transactionQueue.shift();
      if (transaction) {
        this.gridApi.applyTransactionAsync(transaction);
      }
    }
  }

  /**
   * Get the grid API instance
   * @returns GridApi instance or undefined if grid is not ready
   */
  public getGridApi(): GridApi | undefined {
    return this.gridApi;
  }

  /**
   * Set initial row data for the grid
   * This method safely sets row data whether the grid is ready or not
   * @param data - Array of row data to set
   */
  public setInitialRowData(data: unknown[]): void {
    // Prevent setting initial data multiple times
    if (this.initialDataSet) {
      this.logger.warn('Initial row data has already been set. Use updateRows$ for updates.');
      return;
    }

    this.initialDataSet = true;

    if (this.isGridReady && this.gridApi) {
      // Zoneless-safe: consumers call this from WebSocket/promise callbacks where no change
      // detection is scheduled, so push through the grid API. Deliberately do NOT reassign
      // this.rowData here — a later change-detection pass would re-fire the [rowData] binding
      // with this (by then stale) seed array and revert every transaction applied since.
      this.gridApi.setGridOption('rowData', data);
    } else {
      // Grid not created yet: it initializes from the [rowData] binding.
      this.rowData = data;
    }
  }

  /**
   * Get the current grid state including user column formats and calculated columns. Formats
   * are stored under `columnFormats` (a bare `colId -> spec` map); runtime calculated columns
   * under `calculatedColumns` (since they do NOT appear in AG Grid's native `getState()`).
   */
  public getGridState(): any {
    const state = this.gridApi?.getState();
    if (!state) return undefined;
    const formats = this.formatStore.serialize();
    const calc = this.serializeCalcColumns();
    const showValuesAs = serializeShowValuesAs(this.gridApi?.getColumnState());
    return {
      ...state,
      ...(formats ? { columnFormats: formats } : {}),
      ...(calc ? { [CALCULATED_COLUMNS_KEY]: calc } : {}),
      ...(showValuesAs ? { [SHOW_VALUES_AS_KEY]: showValuesAs } : {}),
    };
  }

  /**
   * Apply a previously saved grid state. Order matters: (1) recreate calculated columns so the
   * native state can bind their order/width/sort by colId, (2) `setState`, (3) restore column
   * formats (which bind to columns — incl. calc columns — by colId).
   */
  public applyGridState(state: any): void {
    if (!this.gridApi) {
      this.logger.warn('Cannot apply grid state — grid is not ready');
      return;
    }
    const {
      columnFormats,
      [CALCULATED_COLUMNS_KEY]: calc,
      [SHOW_VALUES_AS_KEY]: showValuesAs,
      ...gridState
    } = state ?? {};
    this.restoreCalcColumns(calc);
    this.gridApi.setState(gridState as GridState);
    this.applyShowValuesAsState(showValuesAs);
    this.applyFormatsWhenReady(migrateMap(columnFormats ?? {}));
  }

  /**
   * Re-apply persisted Show Values As selections via column state (they ride a side-channel
   * since `getState()`/`setState()` do NOT carry them — only `aggFunc` is in `GridState`).
   */
  private applyShowValuesAsState(entries: ShowValuesAsEntry[] | undefined): void {
    if (!entries?.length) return;
    this.gridApi?.applyColumnState({ state: entries });
  }

  /** Serialize tracked calculated columns for persistence, or undefined when there are none. */
  private serializeCalcColumns(): { defs: CalcColumnSchema[]; removed?: string[] } | undefined {
    const defs = [...this.userCalcCols.values()];
    const removed = [...this.removedCalcCols];
    if (defs.length === 0 && removed.length === 0) return undefined;
    return removed.length ? { defs, removed } : { defs };
  }

  /**
   * Recreate calculated columns from a saved blob (always resets the tracked set, so a saved
   * "no calc columns" view removes any added at runtime). Pushes them onto the grid synchronously
   * via setGridOption so a subsequent setState can restore their column-state.
   */
  private restoreCalcColumns(calc: { defs?: CalcColumnSchema[]; removed?: string[] } | undefined): void {
    this.userCalcCols = new Map((calc?.defs ?? []).map((s) => [s.colId, s]));
    this.removedCalcCols = new Set(calc?.removed ?? []);
    this.recomputeEffectiveColumns();
    // Don't push columnDefs in auto-gen mode — AG Grid owns the generated defs there.
    if (!this.useAutoGen) this.gridApi?.setGridOption('columnDefs', this.effectiveColumnDefs);
  }

  private applyFormatsWhenReady(map: ColumnFormatMap): void {
    this.formatStore.restore(map);
    const missing = Object.keys(map).some((colId) => !this.gridApi?.getColumn(colId));
    if (missing && this.gridApi) {
      const handler = () => {
        this.formatStore.reconcile();
        this.gridApi?.removeEventListener('firstDataRendered', handler);
      };
      this.gridApi.addEventListener('firstDataRendered', handler);
    }
  }

  /**
   * Cleanup subscriptions
   */
  ngOnDestroy(): void {
    this.formatStoreUnsub?.();
    this.subscriptions.unsubscribe();
    this.addRows$.complete();
    this.updateRows$.complete();
    this.deleteRows$.complete();
    if (this.themeObserver) {
      this.themeObserver.disconnect();
    }
  }
}
