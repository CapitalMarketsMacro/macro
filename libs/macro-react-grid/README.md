# Macro React Grid

A wrapper component for ag-Grid that supports JSON column configuration.

## Features

- **JSON Column Configuration**: Set columns using JSON strings or arrays
- **ag-Grid Enterprise Support**: Full support for Enterprise features (requires license)
- **Flexible Configuration**: Supports both JSON strings and TypeScript arrays
- **Default Grid Options**: Includes sensible defaults for pagination, sorting, filtering, etc.
- **Shared Theme**: Applies `buildAgGridTheme(isDark)` from `@macro/macro-design` (Theming API) and follows the app's `.dark` class automatically
- **Column Formatting**: Registers the **Format** sideBar tool panel from `@macro/macro-grid-format`
- **Reactive updates**: `addRows$` / `updateRows$` / `deleteRows$` subjects exposed via ref

## Installation

The component is already included in the monorepo. Make sure ag-Grid packages are installed:

```bash
npm install ag-grid-react ag-grid-enterprise
```

## Usage

### Basic Usage with JSON String

```typescript
import { MacroReactGrid } from '@macro/macro-react-grid';
import { useMemo } from 'react';

function MyComponent() {
  const columnsJson = useMemo(
    () =>
      JSON.stringify([
        { field: 'id', headerName: 'ID', width: 100 },
        { field: 'name', headerName: 'Name', width: 200 },
        { field: 'age', headerName: 'Age', width: 100 },
      ]),
    []
  );

  const rowData = useMemo(
    () => [
      { id: 1, name: 'John Doe', age: 30 },
      { id: 2, name: 'Jane Smith', age: 25 },
    ],
    []
  );

  return (
    <div style={{ height: '400px', width: '100%' }}>
      <MacroReactGrid columns={columnsJson} rowData={rowData} />
    </div>
  );
}
```

### Usage with TypeScript Array

```typescript
import { MacroReactGrid } from '@macro/macro-react-grid';
import { ColDef } from 'ag-grid-community';
import { useMemo } from 'react';

function MyComponent() {
  const columnsArray: ColDef[] = useMemo(
    () => [
      { field: 'id', headerName: 'ID', width: 100 },
      { field: 'name', headerName: 'Name', width: 200 },
      { field: 'age', headerName: 'Age', width: 100 },
    ],
    []
  );

  const rowData = useMemo(
    () => [
      { id: 1, name: 'John Doe', age: 30 },
      { id: 2, name: 'Jane Smith', age: 25 },
    ],
    []
  );

  return (
    <div style={{ height: '400px', width: '100%' }}>
      <MacroReactGrid columns={columnsArray} rowData={rowData} />
    </div>
  );
}
```

### Advanced Usage with Custom Grid Options

```typescript
import { MacroReactGrid } from '@macro/macro-react-grid';
import { GridOptions } from 'ag-grid-community';
import { useMemo } from 'react';

function MyComponent() {
  const columnsJson = useMemo(
    () =>
      JSON.stringify([
        { field: 'id', headerName: 'ID', width: 100 },
        { field: 'name', headerName: 'Name', width: 200 },
      ]),
    []
  );

  const rowData = useMemo(
    () => [
      { id: 1, name: 'John Doe' },
      { id: 2, name: 'Jane Smith' },
    ],
    []
  );

  const customGridOptions: GridOptions = useMemo(
    () => ({
      pagination: true,
      paginationPageSize: 20,
      enableRangeSelection: true,
      rowSelection: 'single',
    }),
    []
  );

  return (
    <div style={{ height: '600px', width: '100%' }}>
      <MacroReactGrid
        columns={columnsJson}
        rowData={rowData}
        gridOptions={customGridOptions}
      />
    </div>
  );
}
```

## Props

| Prop | Type | Description | Default |
|------|------|-------------|---------|
| `columns` | `string \| ColDef[]` | Column definitions as JSON string or array | `[]` |
| `rowData` | `unknown[]` | Row data for the grid | `[]` |
| `gridOptions` | `GridOptions` | Additional grid options (merged with defaults) | `{}` |
| `getRowId` | `(params: GetRowIdParams) => string` | Function to get row ID for each row (needed for keyed updates/deletes) | `undefined` |
| `columnFormats` | `ColumnFormatMap` | Initial capital-markets column formats (`colId -> ColumnFormatSpec` from `@macro/macro-grid-format`), applied on grid ready; users can change them via the **Format** tool panel, and saved view state overrides them on restore | `undefined` |

