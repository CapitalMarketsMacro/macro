# Copilot Port Instructions — AG Grid 36 upgrade + Column Format tool panel + Calculated columns + Show Values As

> **Audience:** GitHub Copilot (Opus 4.7) operating on a *separate, diverged* library that already tracks
> this repo but has its own changes.
> **Goal:** port four self-contained capabilities from the `macro` monorepo into that library:
> 1. The **AG Grid 36 / AG Charts 14** upgrade deltas.
> 2. The framework-agnostic **capital-markets column-format engine** (`@macro/macro-grid-format` core).
> 3. The **Format tool panel** UIs (Angular + React) that drive that engine.
> 4. **Calculated columns** + **Show Values As** support, including their persistence.
>
> Everything below is taken **verbatim** from the working source. Reproduce the contracts exactly —
> the engine ordering, the persistence side-channels, and the "bake mode" design are all load-bearing.
> Where a large file is shown as an excerpt, the excerpt is the *non-obvious* part; fill the standard
> plumbing around it.

---

## 0. How to use this document

- These features are **independent**. You can adopt them in any order, but the recommended sequence is
  **§2 (v36 upgrade) → §3 (format core) → §4 (tool panel) → §5/§6 (calc + show-values-as) → §7 (persistence glue)**.
- The target library may have **one or both** of an Angular grid wrapper and a React grid wrapper.
  The two wrappers are *line-for-line equivalent except for framework plumbing* — port one and mirror it.
  The only real divergence is **how AG Grid receives column-def updates** (Angular pushes imperatively;
  React needs a ref-identity "pin" — see §7.4).
- Treat every "GOTCHA" as a regression that has already happened once. They are not hypothetical.

### Acceptance criteria (what "done" looks like)
- Deps on AG Grid `^36` + AG Charts `^14` (matched pair); modules registered once.
- Theme builds with the v36 param names; no removed params remain.
- A **Format** tool panel appears in the grid sidebar; selecting columns + a format applies live and
  survives a save/restore round-trip.
- Users can add/edit/remove **calculated columns** via the header menu without freezing the grid; calc
  columns persist across reload.
- **Show Values As** modes (e.g. `percentOfGrandTotal`) render and persist.
- `getGridState()` / `applyGridState()` round-trip **all three** side-channels (`columnFormats`,
  `calculatedColumns`, `showValuesAs`) alongside AG Grid's native `getState()` blob.

---

## 1. Package & build boundary (do this first)

The format engine ships as one package with **three entry points**. The core is framework-free; the two
tool panels are separate subpaths that are **excluded from the TypeScript build** and consumed *from source*.

`package.json` (the format package) — the shape to mirror:
```jsonc
{
  "name": "@macro/macro-grid-format",
  "exports": {
    ".":        { "types": "./src/index.ts",                 "default": "./src/index.js" },
    "./angular":{ "types": "./src/lib/angular/index.ts",      "default": "./src/lib/angular/index.js" },
    "./react":  { "types": "./src/lib/react/index.ts",        "default": "./src/lib/react/index.js" }
  },
  // ag-grid-community / ag-grid-angular / ag-grid-react / @angular/core / react are ALL OPTIONAL peerDependencies.
  // The only true runtime dependency is tslib.
  "peerDependencies": { "ag-grid-community": "*", "@angular/core": "*", "react": "*" },
  "peerDependenciesMeta": {
    "ag-grid-community": { "optional": true },
    "@angular/core": { "optional": true },
    "react": { "optional": true }
  }
}
```

Build tsconfig (`tsconfig.lib.json`): `declaration: true`, `types: ['node']`, `esModuleInterop`,
`allowSyntheticDefaultImports`, and **exclude** `*.spec.ts`, `src/lib/angular/**`, `src/lib/react/**`.

Path aliases (root `tsconfig.base.json`) point straight at the `.ts` source:
```jsonc
"@macro/macro-grid-format":         ["libs/macro-grid-format/src/index.ts"],
"@macro/macro-grid-format/angular": ["libs/macro-grid-format/src/lib/angular/index.ts"],
"@macro/macro-grid-format/react":   ["libs/macro-grid-format/src/lib/react/index.ts"]
```

> **Why this matters:** importing the core (`@macro/macro-grid-format`) must never pull Angular or React.
> The Angular component and React component live behind `/angular` and `/react` so each app only bundles
> its own framework's panel.

---

## 2. AG Grid 36 / AG Charts 14 upgrade deltas

> **Key fact:** the grid **35 → 36** bump removed **zero** APIs. The entire required surface is
> (1) deps, (2) two CSS selector renames, (3) a few theme-param renames/removals, (4) the selection-API
> object form. Calculated columns and Show Values As are *net-new v36 features* layered on top — not
> upgrade requirements.

### 2.1 Dependencies (matched pair)
```jsonc
"ag-charts-angular":    "^14.0.0",
"ag-charts-enterprise": "^14.0.0",
"ag-charts-react":      "^14.0.0",
"ag-grid-angular":      "^36.0.0",
"ag-grid-community":    "^36.0.0",
"ag-grid-enterprise":   "^36.0.0",
"ag-grid-react":        "^36.0.0"
```
- Grid 36 **must** pair with Charts 14.
- In *this* repo, `npm install` needs `--legacy-peer-deps` — but that is a TypeScript-6 vs `@angular/build`
  peer conflict, **not** an AG Grid requirement. Your library may not need the flag. `npm ci` works without it.

### 2.2 Module registration (once, at module load — not in a lifecycle hook)
```ts
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { AllEnterpriseModule, IntegratedChartsModule } from 'ag-grid-enterprise';
import { AgChartsEnterpriseModule } from 'ag-charts-enterprise';

// Register all ag-Grid modules (Community and Enterprise)
ModuleRegistry.registerModules([
  AllCommunityModule,
  AllEnterpriseModule,
  IntegratedChartsModule.with(AgChartsEnterpriseModule),
]);
```
- `AllEnterpriseModule` is what enables calculated columns, Show Values As, sidebar tool panels, cell
  range / charts. There is **no `LicenseManager.setLicenseKey` call anywhere in this repo** — add your own
  enterprise key separately if your deployment requires it.
- **React only:** also set `enableCharts` on the `<AgGridReact>` element. Angular relies on module
  registration alone.

### 2.3 Theme params (the main code delta)
The theme is built with the v36 Theming API. Mirror `buildAgGridTheme`:
```ts
export function buildAgGridTheme(isDark: boolean): Theme {
  const base = themeQuartz
    .withPart(iconSetMaterial)
    .withPart(isDark ? colorSchemeDarkBlue : colorSchemeLight)
    .withParams(AG_GRID_FONTS);

  if (isDark) {
    return base.withParams(DARK_TOKENS);
  }
  return base;
}
```
Base/light fonts (applied to all themes):
```ts
/**
 * v36 has no `headerFontFamily`: the base `fontFamily` applies to headers and chrome, while
 * `cellFontFamily` overrides cells. So chrome/headers use Roboto and data cells use IBM Plex Mono.
 */
export const AG_GRID_FONTS = {
  fontFamily: "'Roboto', system-ui, sans-serif",
  cellFontFamily: "'IBM Plex Mono', ui-monospace, monospace",
  headerFontSize: 10,
  headerFontWeight: 500,
  fontSize: 12,
  cellHorizontalPadding: 10,
  rowHeight: 22,
  headerHeight: 28,
  wrapperBorderRadius: 0,
  rowBorder: { style: 'solid' as const, width: 1, color: '#1c2029' },
  columnBorder: false,
} as const;
```
Dark token overrides (note the v36-specific comments):
```ts
const DARK_TOKENS = {
  backgroundColor:                '#12141a',
  foregroundColor:                '#e6e8ec',
  // header background derives from chromeBackgroundColor in v36 (dedicated `headerBackgroundColor` was removed)
  chromeBackgroundColor:          '#181b22',
  headerTextColor:                '#6f7687',
  borderColor:                    '#1c2029',
  oddRowBackgroundColor:          '#181b22',
  rowHoverColor:                  '#22262f',
  selectedRowBackgroundColor:     '#1a2a3f',
  accentColor:                    '#2aa6e6',
  focusShadow:                    '0 0 0 2px #12141a, 0 0 0 4px #2aa6e6',
  rangeSelectionBackgroundColor:  'rgba(42,166,230,0.14)',   // STILL VALID in v36
  rangeSelectionBorderColor:      '#2aa6e6',                 // STILL VALID in v36
  inputBackgroundColor:           '#12141a',
  inputBorder:                    { style: 'solid' as const, width: 1, color: '#363c48' },
  inputFocusBorder:               { style: 'solid' as const, width: 1, color: '#2aa6e6' },
  menuBackgroundColor:            '#1e222a',
  menuBorder:                     { style: 'solid' as const, width: 1, color: '#363c48' },
  popupShadow:                    '0 4px 16px rgba(0,0,0,0.40)',  // v36 renamed menuShadow → popupShadow
};
```

**Exact v36 param mapping — apply every one of these to your theme:**
| Old (v35) | v36 |
| --- | --- |
| `headerFontFamily` | **REMOVED** — set base `fontFamily` (headers/chrome) + `cellFontFamily` (cells) |
| `headerBackgroundColor` | **REMOVED** — derives from `chromeBackgroundColor` |
| `listItemHeight` | **REMOVED** — simply absent |
| `menuShadow` | **RENAMED** → `popupShadow` (covers menus/dropdowns/dialogs) |
| `rangeSelectionBackgroundColor`, `rangeSelectionBorderColor` | **KEPT** (still valid) |

> ⚠️ **GOTCHA — silent failure.** `withParams(SOME_CONST)` is called with a *separate const*, so TypeScript
> excess-property checks do **not** fire. An invalid/removed param (a leftover `headerFontFamily`,
> `headerBackgroundColor`, etc.) **compiles fine and is silently dropped at runtime**. In this repo the
> header font silently regressed to mono for several milestones because of exactly this. **Verify by
> reading a rendered header cell's computed `fontFamily`/background in a real browser** — the build will
> not catch it.

