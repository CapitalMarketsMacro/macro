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

## @macro/transports (Unified Transport Library)
Single library providing a common \`TransportClient\` interface across AMPS, Solace, and NATS.

**Import (framework-agnostic):** \`import { NatsTransport, AmpsTransport, SolaceTransport, type TransportClient, type TransportMessage } from '@macro/transports';\`
**Import (Angular):** \`import { NatsTransportService, AmpsTransportService, SolaceTransportService } from '@macro/transports/angular';\`
**Import (React):** \`import { useNatsTransport, useAmpsTransport, useSolaceTransport, useTransportSubscription } from '@macro/transports/react';\`

**Unified API (all transports):**
- \`client.connect(options): Promise<void>\`
- \`client.disconnect(): Promise<void>\`
- \`client.publish(topic, data): void\`
- \`client.subscribe(handler, topic): Promise<string>\`
- \`client.subscribeAsObservable(topic): Promise<{ observable, subscriptionId }>\`
- \`client.subscribeAsSubject(topic): Promise<{ subject, subscriptionId }>\`
- \`client.unsubscribe(subscriptionId): Promise<void>\`
- \`client.isConnected: boolean\`
- \`client.onError(handler): void\`
- \`client.getSubscriptionIds(): string[]\`

**Transport-specific extras:**
- **AMPS**: \`sow()\` (State-of-the-World queries), \`getClient()\`
- **Solace**: \`onEvent()\` (session lifecycle), \`getSession()\`
- **NATS**: \`request()\` (request/reply), \`getConnection()\`

**Connection options:**
- AMPS: \`{ url: 'ws://host:9100/amps/json' }\`
- Solace: \`{ hostUrl: 'ws://host:8008', vpnName, userName, password }\`
- NATS: \`{ servers: 'ws://host:8224', name?, maxReconnectAttempts? }\`

---

## @macro/amps (standalone, legacy)
AMPS (60East) pub/sub client wrapper with RxJS Observable/Subject support.

**Import:** \`import { AmpsClient, AmpsMessage, AmpsSowOptions } from '@macro/amps';\`

---

## @macro/solace (standalone, legacy)
Solace PubSub+ client wrapper with RxJS Observable/Subject support.

**Import:** \`import { SolaceClient, SolaceConnectionProperties, SolaceMessage } from '@macro/solace';\`

---

## @macro/nats (standalone, legacy)
NATS.js v3 WebSocket client wrapper.

**Import:** \`import { NatsClient, NatsConnectionOptions, NatsMessage } from '@macro/nats';\`

---

## @macro/rxutils
RxJS conflation utilities for reducing high-frequency data updates.

**Import:** \`import { ConflationSubject, conflateByKey, ConflatedValue } from '@macro/rxutils';\`

---

## @macro/openfin
OpenFin Workspace platform services with Angular DI wrappers and React hooks.

**Import (Angular):** \`import { WorkspaceService, ThemeService, ContextService, NotificationsService, ViewStateService } from '@macro/openfin';\`
**Import (React hooks):** \`import { useViewState, useNotifications } from '@macro/openfin/react';\`

**Key services:**

| Service | Purpose |
|---------|---------|
| WorkspaceService | Platform init orchestration |
| PlatformService | Workspace platform init, toolbar buttons, custom actions |
| ThemeService | Dark/light sync (\`isDark\` signal, \`syncWithOpenFinTheme()\`) |
| ContextService | FDC3 context: \`broadcast()\`, \`currentChannel$\`, \`onContext<T>()\` |
| NotificationsService | Level API: \`info()\`, \`success()\`, \`warning()\`, \`error()\`, \`critical()\` |
| ViewStateService | View state persistence, \`setCollector()\`, \`enableAutoSave()\` |
| SnapService | Window snapping via @openfin/snap-sdk |
| Dock3Service | Next-gen dock with favorites + content menu |
| HomeService | OpenFin Home search |
| StoreService | Storefront with favorites |
| AnalyticsNatsService | Publishes analytics events to NATS |

---

## @macro/macro-design
Design system: CSS variables, dark mode, AG Grid theme, OpenFin theme config.

**Import:** \`import { buildAgGridTheme, getInitialIsDark, applyDarkMode, onSystemThemeChange, themeConfig } from '@macro/macro-design';\`

**CSS files** (import in styles.css):
- \`libs/macro-design/src/lib/css/fonts.css\` — Google Font imports
- \`libs/macro-design/src/lib/css/macro-design.css\` — OKLCH CSS variables (\`:root\` + \`.dark\`)

---

## @macro/macro-angular-grid
AG Grid 35 Enterprise wrapper for Angular with column formatting, formulas, and RxJS streaming.

**Import:** \`import { MacroAngularGrid } from '@macro/macro-angular-grid';\`
**Selector:** \`<lib-macro-angular-grid>\`

**Inputs:** \`[columns]\`, \`[rowData]\`, \`[gridOptions]\`, \`[getRowId]\`
**Subjects:** \`addRows$\`, \`updateRows$\`, \`deleteRows$\`
**Methods:** \`getGridApi()\`, \`setInitialRowData()\`, \`getGridState()\`, \`applyGridState()\`
**Format mode:** \`toggleFormatMode()\` — popover with Num, %, bps, $, K/M/B + decimals

---

## @macro/macro-react-grid
AG Grid 35 Enterprise wrapper for React with column formatting, formulas, and RxJS streaming.

**Import:** \`import { MacroReactGrid, MacroReactGridRef } from '@macro/macro-react-grid';\`

**Props:** \`columns\`, \`rowData\`, \`gridOptions\`, \`getRowId\`
**Ref API:** \`addRows$\`, \`updateRows$\`, \`deleteRows$\`, \`getGridApi()\`, \`getGridState()\`, \`applyGridState()\`
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
