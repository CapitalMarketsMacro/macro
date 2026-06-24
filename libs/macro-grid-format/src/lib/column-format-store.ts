/**
 * Framework-agnostic engine that owns column formats for one grid. Both the Angular and
 * React wrappers construct a single `new ColumnFormatStore(() => gridApi)` and the tool
 * panels drive it. It is the ONLY place that mutates `colDef.valueFormatter` /
 * `colDef.cellStyle`, so the back-up/restore and reconciliation logic lives in one tested
 * unit (replacing the duplicated logic that used to live in each wrapper).
 */

import type { ColDef, Column, GridApi, ValueFormatterFunc } from 'ag-grid-community';
import type { ColumnFormatMap, ColumnFormatSpec } from './format-spec';
import { buildCellStyle, buildValueFormatter } from './format-engine';

export interface FormattableColumn {
  colId: string;
  headerName: string;
  /** True when a user format is currently applied to this column. */
  active: boolean;
}

export class ColumnFormatStore {
  /** colId -> the currently applied spec. */
  private readonly formats = new Map<string, ColumnFormatSpec>();
  /** colId -> the column's original (app-defined) valueFormatter, captured once. */
  private readonly originalFormatters = new Map<string, ColDef['valueFormatter']>();
  /** colId -> the column's original (app-defined) cellStyle, captured once. */
  private readonly originalCellStyles = new Map<string, ColDef['cellStyle']>();
  /** colId -> the valueFormatter WE installed (identity check for reconciliation). */
  private readonly installedFormatters = new Map<string, ValueFormatterFunc>();
  /** colId -> the cellStyle WE installed (only when colour mode is active). */
  private readonly installedStyles = new Map<string, ColDef['cellStyle']>();
  /** Every formatter/style function we have ever produced (to never back one up as "original"). */
  private readonly ours = new WeakSet<object>();
  private readonly listeners = new Set<() => void>();

  constructor(private readonly getApi: () => GridApi | undefined) {}

  /** Apply (or replace) a format on a column. */
  apply(colId: string, spec: ColumnFormatSpec): void {
    this.formats.set(colId, spec);
    this.captureOriginals(colId);
    this.mutate(colId);
    this.refresh(colId);
    this.emit();
  }

  /** Remove the user format from a column, restoring its original formatter + cellStyle. */
  clear(colId: string): void {
    this.clearOne(colId);
    this.emit();
  }

  /** Remove all user formats, restoring every original. */
  clearAll(): void {
    for (const colId of [...this.formats.keys()]) this.clearOne(colId);
    this.emit();
  }

  has(colId: string): boolean {
    return this.formats.has(colId);
  }

  get(colId: string): ColumnFormatSpec | undefined {
    return this.formats.get(colId);
  }

  entries(): [string, ColumnFormatSpec][] {
    return [...this.formats.entries()];
  }

  size(): number {
    return this.formats.size;
  }

  /** List every column the panel can format, marking which already have a format. */
  listFormattableColumns(): FormattableColumn[] {
    const cols: Column[] = this.getApi()?.getColumns() ?? [];
    return cols.map((col) => {
      const colId = col.getColId();
      const def = col.getColDef();
      return { colId, headerName: def.headerName ?? colId, active: this.formats.has(colId) };
    });
  }

  /** Serialize to the persisted bare map, or `undefined` when nothing is formatted. */
  serialize(): ColumnFormatMap | undefined {
    return this.formats.size > 0 ? (Object.fromEntries(this.formats) as ColumnFormatMap) : undefined;
  }

  /**
   * Restore formats from a (already-migrated) map. Applies every format whose column is
   * present now; columns not yet loaded are applied later by {@link reconcile} (the wrapper
   * wires it to `firstDataRendered` / `displayedColumnsChanged`).
   */
  restore(map: ColumnFormatMap): void {
    for (const colId of [...this.formats.keys()]) this.clearOne(colId);
    for (const [colId, spec] of Object.entries(map)) {
      this.formats.set(colId, spec);
      this.captureOriginals(colId);
      this.mutate(colId);
    }
    this.refreshAll();
    this.emit();
  }