### 2.4 CSS selector renames (TWO copies)
v36 renamed two selector families. Add the new classes; keep the legacy ones as harmless fallback.
```css
/* Pinned rows — v36 renamed the containers to .ag-grid-pinned-{top,bottom}-rows;
   keep the legacy .ag-pinned-{top,bottom} selectors as a harmless fallback. */
.ag-grid-pinned-top-rows .ag-row, .ag-grid-pinned-bottom-rows .ag-row,
.ag-pinned-top .ag-row, .ag-pinned-bottom .ag-row {
  background: var(--bg-raised) !important;
  border-top: 1px solid var(--border-2);
  font-weight: 500;
}

/* Sort icons — v36 renders sort glyphs as .ag-icon-asc/.ag-icon-desc; legacy
   .ag-sort-{ascending,descending}-icon kept as a harmless fallback. */
.ag-header-cell-sorted-asc .ag-icon-asc,
.ag-header-cell-sorted-desc .ag-icon-desc,
.ag-header-cell-sorted-asc .ag-sort-ascending-icon,
.ag-header-cell-sorted-desc .ag-sort-descending-icon { color: var(--brand); }
```
> ⚠️ **GOTCHA:** these renames live in **two** stylesheets in this repo — the design-system CSS
> (`var(--brand)`) **and** the OpenFin workspace overrides (`var(--cerulean-400)`, which also adds a
> `border-bottom` on pinned rows). If your library has a separate workspace theme, port both copies.

### 2.5 Selection API (object form — can be a separate milestone)
```ts
// v35 string form (deprecated):
//   rowSelection: 'multiple', suppressRowClickSelection: true, enableRangeSelection: true
// v36 object form (same behaviour: multi-row, no checkbox column, no click-to-select, cell ranges on):
rowSelection: { mode: 'multiRow', checkboxes: false, enableClickSelection: false },
cellSelection: true,
suppressCellFocus: true,  // retained alongside
```

---

## 3. Capital-markets column-format engine (framework-free core)

Pure TypeScript, JSON-serializable column-format model. **The only AG Grid usage in the entire core is one
`import type` in `format-engine.ts`** (erased at compile time → zero runtime dependency). Reproduce these
files in this dependency order (each only depends on earlier ones):

```
format-spec.ts      → treasury.ts → fx-rate.ts → format-engine.ts → presets.ts → format-registry.ts
                                                              column-format-store.ts (depends on engine + ag-grid types)
                                                              tool-panel-def.ts (ag-grid types only)
```

### 3.1 `format-spec.ts` — the serializable data contract (full)
```ts
export type FormatKind =
  | 'number' | 'integer' | 'percent' | 'basisPoints' | 'currency'
  | 'compact' | 'multiplier' | 'treasury' | 'fxRate' | 'date' | 'text';

export type FontWeight = 'normal' | 'bold' | 'bolder' | 'lighter';
export type NegativeStyle = 'minus' | 'parentheses';
export type SignDisplay = 'auto' | 'always';
export type ColorMode = 'none' | 'posneg' | 'negative';

export interface NumericModifiers {
  decimals?: number;
  thousands?: boolean;
  scale?: number;
  prefix?: string;
  suffix?: string;
  signDisplay?: SignDisplay;
  negativeStyle?: NegativeStyle;
  colorMode?: ColorMode;
  nullText?: string;
  zeroText?: string;
  locale?: string;
}

export type NumberSpec      = { kind: 'number' } & NumericModifiers;
export type IntegerSpec     = { kind: 'integer' } & NumericModifiers;
export type PercentSpec     = { kind: 'percent' } & NumericModifiers;
export type BasisPointsSpec = { kind: 'basisPoints' } & NumericModifiers;
export type CurrencySpec    = { kind: 'currency'; currency?: string; currencyDisplay?: 'symbol' | 'code' | 'none' } & NumericModifiers;
export type CompactSpec     = { kind: 'compact'; notation?: 'KMB' | 'mmbn' } & NumericModifiers;
export type MultiplierSpec  = { kind: 'multiplier' } & NumericModifiers;
export type TreasurySpec    = { kind: 'treasury'; fraction?: 32 | 64; plusTick?: boolean } & Pick<NumericModifiers, 'colorMode' | 'nullText' | 'zeroText'>;
export type FxRateSpec      = { kind: 'fxRate'; pipDecimals?: number; jpyConvention?: boolean; symbolField?: string } & NumericModifiers;
export type DateSpec        = { kind: 'date'; dateStyle?: 'date' | 'datetime' | 'time'; pattern?: string; locale?: string };
export type TextStyleSpec   = { kind: 'text'; weight?: FontWeight; italic?: boolean } & Pick<NumericModifiers, 'nullText'>;

export type ColumnFormatSpec =
  | NumberSpec | IntegerSpec | PercentSpec | BasisPointsSpec | CurrencySpec
  | CompactSpec | MultiplierSpec | TreasurySpec | FxRateSpec | DateSpec | TextStyleSpec;

export type ColumnFormatMap = Record<string, ColumnFormatSpec>;

// ---- Legacy back-compat ----
export interface LegacyFormatConfig { type: 'number' | 'percent' | 'bps' | 'currency' | 'compact'; decimals: number; }
export type FormatType = LegacyFormatConfig['type'];
export type ColumnFormatConfig = LegacyFormatConfig;

const LEGACY_KIND: Record<LegacyFormatConfig['type'], FormatKind> = {
  number: 'number', percent: 'percent', bps: 'basisPoints', currency: 'currency', compact: 'compact',
};

export function migrateSpec(raw: unknown): ColumnFormatSpec | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  if ('kind' in raw) return raw as ColumnFormatSpec;
  if ('type' in raw) {
    const { type, decimals } = raw as LegacyFormatConfig;
    const kind = LEGACY_KIND[type] ?? 'number';
    const base: Record<string, unknown> = { kind, decimals };
    if (kind === 'currency') { base['currency'] = 'USD'; base['currencyDisplay'] = 'symbol'; }
    if (kind === 'compact') base['notation'] = 'KMB';
    return base as ColumnFormatSpec;
  }
  return undefined;
}

export function migrateMap(raw: unknown): ColumnFormatMap {
  const out: ColumnFormatMap = {};
  if (raw && typeof raw === 'object') {
    for (const [colId, value] of Object.entries(raw as Record<string, unknown>)) {
      const spec = migrateSpec(value);
      if (spec) out[colId] = spec;
    }
  }
  return out;
}
```
> ⚠️ **GOTCHA — the persisted shape is a BARE map** (`Record<colId, spec>`), deliberately with **no
> `{version, formats}` envelope** so an older build still iterates `colId → spec`. Migration is *per entry*:
> `migrateSpec` passes through anything with a `kind`, upgrades legacy `{type, decimals}`, and returns
> `undefined` otherwise; `migrateMap` drops unrecognized entries. Preserve this exactly for round-trip
> compatibility.

### 3.2 `format-engine.ts` — the pure engine (key excerpts)
The **only** AG Grid import in the core, plus the market-colour tokens and en-US pinning:
```ts
import type { CellStyle, CellStyleFunc, ColDef, ValueFormatterFunc, ValueFormatterParams } from 'ag-grid-community';
import type { ColorMode, ColumnFormatSpec, CompactSpec, CurrencySpec, FormatKind, FxRateSpec, NumericModifiers } from './format-spec';
import { formatTreasury } from './treasury';
import { formatFxRate } from './fx-rate';

const POSITIVE_COLOR = 'var(--mkt-up, #16a34a)';
const NEGATIVE_COLOR = 'var(--mkt-down, #dc2626)';
const DEFAULT_LOCALE = 'en-US';

function defaultDecimals(kind: FormatKind): number {
  switch (kind) {
    case 'integer': return 0;
    case 'basisPoints': return 1;
    case 'compact': return 1;
    case 'fxRate': return 5;
    default: return 2;
  }
}
function defaultThousands(kind: FormatKind): boolean {
  return kind === 'number' || kind === 'integer' || kind === 'currency';
}
function nf(locale: string, decimals: number, useGrouping: boolean): Intl.NumberFormat {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping });
}
```

