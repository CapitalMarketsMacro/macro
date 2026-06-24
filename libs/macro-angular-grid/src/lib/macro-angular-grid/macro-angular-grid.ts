import { Component, Input, OnInit, OnChanges, OnDestroy, SimpleChanges, PLATFORM_ID, inject } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import { Subject, Subscription } from 'rxjs';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import { Logger } from '@macro/logger';
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
   * Parsed column definitions
   */
  public columnDefs: ColDef[] = [];

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
    pagination: true,
    paginationPageSize: 10,
    paginationPageSizeSelector: [10, 25, 50, 100],
    animateRows: true,
    rowSelection: 'multiple',
    suppressRowClickSelection: true,
    enableRangeSelection: true,
    suppressCellFocus: true,
  };

  /**
   * Merged grid options
   */
  public mergedGridOptions: GridOptions = {};

  theme: Theme | undefined;

  ngOnInit(): void {
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
      return;
    }

    if (typeof this.columns === 'string') {
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
  }

  /**
   * Merge user-provided grid options with defaults
   */
  private mergeGridOptions(): void {
    this.mergedGridOptions = {
      ...this.defaultGridOptions,
      ...this.gridOptions,
      // Ensure columnDefs and rowData are not overridden by gridOptions
      columnDefs: this.columnDefs,
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
   * Get the current grid state including user column formats. Column formats are stored
   * under `columnFormats` as a bare `colId -> spec` map (see {@link ColumnFormatStore}).
   */
  public getGridState(): any {
    const state = this.gridApi?.getState();
    if (!state) return undefined;
    const formats = this.formatStore.serialize();
    return formats ? { ...state, columnFormats: formats } : state;
  }

  /**
   * Apply a previously saved grid state, including any column formats (migrating the legacy
   * `{ type, decimals }` shape). Formats are applied right after `setState`; any whose column
   * isn't present yet are re-applied on the next `firstDataRendered` (no `setTimeout` race).
   */
  public applyGridState(state: any): void {
    if (!this.gridApi) {
      this.logger.warn('Cannot apply grid state — grid is not ready');
      return;
    }
    // Always drive the store from the saved blob — including the empty case. A saved view
    // with no `columnFormats` (user cleared every format) must REMOVE any declaratively
    // seeded formats, not let them survive; restore([]) clears them.
    const { columnFormats, ...gridState } = state ?? {};
    this.gridApi.setState(gridState as GridState);
    this.applyFormatsWhenReady(migrateMap(columnFormats ?? {}));
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
    this.subscriptions.unsubscribe();
    this.addRows$.complete();
    this.updateRows$.complete();
    this.deleteRows$.complete();
    if (this.themeObserver) {
      this.themeObserver.disconnect();
    }
  }
}
