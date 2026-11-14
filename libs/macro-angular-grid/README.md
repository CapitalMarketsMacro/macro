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
| `getRowId` | `(params: GetRowIdParams) => string` | Function to get row ID for each row (useful for tracking rows when data changes) | `undefined` |
| `columnFormats` | `ColumnFormatMap` | Initial capital-markets column formats (`colId -> ColumnFormatSpec` from `@macro/macro-grid-format`), applied on grid ready; users can change them via the **Format** tool panel, and saved view state overrides them on restore | `undefined` |

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

## Using getRowId

The `getRowId` function is useful for tracking rows when data changes. This is especially important when using `applyTransaction` to update grid data.

```typescript
import { Component, ViewChild } from '@angular/core';
import { MacroAngularGrid } from '@macro/macro-angular-grid';
import { GetRowIdParams } from 'ag-grid-community';

@Component({
  selector: 'app-example',
  imports: [MacroAngularGrid],
  template: `
    <div style="height: 400px; width: 100%;">
      <lib-macro-angular-grid
        [columns]="columnsJson"
        [rowData]="rowData"
        [getRowId]="getRowId">
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

  // Get row ID from the data
  getRowId = (params: GetRowIdParams): string => {
    return params.data.id.toString();
  };
}
```

## Updating Grid Data with applyTransaction

The component provides a public `applyTransaction` method that allows you to update grid data programmatically. This is useful for real-time data updates, adding/removing rows, or updating existing rows.

```typescript
import { Component, ViewChild, AfterViewInit } from '@angular/core';
import { MacroAngularGrid } from '@macro/macro-angular-grid';
import { GetRowIdParams, RowNodeTransaction } from 'ag-grid-community';

@Component({
  selector: 'app-example',
  imports: [MacroAngularGrid],
  template: `
    <div>
      <button (click)="addRow()">Add Row</button>
      <button (click)="updateRow()">Update Row</button>
      <button (click)="removeRow()">Remove Row</button>
      <div style="height: 400px; width: 100%;">
        <lib-macro-angular-grid
          #grid
          [columns]="columnsJson"
          [rowData]="rowData"
          [getRowId]="getRowId">
        </lib-macro-angular-grid>
      </div>
    </div>
  `
})
export class ExampleComponent implements AfterViewInit {
  @ViewChild('grid') gridComponent!: MacroAngularGrid;

  columnsJson = JSON.stringify([
    { field: 'id', headerName: 'ID', width: 100 },
    { field: 'name', headerName: 'Name', width: 200 },
    { field: 'age', headerName: 'Age', width: 100 },
  ]);

  rowData = [
    { id: 1, name: 'John Doe', age: 30 },
    { id: 2, name: 'Jane Smith', age: 25 },
  ];

  getRowId = (params: GetRowIdParams): string => {
    return params.data.id.toString();
  };

  ngAfterViewInit(): void {
    // Grid is ready, you can now use applyTransaction
  }

  addRow(): void {
    const transaction: RowNodeTransaction = {
      add: [{ id: 3, name: 'New User', age: 28 }],
    };
    this.gridComponent.applyTransaction(transaction);
  }

  updateRow(): void {
    const transaction: RowNodeTransaction = {
      update: [{ id: 1, name: 'Updated Name', age: 31 }],
    };
    this.gridComponent.applyTransaction(transaction);
  }

  removeRow(): void {
    const transaction: RowNodeTransaction = {
      remove: [{ id: 2 }],
    };
    this.gridComponent.applyTransaction(transaction);
  }

  // Combined transaction example
  combinedTransaction(): void {
    const transaction: RowNodeTransaction = {
      add: [{ id: 4, name: 'New User 2', age: 30 }],
      update: [{ id: 1, name: 'Updated Name', age: 31 }],
      remove: [{ id: 2 }],
    };
    this.gridComponent.applyTransaction(transaction);
  }
}
```

### Public Methods

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `applyTransaction(transaction: RowNodeTransaction)` | Apply a transaction to update grid data (add, update, or remove rows) | `transaction` - Object with `add`, `update`, and/or `remove` arrays | `void` |
| `getGridApi()` | Get the underlying GridApi instance | None | `GridApi \| undefined` |
| `getGridState()` | Serialize grid state (columns, filters, user column formats under `columnFormats`) for persistence | None | `any` |
| `applyGridState(state)` | Restore previously saved grid state (rebuilds `valueFormatter`s from the stored format specs) | `state` from `getGridState()` | `void` |

**Note**: `applyTransaction` requires the grid to be ready. Make sure to call it after the grid has been initialized (e.g., in `ngAfterViewInit` or after the `gridReady` event).

## RxJS Subjects for Row Operations

The component exposes RxJS subjects that allow consumers to publish row data for add/update/delete operations. This provides a reactive way to update the grid data.

### Using RxJS Subjects

```typescript
import { Component, ViewChild, AfterViewInit } from '@angular/core';
import { MacroAngularGrid } from '@macro/macro-angular-grid';
import { GetRowIdParams } from 'ag-grid-community';