  /**
   * Re-apply formats whose installed `valueFormatter` is no longer on the colDef — this
   * happens when the app rebuilds its `columnDefs` (e.g. a React `useMemo`) or columns
   * load after a restore. Never backs up one of our own functions as the "original".
   */
  reconcile(): void {
    const api = this.getApi();
    if (!api || this.formats.size === 0) return;
    let changed = false;
    for (const colId of this.formats.keys()) {
      const col = api.getColumn(colId);
      if (!col) continue;
      const colDef = col.getColDef();
      const installed = this.installedFormatters.get(colId);
      if (installed && colDef.valueFormatter === installed) continue; // still ours
      // colDef was rebuilt (or never installed): capture the fresh app formatter, unless
      // it is (somehow) one of ours, then re-install.
      const current = colDef.valueFormatter;
      if (!(typeof current === 'function' && this.ours.has(current))) {
        this.originalFormatters.set(colId, current);
      }
      const currentStyle = colDef.cellStyle;
      if (!(typeof currentStyle === 'function' && this.ours.has(currentStyle))) {
        this.originalCellStyles.set(colId, currentStyle);
      }
      this.mutate(colId);
      changed = true;
    }
    if (changed) {
      this.refreshAll();
      this.emit();
    }
  }

  /** Subscribe to format changes (returns an unsubscribe fn). */
  onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  // ── internals ──

  private captureOriginals(colId: string): void {
    if (this.originalFormatters.has(colId)) return; // capture once
    const col = this.getApi()?.getColumn(colId);
    if (!col) return;
    const colDef = col.getColDef();
    const current = colDef.valueFormatter;
    const currentStyle = colDef.cellStyle;
    // Don't capture one of our own functions as the "original".
    this.originalFormatters.set(colId, typeof current === 'function' && this.ours.has(current) ? undefined : current);
    this.originalCellStyles.set(
      colId,
      typeof currentStyle === 'function' && this.ours.has(currentStyle) ? undefined : currentStyle,
    );
  }

  /** Install the built valueFormatter + (optional) coloured cellStyle onto the live colDef. */
  private mutate(colId: string): boolean {
    const col = this.getApi()?.getColumn(colId);
    const spec = this.formats.get(colId);
    if (!col || !spec) return false;
    const colDef = col.getColDef();

    const vf = buildValueFormatter(spec);
    this.ours.add(vf);
    colDef.valueFormatter = vf;
    this.installedFormatters.set(colId, vf);

    const mode = (spec as { colorMode?: string }).colorMode;
    if (mode && mode !== 'none') {
      const styled = buildCellStyle(spec, this.originalCellStyles.get(colId));
      if (typeof styled === 'function') this.ours.add(styled);
      colDef.cellStyle = styled;
      this.installedStyles.set(colId, styled);
    } else if (this.installedStyles.has(colId)) {
      // colour was removed on a re-apply → restore original cellStyle.
      colDef.cellStyle = this.originalCellStyles.get(colId);
      this.installedStyles.delete(colId);
    }
    return true;
  }

  private clearOne(colId: string): void {
    const col = this.getApi()?.getColumn(colId);
    if (col) {
      const colDef = col.getColDef();
      if (this.originalFormatters.has(colId)) colDef.valueFormatter = this.originalFormatters.get(colId);
      if (this.installedStyles.has(colId)) colDef.cellStyle = this.originalCellStyles.get(colId);
      this.refresh(colId);
    }
    this.formats.delete(colId);
    this.originalFormatters.delete(colId);
    this.originalCellStyles.delete(colId);
    this.installedFormatters.delete(colId);
    this.installedStyles.delete(colId);
  }

  private refresh(colId: string): void {
    this.getApi()?.refreshCells({ columns: [colId], force: true });
  }

  private refreshAll(): void {
    this.getApi()?.refreshCells({ force: true });
  }

  private emit(): void {
    for (const cb of this.listeners) cb();
  }
}
