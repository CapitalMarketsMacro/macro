import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const LIBRARIES_DOC = `# @macro/* Libraries

## @macro/logger
Pino-based logging with SLF4J-style output. Works in browser and Node.js.

**Import:** \`import { Logger, LogLevel } from '@macro/logger';\`

**Key API:**
- \`Logger.getLogger(context: string): Logger\` — Get/create a cached logger
- \`logger.debug(message, data?)\` / \`logger.info(message, data?)\` / \`logger.warn(message, data?)\` / \`logger.error(message, data?)\`
- \`logger.setLevel(level: LogLevel | string)\` — Set instance log level
- \`Logger.setGlobalLevel(level: LogLevel | string)\` — Set level for all loggers
- \`LogLevel\` enum: TRACE=10, DEBUG=20, INFO=30, WARN=40, ERROR=50, FATAL=60

---

## @macro/amps
AMPS (60East) pub/sub client wrapper with RxJS Observable/Subject support.

**Import:** \`import { AmpsClient, AmpsMessage, AmpsSowOptions } from '@macro/amps';\`

**Key API:**
- \`new AmpsClient(clientName?: string)\`
- \`client.connect(url: string): Promise<void>\`
- \`client.subscribe(handler, topic, filter?): Promise<string>\`
- \`client.subscribeAsObservable(topic, filter?): Promise<{ observable, subId }>\`
- \`client.subscribeAsSubject(topic, filter?): Promise<{ subject, subId }>\`
- \`client.sow(handler, topic, filter, options?): Promise<void>\`
- \`client.publish(topic, data): void\`
- \`client.unsubscribe(subId): Promise<void>\`
- \`client.disconnect(): Promise<void>\`
- \`client.errorHandler(handler): AmpsClient\`

---

## @macro/solace
Solace PubSub+ client wrapper with RxJS Observable/Subject support.

**Import:** \`import { SolaceClient, SolaceConnectionProperties, SolaceMessage } from '@macro/solace';\`

**Key API:**
- \`new SolaceClient(options?: { logLevel? })\`
- \`client.connect(properties: SolaceConnectionProperties): Promise<void>\`
- \`client.subscribe(handler, topic, properties?): Promise<string>\`
- \`client.subscribeAsObservable(topic, properties?): Promise<{ observable, subscriptionId }>\`
- \`client.subscribeAsSubject(topic, properties?): Promise<{ subject, subscriptionId }>\`
- \`client.publish(topic, data, properties?): void\`
- \`client.unsubscribe(subscriptionId, topic?): Promise<void>\`
- \`client.disconnect(): Promise<void>\`
- \`client.errorHandler(handler): SolaceClient\`

\`SolaceConnectionProperties\`: \`{ hostUrl, vpnName, userName, password, clientName?, connectTimeoutInMsecs?, reconnectRetries? }\`

---

## @macro/rxutils
RxJS conflation utilities for reducing high-frequency data updates.

**Import:** \`import { ConflationSubject, conflateByKey, ConflatedValue } from '@macro/rxutils';\`

**Key API:**
- \`new ConflationSubject<TKey, TValue>(intervalMs: number)\`
  - \`.next({ key, value })\` — Feed in values
  - \`.subscribeToConflated(callback)\` — Get conflated output
  - \`.getConflatedObservable()\` — Get the conflated Observable
  - \`.pipeToSubject(targetSubject)\` — Forward conflated values
- \`conflateByKey(source$, intervalMs): Observable<ConflatedValue>\`

---

## @macro/openfin
OpenFin platform services with Angular wrappers.

**Import:** \`import { WorkspaceService, ThemeService, ContextService, ... } from '@macro/openfin';\`

**Services:** WorkspaceService, PlatformService, SettingsService, HomeService, StoreService, DockService, ContextService, ChannelService, NotificationsService, ThemeService, WorkspaceOverrideService

**Base services (framework-agnostic):** Prefixed with \`Base\` — e.g., \`BaseWorkspaceService\`, \`BasePlatformService\`

**Key types:** \`ThemePalette\`, \`ThemeConfig\`, \`themeConfig\`

---

## @macro/macro-design
Design system: CSS variables, dark mode, AG Grid theme, OpenFin theme config.

**Import:** \`import { getInitialIsDark, applyDarkMode, onSystemThemeChange, buildAgGridTheme, AG_GRID_FONTS, themeConfig } from '@macro/macro-design';\`

**Key API:**
- \`getInitialIsDark(): boolean\` — Read from localStorage/system preference
- \`applyDarkMode(isDark: boolean): void\` — Toggle .dark class, persist
- \`onSystemThemeChange(cb): () => void\` — Listen for OS theme changes
- \`buildAgGridTheme(isDark: boolean): Theme\` — Alpine theme + Macro fonts
- \`AG_GRID_FONTS\` — \`{ fontFamily: 'Noto Sans', headerFontFamily: 'Roboto', cellFontFamily: 'Ubuntu' }\`
- \`themeConfig: ThemeConfig\` — Dark/light palettes for OpenFin

**CSS files** (import in styles.css):
- \`libs/macro-design/src/lib/css/fonts.css\` — Google Font imports
- \`libs/macro-design/src/lib/css/macro-design.css\` — OKLCH CSS variables

---

## @macro/macro-angular-grid
AG Grid Enterprise wrapper for Angular with built-in theming and RxJS row operations.

**Import:** \`import { MacroAngularGrid } from '@macro/macro-angular-grid';\`

**Component selector:** \`<lib-macro-angular-grid>\`

**Inputs:**
- \`[columns]: ColDef[] | string\` — Column definitions (JSON string or array)
- \`[rowData]: unknown[]\` — Initial row data
- \`[gridOptions]: GridOptions\` — AG Grid options (merged with defaults)
- \`[getRowId]: (params: GetRowIdParams) => string\` — Row ID function

**Subjects for streaming updates:**
- \`grid.addRows$.next(rows)\`
- \`grid.updateRows$.next(rows)\`
- \`grid.deleteRows$.next(rows)\`

**Methods:**
- \`grid.applyTransaction(transaction)\` — Direct transaction API
- \`grid.getGridApi(): GridApi\`
- \`grid.setInitialRowData(data)\`

**Defaults:** sortable, filterable, resizable, pagination (10 rows), side bar (columns + filters), range selection, Enterprise modules auto-registered

---

## @macro/macro-react-grid
AG Grid Enterprise wrapper for React with built-in theming and RxJS row operations.

**Import:** \`import { MacroReactGrid, MacroReactGridRef } from '@macro/macro-react-grid';\`

**Props:**
- \`columns?: ColDef[] | string\`
- \`rowData?: unknown[]\`
- \`gridOptions?: GridOptions\`
- \`getRowId?: (params: GetRowIdParams) => string\`

**Ref API (via useRef<MacroReactGridRef>):**
- \`ref.current.addRows$.next(rows)\`
- \`ref.current.updateRows$.next(rows)\`
- \`ref.current.deleteRows$.next(rows)\`
- \`ref.current.applyTransaction(transaction)\`
- \`ref.current.getGridApi(): GridApi\`

**Defaults:** Same as Angular wrapper — sortable, filterable, resizable, pagination, side bar, Enterprise modules auto-registered
`;

export function registerLibraries(server: McpServer): void {
  server.resource('libraries', 'macro://libraries', { mimeType: 'text/markdown' }, async () => ({
    contents: [
      {
        uri: 'macro://libraries',
        text: LIBRARIES_DOC,
        mimeType: 'text/markdown',
      },
    ],
  }));
}