The heart of numeric formatting — **reproduce this order exactly or outputs diverge:**
```ts
function formatNumeric(value: number, spec: ColumnFormatSpec): string {
  const mods = spec as NumericModifiers & { kind: FormatKind };
  const kind = spec.kind;
  const scale = mods.scale ?? 1;
  const kindMultiplier = kind === 'percent' ? 100 : kind === 'basisPoints' ? 10000 : 1;
  const n = value * scale * kindMultiplier;   // multiply BEFORE abs

  const decimals = mods.decimals ?? defaultDecimals(kind);
  const useGrouping = mods.thousands ?? defaultThousands(kind);
  const locale = mods.locale ?? DEFAULT_LOCALE;

  const neg = n < 0;
  const abs = Math.abs(n);

  let core: string;
  if (kind === 'currency')      core = formatCurrencyCore(abs, spec as CurrencySpec, decimals, useGrouping);
  else if (kind === 'compact')  core = formatCompact(abs, spec as CompactSpec);
  else                          core = nf(locale, decimals, useGrouping).format(abs);

  // Kind-specific auto suffix (kept INSIDE any parentheses / sign).
  let autoSuffix = '';
  if (kind === 'percent') autoSuffix = '%';
  else if (kind === 'basisPoints') autoSuffix = ' bps';
  else if (kind === 'multiplier' && mods.suffix == null) autoSuffix = 'x';

  const body = (mods.prefix ?? '') + core + autoSuffix + (mods.suffix ?? '');

  if (neg) return mods.negativeStyle === 'parentheses' ? `(${body})` : `-${body}`;
  // `always` flags positives with a leading '+', but an exact 0 is neither sign.
  return n > 0 && mods.signDisplay === 'always' ? `+${body}` : body;
}
```
Compact + currency cores:
```ts
function formatCompact(abs: number, spec: CompactSpec): string {
  const locale = spec.locale ?? DEFAULT_LOCALE;
  const decimals = spec.decimals ?? defaultDecimals('compact');
  const units: [number, string][] = spec.notation === 'mmbn'
    ? [[1e12, 'T'], [1e9, 'BN'], [1e6, 'MM'], [1e3, 'K']]
    : [[1e12, 'T'], [1e9, 'B'],  [1e6, 'M'],  [1e3, 'K']];
  for (const [threshold, unit] of units) {
    if (abs >= threshold) return nf(locale, decimals, false).format(abs / threshold) + unit;
  }
  return nf(locale, decimals, spec.thousands ?? false).format(abs);
}

function formatCurrencyCore(abs: number, spec: CurrencySpec, decimals: number, useGrouping: boolean): string {
  const locale = spec.locale ?? DEFAULT_LOCALE;
  const display = spec.currencyDisplay ?? 'symbol';
  if (display === 'none') return nf(locale, decimals, useGrouping).format(abs);
  return new Intl.NumberFormat(locale, {
    style: 'currency', currency: spec.currency ?? 'USD', currencyDisplay: display,
    minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping,
  }).format(abs);
}
```
The dispatcher + date:
```ts
export function formatValue(value: unknown, spec: ColumnFormatSpec, rowData?: Record<string, unknown>): string {
  switch (spec.kind) {
    case 'treasury': {
      if (!isFiniteNumber(value)) return spec.nullText ?? '';
      if (value === 0 && spec.zeroText != null) return spec.zeroText;
      return formatTreasury(value, { fraction: spec.fraction, plusTick: spec.plusTick });
    }
    case 'fxRate': {
      const fx = spec as FxRateSpec;
      const symbol = rowData?.[fx.symbolField ?? 'symbol'];
      return formatFxRate(value as number, fx, typeof symbol === 'string' ? symbol : undefined);
    }
    case 'date': return formatDate(value, spec);
    case 'text': return value == null ? spec.nullText ?? '' : String(value);
    default: {
      const mods = spec as NumericModifiers;
      if (!isFiniteNumber(value)) return mods.nullText ?? '';
      if (value === 0 && mods.zeroText != null) return mods.zeroText;
      return formatNumeric(value, spec);
    }
  }
}
```
Formatter + style builders (the bridge to AG Grid):
```ts
export function buildValueFormatter(spec: ColumnFormatSpec): ValueFormatterFunc | undefined {
  if (spec.kind === 'text') return undefined;   // text contributes only a cellStyle overlay
  return (params: ValueFormatterParams) =>
    formatValue(params?.value, spec, params?.data as Record<string, unknown> | undefined);
}

function resolveSignColor(value: unknown, mode: ColorMode): string | undefined {
  if (!isFiniteNumber(value)) return undefined;
  if (mode === 'posneg')   { if (value > 0) return POSITIVE_COLOR; if (value < 0) return NEGATIVE_COLOR; return undefined; }
  if (mode === 'negative') { return value < 0 ? NEGATIVE_COLOR : undefined; }
  return undefined;
}

export interface FormatStyleOverlay { color?: string; fontWeight?: string; fontStyle?: string }

export function previewStyle(spec: ColumnFormatSpec, value?: unknown): FormatStyleOverlay {
  const overlay: FormatStyleOverlay = {};
  const mode = (spec as NumericModifiers).colorMode;
  if (mode && mode !== 'none') { const color = resolveSignColor(value, mode); if (color) overlay.color = color; }
  if (spec.kind === 'text') { overlay.fontWeight = spec.weight ?? 'normal'; overlay.fontStyle = spec.italic ? 'italic' : 'normal'; }
  return overlay;
}

export function buildCellStyle(spec: ColumnFormatSpec, base?: ColDef['cellStyle']): ColDef['cellStyle'] | undefined {
  if (!hasStyleOverlay(spec)) return base;
  return (params: unknown): CellStyle => {
    const baseStyle = resolveBaseStyle(base, params);                 // resolves a function base too
    const overlay = previewStyle(spec, (params as { value?: unknown })?.value);
    return { ...baseStyle, ...overlay };                             // overlay merges OVER app styles (keeps textAlign etc.)
  };
}
```
Standard plumbing to fill: `isFiniteNumber`, `formatDate` (`toLocaleDateString/TimeString/String` by
`dateStyle`, returns `''` for null/empty and `String(value)` for invalid dates), `resolveBaseStyle`
(call a function base, else treat as object, default `{}`), and `hasStyleOverlay` (true when `colorMode`
is set/≠none, or `kind === 'text'`).

> ⚠️ **GOTCHAs:**
> - **Intl is hard-pinned to `en-US`** (engine default + the `fx-rate.ts` literal). Every spec's optional
>   `locale` overrides it; tests assume en-US glyphs, so changing the default breaks the suite.
> - **Colour-by-sign resolves to CSS variables** (`var(--mkt-up …)` / `var(--mkt-down …)`), not hex — the
>   spec stays a serializable string (`'posneg'`/`'negative'`) and dark-mode is delegated to the consuming
>   app's `--mkt-up`/`--mkt-down` variables.
> - **`buildValueFormatter` returns `undefined` for `kind:'text'`** — callers must handle that (apply only
>   the cellStyle).
> - `NumericModifiers` is **wider than the registry UI exposes** (`scale`/`locale` are only reachable via
>   presets, never a control). Implement the *whole* `NumericModifiers` surface in the engine, not just the
>   editable fields, or presets like `rates-dv01-mm` lose fidelity.

### 3.3 `treasury.ts` (full)
```ts
export interface TreasuryFormatOptions { fraction?: 32 | 64; plusTick?: boolean; }

export function formatTreasury(decimalPrice: number, options: TreasuryFormatOptions = {}): string {
  const { fraction = 32, plusTick = true } = options;
  if (decimalPrice == null || typeof decimalPrice !== 'number' || isNaN(decimalPrice)) return '';

  const handle = Math.floor(decimalPrice);
  const fractionalPart = decimalPrice - handle;
  const totalTicks = fractionalPart * fraction;
  const ticks = Math.floor(totalTicks);
  const residual = totalTicks - ticks;

  const padWidth = 2;                                  // padded to 2 digits for BOTH 32nds and 64ths
  const ticksStr = ticks.toString().padStart(padWidth, '0');
  const suffix = plusTick && residual >= 0.4 ? '+' : '';   // half-tick fires at >= 0.4, not 0.5

  return `${handle}-${ticksStr}${suffix}`;
}
```

### 3.4 `fx-rate.ts` (full)
```ts
import type { FxRateSpec } from './format-spec';

export function isJpyPair(symbol: string | undefined): boolean {
  return !!symbol && symbol.toUpperCase().endsWith('JPY');
}

export function formatFxRate(value: number, spec: FxRateSpec, rowSymbol?: string): string {
  if (value == null || typeof value !== 'number' || isNaN(value)) return spec.nullText ?? '';
  const pipDecimals = spec.pipDecimals ?? 5;
  const jpy = spec.jpyConvention !== false && isJpyPair(rowSymbol);   // jpyConvention defaults true
  const decimals = jpy ? 3 : pipDecimals;
  const useGrouping = spec.thousands ?? false;
  const core = new Intl.NumberFormat(spec.locale ?? 'en-US', {
    minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping,
  }).format(value);
  return (spec.prefix ?? '') + core + (spec.suffix ?? '');
}
```

### 3.5 `presets.ts` (full — these exact ids/specs)
```ts
export type PresetGroup = 'Rates' | 'FX' | 'Commodities' | 'Risk / PnL' | 'Text' | 'General';
export interface FormatPreset { id: string; label: string; group: PresetGroup; hint?: string; spec: ColumnFormatSpec; }

export const FORMAT_PRESETS: FormatPreset[] = [
  // Rates
  { id: 'rates-yield', label: 'Yield %', group: 'Rates', hint: '4 dp percent', spec: { kind: 'percent', decimals: 4 } },
  { id: 'rates-spread-bps', label: 'Spread (bps)', group: 'Rates', hint: 'signed, coloured', spec: { kind: 'basisPoints', decimals: 1, signDisplay: 'always', colorMode: 'posneg' } },
  { id: 'rates-dv01-mm', label: 'DV01 ($mm)', group: 'Rates', hint: 'scaled to millions', spec: { kind: 'number', decimals: 2, scale: 1e-6, suffix: ' mm' } },
  { id: 'rates-ust-32', label: 'UST Price (32nds)', group: 'Rates', hint: '99-16+', spec: { kind: 'treasury', fraction: 32, plusTick: true } },
  { id: 'rates-ust-64', label: 'UST Price (64ths)', group: 'Rates', hint: '99-49', spec: { kind: 'treasury', fraction: 64, plusTick: false } },
  { id: 'rates-convexity', label: 'Convexity', group: 'Rates', hint: '4 dp', spec: { kind: 'number', decimals: 4 } },
  // FX
  { id: 'fx-rate', label: 'FX Rate (5dp / JPY)', group: 'FX', hint: 'pip precision, JPY -> 3dp', spec: { kind: 'fxRate', pipDecimals: 5, jpyConvention: true, symbolField: 'symbol' } },
  { id: 'fx-points', label: 'FX Points', group: 'FX', hint: 'signed 1 dp', spec: { kind: 'number', decimals: 1, signDisplay: 'always' } },
  { id: 'fx-pips-bps', label: 'Pips (bps)', group: 'FX', hint: 'value x 10000', spec: { kind: 'basisPoints', decimals: 1 } },
  // Commodities
  { id: 'cmdty-price', label: 'Price ($)', group: 'Commodities', hint: '2 dp currency', spec: { kind: 'currency', currency: 'USD', currencyDisplay: 'symbol', decimals: 2 } },
  { id: 'cmdty-spread', label: 'Spread', group: 'Commodities', hint: '4 dp', spec: { kind: 'number', decimals: 4 } },
  { id: 'cmdty-per-unit', label: '$/unit', group: 'Commodities', hint: 'currency 2 dp', spec: { kind: 'currency', currency: 'USD', currencyDisplay: 'symbol', decimals: 2 } },
  // Risk / PnL
  { id: 'pnl-accounting', label: 'PnL $ (accounting)', group: 'Risk / PnL', hint: '(1,234) red/green, 0 dp', spec: { kind: 'currency', currency: 'USD', currencyDisplay: 'symbol', decimals: 0, negativeStyle: 'parentheses', colorMode: 'posneg', zeroText: '-' } },
  { id: 'pnl-notional-mm', label: 'Notional ($mm)', group: 'Risk / PnL', hint: 'compact MM/BN', spec: { kind: 'compact', notation: 'mmbn', decimals: 1, prefix: '$' } },
  { id: 'pnl-change-pct', label: 'Change %', group: 'Risk / PnL', hint: 'signed, coloured', spec: { kind: 'percent', decimals: 2, signDisplay: 'always', colorMode: 'posneg' } },
  { id: 'pnl-greeks', label: 'Greeks', group: 'Risk / PnL', hint: '4 dp, coloured', spec: { kind: 'number', decimals: 4, colorMode: 'posneg' } },
  { id: 'pnl-var', label: 'VaR', group: 'Risk / PnL', hint: '(1,234) 0 dp', spec: { kind: 'currency', currency: 'USD', currencyDisplay: 'symbol', decimals: 0, negativeStyle: 'parentheses' } },
  // Text (styling only)
  { id: 'text-bold', label: 'Bold', group: 'Text', hint: 'font-weight bold', spec: { kind: 'text', weight: 'bold' } },
  { id: 'text-bolder', label: 'Bolder', group: 'Text', hint: 'font-weight bolder', spec: { kind: 'text', weight: 'bolder' } },
  { id: 'text-light', label: 'Light', group: 'Text', hint: 'font-weight lighter', spec: { kind: 'text', weight: 'lighter' } },
  { id: 'text-italic', label: 'Italic', group: 'Text', hint: 'italic', spec: { kind: 'text', italic: true } },
  { id: 'text-bold-italic', label: 'Bold Italic', group: 'Text', hint: 'bold + italic', spec: { kind: 'text', weight: 'bold', italic: true } },
  { id: 'text-normal', label: 'Normal', group: 'Text', hint: 'reset to normal', spec: { kind: 'text', weight: 'normal', italic: false } },
  // General
  { id: 'gen-integer', label: 'Integer', group: 'General', hint: 'grouped, 0 dp', spec: { kind: 'integer' } },
  { id: 'gen-decimal', label: 'Decimal (2dp)', group: 'General', hint: 'grouped, 2 dp', spec: { kind: 'number', decimals: 2 } },
  { id: 'gen-percent', label: 'Percent (2dp)', group: 'General', hint: 'value x 100', spec: { kind: 'percent', decimals: 2 } },
  { id: 'gen-date', label: 'Date', group: 'General', hint: 'locale date', spec: { kind: 'date', dateStyle: 'date' } },
  { id: 'gen-datetime', label: 'Date & time', group: 'General', hint: 'locale datetime', spec: { kind: 'date', dateStyle: 'datetime' } },
];

export function presetsByGroup(): { group: PresetGroup; presets: FormatPreset[] }[] {
  const order: PresetGroup[] = ['Rates', 'FX', 'Commodities', 'Risk / PnL', 'Text', 'General'];
  return order.map((group) => ({ group, presets: FORMAT_PRESETS.filter((p) => p.group === group) }))
              .filter((g) => g.presets.length > 0);
}
```

