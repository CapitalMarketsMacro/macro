/**
 * Declarative metadata for each format `kind`: its label, an example value used for the
 * live preview, the default spec, and the list of editable controls (`fields`). BOTH the
 * Angular and React tool panels render their controls by looping over this registry, so
 * adding a knob is a one-file change that updates both UIs in lockstep.
 */

import type { ColumnFormatSpec, FormatKind } from './format-spec';

export type FieldControl = 'stepper' | 'toggle' | 'select' | 'text';

export interface FormatFieldDef {
  /** Spec property this control edits. */
  key: string;
  label: string;
  control: FieldControl;
  /** stepper bounds. */
  min?: number;
  max?: number;
  /** select options. */
  options?: { value: string; label: string }[];
  /** placeholder / hint for text controls. */
  placeholder?: string;
}

export type FieldGroup = 'Numeric' | 'Rates' | 'FX' | 'Text' | 'Other';

export interface FormatKindDef {
  kind: FormatKind;
  label: string;
  group: FieldGroup;
  /** Sample raw value fed to the live preview. */
  example: number | string;
  /** Default spec applied when the user first selects this kind. */
  defaults: ColumnFormatSpec;
  /** Controls to render for this kind, in order. */
  fields: FormatFieldDef[];
}

const DECIMALS: FormatFieldDef = { key: 'decimals', label: 'Decimals', control: 'stepper', min: 0, max: 10 };
const THOUSANDS: FormatFieldDef = { key: 'thousands', label: 'Thousands', control: 'toggle' };
const SIGN: FormatFieldDef = {
  key: 'signDisplay',
  label: 'Sign',
  control: 'select',
  options: [
    { value: 'auto', label: 'Auto' },
    { value: 'always', label: 'Always +' },
  ],
};
const NEGATIVE: FormatFieldDef = {
  key: 'negativeStyle',
  label: 'Negatives',
  control: 'select',
  options: [
    { value: 'minus', label: '-1,234' },
    { value: 'parentheses', label: '(1,234)' },
  ],
};
const COLOR: FormatFieldDef = {
  key: 'colorMode',
  label: 'Colour',
  control: 'select',
  options: [
    { value: 'none', label: 'None' },
    { value: 'posneg', label: '+green / -red' },
    { value: 'negative', label: '-red only' },
  ],
};
const PREFIX: FormatFieldDef = { key: 'prefix', label: 'Prefix', control: 'text', placeholder: 'e.g. $' };
const SUFFIX: FormatFieldDef = { key: 'suffix', label: 'Suffix', control: 'text', placeholder: 'e.g. mm' };

const NUMERIC_EXTRAS = [SIGN, NEGATIVE, COLOR, PREFIX, SUFFIX];

