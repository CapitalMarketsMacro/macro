import { Component, Input, OnInit, OnChanges, OnDestroy, SimpleChanges, PLATFORM_ID, inject, ElementRef, ViewChild } from '@angular/core';
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

// Register all ag-Grid modules (Community and Enterprise)
ModuleRegistry.registerModules([
  AllCommunityModule,
  AllEnterpriseModule,
  IntegratedChartsModule.with(AgChartsEnterpriseModule)
]);

/** User-applied column format types */
export type FormatType = 'number' | 'percent' | 'bps' | 'currency' | 'compact';

/** Configuration for a user-applied column format */
export interface ColumnFormatConfig {
  type: FormatType;
  decimals: number;
}

/** Format a numeric value according to user config */
function applyFormat(value: unknown, config: ColumnFormatConfig): string {
  if (value == null || typeof value !== 'number' || isNaN(value)) return String(value ?? '');
  let num = value;
  let prefix = '';
  let suffix = '';
  switch (config.type) {
    case 'percent': num = value * 100; suffix = '%'; break;
    case 'bps': num = value * 10000; suffix = ' bps'; break;
    case 'currency': prefix = '$'; break;
    case 'compact': {
      const abs = Math.abs(value);
      if (abs >= 1e9) return prefix + (value / 1e9).toFixed(config.decimals) + 'B';
      if (abs >= 1e6) return prefix + (value / 1e6).toFixed(config.decimals) + 'M';
      if (abs >= 1e3) return prefix + (value / 1e3).toFixed(config.decimals) + 'K';
      break;
    }
  }
  return prefix + num.toFixed(config.decimals) + suffix;
}

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
   * Default grid options
   */
  public defaultGridOptions: GridOptions = {
    defaultColDef: {
      sortable: true,
      filter: true,
      resizable: true,
    },
    sideBar: { toolPanels: ['columns', 'filters'], hiddenByDefault: false },
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

  @ViewChild('gridContainer', { static: true }) private gridContainerRef!: ElementRef<HTMLElement>;

  // ── Column formatting state ──
  public formatMode = false;
  public popover: { colId: string; headerName: string; x: number; y: number } | null = null;
  public selectedFormatType: FormatType = 'number';
  public selectedFormatDecimals = 2;
  private columnFormats = new Map<string, ColumnFormatConfig>();
  private originalFormatters = new Map<string, any>();
  private headerClickListener?: (e: MouseEvent) => void;

  public readonly formatTypes: { value: FormatType; label: string }[] = [
    { value: 'number', label: 'Num' },
    { value: 'percent', label: '%' },
    { value: 'bps', label: 'bps' },
    { value: 'currency', label: '$' },
    { value: 'compact', label: 'K/M' },
  ];

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
   * Get the current grid state including user column formats.
   * Column formats are stored as `columnFormats` on the returned object.
   */
  public getGridState(): any {
    const state = this.gridApi?.getState();
    if (!state) return undefined;
    if (this.columnFormats.size > 0) {
      return { ...state, columnFormats: Object.fromEntries(this.columnFormats) };
    }
    return state;
  }

  /**
   * Apply a previously saved grid state, including any column formats.
   */
  public applyGridState(state: any): void {
    if (!this.gridApi) {
      this.logger.warn('Cannot apply grid state — grid is not ready');
      return;
    }
    if (state?.columnFormats) {
      const { columnFormats, ...gridState } = state;
      this.restoreColumnFormats(columnFormats);
      this.gridApi.setState(gridState as GridState);
    } else {
      this.gridApi.setState(state as GridState);
    }
  }

  // ── Format mode UI methods ──

  toggleFormatMode(): void {
    this.formatMode = !this.formatMode;
    this.popover = null;
    if (this.formatMode) {
      this.attachHeaderClickListener();
    } else {
      this.detachHeaderClickListener();
    }
  }

  closePopover(): void {
    this.popover = null;
  }

  selectFormatType(type: FormatType): void {
    this.selectedFormatType = type;
  }

  adjustDecimals(delta: number): void {
    this.selectedFormatDecimals = Math.max(0, Math.min(10, this.selectedFormatDecimals + delta));
  }

  hasColumnFormat(colId: string): boolean {
    return this.columnFormats.has(colId);
  }

  getFormattedColumnCount(): number {
    return this.columnFormats.size;
  }

  applyAndClose(): void {
    if (!this.popover || !this.gridApi) return;
    const config: ColumnFormatConfig = {
      type: this.selectedFormatType,
      decimals: this.selectedFormatDecimals,
    };
    this.columnFormats.set(this.popover.colId, config);
    this.applyFormatterToColumn(this.popover.colId, config);
    this.popover = null;
  }

  clearColumnFormat(): void {
    if (!this.popover || !this.gridApi) return;
    this.columnFormats.delete(this.popover.colId);
    this.restoreOriginalFormatter(this.popover.colId);
    this.selectedFormatType = 'number';
    this.selectedFormatDecimals = 2;
  }

  private attachHeaderClickListener(): void {
    this.detachHeaderClickListener();
    this.headerClickListener = (e: MouseEvent) => {
      const headerCell = (e.target as HTMLElement).closest('.ag-header-cell') as HTMLElement | null;
      if (!headerCell) return;
      if ((e.target as HTMLElement).closest('.ag-header-cell-menu-button, .ag-header-cell-filter-button')) return;
      const colId = headerCell.getAttribute('col-id');
      if (!colId) return;
      e.stopPropagation();
      e.preventDefault();
      const col = this.gridApi?.getColumn(colId);
      if (!col) return;
      const rect = headerCell.getBoundingClientRect();
      const existing = this.columnFormats.get(colId);
      this.selectedFormatType = existing?.type ?? 'number';
      this.selectedFormatDecimals = existing?.decimals ?? 2;
      this.popover = {
        colId,
        headerName: col.getColDef().headerName ?? colId,
        x: rect.left,
        y: rect.bottom + 4,
      };
    };
    this.gridContainerRef.nativeElement.addEventListener('click', this.headerClickListener, true);
  }

  private detachHeaderClickListener(): void {
    if (this.headerClickListener) {
      this.gridContainerRef.nativeElement.removeEventListener('click', this.headerClickListener, true);
      this.headerClickListener = undefined;
    }
  }

  private applyFormatterToColumn(colId: string, config: ColumnFormatConfig): void {
    const col = this.gridApi?.getColumn(colId);
    if (!col) return;
    const colDef = col.getColDef();
    if (!this.originalFormatters.has(colId)) {
      this.originalFormatters.set(colId, colDef.valueFormatter);
    }
    colDef.valueFormatter = (params: any) => applyFormat(params.value, config);
    this.gridApi?.refreshCells({ columns: [colId], force: true });
  }

  private restoreOriginalFormatter(colId: string): void {
    const col = this.gridApi?.getColumn(colId);
    if (!col) return;
    const colDef = col.getColDef();
    if (this.originalFormatters.has(colId)) {
      colDef.valueFormatter = this.originalFormatters.get(colId);
      this.originalFormatters.delete(colId);
    }
    this.gridApi?.refreshCells({ columns: [colId], force: true });
  }

  private restoreColumnFormats(formats: Record<string, ColumnFormatConfig>): void {
    for (const [colId, config] of Object.entries(formats)) {
      this.columnFormats.set(colId, config);
      // Defer formatter application until after grid state is applied
      setTimeout(() => this.applyFormatterToColumn(colId, config), 0);
    }
  }

  /**
   * Cleanup subscriptions
   */
  ngOnDestroy(): void {
    this.detachHeaderClickListener();
    this.subscriptions.unsubscribe();
    this.addRows$.complete();
    this.updateRows$.complete();
    this.deleteRows$.complete();
    if (this.themeObserver) {
      this.themeObserver.disconnect();
    }
  }
}