### 3.6 `format-registry.ts` — the declarative driver for BOTH panel UIs
This is the single source of truth that both the Angular and React panels render. Add a knob here → both
UIs update in lockstep.
```ts
export type FieldControl = 'stepper' | 'toggle' | 'select' | 'text';
export interface FormatFieldDef {
  key: string; label: string; control: FieldControl;
  min?: number; max?: number; options?: { value: string; label: string }[]; placeholder?: string;
}
export type FieldGroup = 'Numeric' | 'Rates' | 'FX' | 'Text' | 'Other';
export interface FormatKindDef {
  kind: FormatKind; label: string; group: FieldGroup; example: number | string;
  defaults: ColumnFormatSpec; fields: FormatFieldDef[];
}

// Shared, reusable field defs (module singletons — treat as immutable):
const DECIMALS: FormatFieldDef = { key: 'decimals', label: 'Decimals', control: 'stepper', min: 0, max: 10 };
const THOUSANDS: FormatFieldDef = { key: 'thousands', label: 'Thousands', control: 'toggle' };
const SIGN: FormatFieldDef = { key: 'signDisplay', label: 'Sign', control: 'select',
  options: [ { value: 'auto', label: 'Auto' }, { value: 'always', label: 'Always +' } ] };
const NEGATIVE: FormatFieldDef = { key: 'negativeStyle', label: 'Negatives', control: 'select',
  options: [ { value: 'minus', label: '-1,234' }, { value: 'parentheses', label: '(1,234)' } ] };
const COLOR: FormatFieldDef = { key: 'colorMode', label: 'Colour', control: 'select',
  options: [ { value: 'none', label: 'None' }, { value: 'posneg', label: '+green / -red' }, { value: 'negative', label: '-red only' } ] };
const PREFIX: FormatFieldDef = { key: 'prefix', label: 'Prefix', control: 'text', placeholder: 'e.g. $' };
const SUFFIX: FormatFieldDef = { key: 'suffix', label: 'Suffix', control: 'text', placeholder: 'e.g. mm' };
const NUMERIC_EXTRAS = [SIGN, NEGATIVE, COLOR, PREFIX, SUFFIX];

// FORMAT_REGISTRY — full, verbatim. Each kind's `fields` are NOT uniform; reproduce exactly.
export const FORMAT_REGISTRY: Record<FormatKind, FormatKindDef> = {
  number: {
    kind: 'number', label: 'Decimal', group: 'Numeric', example: 1234.5,
    defaults: { kind: 'number', decimals: 2 },
    fields: [DECIMALS, THOUSANDS, ...NUMERIC_EXTRAS],
  },
  integer: {
    kind: 'integer', label: 'Integer', group: 'Numeric', example: 1234,
    defaults: { kind: 'integer' },
    fields: [THOUSANDS, ...NUMERIC_EXTRAS],            // NB: no DECIMALS (integer is 0dp)
  },
  percent: {
    kind: 'percent', label: 'Percent', group: 'Numeric', example: 0.0425,
    defaults: { kind: 'percent', decimals: 2 },
    fields: [DECIMALS, ...NUMERIC_EXTRAS],             // NB: no THOUSANDS
  },
  basisPoints: {
    kind: 'basisPoints', label: 'Basis points', group: 'Rates', example: 0.00125,
    defaults: { kind: 'basisPoints', decimals: 1 },
    fields: [DECIMALS, SIGN, COLOR, PREFIX, SUFFIX],   // NB: no THOUSANDS, no NEGATIVE
  },
  currency: {
    kind: 'currency', label: 'Currency', group: 'Numeric', example: 1234.5,
    defaults: { kind: 'currency', currency: 'USD', currencyDisplay: 'symbol', decimals: 2 },
    fields: [
      DECIMALS, THOUSANDS,
      { key: 'currency', label: 'Code', control: 'text', placeholder: 'USD' },
      { key: 'currencyDisplay', label: 'Show', control: 'select',
        options: [ { value: 'symbol', label: 'Symbol' }, { value: 'code', label: 'Code' }, { value: 'none', label: 'None' } ] },
      NEGATIVE, COLOR,
    ],
  },
  compact: {
    kind: 'compact', label: 'Compact', group: 'Numeric', example: 2_500_000,
    defaults: { kind: 'compact', notation: 'KMB', decimals: 1 },
    fields: [
      DECIMALS,
      { key: 'notation', label: 'Notation', control: 'select',
        options: [ { value: 'KMB', label: 'K / M / B' }, { value: 'mmbn', label: 'K / MM / BN' } ] },
      PREFIX, COLOR,
    ],
  },
  multiplier: {
    kind: 'multiplier', label: 'Multiplier', group: 'Numeric', example: 1.25,
    defaults: { kind: 'multiplier', decimals: 2 },
    fields: [DECIMALS, SUFFIX, COLOR],
  },
  treasury: {
    kind: 'treasury', label: 'Treasury ticks', group: 'Rates', example: 99.515625,
    defaults: { kind: 'treasury', fraction: 32, plusTick: true },
    fields: [
      { key: 'fraction', label: 'Ticks', control: 'select',
        options: [ { value: '32', label: '32nds' }, { value: '64', label: '64ths' } ] },
      { key: 'plusTick', label: 'Half-tick +', control: 'toggle' },
      COLOR,
    ],
  },
  fxRate: {
    kind: 'fxRate', label: 'FX rate', group: 'FX', example: 1.08745,
    defaults: { kind: 'fxRate', pipDecimals: 5, jpyConvention: true, symbolField: 'symbol' },
    fields: [
      { key: 'pipDecimals', label: 'Pip dp', control: 'stepper', min: 0, max: 8 },
      { key: 'jpyConvention', label: 'JPY → 3dp', control: 'toggle' },
      { key: 'symbolField', label: 'Symbol field', control: 'text', placeholder: 'symbol' },
    ],                                                  // NB: no COLOR field
  },
  date: {
    kind: 'date', label: 'Date', group: 'Other', example: 0,
    defaults: { kind: 'date', dateStyle: 'date' },
    fields: [
      { key: 'dateStyle', label: 'Style', control: 'select',
        options: [ { value: 'date', label: 'Date' }, { value: 'datetime', label: 'Date & time' }, { value: 'time', label: 'Time' } ] },
    ],
  },
  text: {
    kind: 'text', label: 'Text style', group: 'Text', example: 'Sample',
    defaults: { kind: 'text', weight: 'bold' },
    fields: [
      { key: 'weight', label: 'Weight', control: 'select',
        options: [ { value: 'normal', label: 'Normal' }, { value: 'bold', label: 'Bold' }, { value: 'bolder', label: 'Bolder' }, { value: 'lighter', label: 'Lighter' } ] },
      { key: 'italic', label: 'Italic', control: 'toggle' },
    ],
  },
};

export function kindsByGroup(): { group: FieldGroup; kinds: FormatKindDef[] }[] {
  const order: FieldGroup[] = ['Numeric', 'Rates', 'FX', 'Text', 'Other'];
  const all = Object.values(FORMAT_REGISTRY);
  return order.map((group) => ({ group, kinds: all.filter((k) => k.group === group) }))
              .filter((g) => g.kinds.length > 0);
}

// Coercion key-sets — a control's raw string value is coerced by which set its key is in:
export const NUMBER_FIELD_KEYS = new Set(['decimals', 'pipDecimals', 'scale', 'fraction']);
export const BOOLEAN_FIELD_KEYS = new Set(['thousands', 'plusTick', 'jpyConvention', 'italic']);

export function setSpecField(spec: ColumnFormatSpec, key: string, raw: unknown): ColumnFormatSpec {
  const next: Record<string, unknown> = { ...spec };
  let value: unknown;
  if (BOOLEAN_FIELD_KEYS.has(key))      value = Boolean(raw);
  else if (NUMBER_FIELD_KEYS.has(key))  value = raw === '' || raw == null ? undefined : Number(raw);
  else                                  value = raw === '' || raw == null ? undefined : raw;
  if (value === undefined) delete next[key]; else next[key] = value;
  return next as ColumnFormatSpec;
}
```
> ⚠️ **GOTCHA:** `setSpecField` coercion is keyed by the field `key` string. **Any new numeric/boolean
> field must be added to `NUMBER_FIELD_KEYS` / `BOOLEAN_FIELD_KEYS`** or it will be stored as a raw string
> and silently misbehave. Also note: `presetsByGroup` order (`Rates, FX, Commodities, Risk / PnL, Text,
> General`) and `kindsByGroup` order (`Numeric, Rates, FX, Text, Other`) are **different enums** — don't
> conflate them.

