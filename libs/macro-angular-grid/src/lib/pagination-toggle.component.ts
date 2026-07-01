import { Component } from '@angular/core';
import type { IStatusPanelAngularComp } from 'ag-grid-angular';
import type { GridApi, IStatusPanelParams } from 'ag-grid-community';

/** Status-panel component key used in `statusBar.statusPanels` and `components`. */
export const MACRO_PAGINATION_TOGGLE = 'macroPaginationToggle';

/**
 * A subtle status-bar toggle that turns AG Grid pagination on/off at runtime. Registered as the
 * `macroPaginationToggle` status panel and rendered in the grid's own status bar, so it reads as a
 * native part of the grid. Pagination defaults OFF; flipping it calls `setGridOption('pagination')`.
 */
@Component({
  standalone: true,
  template: `
    <label class="macro-pagination-toggle">
      <input type="checkbox" [checked]="on" (change)="onToggle($event)" aria-label="Toggle pagination" />
      <span>Pagination</span>
    </label>
  `,
  styles: [
    `
      .macro-pagination-toggle {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0 0.5rem;
        font-size: 0.8rem;
        cursor: pointer;
        white-space: nowrap;
      }
      .macro-pagination-toggle input {
        cursor: pointer;
      }
    `,
  ],
})
export class MacroPaginationToggleComponent implements IStatusPanelAngularComp {
  private api!: GridApi;
  on = false;

  agInit(params: IStatusPanelParams): void {
    this.api = params.api;
    this.on = !!this.api.getGridOption('pagination');
  }

  onToggle(event: Event): void {
    this.on = (event.target as HTMLInputElement).checked;
    this.api.setGridOption('pagination', this.on);
  }
}
