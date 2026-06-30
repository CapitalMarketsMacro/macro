# Copilot instructions — AG Grid 36 + Format tool panel + Calculated columns + Show Values As

> Condensed, auto-loaded guidance for the AG Grid features in this codebase. **Full verbatim contracts +
> all code live in [`docs/copilot/ag-grid-36-format-panel-port.md`](../docs/copilot/ag-grid-36-format-panel-port.md)** — read it before
> implementing; this file is the quick reference + the rules you must not break.

## Stack
- **AG Grid `^36.0.0`** + **AG Charts `^14.0.0`** (matched pair — never bump one without the other).
- Two grid wrappers, **line-for-line equivalent except framework plumbing**: `@macro/macro-angular-grid`
  (Angular) and `@macro/macro-react-grid` (React). Port/change one → mirror the other.
- `@macro/macro-grid-format` = framework-free format engine + the tool-panel UIs, with **three entry points**:
  `.` (core), `./angular`, `./react`.

## Architecture rules (do not break)
1. **The format core is framework-free.** The only AG Grid usage in `format-engine.ts` is one `import type`
   (erased at compile). `format-spec`/`treasury`/`fx-rate`/`presets`/`format-registry` have no AG Grid
   reference. Keep `ag-grid-*`, `@angular/core`, `react` as **optional peerDependencies**; only runtime dep is `tslib`.
2. **The two tool panels are separate subpaths** (`./angular`, `./react`) and are **excluded from the tsc
   build** — apps consume them from source. Never export a framework panel from the core barrel.
3. **`format-registry.ts` is the single source of truth for both panel UIs.** Add a format knob there once →
   both Angular and React panels update. Every new numeric/boolean field **must** be added to
   `NUMBER_FIELD_KEYS` / `BOOLEAN_FIELD_KEYS` or `setSpecField` stores it as a raw string.
4. **Bake mode is mandatory.** Both wrappers call `store.setBakeMode(true)`: the `ColumnFormatStore` becomes a
   pure spec registry that **never mutates live colDefs** (`reconcile()` no-ops). The wrapper instead bakes
   `buildValueFormatter` + `buildCellStyle` into `effectiveColumnDefs` and re-applies via
   `setGridOption('columnDefs', …)` on `store.onChange` (guarded by a re-entrancy flag). Without bake mode you
   get an in-place-mutation ↔ rebuild ↔ reconcile **infinite loop**.
5. **Persistence rides three side-channels**, omitted when empty, alongside AG Grid's native `getState()`:
   `columnFormats` (bare `colId→spec` map), `calculatedColumns`, `showValuesAs`. **None** are in AG Grid's
   native state.
6. **Theme params are validated by hand, not the compiler.** `withParams(CONST)` silently drops unknown
   params (no build error). Verify rendered output in a real browser.

## Feature cheat-sheets

### v36 upgrade deltas (grid 35→36 removed ZERO APIs)
- Register once at module load: `ModuleRegistry.registerModules([AllCommunityModule, AllEnterpriseModule, IntegratedChartsModule.with(AgChartsEnterpriseModule)])`. React also sets `enableCharts` on `<AgGridReact>`. No `LicenseManager` call exists in-repo.
- **Theme params:** REMOVED `headerFontFamily` (use base `fontFamily` + `cellFontFamily`), `headerBackgroundColor` (use `chromeBackgroundColor`), `listItemHeight`. RENAMED `menuShadow`→`popupShadow`. KEPT `rangeSelection{Background,Border}Color`.
- **CSS renames** (two stylesheet copies — design-system + OpenFin workspace): `.ag-pinned-{top,bottom}` → `.ag-grid-pinned-{top,bottom}-rows`; `.ag-sort-{ascending,descending}-icon` → `.ag-icon-{asc,desc}` (keep legacy as fallback).
- **Selection API:** `rowSelection:'multiple'`+`suppressRowClickSelection` → `rowSelection:{mode:'multiRow',checkboxes:false,enableClickSelection:false}`; `enableRangeSelection` → `cellSelection:true`.

