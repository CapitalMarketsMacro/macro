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
  /**
   * colIds whose formatting is applied externally by baking the spec into the colDef (calculated
   * columns — AG Grid caches a cellDataType value formatter, so a post-hoc valueFormatter mutation
   * + refreshCells is ignored). For these the store tracks the spec (for persistence + the panel)
   * but does NOT mutate/restore/reconcile the live colDef — the grid wrapper bakes it instead.
   */
  private externallyManaged = new Set<string>();
  /**
   * When true the store NEVER touches live colDefs (no mutate / restore / reconcile) — it is a pure
   * spec registry and the grid wrapper bakes every format into the colDefs instead. This is the
   * model used by the grid wrappers (AG Grid caches/clones colDefs, so a single baking source
   * avoids the in-place-mutation ↔ columnDef-rebuild ↔ reconcile feedback loop).
   */
  private bakeMode = false;

  constructor(private readonly getApi: () => GridApi | undefined) {}

  /** Enable "bake mode": the store stops mutating colDefs; the wrapper bakes formats instead. */
  setBakeMode(on: boolean): void {
    this.bakeMode = on;
  }

  /** Declare which colIds are externally managed (their formatting is baked into the colDef). */
  setExternallyManaged(colIds: Iterable<string>): void {
    this.externallyManaged = new Set(colIds);
  }

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
    if (this.bakeMode) return; // formats live in the colDefs; nothing to reconcile
    const api = this.getApi();
    if (!api || this.formats.size === 0) return;
    let changed = false;
    for (const colId of this.formats.keys()) {
      if (this.externallyManaged.has(colId)) continue; // baked into the colDef by the wrapper
      const col = api.getColumn(colId);
      if (!col) continue;
      const colDef = col.getColDef();
      // Still fully ours? Both the installed valueFormatter AND cellStyle (whichever this kind
      // installs) must still be on the colDef. A text format installs only a cellStyle.
      const installedVf = this.installedFormatters.get(colId);
      const installedStyle = this.installedStyles.get(colId);
      const vfOk = !installedVf || colDef.valueFormatter === installedVf;
      const styleOk = !installedStyle || colDef.cellStyle === installedStyle;
      if (vfOk && styleOk) continue;
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

  /** Install the built valueFormatter (if the kind has one) + any cellStyle overlay onto the colDef. */
  private mutate(colId: string): boolean {
    // In bake mode (or for externally-managed/calculated columns) the wrapper bakes the format into
    // the colDef; the store must not mutate the live colDef.
    if (this.bakeMode || this.externallyManaged.has(colId)) return true;
    const col = this.getApi()?.getColumn(colId);
    const spec = this.formats.get(colId);
    if (!col || !spec) return false;
    const colDef = col.getColDef();

    // valueFormatter — kinds that only style the cell (text) return undefined; in that case
    // leave the column's own value display in place (restoring it if we'd previously installed one).
    const vf = buildValueFormatter(spec);
    if (vf) {
      this.ours.add(vf);
      colDef.valueFormatter = vf;
      this.installedFormatters.set(colId, vf);
    } else if (this.installedFormatters.has(colId)) {
      colDef.valueFormatter = this.originalFormatters.get(colId);
      this.installedFormatters.delete(colId);
    }

    // cellStyle overlay — colour-by-sign (numeric) or font weight/italic (text), merged over the
    // original. buildCellStyle returns the SAME base ref when there is no overlay.
    const base = this.originalCellStyles.get(colId);
    const styled = buildCellStyle(spec, base);
    if (styled !== base) {
      if (typeof styled === 'function') this.ours.add(styled);
      colDef.cellStyle = styled;
      this.installedStyles.set(colId, styled);
    } else if (this.installedStyles.has(colId)) {
      // overlay was removed on a re-apply → restore the original cellStyle.
      colDef.cellStyle = base;
      this.installedStyles.delete(colId);
    }
    return true;
  }

  private clearOne(colId: string): void {
    const col = this.bakeMode || this.externallyManaged.has(colId) ? null : this.getApi()?.getColumn(colId);
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
