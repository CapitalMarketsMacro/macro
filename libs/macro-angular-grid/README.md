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

The component uses the `ag-theme-quartz` theme. Make sure ag-Grid styles are imported in your application's global styles:

```css
@import "ag-grid-community/styles/ag-grid.css";
@import "ag-grid-community/styles/ag-theme-quartz.css";
```

## Requirements

- Angular 20+
- ag-grid-angular 34+
- ag-grid-enterprise 34+ (optional, for Enterprise features)
