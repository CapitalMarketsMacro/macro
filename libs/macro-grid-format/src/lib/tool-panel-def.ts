/**
 * Helpers to register the "Format" custom tool panel into a grid's sideBar. The panel
 * component itself is framework-specific (`@macro/macro-grid-format/angular` or `/react`)
 * and is registered by component KEY in `gridOptions.components`, so this core helper has
 * no Angular/React dependency.
 */

import type { SideBarDef, ToolPanelDef } from 'ag-grid-community';

/** Tool-panel id (used by `api.openToolPanel(...)` and in persisted sideBar state). */
export const FORMAT_TOOL_PANEL_ID = 'macroFormat';

/** Component key both wrappers map to their framework panel via `gridOptions.components`. */
export const FORMAT_TOOL_PANEL_COMPONENT = 'macroFormatToolPanel';

/** Build the `ToolPanelDef` for the Format panel, passing `toolPanelParams` (the store). */
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

/**
 * Merge the Format panel into an existing sideBar definition (defaulting to the standard
 * columns + filters panels), keeping it idempotent (no duplicate Format panel). Accepts the
 * full `GridOptions.sideBar` union (object | string[] | string | boolean | undefined) so a
 * consumer-supplied sideBar of any shape is handled without spreading a primitive.
 */
export function withFormatPanel(
  sideBar: SideBarDef | string | string[] | boolean | null | undefined,
  toolPanelParams: unknown,
): SideBarDef {
  const def = formatToolPanelDef(toolPanelParams);
  const base = sideBar && typeof sideBar === 'object' && !Array.isArray(sideBar) ? sideBar : undefined;
  const existing = base && Array.isArray(base.toolPanels)
    ? base.toolPanels
    : Array.isArray(sideBar)
      ? sideBar
      : ['columns', 'filters'];
  const withoutFormat = existing.filter(
    (panel) => typeof panel === 'string' || panel.id !== FORMAT_TOOL_PANEL_ID,
  );
  return {
    ...(base ?? {}),
    toolPanels: [...withoutFormat, def],
    hiddenByDefault: base?.hiddenByDefault ?? false,
  };
}