@Component({
  selector: 'app-example',
  imports: [MacroAngularGrid],
  template: `
    <div>
      <button (click)="addNewRow()">Add Row</button>
      <button (click)="updateExistingRow()">Update Row</button>
      <button (click)="deleteRow()">Delete Row</button>
      <div style="height: 400px; width: 100%;">
        <lib-macro-angular-grid
          #grid
          [columns]="columnsJson"
          [rowData]="rowData"
          [getRowId]="getRowId">
        </lib-macro-angular-grid>
      </div>
    </div>
  `
})
export class ExampleComponent implements AfterViewInit {
  @ViewChild('grid') gridComponent!: MacroAngularGrid;

  columnsJson = JSON.stringify([
    { field: 'id', headerName: 'ID', width: 100 },
    { field: 'name', headerName: 'Name', width: 200 },
    { field: 'age', headerName: 'Age', width: 100 },
  ]);

  rowData = [
    { id: 1, name: 'John Doe', age: 30 },
    { id: 2, name: 'Jane Smith', age: 25 },
  ];

  getRowId = (params: GetRowIdParams): string => {
    return params.data.id.toString();
  };

  ngAfterViewInit(): void {
    // Grid is ready, you can now use the subjects
  }

  addNewRow(): void {
    // Publish to addRows$ subject
    this.gridComponent.addRows$.next([
      { id: 3, name: 'New User', age: 28 }
    ]);
  }

  updateExistingRow(): void {
    // Publish to updateRows$ subject
    this.gridComponent.updateRows$.next([
      { id: 1, name: 'Updated Name', age: 31 }
    ]);
  }

  deleteRow(): void {
    // Publish to deleteRows$ subject
    // Note: For delete, you only need to provide the row ID or the row data
    this.gridComponent.deleteRows$.next([
      { id: 2 }
    ]);
  }
}
```

### Reactive Data Updates

You can also connect these subjects to other RxJS streams:

```typescript
import { Component, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { MacroAngularGrid } from '@macro/macro-angular-grid';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

@Component({
  selector: 'app-example',
  imports: [MacroAngularGrid],
  template: `
    <div style="height: 400px; width: 100%;">
      <lib-macro-angular-grid
        #grid
        [columns]="columnsJson"
        [rowData]="rowData"
        [getRowId]="getRowId">
      </lib-macro-angular-grid>
    </div>
  `
})
export class ExampleComponent implements OnInit, OnDestroy {
  @ViewChild('grid') gridComponent!: MacroAngularGrid;
  private subscription = new Subscription();

  // Your data source
  private dataSource$ = new Subject<any[]>();

  columnsJson = JSON.stringify([
    { field: 'id', headerName: 'ID', width: 100 },
    { field: 'name', headerName: 'Name', width: 200 },
  ]);

  rowData = [
    { id: 1, name: 'John Doe' },
  ];

  getRowId = (params: GetRowIdParams): string => {
    return params.data.id.toString();
  };

  ngOnInit(): void {
    // Connect your data source to the grid's addRows$ subject
    this.subscription.add(
      this.dataSource$
        .pipe(debounceTime(100)) // Debounce updates
        .subscribe((newRows) => {
          this.gridComponent.addRows$.next(newRows);
        })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  // Method to receive data from external source (e.g., WebSocket, API)
  onDataReceived(data: any[]): void {
    this.dataSource$.next(data);
  }
}
```

### Available Subjects

| Subject | Type | Description |
|---------|------|-------------|
| `addRows$` | `Subject<unknown[]>` | Publish an array of row data objects to add new rows |
| `updateRows$` | `Subject<unknown[]>` | Publish an array of row data objects to update existing rows |
| `deleteRows$` | `Subject<unknown[]>` | Publish an array of row data objects (or objects with IDs) to delete rows |

**Important Notes:**
- The subjects are automatically subscribed to in the component's `ngOnInit` lifecycle
- The component handles subscription cleanup in `ngOnDestroy`
- Make sure `getRowId` is provided when using `updateRows$` or `deleteRows$` to properly identify rows
- The grid must be ready before publishing to subjects (wait for `ngAfterViewInit` or `gridReady` event)

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

The component uses AG Grid's **Theming API** — it applies `buildAgGridTheme(isDark)` from
`@macro/macro-design` automatically and follows the app's `.dark` class, so dark/light mode
stays in sync with the rest of the platform. No ag-Grid CSS imports are needed (and the legacy
`ag-grid.css` / `ag-theme-*.css` files must **not** be imported alongside the Theming API).

## Column formatting

The grid registers the **Format** sideBar tool panel from `@macro/macro-grid-format`: users can
apply capital-markets formats (decimal, %, bps, currency, K/MM/BN, Treasury 32nds/64ths, FX pip,
date, colour-by-sign, …) per column at runtime. Formats persist through
`getGridState()` / `applyGridState()` and can be seeded via the `columnFormats` input.

## Requirements

- Angular 22+ (standalone, zoneless-compatible)
- ag-grid-angular 36+
- ag-grid-enterprise 36+ (license required; the component registers `AllEnterpriseModule`)
