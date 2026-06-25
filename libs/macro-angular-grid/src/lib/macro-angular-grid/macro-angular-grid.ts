import { Component, Input, OnInit, OnChanges, OnDestroy, SimpleChanges, PLATFORM_ID, inject } from '@angular/core';
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
import { MacroFormatToolPanelComponent } from '@macro/macro-grid-format/angular';

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
   * Pending initial row data to be set when grid becomes ready
   */
  private pendingInitialData?: unknown[];

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
    this.userCalcCols.set(colId, next);
    this.removedCalcCols.delete(colId);
    this.recomputeEffectiveColumns();
    this.formatStore.reconcile();
  };

  /** A user removed a calculated column via the dialog. */
  private readonly onCalcColumnRemoved = (e: CalculatedColumnRemovedEvent): void => {
    const colId = e.column.getColId();
    this.userCalcCols.delete(colId);
    this.removedCalcCols.add(colId);
    // Drop any user format on the removed calc column so it isn't persisted as a dangling
    // columnFormats entry (which would resurrect if a same-colId calc column is recreated).
    this.formatStore.clear(colId);
    this.recomputeEffectiveColumns();
    this.formatStore.reconcile();
  };

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
    },
    components: { [FORMAT_TOOL_PANEL_COMPONENT]: MacroFormatToolPanelComponent },
    sideBar: withFormatPanel(
      { toolPanels: ['columns', 'filters'], hiddenByDefault: false },
      { store: this.formatStore },
    ),
    // AG Grid 36 calculated columns: users add/edit/remove via the column header menu.
    // 'deferred' = the dialog validates the expression and applies on Apply (safer for desks).
    calculatedColumns: { applyMode: 'deferred' },
    pagination: true,
    paginationPageSize: 10,
    paginationPageSizeSelector: [10, 25, 50, 100],
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

  theme: Theme | undefined;

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
    this.theme = buildAgGridTheme(isDark);
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
    if (this.applyingColumnDefs) return;
    this.applyingColumnDefs = true;
    try {
      this.recomputeEffectiveColumns();
      this.gridApi?.setGridOption('columnDefs', this.effectiveColumnDefs);
    } finally {
      this.applyingColumnDefs = false;
    }
  };

  /**
   * Merge user-provided grid options with defaults
   */
  private mergeGridOptions(): void {
    this.mergedGridOptions = {
      ...this.defaultGridOptions,
      ...this.gridOptions,
      // Ensure columnDefs and rowData are not overridden by gridOptions
      columnDefs: this.effectiveColumnDefs,
      rowData: this.rowData,
      // Add getRowId if provided
      ...(this.getRowId && { getRowId: this.getRowId }),
      // Re-apply the Format tool panel AFTER the gridOptions spread so a consumer-supplied
      // sideBar/components cannot clobber it — they are merged instead (mirrors how the React
      // wrapper passes sideBar/components as explicit, higher-precedence props).
      components: {
        ...this.gridOptions.components,
        [FORMAT_TOOL_PANEL_COMPONENT]: MacroFormatToolPanelComponent,
      },
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

    // Set any pending initial data
    if (this.pendingInitialData && !this.initialDataSet) {
      // Update the rowData input property - Angular will update ag-grid via input binding
      this.rowData = this.pendingInitialData;
      this.initialDataSet = true;
      this.pendingInitialData = undefined;
    }

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

    // Update the rowData input property to keep binding in sync
    // This will trigger Angular's change detection to update ag-grid via input binding
    this.rowData = data;
    this.initialDataSet = true;

    if (this.isGridReady && this.gridApi) {
      // Grid is ready, but we'll let the input binding handle it
      // No need to call setGridOption since Angular will update via [rowData] binding
    } else {
      // Grid not ready yet, store data to be set when ready
      this.pendingInitialData = data;
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
    return {
      ...state,
      ...(formats ? { columnFormats: formats } : {}),
      ...(calc ? { [CALCULATED_COLUMNS_KEY]: calc } : {}),
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
    const { columnFormats, [CALCULATED_COLUMNS_KEY]: calc, ...gridState } = state ?? {};
    this.restoreCalcColumns(calc);
    this.gridApi.setState(gridState as GridState);
    this.applyFormatsWhenReady(migrateMap(columnFormats ?? {}));
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
    this.gridApi?.setGridOption('columnDefs', this.effectiveColumnDefs);
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
