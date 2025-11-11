# Macro React Grid

A wrapper component for ag-Grid that supports JSON column configuration.

## Features

- **JSON Column Configuration**: Set columns using JSON strings or arrays
- **ag-Grid Enterprise Support**: Full support for Enterprise features (requires license)
- **Flexible Configuration**: Supports both JSON strings and TypeScript arrays
- **Default Grid Options**: Includes sensible defaults for pagination, sorting, filtering, etc.
- **Custom Theme**: Configured with Alpine theme, dark blue color scheme, and custom fonts

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

## Default Grid Options

The component includes the following default options:

- **Sorting**: Enabled on all columns
- **Filtering**: Enabled on all columns
- **Resizing**: Enabled on all columns
- **Pagination**: Enabled with page size selector (10, 25, 50, 100)
- **Row Selection**: Multiple selection enabled
- **Range Selection**: Enabled
- **Animated Rows**: Enabled

You can override any of these by providing custom `gridOptions`.

## Enterprise Features

All ag-Grid modules (Community and Enterprise) are automatically registered in the component itself. You don't need to register them in your application.

**Note**: Enterprise features require a valid ag-Grid Enterprise license. The component registers `AllEnterpriseModule` automatically, so all Enterprise features are available when using this component.

## Theme Configuration

The component is configured with:
- **Theme**: Alpine
- **Color Scheme**: Dark Blue
- **Icon Set**: Alpine
- **Fonts**:
  - Default: Noto Sans
  - Header: Roboto
  - Cell: Ubuntu

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

The component uses the `ag-theme-quartz` theme. Make sure ag-Grid styles are imported in your application's global styles:

```css
@import "ag-grid-community/styles/ag-grid.css";
@import "ag-grid-community/styles/ag-theme-quartz.css";
```

## Requirements

- React 19+
- ag-grid-react 34+
- ag-grid-enterprise 34+ (optional, for Enterprise features)
