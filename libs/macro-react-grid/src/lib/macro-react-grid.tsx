import { useEffect, useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  ColDef,
  GridOptions,
  GridReadyEvent,
  ModuleRegistry,
  AllCommunityModule,
  Theme,
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
} from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';

// Register all ag-Grid modules (Community and Enterprise)
// This ensures all features are available without requiring registration in the application
ModuleRegistry.registerModules([
  AllCommunityModule,
  AllEnterpriseModule,
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
}

/**
 * Macro React Grid Component
 * Wraps ag-Grid with support for JSON column configuration
 */
export function MacroReactGrid({
  columns = [],
  rowData = [],
  gridOptions = {},
}: MacroReactGridProps) {
  const [theme, setTheme] = useState<Theme | undefined>(undefined);

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
    }),
    [defaultGridOptions, gridOptions, columnDefs, rowData]
  );

  // Initialize theme
  useEffect(() => {
    const baseTheme = themeAlpine;
    let currentTheme: Theme = baseTheme;
    currentTheme = currentTheme.withPart(iconSetAlpine);
    currentTheme = currentTheme.withPart(colorSchemeDarkBlue);
    currentTheme = currentTheme.withParams({
      fontFamily: 'Noto Sans',
      headerFontFamily: 'Roboto',
      cellFontFamily: 'Ubuntu',
    });
    console.log('Setting Theme : ', currentTheme);
    setTheme(currentTheme);
  }, []);

  /**
   * Grid ready event handler
   */
  const onGridReady = (event: GridReadyEvent): void => {
    console.log('AG Grid is ready', event);
  };

  return (
    <div  style={{ height: '100%', width: '100%' }}>
      <AgGridReact
        theme={theme}
        columnDefs={columnDefs}
        rowData={rowData}
        gridOptions={mergedGridOptions}
        onGridReady={onGridReady}


      />
    </div>
  );
}

export default MacroReactGrid;
