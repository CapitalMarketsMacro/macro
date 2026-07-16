import { ChangeDetectorRef, Component, OnDestroy, inject, ChangeDetectionStrategy } from '@angular/core';
import type { IStatusPanelAngularComp } from 'ag-grid-angular';
import type { GridApi, IStatusPanelParams } from 'ag-grid-community';

/** Status-panel component key used in `statusBar.statusPanels` and `components`. */
export const MACRO_GROUPING_TOGGLE = 'macroGroupingToggle';
/** Status-panel component key used in `statusBar.statusPanels` and `components`. */
export const MACRO_PIVOT_TOGGLE = 'macroPivotToggle';

const TOGGLE_STYLES = `
  .macro-grid-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0 0.5rem;
    font-size: 0.8rem;
    cursor: pointer;
    white-space: nowrap;
  }
  .macro-grid-toggle input {
    cursor: pointer;
  }
`;

/**
 * A subtle status-bar toggle for row grouping. ON shows the row-group drag panel
 * (`rowGroupPanelShow: 'always'`) so users can drag column headers into it to group; OFF hides the
 * panel AND clears any active row groups so the blotter visibly returns to a flat view.
 */
@Component({
  standalone: true,
  template: `
    <label class="macro-grid-toggle">
      <input type="checkbox" [checked]="on" (change)="onToggle($event)" aria-label="Toggle row grouping" />
      <span>Grouping</span>
    </label>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [TOGGLE_STYLES],
})
export class MacroGroupingToggleComponent implements IStatusPanelAngularComp {
  private api!: GridApi;
  on = false;

  agInit(params: IStatusPanelParams): void {
    this.api = params.api;
    const show = this.api.getGridOption('rowGroupPanelShow');
    this.on = show === 'always' || show === 'onlyWhenGrouping';
  }

  onToggle(event: Event): void {
    this.on = (event.target as HTMLInputElement).checked;
    this.api.setGridOption('rowGroupPanelShow', this.on ? 'always' : 'never');
    if (!this.on) this.api.applyColumnState({ defaultState: { rowGroup: false } });
  }
}

/**
 * A subtle status-bar toggle for pivot mode. ON flips `pivotMode` so users can build a pivot via the
 * columns tool panel / pivot drag strip (with Show Values As available on value columns); OFF returns
 * to the flat/grouped view, keeping the pivot assignments for the next flip. Stays in sync when pivot
 * mode is changed elsewhere (e.g. the columns tool panel's own Pivot Mode checkbox).
 */
@Component({
  standalone: true,
  template: `
    <label class="macro-grid-toggle">
      <input type="checkbox" [checked]="on" (change)="onToggle($event)" aria-label="Toggle pivot mode" />
      <span>Pivot</span>
    </label>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [TOGGLE_STYLES],
})
export class MacroPivotToggleComponent implements IStatusPanelAngularComp, OnDestroy {
  private api!: GridApi;
  private cdr = inject(ChangeDetectorRef);
  on = false;

  private readonly syncFromGrid = (): void => {
    this.on = !!this.api.getGridOption('pivotMode');
    // markForCheck so the checkbox rebinds in zoneless hosts too (macro-workspace).
    this.cdr.markForCheck();
  };

  agInit(params: IStatusPanelParams): void {
    this.api = params.api;
    this.on = !!this.api.getGridOption('pivotMode');
    this.api.addEventListener('columnPivotModeChanged', this.syncFromGrid);
  }

  onToggle(event: Event): void {
    this.on = (event.target as HTMLInputElement).checked;
    this.api.setGridOption('pivotMode', this.on);
  }

  ngOnDestroy(): void {
    if (this.api && !this.api.isDestroyed()) {
      this.api.removeEventListener('columnPivotModeChanged', this.syncFromGrid);
    }
  }
}