### 3.7 `column-format-store.ts` — per-grid format registry + "bake mode"
The store owns formats for **one** grid. In this repo both wrappers run it in **bake mode**, where the
store is a *pure spec registry* that **never touches live colDefs** — the wrapper bakes formats into the
colDefs instead (see §4.3 / §7). The full colDef-mutation paths only run when bake mode is **off**.

Class surface (the API the panels + wrappers call):
```ts
export interface FormattableColumn { colId: string; headerName: string; active: boolean; }

export class ColumnFormatStore {
  constructor(getApi: () => GridApi | undefined);
  setBakeMode(on: boolean): void;                  // true => never mutates colDefs; reconcile() no-ops
  setExternallyManaged(colIds: Iterable<string>): void;  // calc cols whose formatter AG Grid caches
  apply(colId: string, spec: ColumnFormatSpec): void;
  clear(colId: string): void;
  clearAll(): void;
  has(colId: string): boolean;
  get(colId: string): ColumnFormatSpec | undefined;
  entries(): [string, ColumnFormatSpec][];
  size(): number;
  listFormattableColumns(): FormattableColumn[];   // reads live grid columns via getApi()
  serialize(): ColumnFormatMap | undefined;        // bare colId->spec map, or undefined when empty
  restore(map: ColumnFormatMap): void;             // clears all, then applies the map (see GOTCHA)
  reconcile(): void;
  onChange(cb: () => void): () => void;            // returns unsubscribe
}
```
The bake-mode branches (the "never touches colDefs" guarantee):
```ts
setBakeMode(on: boolean): void { this.bakeMode = on; }

reconcile(): void {
  if (this.bakeMode) return;   // formats live in the colDefs; nothing to reconcile
  // ...(non-bake path: detect drift between installed formatter/style and the colDef, re-mutate)
}

private mutate(colId: string): boolean {
  // In bake mode (or for externally-managed/calc columns) the wrapper bakes the format; don't mutate.
  if (this.bakeMode || this.externallyManaged.has(colId)) return true;
  // ...(non-bake path: install buildValueFormatter + buildCellStyle onto the live colDef,
  //     tracking installed fns in a WeakSet `ours` so reconcile/capture never treats them as "original")
}

private clearOne(colId: string): void {
  const col = this.bakeMode || this.externallyManaged.has(colId) ? null : this.getApi()?.getColumn(colId);
  // ...(if col: restore original valueFormatter/cellStyle), then delete all per-col tracking maps
}
```
Serialize / restore — the persistence surface:
```ts
serialize(): ColumnFormatMap | undefined {
  return this.formats.size > 0 ? (Object.fromEntries(this.formats) as ColumnFormatMap) : undefined;
}

restore(map: ColumnFormatMap): void {
  for (const colId of [...this.formats.keys()]) this.clearOne(colId);   // clear existing first
  for (const [colId, spec] of Object.entries(map)) {
    this.formats.set(colId, spec);
    this.captureOriginals(colId);   // back up app's formatter/cellStyle ONCE (no-op in bake mode path)
    this.mutate(colId);
  }
  this.refreshAll();
  this.emit();
}
```
> ⚠️ **GOTCHAs:**
> - **`restore()` always clears first**, so restoring a saved view with **no** `columnFormats` key
>   intentionally **clears any declaratively-seeded initial formats**. (The wrappers exploit this — see §7.)
> - `setExternallyManaged(colIds)` is **independent of bake mode** — a non-bake consumer still needs it for
>   calculated columns (whose formatter AG Grid caches and ignores post-hoc mutation of).
> - When NOT in bake mode, the store is the **only** thing allowed to mutate `colDef.valueFormatter` /
>   `cellStyle`; it backs up the app's originals exactly once and uses a `WeakSet` to never mistake one of
>   its own functions for an "original".

### 3.8 `tool-panel-def.ts` (full — framework-free)
```ts
/** Tool-panel id (used by api.openToolPanel(...) and in persisted sideBar state). */
export const FORMAT_TOOL_PANEL_ID = 'macroFormat';
/** Component key both wrappers map to their framework panel via gridOptions.components. */
export const FORMAT_TOOL_PANEL_COMPONENT = 'macroFormatToolPanel';

export function formatToolPanelDef(toolPanelParams?: unknown): ToolPanelDef {
  return {
    id: FORMAT_TOOL_PANEL_ID,
    labelDefault: 'Format',
    labelKey: FORMAT_TOOL_PANEL_ID,
    iconKey: 'columns',
    toolPanel: FORMAT_TOOL_PANEL_COMPONENT,
    toolPanelParams,
  };
}

export function withFormatPanel(
  sideBar: SideBarDef | string | string[] | boolean | null | undefined,
  toolPanelParams: unknown,
): SideBarDef {
  const def = formatToolPanelDef(toolPanelParams);
  const base = sideBar && typeof sideBar === 'object' && !Array.isArray(sideBar) ? sideBar : undefined;
  const existing = base && Array.isArray(base.toolPanels)
    ? base.toolPanels
    : Array.isArray(sideBar) ? sideBar : ['columns', 'filters'];
  const withoutFormat = existing.filter((panel) => typeof panel === 'string' || panel.id !== FORMAT_TOOL_PANEL_ID);
  return { ...(base ?? {}), toolPanels: [...withoutFormat, def], hiddenByDefault: base?.hiddenByDefault ?? false };
}
```
> `withFormatPanel` is **idempotent** and union-shape tolerant: it strips any pre-existing Format panel
> before appending, defaults to `['columns','filters']`, and never spreads a primitive. Safe to call
> repeatedly.

### 3.9 Core barrel `src/index.ts`
Re-export **only** the framework-free core — spec, engine, treasury, fx-rate, presets, registry, store,
tool-panel-def, calculated-columns (§5), show-values-as (§6). **Do NOT export the framework panels here**
— they live behind `/angular` and `/react`.

---

## 4. Format tool panel UIs (Angular + React)

Both panels hold **zero formatting logic**: they render entirely off `FORMAT_REGISTRY`
(`kindsByGroup` / a kind's `fields`) + `presetsByGroup`, edit a draft spec exclusively via `setSpecField`,
preview via `formatValue` + `previewStyle`, and push to the store via `apply` / `clear` / `clearAll`.

### 4.1 Angular — `src/lib/angular/macro-format-tool-panel.component.ts`
```ts
export interface FormatToolPanelParams extends IToolPanelParams { store: ColumnFormatStore; }
const SAMPLE_ROW = { symbol: 'EURUSD' };

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

  readonly currentKind = computed<FormatKindDef>(() => FORMAT_REGISTRY[this.draft().kind]);
  readonly preview = computed(() => formatValue(this.currentKind().example, this.draft(), SAMPLE_ROW));
  readonly previewCss = computed(() => previewStyle(this.draft(), this.currentKind().example));

  agInit(params: FormatToolPanelParams): void {
    this.params = params;
    this.store = params.store;
    this.refreshColumns();
    this.refreshActive();
    this.unsubscribe = this.store.onChange(() => { this.refreshColumns(); this.refreshActive(); });
    this.columnListener = () => this.refreshColumns();
    this.params.api.addEventListener('displayedColumnsChanged', this.columnListener);
  }

  /** Required by IToolPanel; returning true keeps the panel mounted across sideBar updates. */
  refresh(): boolean { return true; }

  ngOnDestroy(): void {
    this.unsubscribe?.();
    if (this.columnListener) this.params?.api.removeEventListener('displayedColumnsChanged', this.columnListener);
  }

  private refreshColumns(): void { this.columns.set(this.store.listFormattableColumns()); }
  private refreshActive(): void { this.active.set(this.store.entries()); }

  // edit/apply wiring — ALL edits route through setSpecField; ALL writes go through the store:
  selectPreset(preset: FormatPreset): void { this.draft.set({ ...preset.spec }); }
  selectKind(kind: FormatKindDef): void { this.draft.set({ ...kind.defaults }); }
  onField(key: string, raw: unknown): void { this.draft.set(setSpecField(this.draft(), key, raw)); }
  onStep(key: string, delta: number, min = 0, max = 10): void {
    const current = Number((this.draft() as Record<string, unknown>)[key] ?? 0);
    this.onField(key, Math.max(min, Math.min(max, current + delta)));
  }
  onToggle(key: string): void { this.onField(key, !(this.draft() as Record<string, unknown>)[key]); }
  canApply(): boolean { return this.selected().size > 0; }
  apply(): void { const spec = this.draft(); for (const colId of this.selected()) this.store.apply(colId, spec); }
  resetSelected(): void { for (const colId of this.selected()) this.store.clear(colId); }
  resetAll(): void { this.store.clearAll(); }
  removeActive(colId: string): void { this.store.clear(colId); }
}
```
The template loops `kindGroups`, the current kind's `fields` (switching on `field.control` →
stepper/toggle/select/text), `presetGroups`, the column list (filtered by `search`, checkboxes bound to
`selected`), the live `preview` (with `previewCss`), and the `active` list with per-row remove + reset-all.

`src/lib/angular/index.ts` barrel: `export { MacroFormatToolPanelComponent }` + `export type { FormatToolPanelParams }`.

