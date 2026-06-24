/**
 * Angular entry — `@macro/macro-grid-format/angular`.
 *
 * Register the panel by component KEY in the grid's `gridOptions.components`, then add it to
 * the sideBar via `withFormatPanel(...)` from the core entry:
 * ```ts
 * import { ColumnFormatStore, withFormatPanel, FORMAT_TOOL_PANEL_COMPONENT } from '@macro/macro-grid-format';
 * import { MacroFormatToolPanelComponent } from '@macro/macro-grid-format/angular';
 * // components: { [FORMAT_TOOL_PANEL_COMPONENT]: MacroFormatToolPanelComponent }
 * // sideBar: withFormatPanel(existingSideBar, { store })
 * ```
 */
export { MacroFormatToolPanelComponent } from './macro-format-tool-panel.component';
export type { FormatToolPanelParams } from './macro-format-tool-panel.component';
