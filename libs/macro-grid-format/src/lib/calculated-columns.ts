/**
 * Persistence helpers for AG Grid 36 **calculated columns**.
 *
 * Calculated columns do NOT appear in `gridApi.getState()` — only their column-state (order,
 * width, sort) references the colId; the expression/definition itself is not persisted by the
 * native state API. So we capture the runtime-added/edited calc columns ourselves (from the
 * `calculatedColumn*` events) and round-trip a small JSON schema through the grid wrappers'
 * existing `getGridState()`/`applyGridState()` side-channel (the OpenFin ViewState blob),
 * recreating them on restore by merging into `columnDefs`.
 *
 * Framework-agnostic and function-free (so it `JSON.stringify`s cleanly).
 */

import type { ColDef, ColGroupDef } from 'ag-grid-community';

/** State-blob key carrying the runtime calculated-column schema (sibling of `columnFormats`). */
export const CALCULATED_COLUMNS_KEY = 'calculatedColumns';

/** Minimal JSON-serializable description of a calculated column (no functions). */
export interface CalcColumnSchema {
  colId: string;
  calculatedExpression: string;
  headerName?: string;
  /** Built-in cell data type driving formatting/editing ('number' | 'text' | 'date' | 'boolean'). */
  cellDataType?: string;
}

type AnyColDef = ColDef | ColGroupDef;

function isLeaf(def: AnyColDef): def is ColDef {
  return !('children' in def);
}

function leafColId(def: ColDef): string | undefined {
  return def.colId ?? (typeof def.field === 'string' ? def.field : undefined);
}

/** Pull the serializable schema for every colDef that carries a `calculatedExpression`. */
export function serializeCalculatedColumns(colDefs: readonly AnyColDef[] | undefined): CalcColumnSchema[] {
  const out: CalcColumnSchema[] = [];
  for (const def of colDefs ?? []) {
    if (!isLeaf(def)) continue;
    const expr = def.calculatedExpression;
    const colId = leafColId(def);
    if (typeof expr === 'string' && expr.length > 0 && colId) {
      const schema: CalcColumnSchema = { colId, calculatedExpression: expr };
      if (def.headerName != null) schema.headerName = def.headerName;
      if (typeof def.cellDataType === 'string') schema.cellDataType = def.cellDataType;
      out.push(schema);
    }
  }
  return out;
}

/** Turn a persisted schema into a calculated-column colDef AG Grid can materialise. */
export function schemaToColDef(schema: CalcColumnSchema): ColDef {
  const def: ColDef = { colId: schema.colId, calculatedExpression: schema.calculatedExpression };
  if (schema.headerName != null) def.headerName = schema.headerName;
  if (schema.cellDataType) def.cellDataType = schema.cellDataType;
  return def;
}

/**
 * Produce the effective columnDefs for the grid: the app's base defs with the tracked
 * calculated-column schemas merged in. A schema whose colId matches a base def OVERRIDES that
 * def's calc fields (an edited pre-defined column); a schema with a new colId is APPENDED (a
 * user-created column); base leaf defs whose colId is in `removed` are dropped (a removed
 * pre-defined calc column). Returns a NEW array; never mutates inputs. Idempotent.
 */
export function mergeCalculatedColumns(
  base: readonly AnyColDef[] | undefined,
  schemas: readonly CalcColumnSchema[],
  removed: ReadonlySet<string> = new Set(),
): AnyColDef[] {
  const byColId = new Map(schemas.map((s) => [s.colId, s]));
  const usedFromBase = new Set<string>();

  const merged: AnyColDef[] = [];
  for (const def of base ?? []) {
    if (!isLeaf(def)) {
      merged.push(def);
      continue;
    }
    const colId = leafColId(def);
    if (colId && removed.has(colId)) continue; // user removed this pre-defined calc column
    const schema = colId ? byColId.get(colId) : undefined;
    if (schema) {
      usedFromBase.add(colId!);
      merged.push({
        ...def,
        calculatedExpression: schema.calculatedExpression,
        ...(schema.headerName != null ? { headerName: schema.headerName } : {}),
        ...(schema.cellDataType ? { cellDataType: schema.cellDataType } : {}),
      });
    } else {
      merged.push(def);
    }
  }

  // Append user-created calc columns (schemas with no matching base def).
  for (const schema of schemas) {
    if (!usedFromBase.has(schema.colId) && !removed.has(schema.colId)) {
      merged.push(schemaToColDef(schema));
    }
  }
  return merged;
}