### 4.2 React — `src/lib/react/MacroFormatToolPanel.tsx`
```tsx
export type MacroFormatToolPanelProps = CustomToolPanelProps & { store: ColumnFormatStore };
const SAMPLE_ROW = { symbol: 'EURUSD' };
const PRESET_GROUPS = presetsByGroup();
const KIND_GROUPS = kindsByGroup();

export function MacroFormatToolPanel({ store, api }: MacroFormatToolPanelProps) {
  const [columns, setColumns] = useState<FormattableColumn[]>([]);
  const [active, setActive] = useState<[string, ColumnFormatSpec][]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<ColumnFormatSpec>({ kind: 'number', decimals: 2 });

  const refresh = useCallback(() => {
    setColumns(store.listFormattableColumns());
    setActive(store.entries());
  }, [store]);

  useEffect(() => {
    refresh();
    const off = store.onChange(refresh);
    const onCols = () => setColumns(store.listFormattableColumns());
    api.addEventListener('displayedColumnsChanged', onCols);
    return () => { off(); api.removeEventListener('displayedColumnsChanged', onCols); };
  }, [store, api, refresh]);

  const kindDef = FORMAT_REGISTRY[draft.kind];
  const preview = formatValue(kindDef.example, draft, SAMPLE_ROW);
  const previewCss = previewStyle(draft, kindDef.example) as React.CSSProperties;

  const onField = (key: string, raw: unknown) => setDraft((d) => setSpecField(d, key, raw));
  const onStep = (f: FormatFieldDef, delta: number) => {
    const current = Number(specVal(f.key) ?? 0);
    onField(f.key, Math.max(f.min ?? 0, Math.min(f.max ?? 10, current + delta)));
  };
  const apply = () => selected.forEach((colId) => store.apply(colId, draft));
  const resetSelected = () => selected.forEach((colId) => store.clear(colId));
  const canApply = selected.size > 0;
  // JSX: KIND_GROUPS.flatMap(g => g.kinds) for the kind picker; kindDef.fields rendered by field.control;
  //      PRESET_GROUPS for presets; the column list filtered by search; the Applied list with
  //      store.clear(colId) per row and store.clearAll().
}
export default MacroFormatToolPanel;
```
`src/lib/react/index.ts` barrel: `export { MacroFormatToolPanel }; export default MacroFormatToolPanel;`
+ `export type { MacroFormatToolPanelProps }`.

> ⚠️ **GOTCHAs:**
> - **Angular `refresh()` must return `true`** — returning false tears the panel down and loses the
>   `agInit` subscriptions.
> - The **React panel derives all colours from live AG theme CSS vars** (`--ag-foreground-color`,
>   `--ag-background-color`, `--ag-accent-color` via `color-mix`) so it tracks light/dark without importing
>   a stylesheet. The Angular panel uses an external `.css`. Keep the theme-var approach in React.

### 4.3 Wiring the panel into a grid wrapper (once per framework)
1. **Create ONE store per grid** with a `getApi` closure, and immediately `setBakeMode(true)`:
   - Angular: a class field `new ColumnFormatStore(() => this.gridApi)`, then `setBakeMode(true)` in `ngOnInit`.
   - React: a `useRef` so the panel is **never** torn down across renders.
2. **Register the component under the EXACT string key** `FORMAT_TOOL_PANEL_COMPONENT`:
   ```ts
   // Angular
   components: { [FORMAT_TOOL_PANEL_COMPONENT]: MacroFormatToolPanelComponent }
   // React
   components={{ [FORMAT_TOOL_PANEL_COMPONENT]: MacroFormatToolPanel }}
   ```
3. **Build the sidebar** with `withFormatPanel(existingSideBar, { store })`. The `{ store }` object is
   delivered to the panel via `toolPanelParams` and arrives as `params.store` (Angular `agInit`) /
   `props.store` (React).
4. **Wire `reconcile`** to the grid's `displayedColumnsChanged` and `newColumnsLoaded` events. (In bake
   mode `reconcile` is a no-op, but keeping the wiring lets you flip bake mode off without code changes and
   keeps non-bake consumers correct.)

> ⚠️ **GOTCHA — mismatched keys = blank panel.** The panel is registered by the *string* key, not by class.
> The same `FORMAT_TOOL_PANEL_COMPONENT` must appear in `components` **and** be what `formatToolPanelDef`
> sets as `toolPanel`. Also: create the store/sideBar/components **once** (stable refs) so the
> `toolPanelParams` ref stays stable and the panel survives option updates. Angular re-applies
> `components` + `withFormatPanel` **after** the consumer `gridOptions` spread (merge, not clobber); React
> passes `sideBar`/`components` as explicit (higher-precedence) props on `<AgGridReact>`.

---

## 5. Calculated columns (AG Grid 36 feature)

Enable via grid option; users add/edit/remove columns from the header menu. Dev-declared calc columns use
a `calculatedExpression` with bracket refs (e.g. `'[bid] - [ask]'`).
```ts
// gridOptions:
calculatedColumns: { applyMode: 'deferred' },   // 'deferred' = validate + Apply/Cancel in the dialog
```
Events carry `{ column, expression }`:
`calculatedColumnCreated`, `calculatedColumnExpressionChanged`, `calculatedColumnRemoved`.

### 5.1 Persistence helpers — `calculated-columns.ts` (framework-free)
```ts
export const CALCULATED_COLUMNS_KEY = 'calculatedColumns';
export interface CalcColumnSchema { colId: string; calculatedExpression: string; headerName?: string; cellDataType?: string; }

export function mergeCalculatedColumns(
  base: readonly AnyColDef[] | undefined,
  schemas: readonly CalcColumnSchema[],
  removed: ReadonlySet<string> = new Set(),
): AnyColDef[] {
  const byColId = new Map(schemas.map((s) => [s.colId, s]));
  const usedFromBase = new Set<string>();
  const merged: AnyColDef[] = [];
  for (const def of base ?? []) {
    if (!isLeaf(def)) { merged.push(def); continue; }          // pass through groups
    const colId = leafColId(def);
    if (colId && removed.has(colId)) continue;                 // user removed this pre-defined calc column
    const schema = colId ? byColId.get(colId) : undefined;
    if (schema) {
      usedFromBase.add(colId!);
      merged.push({
        ...def,
        calculatedExpression: schema.calculatedExpression,
        ...(schema.headerName != null ? { headerName: schema.headerName } : {}),
        ...(schema.cellDataType ? { cellDataType: schema.cellDataType } : {}),
      });
    } else { merged.push(def); }
  }
  for (const schema of schemas) {                              // append user-created (not in base)
    if (!usedFromBase.has(schema.colId) && !removed.has(schema.colId)) merged.push(schemaToColDef(schema));
  }
  return merged;
}

export function sameCalcSchema(a: CalcColumnSchema | undefined, b: CalcColumnSchema | undefined): boolean {
  if (!a || !b) return a === b;
  return a.colId === b.colId && a.calculatedExpression === b.calculatedExpression
      && a.headerName === b.headerName && a.cellDataType === b.cellDataType;
}

export function schemaToColDef(schema: CalcColumnSchema): ColDef {
  const def: ColDef = { colId: schema.colId, calculatedExpression: schema.calculatedExpression };
  if (schema.headerName != null) def.headerName = schema.headerName;
  if (schema.cellDataType) def.cellDataType = schema.cellDataType;
  return def;
}

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
```
(`AnyColDef = ColDef | ColGroupDef`; `isLeaf` = not a group; `leafColId(def) = def.colId ?? (typeof def.field === 'string' ? def.field : undefined)`.)

### 5.2 Two calc-column gotchas (both already caused freezes)
> ⚠️ **(a) Calc columns require BAKED formatting, not post-hoc `valueFormatter` mutation.** AG Grid 36
> caches a `cellDataType` value formatter for calculated columns, so mutating `colDef.valueFormatter`
> after the fact + `refreshCells` is **ignored**. This is the whole reason for **bake mode**: a calc
> column's format must be baked into the colDef *before* it reaches the grid.
>
> ⚠️ **(b) Re-feeding a user-created calc column into `columnDefs` re-emits `calculatedColumnCreated` for
> the same column** → a re-feed → re-emit → re-feed cycle that **freezes the grid**. Guard the upsert
> handler with `sameCalcSchema` (bail when nothing actually changed). See §7.2.

---

## 6. Show Values As (AG Grid 36 feature)

Column-level aggregation transform — show an aggregated value as a % of grand total, parent group, etc.
```ts
// colDef (preset mode + header-menu toggle):
{
  colId: 'pnlPctGrand', field: 'pnl', headerName: 'PnL % (grand)', aggFunc: 'sum',
  showValuesAs: 'percentOfGrandTotal', enableShowValuesAs: true,
  type: 'numericColumn', cellStyle: { textAlign: 'right' }, width: 140,
},
{
  colId: 'notionalPctParent', field: 'notional', headerName: 'Notional % (parent)', aggFunc: 'sum',
  showValuesAs: 'percentOfParentRowTotal', enableShowValuesAs: true,
  type: 'numericColumn', cellStyle: { textAlign: 'right' }, width: 170,
},
```
Built-in string modes: `percentOfGrandTotal`, `percentOfColumnTotal`, `percentOfRowTotal`,
`percentOfParentRowTotal`, `percentOfParentColumnTotal`.

### 6.1 Persistence — `show-values-as.ts` (full, framework-free)
```ts
export const SHOW_VALUES_AS_KEY = 'showValuesAs';
export interface ShowValuesAsEntry { colId: string; showValuesAs: string; }
interface ColumnStateLike { colId: string; showValuesAs?: unknown; }

export function serializeShowValuesAs(
  columnState: readonly ColumnStateLike[] | undefined,
): ShowValuesAsEntry[] | undefined {
  const out: ShowValuesAsEntry[] = [];
  for (const col of columnState ?? []) {
    if (col && typeof col.colId === 'string' && typeof col.showValuesAs === 'string' && col.showValuesAs) {
      out.push({ colId: col.colId, showValuesAs: col.showValuesAs });
    }
  }
  return out.length ? out : undefined;
}
```
> ⚠️ **GOTCHAs:**
> - **Show Values As is NOT in `gridApi.getState()`.** `GridState.aggregation.aggregationModel` carries
>   `{colId, aggFunc}` **only** — no mode. The mode lives in **column state**:
>   `getColumnState()[].showValuesAs`, applied via `applyColumnState({ state: [{colId, showValuesAs}] })`.
>   That's why it needs its own side-channel (§7) and must be re-applied **after** `setState` (see §7.3).
> - **Only built-in *string* modes persist.** Custom transform objects carry functions → not
>   JSON-serializable; `serializeShowValuesAs` drops them.
> - **`percentOfParentColumnTotal` and `percentOfRowTotal` are PIVOT-column concepts** → they render
>   **`#N/A`** in plain row grouping. For "share of parent group" use **`percentOfParentRowTotal`**.
>   `ShowValuesAsModule` is already inside `AllEnterpriseModule`.

