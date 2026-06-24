/**
 * React entry — `@macro/macro-grid-format/react`.
 *
 * Register the panel by component KEY in `<AgGridReact components={...} />`, then add it to
 * the sideBar via `withFormatPanel(...)` from the core entry:
 * ```tsx
 * import { ColumnFormatStore, withFormatPanel, FORMAT_TOOL_PANEL_COMPONENT } from '@macro/macro-grid-format';
 * import { MacroFormatToolPanel } from '@macro/macro-grid-format/react';
 * // components={{ [FORMAT_TOOL_PANEL_COMPONENT]: MacroFormatToolPanel }}
 * // sideBar={withFormatPanel(existingSideBar, { store })}
 * ```
 */
export { MacroFormatToolPanel, default } from './MacroFormatToolPanel';
export type { MacroFormatToolPanelProps } from './MacroFormatToolPanel';
