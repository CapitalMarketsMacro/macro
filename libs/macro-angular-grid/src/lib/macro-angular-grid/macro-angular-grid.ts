import { Component, Input, OnInit, OnChanges, OnDestroy, SimpleChanges, PLATFORM_ID, inject } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import { Subject, Subscription } from 'rxjs';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
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
} from 'ag-grid-community';
import {
  AllEnterpriseModule,
  IntegratedChartsModule,
} from 'ag-grid-enterprise';
import {
  colorSchemeDarkBlue,
  colorSchemeLight,
  iconSetAlpine,
  themeAlpine,
} from "ag-grid-community";
import { AgChartsEnterpriseModule } from 'ag-charts-enterprise';

// Register all ag-Grid modules (Community and Enterprise)
// This ensures all features are available without requiring registration in the application
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

  /**
   * Default grid options
   */
  public defaultGridOptions: GridOptions = {
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
  };

  /**
   * Merged grid options
   */
  public mergedGridOptions: GridOptions = {};

  baseTheme = themeAlpine;
  theme : Theme | undefined;

  ngOnInit(): void {
    this.parseColumns();
    this.mergeGridOptions();
    this.initializeTheme();
    this.setupThemeObserver();

    console.log('Macro Angular Grid initialized');
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
    this.theme = this.baseTheme;
    this.theme = this.theme.withPart(iconSetAlpine);
    this.theme = this.theme.withPart(isDark ? colorSchemeDarkBlue : colorSchemeLight);
    this.theme = this.theme.withParams({
      fontFamily: 'Noto Sans',
      headerFontFamily: 'Roboto',
      cellFontFamily: 'Ubuntu',
    });
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
        console.error('Error parsing columns JSON:', error);
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
    console.log('AG Grid is ready', event);
    
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
      console.warn('Initial row data has already been set. Use updateRows$ for updates.');
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