export const FORMAT_REGISTRY: Record<FormatKind, FormatKindDef> = {
  number: {
    kind: 'number', label: 'Decimal', group: 'Numeric', example: 1234.5,
    defaults: { kind: 'number', decimals: 2 },
    fields: [DECIMALS, THOUSANDS, ...NUMERIC_EXTRAS],
  },
  integer: {
    kind: 'integer', label: 'Integer', group: 'Numeric', example: 1234,
    defaults: { kind: 'integer' },
    fields: [THOUSANDS, ...NUMERIC_EXTRAS],
  },
  percent: {
    kind: 'percent', label: 'Percent', group: 'Numeric', example: 0.0425,
    defaults: { kind: 'percent', decimals: 2 },
    fields: [DECIMALS, ...NUMERIC_EXTRAS],
  },
  basisPoints: {
    kind: 'basisPoints', label: 'Basis points', group: 'Rates', example: 0.00125,
    defaults: { kind: 'basisPoints', decimals: 1 },
    fields: [DECIMALS, SIGN, COLOR, PREFIX, SUFFIX],
  },
  currency: {
    kind: 'currency', label: 'Currency', group: 'Numeric', example: 1234.5,
    defaults: { kind: 'currency', currency: 'USD', currencyDisplay: 'symbol', decimals: 2 },
    fields: [
      DECIMALS,
      THOUSANDS,
      { key: 'currency', label: 'Code', control: 'text', placeholder: 'USD' },
      {
        key: 'currencyDisplay', label: 'Show', control: 'select',
        options: [
          { value: 'symbol', label: 'Symbol' },
          { value: 'code', label: 'Code' },
          { value: 'none', label: 'None' },
        ],
      },
      NEGATIVE,
      COLOR,
    ],
  },
  compact: {
    kind: 'compact', label: 'Compact', group: 'Numeric', example: 2_500_000,
    defaults: { kind: 'compact', notation: 'KMB', decimals: 1 },
    fields: [
      DECIMALS,
      {
        key: 'notation', label: 'Notation', control: 'select',
        options: [
          { value: 'KMB', label: 'K / M / B' },
          { value: 'mmbn', label: 'K / MM / BN' },
        ],
      },
      PREFIX,
      COLOR,
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
      {
        key: 'fraction', label: 'Ticks', control: 'select',
        options: [
          { value: '32', label: '32nds' },
          { value: '64', label: '64ths' },
        ],
      },
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
    ],
  },
  date: {
    kind: 'date', label: 'Date', group: 'Other', example: 0,
    defaults: { kind: 'date', dateStyle: 'date' },
    fields: [
      {
        key: 'dateStyle', label: 'Style', control: 'select',
        options: [
          { value: 'date', label: 'Date' },
          { value: 'datetime', label: 'Date & time' },
          { value: 'time', label: 'Time' },
        ],
      },
    ],
  },
  text: {
    kind: 'text', label: 'Text style', group: 'Text', example: 'Sample',
    defaults: { kind: 'text', weight: 'bold' },
    fields: [
      {
        key: 'weight', label: 'Weight', control: 'select',
        options: [
          { value: 'normal', label: 'Normal' },
          { value: 'bold', label: 'Bold' },
          { value: 'bolder', label: 'Bolder' },
          { value: 'lighter', label: 'Lighter' },
        ],
      },
      { key: 'italic', label: 'Italic', control: 'toggle' },
    ],
  },
};

/** Format kinds in display order, grouped for the kind picker. */
export function kindsByGroup(): { group: FieldGroup; kinds: FormatKindDef[] }[] {
  const order: FieldGroup[] = ['Numeric', 'Rates', 'FX', 'Text', 'Other'];
  const all = Object.values(FORMAT_REGISTRY);
  return order
    .map((group) => ({ group, kinds: all.filter((k) => k.group === group) }))
    .filter((g) => g.kinds.length > 0);
}

/** The numeric fields whose stepper/select values must be coerced from string inputs. */
export const NUMBER_FIELD_KEYS = new Set(['decimals', 'pipDecimals', 'scale', 'fraction']);
export const BOOLEAN_FIELD_KEYS = new Set(['thousands', 'plusTick', 'jpyConvention', 'italic']);

/**
 * Apply one editor control's raw value onto a draft spec, coercing it to the right type and
 * dropping empty optional fields. Shared by both panel UIs so they edit the spec identically.
 */
export function setSpecField(spec: ColumnFormatSpec, key: string, raw: unknown): ColumnFormatSpec {
  const next: Record<string, unknown> = { ...spec };
  let value: unknown;
  if (BOOLEAN_FIELD_KEYS.has(key)) {
    value = Boolean(raw);
  } else if (NUMBER_FIELD_KEYS.has(key)) {
    value = raw === '' || raw == null ? undefined : Number(raw);
  } else {
    value = raw === '' || raw == null ? undefined : raw;
  }
  if (value === undefined) {
    delete next[key];
  } else {
    next[key] = value;
  }
  return next as ColumnFormatSpec;
}