### Format engine
- `ColumnFormatSpec` = discriminated union over `kind`: number/integer/percent/basisPoints/currency/compact/multiplier/treasury/fxRate/date/text, sharing `NumericModifiers` (decimals, thousands, scale, prefix, suffix, signDisplay, negativeStyle, colorMode, nullText, zeroText, locale).
- Engine ordering is **load-bearing**: `value × scale × kindMultiplier` (percent ×100, bps ×10000) → `abs` → core → auto-suffix **inside** sign/parens → negative wrap → `+` only for strictly-positive when `signDisplay:'always'`.
- Intl **pinned to `en-US`** (per-spec `locale` overrides). Colour-by-sign resolves to `var(--mkt-up …)`/`var(--mkt-down …)`, not hex. `buildValueFormatter` returns **`undefined` for `kind:'text'`** (text only styles).
- Persisted map is a **bare `colId→spec` map** (no version envelope). `migrateSpec`/`migrateMap` upgrade legacy `{type,decimals}` per entry.

### Format tool panel
- Register the panel by the **string key** `FORMAT_TOOL_PANEL_COMPONENT` (`'macroFormatToolPanel'`) in
  `gridOptions.components`; build the sidebar with `withFormatPanel(existing, { store })`. Mismatched key = blank panel.
- Create the store + sidebar + components **once** (Angular class fields; React `useRef`/`useMemo`) so the panel
  isn't torn down. Angular `IToolPanelAngularComp.refresh()` must `return true`.
- Panels hold **zero** formatting logic: they render off `FORMAT_REGISTRY`/`presetsByGroup`, edit via
  `setSpecField`, preview via `formatValue`/`previewStyle`, and write via `store.apply/clear/clearAll`.

### Calculated columns
- Enable: `gridOptions.calculatedColumns = { applyMode: 'deferred' }`. Dev-declared = a colDef with
  `calculatedExpression: '[a] - [b]'`. Events: `calculatedColumnCreated`/`…ExpressionChanged`/`…Removed`.
- Track runtime calc cols in `Map<colId, CalcColumnSchema>` + a removed `Set`; build via
  `mergeCalculatedColumns(base, [...defs], removed)`.
- Calc-column formats **must be baked** (AG Grid caches a `cellDataType` valueFormatter and ignores post-hoc
  mutation) — that's why bake mode exists.

### Show Values As
- colDef: `showValuesAs: 'percentOfGrandTotal' | …` + `enableShowValuesAs: true`. Use
  **`percentOfParentRowTotal`** for "share of parent group" — `percentOfParentColumnTotal`/`percentOfRowTotal`
  are pivot-only and render **`#N/A`** in plain row grouping.
- Persisted via `serializeShowValuesAs(getColumnState())` (only built-in **string** modes; custom objects dropped).

### Persistence (`getGridState`/`applyGridState`)
- `getGridState()` = `{ ...gridApi.getState(), columnFormats?, calculatedColumns?, showValuesAs? }`.
- `applyGridState()` order is **load-bearing**: (1) recreate calc cols + `setGridOption('columnDefs')` **first**;
  (2) `setState(native)`; (2b) `applyColumnState({ state: showValuesAs })` **after** setState; (3)
  `store.restore(migrateMap(columnFormats ?? {}))` — runs **always**, so an absent map **clears** seeded formats.
- **React only:** after each `setGridOption('columnDefs', built)`, the next `effectiveColumnDefs` `useMemo` must
  return the **same array reference** (`pinnedDefsRef`, consume-once) so `<AgGridReact>` short-circuits and doesn't
  re-apply columnDefs after `setState`. Angular pushes imperatively and needs no pin.

## Top gotchas (each already caused a bug once)
- v36 removed-param drop is **silent** → verify computed `fontFamily`/background in a real browser.
- **Bake mode required** or infinite reconcile loop.
- **`sameCalcSchema` guard** on the calc upsert handler, or re-feeding a user calc column re-emits
  `calculatedColumnCreated` → re-feed → **grid freeze**.
- Show Values As is **not** in `getState()` — re-apply via `applyColumnState` **after** `setState`.
- `store.restore` always clears first — empty map intentionally clears seeded formats.
- **Don't seed a store format on a Show-Values-As column** (a baked valueFormatter reformats the % as currency).
- Grouping uses **`grandTotalRow: 'bottom'`** (v36 name; NOT `groupIncludeTotalFooter`).

## When changing these features
- Mirror Angular ↔ React. Run the engine specs (they assume **en-US** Intl output — don't change the default locale).
- Specs can't catch the freeze/feedback-loop bugs (they mock AG Grid events) — verify in a real/headless browser.
- See the full doc's **§9 ordered checklist** and **§11 gotcha index** before a port.
