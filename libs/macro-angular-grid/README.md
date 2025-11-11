# Macro Angular Grid

A wrapper component for ag-Grid that supports JSON column configuration.

## Features

- **JSON Column Configuration**: Set columns using JSON strings or arrays
- **ag-Grid Enterprise Support**: Full support for Enterprise features (requires license)
- **Flexible Configuration**: Supports both JSON strings and TypeScript arrays
- **Default Grid Options**: Includes sensible defaults for pagination, sorting, filtering, etc.

## Installation

The component is already included in the monorepo. Make sure ag-Grid packages are installed:

```bash
npm install ag-grid-angular ag-grid-enterprise
```

## Usage

### Basic Usage with JSON String

```typescript
import { Component } from '@angular/core';
import { MacroAngularGrid } from '@macro/macro-angular-grid';

@Component({
  selector: 'app-example',
  imports: [MacroAngularGrid],
  template: `
    <div style="height: 400px; width: 100%;">
      <lib-macro-angular-grid
        [columns]="columnsJson"
        [rowData]="rowData">
      </lib-macro-angular-grid>
    </div>
  `
})
export class ExampleComponent {
  columnsJson = JSON.stringify([
    { field: 'id', headerName: 'ID', width: 100 },
    { field: 'name', headerName: 'Name', width: 200 },
    { field: 'age', headerName: 'Age', width: 100 },
  ]);

  rowData = [
    { id: 1, name: 'John Doe', age: 30 },
    { id: 2, name: 'Jane Smith', age: 25 },
  ];
}
```

### Usage with TypeScript Array

```typescript
import { Component } from '@angular/core';
import { MacroAngularGrid } from '@macro/macro-angular-grid';
import { ColDef } from 'ag-grid-community';

@Component({
  selector: 'app-example',
  imports: [MacroAngularGrid],
  template: `
    <div style="height: 400px; width: 100%;">
      <lib-macro-angular-grid
        [columns]="columnsArray"
        [rowData]="rowData">
      </lib-macro-angular-grid>
    </div>
  `
})
export class ExampleComponent {
  columnsArray: ColDef[] = [
    { field: 'id', headerName: 'ID', width: 100 },
    { field: 'name', headerName: 'Name', width: 200 },
    { field: 'age', headerName: 'Age', width: 100 },
  ];

  rowData = [
    { id: 1, name: 'John Doe', age: 30 },
    { id: 2, name: 'Jane Smith', age: 25 },
  ];
}
```

### Advanced Usage with Custom Grid Options

```typescript
import { Component } from '@angular/core';
import { MacroAngularGrid } from '@macro/macro-angular-grid';
import { GridOptions } from 'ag-grid-community';

@Component({
  selector: 'app-example',
  imports: [MacroAngularGrid],
  template: `
    <div style="height: 600px; width: 100%;">
      <lib-macro-angular-grid
        [columns]="columnsJson"
        [rowData]="rowData"
        [gridOptions]="customGridOptions">
      </lib-macro-angular-grid>
    </div>
  `
})
export class ExampleComponent {
  columnsJson = JSON.stringify([
    { field: 'id', headerName: 'ID', width: 100 },
    { field: 'name', headerName: 'Name', width: 200 },
  ]);

  rowData = [
    { id: 1, name: 'John Doe' },
    { id: 2, name: 'Jane Smith' },
  ];

  customGridOptions: GridOptions = {
    pagination: true,
    paginationPageSize: 20,
    enableRangeSelection: true,
    rowSelection: 'single',
  };
}
```

## Inputs

| Input | Type | Description | Default |
|-------|------|-------------|---------|
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

- Angular 20+
- ag-grid-angular 34+
- ag-grid-enterprise 34+ (optional, for Enterprise features)
