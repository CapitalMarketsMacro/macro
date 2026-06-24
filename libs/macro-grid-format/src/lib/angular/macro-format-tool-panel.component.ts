import { Component, computed, signal } from '@angular/core';
import type { IToolPanelAngularComp } from 'ag-grid-angular';
import type { IToolPanelParams } from 'ag-grid-community';
import {
  FORMAT_REGISTRY,
  type ColumnFormatSpec,
  type FormatKindDef,
  type FormattableColumn,
  type FormatPreset,
  formatValue,
  kindsByGroup,
  presetsByGroup,
  previewStyle,
  setSpecField,
} from '../../index';
import type { ColumnFormatStore } from '../column-format-store';

/** Params AG Grid passes to the panel — our `store` is merged in via `toolPanelParams`. */
export interface FormatToolPanelParams extends IToolPanelParams {
  store: ColumnFormatStore;
}

const SAMPLE_ROW = { symbol: 'EURUSD' };

/**
 * The "Format" sideBar tool panel (Angular). A thin, signal-driven renderer over the shared
 * {@link FORMAT_REGISTRY} / presets that drives the framework-agnostic {@link ColumnFormatStore}.
 * Holds no formatting logic of its own — everything routes through the store + engine.
 */
@Component({
  selector: 'lib-macro-format-tool-panel',
  standalone: true,
  templateUrl: './macro-format-tool-panel.component.html',
  styleUrl: './macro-format-tool-panel.component.css',
})
export class MacroFormatToolPanelComponent implements IToolPanelAngularComp {
  private params!: FormatToolPanelParams;
  private store!: ColumnFormatStore;
  private unsubscribe?: () => void;
  private columnListener?: () => void;

  readonly presetGroups = presetsByGroup();
  readonly kindGroups = kindsByGroup();

  readonly columns = signal<FormattableColumn[]>([]);
  readonly search = signal('');
  readonly selected = signal<Set<string>>(new Set());
  readonly draft = signal<ColumnFormatSpec>({ kind: 'number', decimals: 2 });
  readonly active = signal<[string, ColumnFormatSpec][]>([]);

  readonly filteredColumns = computed(() => {
    const q = this.search().trim().toLowerCase();
    const cols = this.columns();
    if (!q) return cols;
    return cols.filter((c) => c.headerName.toLowerCase().includes(q) || c.colId.toLowerCase().includes(q));
  });

  readonly currentKind = computed<FormatKindDef>(() => FORMAT_REGISTRY[this.draft().kind]);

  readonly preview = computed(() => {
    const def = this.currentKind();
    return formatValue(def.example, this.draft(), SAMPLE_ROW);
  });

  /** Style overlay (font weight/italic, colour) applied to the preview text so it reflects the draft. */
  readonly previewCss = computed(() => previewStyle(this.draft(), this.currentKind().example));

  agInit(params: FormatToolPanelParams): void {
    this.params = params;
    this.store = params.store;
    this.refreshColumns();
    this.refreshActive();
    this.unsubscribe = this.store.onChange(() => {
      this.refreshColumns();
      this.refreshActive();
    });
    this.columnListener = () => this.refreshColumns();
    this.params.api.addEventListener('displayedColumnsChanged', this.columnListener);
  }

  /** Required by IToolPanel; returning true keeps the panel mounted across sideBar updates. */
  refresh(): boolean {
    return true;
  }

  ngOnDestroy(): void {
    this.unsubscribe?.();
    if (this.columnListener) {
      this.params?.api.removeEventListener('displayedColumnsChanged', this.columnListener);
    }
  }

  private refreshColumns(): void {
    this.columns.set(this.store.listFormattableColumns());
  }

  private refreshActive(): void {
    this.active.set(this.store.entries());
  }

  // ── column selection ──

  toggleColumn(colId: string): void {
    const next = new Set(this.selected());
    if (next.has(colId)) next.delete(colId);
    else next.add(colId);
    this.selected.set(next);
  }

  isSelected(colId: string): boolean {
    return this.selected().has(colId);
  }

  clearSelection(): void {
    this.selected.set(new Set());
  }

  // ── editor ──

  selectPreset(preset: FormatPreset): void {
    this.draft.set({ ...preset.spec });
  }

  selectKind(kind: FormatKindDef): void {
    this.draft.set({ ...kind.defaults });
  }

  onField(key: string, raw: unknown): void {
    this.draft.set(setSpecField(this.draft(), key, raw));
  }

  onStep(key: string, delta: number, min = 0, max = 10): void {
    const current = Number((this.draft() as Record<string, unknown>)[key] ?? 0);
    const value = Math.max(min, Math.min(max, current + delta));
    this.onField(key, value);
  }

  onToggle(key: string): void {
    this.onField(key, !(this.draft() as Record<string, unknown>)[key]);
  }

  specValue(key: string): unknown {
    return (this.draft() as Record<string, unknown>)[key];
  }

  strVal(key: string): string {
    const v = this.specValue(key);
    return v == null ? '' : String(v);
  }

  boolVal(key: string): boolean {
    return Boolean(this.specValue(key));
  }

  // ── apply / reset ──

  canApply(): boolean {
    return this.selected().size > 0;
  }

  apply(): void {
    const spec = this.draft();
    for (const colId of this.selected()) this.store.apply(colId, spec);
  }

  resetSelected(): void {
    for (const colId of this.selected()) this.store.clear(colId);
  }

  resetAll(): void {
    this.store.clearAll();
  }

  removeActive(colId: string): void {
    this.store.clear(colId);
  }

  headerFor(colId: string): string {
    return this.columns().find((c) => c.colId === colId)?.headerName ?? colId;
  }
}
