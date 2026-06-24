/**
 * @macro/macro-grid-format — framework-agnostic capital-markets column formatting for
 * AG Grid. This barrel exports ONLY the framework-free core; the Angular and React tool
 * panels are separate subpath entries (`@macro/macro-grid-format/angular` and `/react`).
 */

export type {
  FormatKind,
  FontWeight,
  NegativeStyle,
  SignDisplay,
  ColorMode,
  NumericModifiers,
  NumberSpec,
  IntegerSpec,
  PercentSpec,
  BasisPointsSpec,
  CurrencySpec,
  CompactSpec,
  MultiplierSpec,
  TreasurySpec,
  FxRateSpec,
  DateSpec,
  TextStyleSpec,
  ColumnFormatSpec,
  ColumnFormatMap,
  LegacyFormatConfig,
  FormatType,
  ColumnFormatConfig,
} from './lib/format-spec';
export { migrateSpec, migrateMap } from './lib/format-spec';

export { formatValue, buildValueFormatter, buildCellStyle, previewStyle } from './lib/format-engine';

export { formatTreasury } from './lib/treasury';
export type { TreasuryFormatOptions } from './lib/treasury';

export { formatFxRate, isJpyPair } from './lib/fx-rate';

export { FORMAT_PRESETS, presetsByGroup } from './lib/presets';
export type { FormatPreset, PresetGroup } from './lib/presets';

export {
  FORMAT_REGISTRY,
  kindsByGroup,
  setSpecField,
  NUMBER_FIELD_KEYS,
  BOOLEAN_FIELD_KEYS,
} from './lib/format-registry';
export type { FormatKindDef, FormatFieldDef, FieldControl, FieldGroup } from './lib/format-registry';

export { ColumnFormatStore } from './lib/column-format-store';
export type { FormattableColumn } from './lib/column-format-store';

export {
  FORMAT_TOOL_PANEL_ID,
  FORMAT_TOOL_PANEL_COMPONENT,
  formatToolPanelDef,
  withFormatPanel,
} from './lib/tool-panel-def';
