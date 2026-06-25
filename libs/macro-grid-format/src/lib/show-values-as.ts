/**
 * Persistence helper for AG Grid 36 **Show Values As** selections.
 *
 * A column's active Show Values As mode (e.g. "% of grand total") lives in the column's
 * *column state* (`getColumnState()[].showValuesAs` / `applyColumnState`), NOT in
 * `gridApi.getState()` — the native `GridState.aggregation` section only carries each column's
 * `aggFunc`. So a user's mode change is lost through the wrappers' `getState()`/`setState()`
 * envelope. We capture it ourselves and round-trip a tiny JSON array through the same
 * `getGridState()`/`applyGridState()` side-channel used for `columnFormats`/`calculatedColumns`.
 *
 * Only the built-in *string* modes are persisted (custom `ShowValuesAs` transform objects can
 * carry functions and are not JSON-serializable), keeping this function-free and stringify-safe.
 */

/** State-blob key carrying the Show Values As selections (sibling of `columnFormats`). */
export const SHOW_VALUES_AS_KEY = 'showValuesAs';

/** A single persisted Show Values As selection — a `colId` + its built-in mode name. */
export interface ShowValuesAsEntry {
  colId: string;
  showValuesAs: string;
}

/** Minimal shape we read off `gridApi.getColumnState()`. */
interface ColumnStateLike {
  colId: string;
  showValuesAs?: unknown;
}

/**
 * Pull the persistable Show Values As selections from a grid's column state. Returns `undefined`
 * when no column has a (string) mode set, so the wrapper can omit the key entirely.
 */
export function serializeShowValuesAs(
  columnState: readonly ColumnStateLike[] | undefined
): ShowValuesAsEntry[] | undefined {
  const out: ShowValuesAsEntry[] = [];
  for (const col of columnState ?? []) {
    if (col && typeof col.colId === 'string' && typeof col.showValuesAs === 'string' && col.showValuesAs) {
      out.push({ colId: col.colId, showValuesAs: col.showValuesAs });
    }
  }
  return out.length ? out : undefined;
}