## Ref API (`MacroReactGridRef`)

The component is a `forwardRef`. Attach a ref to drive the grid imperatively or reactively:

```typescript
import { MacroReactGrid, MacroReactGridRef } from '@macro/macro-react-grid';
import { useRef } from 'react';

function MyComponent() {
  const gridRef = useRef<MacroReactGridRef>(null);

  // Real-time updates (e.g. from a WebSocket handler):
  // gridRef.current?.updateRows$.next([{ id: 1, price: 101.25 }]);
  // gridRef.current?.addRows$.next([{ id: 3, price: 99.5 }]);
  // gridRef.current?.deleteRows$.next([{ id: 2 }]);

  return <MacroReactGrid ref={gridRef} columns={...} rowData={...} getRowId={...} />;
}
```

| Member | Description |
|--------|-------------|
| `applyTransaction(transaction)` | Apply an AG Grid `RowNodeTransaction` (`add` / `update` / `remove`) |
| `getGridApi()` | The underlying `GridApi` (or `undefined` before ready) |
| `getGridState()` / `applyGridState(state)` | Save/restore grid state, including user column formats (`columnFormats` key) |
| `addRows$` / `updateRows$` / `deleteRows$` | RxJS `Subject<unknown[]>`s — publish row arrays for reactive add/update/delete (provide `getRowId` for update/delete) |

## Default Grid Options

The component includes the following default options:

- **Sorting**: Enabled on all columns
- **Filtering**: Enabled on all columns (column filters; see the status-bar toggles below for Quick/Advanced Filter)
- **Resizing**: Enabled on all columns
- **Pagination**: OFF by default, with a page size selector (10, 25, 50, 100) once enabled
- **Row Selection**: Multiple selection enabled
- **Range Selection**: Enabled
- **Animated Rows**: Enabled
- **Status-bar toggles** (bottom-right, feel native to the grid):
  - **Search** — reveals an inline quick-filter box (drives `quickFilterText`: filters every column, all words must match; Escape clears; unchecking clears the filter)
  - **Adv Filter** — flips AG Grid Enterprise's Advanced Filter builder (`enableAdvancedFilter`; column filters are disabled by AG Grid while it is on, the quick filter keeps working)
  - **Grouping** — shows the row-group drag panel; unchecking also clears active groups
  - **Pivot** — flips pivot mode (stays in sync with the columns tool panel)
  - **Pagination** — turns pagination on/off at runtime

You can override any of these by providing custom `gridOptions`.

## Enterprise Features

All ag-Grid modules (Community and Enterprise) are automatically registered in the component itself. You don't need to register them in your application.

**Note**: Enterprise features require a valid ag-Grid Enterprise license. The component registers `AllEnterpriseModule` automatically, so all Enterprise features are available when using this component.

## Theme Configuration

The component builds its theme with `buildAgGridTheme(isDark)` from `@macro/macro-design`
(single source of truth, shared with the Angular wrapper) and re-applies it when the app's
`.dark` class toggles:

- **Base theme**: Quartz (AG Grid v36 Theming API)
- **Icon set**: Material
- **Color scheme**: Dark Blue (dark) / Light, plus Macro E-Trading dark tokens
- **Fonts**: Roboto for chrome/headers, IBM Plex Mono for data cells (aligned digits)

## Column Definition Examples

### Basic Column

```json
{
  "field": "name",
  "headerName": "Name",
  "width": 200
}
```

### Column with Custom Renderer

```json
{
  "field": "price",
  "headerName": "Price",
  "width": 150,
  "valueFormatter": "params => '$' + params.value.toFixed(2)"
}
```

### Column with Filter

```json
{
  "field": "status",
  "headerName": "Status",
  "width": 150,
  "filter": "agSetColumnFilter",
  "filterParams": {
    "values": ["Active", "Inactive", "Pending"]
  }
}
```

## Styling

The theme is applied via AG Grid's **Theming API** — no ag-Grid CSS imports are needed (and the
legacy `ag-grid.css` / `ag-theme-*.css` files must **not** be imported alongside it).

## Requirements

- React 19+
- ag-grid-react 36+
- ag-grid-enterprise 36+ (license required; the component registers `AllEnterpriseModule`)
