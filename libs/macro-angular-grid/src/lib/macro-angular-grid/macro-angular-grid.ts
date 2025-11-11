import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  ColDef,
  GridOptions,
  GridReadyEvent,
  ModuleRegistry,
  AllCommunityModule,
  Theme,
} from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import {
  colorSchemeDark,
  colorSchemeDarkBlue,
  colorSchemeDarkWarm,
  colorSchemeLight,
  colorSchemeLightCold,
  colorSchemeLightWarm,
  colorSchemeVariable,
  iconSetAlpine,
  iconSetMaterial,
  iconSetQuartzBold,
  iconSetQuartzLight,
  iconSetQuartzRegular,
  themeAlpine,
  themeBalham,
  themeQuartz,
} from "ag-grid-community";

// Register all ag-Grid modules (Community and Enterprise)
// This ensures all features are available without requiring registration in the application
ModuleRegistry.registerModules([
  AllCommunityModule,
  AllEnterpriseModule,
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
export class MacroAngularGrid implements OnInit, OnChanges {
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
   * Parsed column definitions
   */
  public columnDefs: ColDef[] = [];

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
    this.theme = this.baseTheme;
    this.theme = this.theme.withPart(iconSetAlpine)
    this.theme = this.theme.withPart(colorSchemeDarkBlue)
    this.theme = this.theme.withParams({
      fontFamily: 'Noto Sans',
      headerFontFamily: 'Roboto',
      cellFontFamily: 'Ubuntu',
    })
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['columns']) {
      this.parseColumns();
    }
    if (changes['gridOptions']) {
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
    };
  }

  /**
   * Grid ready event handler
   */
  onGridReady(event: GridReadyEvent): void {
    console.log('AG Grid is ready', event);
  }
}
