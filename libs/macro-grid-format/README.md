# @macro/macro-grid-format

Framework-agnostic **capital-markets column formatting** for AG Grid, shared by the
Angular (`@macro/macro-angular-grid`) and React (`@macro/macro-react-grid`) grid wrappers.

It provides:

- A **JSON-serializable format spec** (`ColumnFormatSpec`) — a discriminated union over
  capital-markets format kinds (decimal, integer, percent, basis points, currency, compact
  `K/MM/BN`, multiplier `×`, Treasury 32nds/64ths, FX pip/JPY, date) with shared numeric
  modifiers (decimals, thousands grouping, scale, prefix/suffix, sign display, accounting
  parentheses, colour-by-sign, null/zero text).
- A pure **format engine** (`formatValue`, `buildValueFormatter`, `buildCellStyle`).
- Named **presets** grouped by business area (Rates / FX / Commodities / Risk-PnL / General).
- A framework-agnostic **`ColumnFormatStore`** that applies/clears/serialises formats against a
  `GridApi`, backing up and restoring app-defined `valueFormatter`/`cellStyle`, and reconciling
  on column rebuilds.
- A **"Format" sideBar tool panel** in two flavours:
  - `@macro/macro-grid-format/angular` — `MacroFormatToolPanelComponent` (`IToolPanelAngularComp`)
  - `@macro/macro-grid-format/react` — `MacroFormatToolPanel` (`CustomToolPanelProps`)

## Persistence

Specs persist inside the grid wrappers' existing `getGridState()` / `applyGridState()` under the
`columnFormats` key — a **bare `Record<colId, ColumnFormatSpec>` map** for full forward/backward
compatibility. The legacy `{ type, decimals }` shape is migrated per-entry on read
(`migrateMap`). No functions are ever stored; `valueFormatter` is rebuilt from the spec on restore.

## Layout

```
src/
  index.ts                 # core barrel (framework-free)
  lib/
    format-spec.ts         # ColumnFormatSpec union + migrate helpers
    format-engine.ts       # formatValue / buildValueFormatter / buildCellStyle
    treasury.ts            # 32nds / 64ths + half-tick
    fx-rate.ts             # pip / JPY conventions
    presets.ts             # business-area preset catalog
    format-registry.ts     # per-kind metadata driving both panel UIs
    column-format-store.ts # apply / clear / serialize / restore / reconcile
    tool-panel-def.ts      # sideBar tool-panel registration helpers
    angular/               # MacroFormatToolPanelComponent (consumed from source)
    react/                 # MacroFormatToolPanel (consumed from source)
```

The `angular/` and `react/` panels are consumed **from source** by the apps (like the grid
wrappers) and are not part of the `tsc` build — only the framework-free core is built.