---

## 7. Persistence glue — the three side-channels (the integration that ties it together)

`getGridState()` returns AG Grid's native `getState()` blob **plus three side-channels**, each omitted when
empty. `applyGridState()` reverses it **in a specific order**. None of the three are carried by AG Grid's
native state.

### 7.1 The bake function (single source of truth for formatting — regular AND calc)
Angular `recomputeEffectiveColumns()`:
```ts
private recomputeEffectiveColumns(): void {
  const merged = mergeCalculatedColumns(this.columnDefs, [...this.userCalcCols.values()], this.removedCalcCols);
  this.effectiveColumnDefs = merged.map((def) => {
    const d = def as ColDef;
    const colId = d.colId ?? (typeof d.field === 'string' ? d.field : undefined);
    if (!colId) return def;
    const spec = this.formatStore.get(colId);
    if (!spec) return def;
    const baked: ColDef = { ...d };
    const vf = buildValueFormatter(spec);   if (vf) baked.valueFormatter = vf;
    const cs = buildCellStyle(spec, d.cellStyle); if (cs) baked.cellStyle = cs;
    return baked;
  });
}
```
On any store change, re-bake + re-apply with a re-entrancy guard (bake mode means `reconcile` can't loop):
```ts
private applyingColumnDefs = false;
private readonly onStoreFormatsChanged = (): void => {
  if (this.applyingColumnDefs) return;
  this.applyingColumnDefs = true;
  try {
    this.recomputeEffectiveColumns();
    this.gridApi?.setGridOption('columnDefs', this.effectiveColumnDefs);
  } finally { this.applyingColumnDefs = false; }
};
```

### 7.2 Calc-column event handlers (with the freeze guard)
```ts
private userCalcCols = new Map<string, CalcColumnSchema>();
private removedCalcCols = new Set<string>();

private readonly onCalcColumnUpserted = (e: CalculatedColumnCreatedEvent | CalculatedColumnExpressionChangedEvent): void => {
  const colId = e.column.getColId();
  const def = e.column.getColDef();
  const next: CalcColumnSchema = {
    colId, calculatedExpression: e.expression,
    ...(def.headerName != null ? { headerName: def.headerName } : {}),
    ...(typeof def.cellDataType === 'string' ? { cellDataType: def.cellDataType } : {}),
  };
  // Idempotency guard — bail if nothing changed, else re-feed → re-emit → re-feed FREEZES the grid.
  const prev = this.userCalcCols.get(colId);
  if (prev && !this.removedCalcCols.has(colId) && sameCalcSchema(prev, next)) return;
  this.userCalcCols.set(colId, next);
  this.removedCalcCols.delete(colId);
  this.recomputeEffectiveColumns();
  this.formatStore.reconcile();
};

private readonly onCalcColumnRemoved = (e: CalculatedColumnRemovedEvent): void => {
  const colId = e.column.getColId();
  this.userCalcCols.delete(colId);
  this.removedCalcCols.add(colId);
  this.formatStore.clear(colId);   // drop any dangling format so it doesn't resurrect on recreate
  this.recomputeEffectiveColumns();
  this.formatStore.reconcile();
};
```

### 7.3 `getGridState` / `applyGridState` (Angular — the full methods)
```ts
public getGridState(): any {
  const state = this.gridApi?.getState();
  if (!state) return undefined;
  const formats = this.formatStore.serialize();
  const calc = this.serializeCalcColumns();
  const showValuesAs = serializeShowValuesAs(this.gridApi?.getColumnState());
  return {
    ...state,
    ...(formats ? { columnFormats: formats } : {}),
    ...(calc ? { [CALCULATED_COLUMNS_KEY]: calc } : {}),
    ...(showValuesAs ? { [SHOW_VALUES_AS_KEY]: showValuesAs } : {}),
  };
}

public applyGridState(state: any): void {
  if (!this.gridApi) { this.logger.warn('Cannot apply grid state — grid is not ready'); return; }
  const { columnFormats, [CALCULATED_COLUMNS_KEY]: calc, [SHOW_VALUES_AS_KEY]: showValuesAs, ...gridState } = state ?? {};
  this.restoreCalcColumns(calc);                       // 1. recreate calc cols + setGridOption FIRST
  this.gridApi.setState(gridState as GridState);        // 2. native state
  this.applyShowValuesAsState(showValuesAs);            // 2b. applyColumnState AFTER setState
  this.applyFormatsWhenReady(migrateMap(columnFormats ?? {}));  // 3. ALWAYS drives the store
}

private applyShowValuesAsState(entries: ShowValuesAsEntry[] | undefined): void {
  if (!entries?.length) return;
  this.gridApi?.applyColumnState({ state: entries });
}

private serializeCalcColumns(): { defs: CalcColumnSchema[]; removed?: string[] } | undefined {
  const defs = [...this.userCalcCols.values()];
  const removed = [...this.removedCalcCols];
  if (defs.length === 0 && removed.length === 0) return undefined;
  return removed.length ? { defs, removed } : { defs };
}

private restoreCalcColumns(calc: { defs?: CalcColumnSchema[]; removed?: string[] } | undefined): void {
  this.userCalcCols = new Map((calc?.defs ?? []).map((s) => [s.colId, s]));
  this.removedCalcCols = new Set(calc?.removed ?? []);
  this.recomputeEffectiveColumns();
  this.gridApi?.setGridOption('columnDefs', this.effectiveColumnDefs);
}

private applyFormatsWhenReady(map: ColumnFormatMap): void {
  this.formatStore.restore(map);
  const missing = Object.keys(map).some((colId) => !this.gridApi?.getColumn(colId));
  if (missing && this.gridApi) {
    const handler = () => { this.formatStore.reconcile(); this.gridApi?.removeEventListener('firstDataRendered', handler); };
    this.gridApi.addEventListener('firstDataRendered', handler);
  }
}
```
> ⚠️ **The order in `applyGridState` is load-bearing:**
> 1. **Recreate calc columns + `setGridOption('columnDefs')` FIRST** so native `setState` can bind their
>    order/width/sort by `colId`.
> 2. `setState(gridState)`.
> 2b. `applyColumnState({ state: showValuesAs })` **AFTER** `setState` — Show Values As is *not* in
>    GridState, and `setState` would otherwise reset column state. Doing it before `setState` loses it.
> 3. `store.restore(...)` runs **ALWAYS** — an empty/absent `columnFormats` key intentionally **clears**
>    declaratively-seeded formats. Same for calc columns: a saved "no calc columns" view removes runtime
>    ones. Then a one-shot `firstDataRendered` fallback reconciles formats for columns not yet loaded.

### 7.4 React equivalents + the ref-identity "pin"
React mirrors all of the above, but needs one extra trick. After `setGridOption('columnDefs', built)` the
**next render's `effectiveColumnDefs` `useMemo` must return the SAME array reference** so `<AgGridReact>`'s
`columnDefs` prop short-circuits and does **not** re-apply columnDefs after `setState` (which would clobber
restored state).
```tsx
const pinnedDefsRef = useRef<ReturnType<typeof mergeCalculatedColumns> | null>(null);

const buildEffective = useCallback(() => {
  const merged = mergeCalculatedColumns(columnDefs, [...calcDefsRef.current.values()], calcRemovedRef.current);
  return merged.map((def) => { /* same bake logic as §7.1, using store.get(colId) */ });
}, [columnDefs, store]);

const effectiveColumnDefs = useMemo(() => {
  if (pinnedDefsRef.current) { const pinned = pinnedDefsRef.current; pinnedDefsRef.current = null; return pinned; }
  return buildEffective();
}, [buildEffective, calcVersion]);   // calcVersion is a counter that forces recompute

// store onChange -> re-bake + setGridOption, pinning the freshly-built array:
useEffect(() => {
  const off = store.onChange(() => {
    if (applyingCalcDefsRef.current) return;
    applyingCalcDefsRef.current = true;
    try {
      const built = buildEffective();
      pinnedDefsRef.current = built;
      setCalcVersion((v) => v + 1);
      gridApiRef.current?.setGridOption('columnDefs', built);
    } finally { applyingCalcDefsRef.current = false; }
  });
  return off;
}, [store, buildEffective]);
```
React `applyGridState` (inside `useImperativeHandle`) — same ordered sequence, with the pin:
```tsx
applyGridState: (state: any) => {
  const api = gridApiRef.current; if (!api) return;
  const { columnFormats: cf, [CALCULATED_COLUMNS_KEY]: calc, [SHOW_VALUES_AS_KEY]: showValuesAs, ...gs } = state ?? {};
  // 1. recreate calc cols BEFORE setState
  calcDefsRef.current = new Map((calc?.defs ?? []).map((s: CalcColumnSchema) => [s.colId, s]));
  calcRemovedRef.current = new Set<string>(calc?.removed ?? []);
  const merged = buildEffective();
  pinnedDefsRef.current = merged;
  setCalcVersion((v) => v + 1);
  api.setGridOption('columnDefs', merged);
  // 2. native state
  api.setState(gs as GridState);
  // 2b. show-values-as AFTER setState
  if (showValuesAs?.length) api.applyColumnState({ state: showValuesAs });
  // 3. formats ALWAYS
  const map = migrateMap(cf ?? {});
  store.restore(map);
  if (Object.keys(map).some((id) => !api.getColumn(id))) {
    const handler = () => { store.reconcile(); api.removeEventListener('firstDataRendered', handler); };
    api.addEventListener('firstDataRendered', handler);
  }
},
```
React render — note `sideBar`/`components`/`columnDefs` passed as explicit props **and** `enableCharts`:
```tsx
<AgGridReact theme={theme} columnDefs={effectiveColumnDefs} enableCharts rowData={rowData}
  gridOptions={mergedGridOptions} getRowId={getRowId}
  sideBar={sideBar} components={components} onGridReady={onGridReady} />
```

### 7.5 Wrapper public API (target surface)
```ts
// ANGULAR — selector 'lib-macro-angular-grid'
@Input() columns: string | ColDef[] = [];
@Input() rowData: unknown[] = [];
@Input() gridOptions: GridOptions = {};
@Input() getRowId?: (params: GetRowIdParams) => string;
@Input() columnFormats?: ColumnFormatMap;   // seed declarative formats; saved state overrides on restore
public readonly addRows$ = new Subject<unknown[]>();
public readonly updateRows$ = new Subject<unknown[]>();
public readonly deleteRows$ = new Subject<unknown[]>();
public applyTransaction(t: RowNodeTransaction): void;
public getGridApi(): GridApi | undefined;
public setInitialRowData(data: unknown[]): void;
public getGridState(): any;
public applyGridState(state: any): void;

// REACT — forwardRef<MacroReactGridRef, MacroReactGridProps>
interface MacroReactGridProps { columns?: string | ColDef[]; rowData?: unknown[]; gridOptions?: GridOptions; getRowId?: (p: GetRowIdParams) => string; columnFormats?: ColumnFormatMap; }
interface MacroReactGridRef { applyTransaction(t: RowNodeTransaction): void; getGridApi(): GridApi | undefined; getGridState(): any; applyGridState(state: any): void; addRows$: Subject<unknown[]>; updateRows$: Subject<unknown[]>; deleteRows$: Subject<unknown[]>; }
```
Default grid options the wrapper sets (Angular shown; React identical in a `useMemo`):
```ts
public defaultGridOptions: GridOptions = {
  defaultColDef: { sortable: true, filter: true, resizable: true },
  components: { [FORMAT_TOOL_PANEL_COMPONENT]: MacroFormatToolPanelComponent },
  sideBar: withFormatPanel({ toolPanels: ['columns', 'filters'], hiddenByDefault: false }, { store: this.formatStore }),
  calculatedColumns: { applyMode: 'deferred' },
  pagination: true, paginationPageSize: 10, paginationPageSizeSelector: [10, 25, 50, 100],
  animateRows: true,
  rowSelection: { mode: 'multiRow', checkboxes: false, enableClickSelection: false },
  cellSelection: true,
  suppressCellFocus: true,
};
// When merging consumer gridOptions, re-apply components + withFormatPanel with HIGHER precedence:
this.mergedGridOptions = {
  ...this.defaultGridOptions, ...this.gridOptions,
  columnDefs: this.effectiveColumnDefs, rowData: this.rowData,
  ...(this.getRowId && { getRowId: this.getRowId }),
  components: { ...this.gridOptions.components, [FORMAT_TOOL_PANEL_COMPONENT]: MacroFormatToolPanelComponent },
  sideBar: withFormatPanel(this.gridOptions.sideBar, { store: this.formatStore }),
};
```
onGridReady wiring (both frameworks):
```ts
api.addEventListener('displayedColumnsChanged', reconcileFormats);
api.addEventListener('newColumnsLoaded', reconcileFormats);
api.addEventListener('calculatedColumnCreated', onCalcColumnUpserted);
api.addEventListener('calculatedColumnExpressionChanged', onCalcColumnUpserted);
api.addEventListener('calculatedColumnRemoved', onCalcColumnRemoved);
formatStoreUnsub = formatStore.onChange(onStoreFormatsChanged);   // re-bake on store change
if (columnFormats) formatStore.restore(migrateMap(columnFormats)); // seed declarative formats
```

---

## 8. Reference consumer (how an app uses all of it)

A grouped/aggregated view that exercises both Show Values As columns and seeded formats:
```ts
// columns: desk/book/trader are rowGroup:true, hide:true; pnl/dayPnl/dv01/notional aggFunc:'sum';
// plus the two Show Values As columns from §6.

public initialColumnFormats: ColumnFormatMap = {
  pnl:      { kind: 'currency', currency: 'USD', decimals: 0, negativeStyle: 'parentheses', colorMode: 'posneg' },
  dayPnl:   { kind: 'currency', currency: 'USD', decimals: 0, negativeStyle: 'parentheses', colorMode: 'posneg' },
  dv01:     { kind: 'currency', currency: 'USD', decimals: 0 },
  notional: { kind: 'compact', notation: 'mmbn', decimals: 1, prefix: '$' },
  // NOTE: seed formats on the ABSOLUTE columns only — NOT the %-mode columns
  //       (a baked valueFormatter would reformat the % as currency).
};

// gridOptions for grouping:
//   rowGroupPanelShow: 'always', groupDefaultExpanded: 1, grandTotalRow: 'bottom'  (v36 name; NOT groupIncludeTotalFooter),
//   suppressAggFuncInHeader: true, autoGroupColumnDef: { pinned: 'left', minWidth: 260 }
```
Template: `<lib-macro-angular-grid [columns]="columns" [rowData]="rowData" [getRowId]="getRowId"
[columnFormats]="initialColumnFormats" [gridOptions]="gridOptions">`.

> ⚠️ **Do not seed a store format on a Show-Values-As column** — the baked `valueFormatter` would reformat
> the computed percentage as currency. Seed formats only on the absolute aggregated columns.

---

## 9. Adoption checklist (ordered)

1. **Deps:** AG Grid `^36` + AG Charts `^14` (matched pair). Register `[AllCommunityModule,
   AllEnterpriseModule, IntegratedChartsModule.with(AgChartsEnterpriseModule)]` once. (React: `enableCharts`.)
2. **Theme:** apply the v36 param mapping (§2.3). Verify a rendered header cell's computed font/background.
3. **CSS:** add the v36 pinned-row + sort-icon classes (both stylesheet copies, §2.4).
4. **Selection API:** object-form `rowSelection` + `cellSelection` (§2.5).
5. **Format core:** port the six files in dependency order (§3); keep ag-grid as `import type` only;
   ag-grid/@angular/react as optional peers. Port the `*.spec.ts` too — they're the regression baseline.
6. **Tool panel:** add the `/angular` and `/react` subpaths (excluded from tsc build); wire into each grid
   wrapper (§4.3): one store, `setBakeMode(true)`, register by `FORMAT_TOOL_PANEL_COMPONENT`, `withFormatPanel`.
7. **Bake pipeline:** `effectiveColumnDefs = mergeCalculatedColumns(...)` then bake `valueFormatter` +
   `cellStyle` from `store.get(colId)`; re-apply via `setGridOption('columnDefs')` on `store.onChange`
   (guarded). React: add the `pinnedDefsRef` pin + `calcVersion`.
8. **Calc columns:** `calculatedColumns: { applyMode: 'deferred' }`; wire the three events; **`sameCalcSchema`
   guard** on upsert; clear the format on remove (§5, §7.2).
9. **Show Values As:** colDef `showValuesAs` + `enableShowValuesAs`; persist via `serializeShowValuesAs`;
   re-apply via `applyColumnState` **after** `setState` (§6, §7.3). Use `percentOfParentRowTotal`, not the
   pivot-only modes.
10. **Persistence:** `getGridState` spreads the three side-channels; `applyGridState` reverses them in the
    exact order of §7.3. `store.restore` always runs (empty map clears seeds).
11. **Verify** (§10).

---

## 10. Verification

- **Unit:** port and run the engine specs (`format-engine`, `format-spec`, `treasury`, `fx-rate`,
  `show-values-as`, `calculated-columns`, `column-format-store`). They assume **en-US** Intl output — don't
  change the default locale.
- **Build:** the format core builds with the angular/react folders excluded; the apps consume the panels
  from source.
- **Manual / headless browser** (specs cannot catch these — they need real AG Grid events):
  - Header cell computed `fontFamily`/background match the theme (catches the silent v36 param-drop).
  - Format tool panel: select columns + a format → cells reformat live; the active list updates.
  - Add a calc column via the header menu → it renders and does **not** freeze the grid; edit/remove work.
  - Set a Show Values As mode → renders a %, not `#N/A`.
  - **Round-trip:** set formats + a calc column + a Show Values As mode → `getGridState()` → reload →
    `applyGridState()` → all three restore. Then save a view with everything cleared → restore → seeds do
    **not** resurrect.
- The repo diagnoses runtime freezes with a **headless-Chrome CDP harness** (no Playwright needed): launch
  `Google Chrome --headless=new --remote-allow-origins=* --remote-debugging-port=…`, attach to the page via
  `/json/list`, capture `Runtime.consoleAPICalled`, probe responsiveness with a `Runtime.evaluate`
  round-trip (a frozen main thread never answers), and read `.ag-cell[col-id=…]` `textContent` to confirm
  formats render.

---

## 11. Consolidated gotcha index

| # | Gotcha | Section |
| --- | --- | --- |
| 1 | v36 removed-param drop is **silent** (no build error) — verify in a real browser | §2.3 |
| 2 | CSS renames live in **two** stylesheets | §2.4 |
| 3 | Persisted format map is a **bare** `colId→spec` map (no version envelope) | §3.1 |
| 4 | `formatNumeric` ordering (scale×multiplier → abs → core → auto-suffix inside sign/parens) | §3.2 |
| 5 | Intl pinned to **en-US**; colour modes resolve to CSS vars; `buildValueFormatter` is `undefined` for text | §3.2 |
| 6 | `NumericModifiers` is wider than the registry UI — implement the whole surface | §3.2 |
| 7 | Treasury pads ticks to 2 digits for 32 **and** 64; half-tick at `>= 0.4` | §3.3 |
| 8 | New numeric/boolean field **must** join `NUMBER_FIELD_KEYS`/`BOOLEAN_FIELD_KEYS` | §3.6 |
| 9 | `store.restore` always clears first — empty map clears seeded formats | §3.7, §7.3 |
| 10 | **Bake mode is mandatory** to avoid the reconcile feedback loop | §3.7, §7.1 |
| 11 | Panel registered by **string key**; mismatched key = blank panel | §4.3 |
| 12 | Angular `refresh()` must return `true` | §4.1 |
| 13 | Calc columns need **baked** formatting (cellDataType caches the formatter) | §5.2 |
| 14 | **`sameCalcSchema` guard** prevents the re-feed → re-emit → freeze | §5.2, §7.2 |
| 15 | Show Values As is **not** in `getState()` — it's column state | §6.1, §7.3 |
| 16 | `percentOfParentColumnTotal` / `percentOfRowTotal` are **pivot-only** → `#N/A` | §6.1 |
| 17 | `applyGridState` order is load-bearing (calc → setState → showValuesAs → formats) | §7.3 |
| 18 | React needs the **`pinnedDefsRef`** ref-identity pin (Angular gets it for free) | §7.4 |
| 19 | Don't seed a store format on a Show-Values-As column | §8 |
| 20 | `grandTotalRow` is the v36 name (NOT `groupIncludeTotalFooter`) | §8 |
