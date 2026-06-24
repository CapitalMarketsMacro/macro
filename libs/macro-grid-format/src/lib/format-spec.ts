/**
 * Column format spec — the JSON-serializable description of how a column's values
 * should be displayed. NEVER stores functions, so it round-trips cleanly through
 * `getGridState()` / `applyGridState()` (the grid wrappers persist it under the
 * `columnFormats` key) and is rebuilt into a `valueFormatter` on restore.
 *
 * The spec is a discriminated union over capital-markets format `kind`s, structurally
 * a superset of the legacy `{ type, decimals }` shape (see {@link migrateSpec}).
 */

/** The capital-markets format families the engine understands. */
export type FormatKind =
  | 'number'
  | 'integer'
  | 'percent'
  | 'basisPoints'
  | 'currency'
  | 'compact'
  | 'multiplier'
  | 'treasury'
  | 'fxRate'
  | 'date'
  | 'text';

/** Curated font-weight presets for text columns (CSS keyword values, not free-form). */
export type FontWeight = 'normal' | 'bold' | 'bolder' | 'lighter';

/** How negative numbers are rendered. `parentheses` = accounting style `(1,234)`. */
export type NegativeStyle = 'minus' | 'parentheses';

/** `always` forces a leading `+` on positive numbers (tick/blotter convention). */
export type SignDisplay = 'auto' | 'always';

/**
 * Colour-by-sign mode. Resolved to a `cellStyle` colour at build time from the
 * `@macro/macro-design` tokens, so the spec stays a serializable string and dark
 * mode is handled by the token CSS variables.
 */
export type ColorMode = 'none' | 'posneg' | 'negative';

/** Shared numeric knobs available on every numeric `kind`. */
export interface NumericModifiers {
  /** Fraction digits. Falls back to the per-kind default in the registry. */
  decimals?: number;
  /** Thousands grouping. Defaults per-kind (on for number/integer/currency). */
  thousands?: boolean;
  /** Multiply the raw value by this before display (e.g. `1e-6` to show `$mm`). */
  scale?: number;
  /** Literal text placed before the formatted number. */
  prefix?: string;
  /** Literal text placed after the formatted number. */
  suffix?: string;
  /** `always` => leading `+` on positives. */
  signDisplay?: SignDisplay;
  /** Negative rendering style. */
  negativeStyle?: NegativeStyle;
  /** Colour-by-sign mode (resolved to cellStyle by the store/engine). */
  colorMode?: ColorMode;
  /** Text for null/undefined/NaN values. Default `''`. */
  nullText?: string;
  /** Text for an exact `0` (e.g. `'-'` on a blotter). */
  zeroText?: string;
  /** Locale for `Intl.NumberFormat`. Pinned to `'en-US'` by default in the engine. */
  locale?: string;
}

