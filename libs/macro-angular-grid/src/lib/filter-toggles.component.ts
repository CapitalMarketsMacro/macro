import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  Injector,
  OnDestroy,
  afterNextRender,
  inject,
  viewChild,
  ChangeDetectionStrategy
} from '@angular/core';
import type { IStatusPanelAngularComp } from 'ag-grid-angular';
import type { GridApi, IStatusPanelParams } from 'ag-grid-community';

/** Status-panel component key used in `statusBar.statusPanels` and `components`. */
export const MACRO_QUICK_FILTER_TOGGLE = 'macroQuickFilterToggle';
/** Status-panel component key used in `statusBar.statusPanels` and `components`. */
export const MACRO_ADVANCED_FILTER_TOGGLE = 'macroAdvancedFilterToggle';

/**
 * Fired at runtime whenever `enableAdvancedFilter` flips, but classified as an internal event in
 * this AG Grid build's typings (excluded from the public `addEventListener` union) — cast the
 * documented name so the toggle can still stay in sync with programmatic changes.
 */
const ADVANCED_FILTER_ENABLED_CHANGED = 'advancedFilterEnabledChanged' as unknown as Parameters<
  GridApi['addEventListener']
>[0];

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
 * A subtle status-bar "Search" toggle for AG Grid's Quick Filter. Checking it reveals an inline
 * search box (auto-focused) right next to the toggle — search lives with all the other grid
 * controls, no app markup needed. Typing drives `quickFilterText` (all columns, all words must
 * match); Escape clears; unchecking clears the filter too so no hidden filter lingers.
 */
@Component({
  standalone: true,
  template: `
    <span class="macro-quick-filter">
      <label class="macro-grid-toggle">
        <input type="checkbox" [checked]="on" (change)="onToggle($event)" aria-label="Toggle quick filter search" />
        <span>Search</span>
      </label>
      @if (on) {
        <input
          #box
          class="macro-quick-filter__input"
          type="search"
          [value]="text"
          placeholder="Search all columns…"
          aria-label="Quick filter text"
          (input)="onText($event)"
          (keydown.escape)="clear()"
        />
      }
    </span>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [
    TOGGLE_STYLES,
    `
      .macro-quick-filter {
        display: inline-flex;
        align-items: center;
      }
      .macro-quick-filter__input {
        /* Shrinks on narrow blotter tiles so the other toggles stay in view. */
        width: clamp(6rem, 18vw, 11rem);
        font-size: 0.8rem;
        padding: 0.15rem 0.45rem;
        margin-right: 0.5rem;
        /* The input-specific theme tokens — same border/fill as the grid's own filter inputs,
           visible in dark mode (the plain border/background pair is ~1.1:1 there). */
        border: var(--ag-input-border, 1px solid #babfc7);
        border-radius: 3px;
        background: var(--ag-input-background-color, transparent);
        color: inherit;
        outline: none;
      }
      .macro-quick-filter__input:focus {
        border-color: var(--ag-accent-color, #2196f3);
      }
    `,
  ],
})
export class MacroQuickFilterToggleComponent implements IStatusPanelAngularComp {
  private api!: GridApi;
  private readonly injector = inject(Injector);
  private readonly box = viewChild<ElementRef<HTMLInputElement>>('box');
  on = false;
  text = '';

  agInit(params: IStatusPanelParams): void {
    this.api = params.api;
    // Respect a quickFilterText the consumer seeded via gridOptions.
    const initial = this.api.getGridOption('quickFilterText');
    this.text = initial ?? '';
    this.on = !!initial;
  }

  onToggle(event: Event): void {
    this.on = (event.target as HTMLInputElement).checked;
    if (this.on) {
      // Focus after the @if input has actually rendered — under zoneless CD a bare setTimeout
      // can fire before the scheduled render, when the input doesn't exist yet.
      afterNextRender(() => this.box()?.nativeElement.focus(), { injector: this.injector });
    } else {
      this.text = '';
      this.api.setGridOption('quickFilterText', '');
    }
  }

  onText(event: Event): void {
    this.text = (event.target as HTMLInputElement).value;
    this.api.setGridOption('quickFilterText', this.text);
  }

  clear(): void {
    this.text = '';
    this.api.setGridOption('quickFilterText', '');
  }
}

/**
 * A subtle status-bar toggle for AG Grid Enterprise's Advanced Filter (the expression builder
 * that appears above the grid). ON flips `enableAdvancedFilter`; note AG Grid then disables the
 * per-column filters (native behaviour — the two are mutually exclusive), while the Quick Filter
 * keeps working alongside. Stays in sync when advanced filter is enabled/disabled elsewhere.
 */
@Component({
  standalone: true,
  template: `
    <label class="macro-grid-toggle">
      <input type="checkbox" [checked]="on" (change)="onToggle($event)" aria-label="Toggle advanced filter" />
      <span>Adv Filter</span>
    </label>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [TOGGLE_STYLES],
})
export class MacroAdvancedFilterToggleComponent implements IStatusPanelAngularComp, OnDestroy {
  private api!: GridApi;
  private cdr = inject(ChangeDetectorRef);
  on = false;

  private readonly syncFromGrid = (): void => {
    this.on = !!this.api.getGridOption('enableAdvancedFilter');
    // markForCheck so the checkbox rebinds in zoneless hosts too (macro-workspace).
    this.cdr.markForCheck();
  };

  agInit(params: IStatusPanelParams): void {
    this.api = params.api;
    this.on = !!this.api.getGridOption('enableAdvancedFilter');
    this.api.addEventListener(ADVANCED_FILTER_ENABLED_CHANGED, this.syncFromGrid);
  }

  onToggle(event: Event): void {
    this.on = (event.target as HTMLInputElement).checked;
    this.api.setGridOption('enableAdvancedFilter', this.on);
  }

  ngOnDestroy(): void {
    if (this.api && !this.api.isDestroyed()) {
      this.api.removeEventListener(ADVANCED_FILTER_ENABLED_CHANGED, this.syncFromGrid);
    }
  }
}