/** Spec for `number` — general decimal with grouping. */
export type NumberSpec = { kind: 'number' } & NumericModifiers;
/** Spec for `integer` — 0-dp with grouping. */
export type IntegerSpec = { kind: 'integer' } & NumericModifiers;
/** Spec for `percent` — value × 100 with a `%` suffix. */
export type PercentSpec = { kind: 'percent' } & NumericModifiers;
/** Spec for `basisPoints` — value × 10000 with a ` bps` suffix. */
export type BasisPointsSpec = { kind: 'basisPoints' } & NumericModifiers;
/** Spec for `currency` — ISO currency via `Intl`, or manual prefix when display is `none`. */
export type CurrencySpec = {
  kind: 'currency';
  /** ISO 4217 code, e.g. `'USD'`. */
  currency?: string;
  /** How the currency is shown. `none` => no symbol/code (manual prefix only). */
  currencyDisplay?: 'symbol' | 'code' | 'none';
} & NumericModifiers;
/** Spec for `compact` — abbreviated magnitudes (`K`/`M`/`B` or `K`/`MM`/`BN`). */
export type CompactSpec = {
  kind: 'compact';
  notation?: 'KMB' | 'mmbn';
} & NumericModifiers;
/** Spec for `multiplier` — ratios/leverage with an `x` suffix. */
export type MultiplierSpec = { kind: 'multiplier' } & NumericModifiers;
/** Spec for `treasury` — bond prices in 32nds/64ths with optional half-tick `+`. */
export type TreasurySpec = {
  kind: 'treasury';
  /** Tick denominator. `32` => 32nds, `64` => 64ths. */
  fraction?: 32 | 64;
  /** Render the half-tick `+` (e.g. `99-16+`). */
  plusTick?: boolean;
} & Pick<NumericModifiers, 'colorMode' | 'nullText' | 'zeroText'>;
/** Spec for `fxRate` — pip precision with the JPY 3-dp convention. */
export type FxRateSpec = {
  kind: 'fxRate';
  /** Decimals for non-JPY pairs. Default 5. */
  pipDecimals?: number;
  /** When true, pairs ending in JPY render at 3 dp. */
  jpyConvention?: boolean;
  /** Row field holding the pair symbol (read from `params.data[symbolField]`). */
  symbolField?: string;
} & NumericModifiers;
/** Spec for `date` — date/time via `Intl.DateTimeFormat`. */
export type DateSpec = {
  kind: 'date';
  dateStyle?: 'date' | 'datetime' | 'time';
  /** Reserved for a future custom pattern formatter. */
  pattern?: string;
  locale?: string;
};

/**
 * Spec for `text` — leaves the value untouched (no value formatter) and only styles the cell
 * via a curated set of font presets (weight + italic). For string columns where the desk wants
 * emphasis without arbitrary CSS control.
 */
export type TextStyleSpec = {
  kind: 'text';
  weight?: FontWeight;
  italic?: boolean;
} & Pick<NumericModifiers, 'nullText'>;

/** The full discriminated union of column format specs. */
export type ColumnFormatSpec =
  | NumberSpec
  | IntegerSpec
  | PercentSpec
  | BasisPointsSpec
  | CurrencySpec
  | CompactSpec
  | MultiplierSpec
  | TreasurySpec
  | FxRateSpec
  | DateSpec
  | TextStyleSpec;

/**
 * PERSISTED shape — a BARE map `colId -> spec`. Kept un-wrapped (no `{version, formats}`
 * envelope) so an older app build still iterates `colId -> spec` correctly. Versioning is
 * handled per-entry by structural migration ({@link migrateSpec}).
 */
export type ColumnFormatMap = Record<string, ColumnFormatSpec>;

/** The legacy v0 spec (today's popover shape), still readable as a subset. */
export interface LegacyFormatConfig {
  type: 'number' | 'percent' | 'bps' | 'currency' | 'compact';
  decimals: number;
}

/** Back-compat aliases so existing `FormatType` / `ColumnFormatConfig` importers compile. */
export type FormatType = LegacyFormatConfig['type'];
export type ColumnFormatConfig = LegacyFormatConfig;

const LEGACY_KIND: Record<LegacyFormatConfig['type'], FormatKind> = {
  number: 'number',
  percent: 'percent',
  bps: 'basisPoints',
  currency: 'currency',
  compact: 'compact',
};

/**
 * Migrate a single persisted entry to the current spec shape. Already-current specs
 * (those with a `kind`) pass through unchanged; legacy `{ type, decimals }` entries
 * are upgraded; anything unrecognised returns `undefined` (skipped on restore).
 */
export function migrateSpec(raw: unknown): ColumnFormatSpec | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  if ('kind' in raw) return raw as ColumnFormatSpec;
  if ('type' in raw) {
    const { type, decimals } = raw as LegacyFormatConfig;
    const kind = LEGACY_KIND[type] ?? 'number';
    const base: Record<string, unknown> = { kind, decimals };
    if (kind === 'currency') {
      base['currency'] = 'USD';
      base['currencyDisplay'] = 'symbol';
    }
    if (kind === 'compact') base['notation'] = 'KMB';
    return base as ColumnFormatSpec;
  }
  return undefined;
}

/** Migrate a whole persisted `columnFormats` map, dropping unrecognised entries. */
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
