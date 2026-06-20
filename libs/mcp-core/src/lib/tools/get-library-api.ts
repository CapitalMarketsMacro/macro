import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const LIBRARY_APIS: Record<string, string> = {
  logger: `# @macro/logger API

**Import:** \`import { Logger, LogLevel } from '@macro/logger';\`
**Source:** \`libs/logger/src/index.ts\`

## Logger class
- \`static getLogger(context: string): Logger\` — Get/create cached logger instance
- \`debug(message: string, data?: unknown): void\`
- \`info(message: string, data?: unknown): void\`
- \`warn(message: string, data?: unknown): void\`
- \`error(message: string, data?: unknown): void\`
- \`setLevel(level: LogLevel | string): void\` — Set instance log level
- \`getLevel(): string\` — Get current level as string
- \`getLevelNumber(): number\`
- \`getContext(): string\`
- \`static setGlobalLevel(level: LogLevel | string): void\` — Set for all loggers
- \`static getGlobalLevel(): string\`
- \`static getGlobalLevelNumber(): number\`

## LogLevel enum
TRACE=10, DEBUG=20, INFO=30, WARN=40, ERROR=50, FATAL=60

## Usage
\`\`\`typescript
const logger = Logger.getLogger('MyComponent');
Logger.setGlobalLevel(LogLevel.DEBUG);
logger.info('User data', { userId: 123, name: 'John' });
logger.error('Request failed', { statusCode: 500, endpoint: '/api' });
\`\`\``,

  utils: `# @macro/utils API

**Import:** \`import { ConflationSubject, conflateByKey, ConflatedValue } from '@macro/utils';\`
**Source:** \`libs/utils/src/index.ts\`

## ConflationSubject<TKey, TValue> class (extends Subject)
- \`constructor(intervalMs: number)\` — conflation interval in ms
- \`next({ key: TKey, value: TValue })\` — feed in values (inherited from Subject)
- \`subscribeToConflated(callback | observer): Subscription\` — get conflated output
- \`getConflatedObservable(): Observable<ConflatedValue<TKey, TValue>>\`
- \`pipeToSubject(targetSubject: Subject<ConflatedValue>): Subscription\`
- \`unsubscribeFromConflated(): void\`
- \`complete(): void\` — also cleans up internal subscription
- \`unsubscribe(): void\` — also cleans up internal subscription

## conflateByKey function
\`conflateByKey<TKey, TValue>(source$: Observable<ConflatedValue<TKey, TValue>>, intervalMs: number): Observable<ConflatedValue<TKey, TValue>>\`

## ConflatedValue<TKey, TValue> type
\`{ key: TKey; value: TValue }\`

## Usage
\`\`\`typescript
const conflated = new ConflationSubject<string, MarketData>(100);
conflated.next({ key: 'EUR/USD', value: { bid: 1.0850 } });
conflated.next({ key: 'EUR/USD', value: { bid: 1.0851 } });
// After 100ms, only latest value emitted per key
conflated.subscribeToConflated(({ key, value }) => console.log(key, value));
\`\`\``,

  openfin: `# @macro/openfin API

**Import:** \`import { WorkspaceService, ThemeService, ContextService, ... } from '@macro/openfin';\`
**Source:** \`libs/openfin/src/index.ts\`

## Angular Services (Injectable, providedIn: 'root') — the DEFAULT exports
| Service | Key Methods / Properties |
|---------|-------------------------|
| WorkspaceService | \`init(manifestUrl)\` — orchestrates full platform init |
| PlatformService | \`init(overrides)\` — OpenFin platform init |
| SettingsService | \`loadSettings()\` — load customSettings from manifest |
| HomeService | \`register()\`, \`deregister()\` — Home search provider |
| StoreService | \`register()\`, \`deregister()\` — Storefront catalog |
| DockService / Dock3Service | \`register()\`, \`deregister()\` — Dock taskbar (Dock3 = newer API) |
| ContextService | \`broadcast(context)\`, \`registerContextListener(type)\`, \`context$\` |
| ChannelService | \`create(name)\`, \`connect(name)\`, \`dispatch(topic, data)\` |
| NotificationsService | \`create(notification)\`, \`clear(id)\` |
| ThemeService | \`isDark: Signal<boolean>\`, \`currentPalette: Signal<ThemePalette>\` |
| ThemePresetService | OpenFin platform theme presets / generated palettes |
| SnapService | OpenFin Snap dock integration |
| ViewStateService | persist/restore per-view state (see useViewState in /react) |
| WorkspaceStorageService / FavoritesService / WorkspaceOverrideService | storage, favorites, browser overrides |

## Base Services (framework-agnostic, prefix with Base)
\`BasePlatformService\`, \`BaseSettingsService\`, \`BaseContextService\`, \`BaseChannelService\`, \`BaseStoreService\`, \`BaseDockService\`, \`BaseDock3Service\`, \`BaseHomeService\`, \`BaseNotificationsService\`, \`BaseWorkspaceStorageService\`, \`BaseWorkspaceOverrideService\`, \`BasePlatformService\`, \`BaseWorkspaceService\`, \`BaseThemeService\`, \`BaseViewStateService\`, \`BaseThemePresetService\`, \`BaseSnapService\`, \`BaseFavoritesService\`

## React (\`@macro/openfin/react\`)
- \`useViewState<T>(key, initial)\` — persist per-view state across reloads (ViewStateService hook)

## Types
- \`ThemePalette\` — brand colors, background layers, text colors, input colors, status colors
- \`ThemeConfig { dark: ThemePalette; light: ThemePalette }\`
- \`themeConfig\` — preconfigured dark/light palettes (brandPrimary: '#2AA6E6' dark / '#1685C2' light)

## Utilities
- \`launchApp(app: App): Promise<...>\` — launch an OpenFin app from a full \`App\` object
  (manifest/manifestType), NOT an id string. Import \`App\` from \`@openfin/workspace\`.
- \`onOpenFinThemeChange(cb: (isDark: boolean) => void): () => void\` — from \`@macro/openfin/theme-sync\`
  (the macro ThemeController already wires this for you)`,

  'macro-design': `# @macro/macro-design API

Single source of truth for theming. Default theme: \`macro\` ("Macro E-Trading / Macro
Cerulean"), dark-default. Brand cerulean \`#2AA6E6\` (dark) / \`#1685C2\` (light).

**Import:** \`import { themeController, buildAgGridTheme, AG_GRID_FONTS, themeConfig, getTheme, getPalette, MACRO_THEME } from '@macro/macro-design';\`
**Angular:** \`import { ThemeService } from '@macro/macro-design/angular';\`
**React:** \`import { useTheme, themeController } from '@macro/macro-design/react';\`
**Source:** \`libs/macro-design/src/index.ts\`

## Theme state — ThemeController + framework adapters
- \`themeController\` (singleton ThemeController) — framework-agnostic store. Owns the \`.dark\`
  class on <html>, localStorage persistence, and OS + OpenFin theme sync.
  - \`start()\` — idempotent; call once in main.tsx (React) before createRoot
  - \`toggle()\`, \`setDark(isDark)\`, \`setTheme(themeId)\`, \`getSnapshot()\`, \`subscribe(listener)\`
- **Angular** \`ThemeService\` (\`/angular\`, providedIn root): signals \`isDark()\`, \`mode()\`,
  \`themeId()\`, \`theme()\`, \`palette()\`; actions \`toggle()\`, \`setDark()\`, \`setTheme()\`.
  Injecting it starts the controller automatically.
- **React** \`useTheme()\` (\`/react\`): returns \`{ isDark, mode, themeId, theme, palette, toggle, setDark, setTheme }\` via useSyncExternalStore.
- Legacy helpers \`getInitialIsDark()\` / \`applyDarkMode()\` / \`onSystemThemeChange()\` still exist
  (the controller is built on them) but prefer ThemeService / useTheme.

## Named theme registry
- \`MACRO_THEME\`, \`MACRO_THEMES\`, \`DEFAULT_THEME_ID\` ('macro')
- \`getTheme(id?): MacroThemeDefinition\`, \`getPalette(mode, id?): ThemePalette\`

## AG Grid Theme
- \`buildAgGridTheme(isDark: boolean): Theme\` — themeQuartz + iconSetMaterial +
  colorSchemeDarkBlue/Light + Macro fonts (dark mode also layers Macro E-Trading dark tokens)
- \`AG_GRID_FONTS\` — IBM Plex Mono cells (\`fontSize: 12\`), Roboto headers (\`headerFontSize: 10\`),
  \`rowHeight: 22\`, \`headerHeight: 28\`, square corners
- Both MacroAngularGrid/MacroReactGrid apply this automatically (watch the \`.dark\` class)

## OpenFin Theme Config
- \`themeConfig: ThemeConfig\` — dark/light \`ThemePalette\`s (themeConfig.dark.brandPrimary === '#2AA6E6')
- \`ThemePalette\` / \`ThemeConfig\` / \`ThemeState\` / \`MacroThemeDefinition\` / \`ThemeMode\` types

## CSS Files (import in app styles.css, in this order, before framework CSS)
- \`libs/macro-design/src/lib/css/fonts.css\` — Roboto, IBM Plex Mono, Noto Sans, Ubuntu
- \`libs/macro-design/src/lib/css/macro-etrading.css\` — core token system (--brand, --bg-canvas, ...)
- \`libs/macro-design/src/lib/css/macro-design.css\` — Shadcn/Tailwind bridge (--background, --primary, ...)`,

  'macro-angular-grid': `# @macro/macro-angular-grid API

**Import:** \`import { MacroAngularGrid } from '@macro/macro-angular-grid';\`
**Source:** \`libs/macro-angular-grid/src/index.ts\`

## MacroAngularGrid Component
**Selector:** \`<lib-macro-angular-grid>\`

### Inputs
- \`@Input() columns: string | ColDef[]\` — Column definitions (JSON string or array)
- \`@Input() rowData: unknown[]\` — Initial row data
- \`@Input() gridOptions: GridOptions\` — Merged with defaults
- \`@Input() getRowId?: (params: GetRowIdParams) => string\` — Row identity function

### Public Subjects (for streaming updates)
- \`addRows$: Subject<unknown[]>\` — \`.next([...rows])\` to add rows
- \`updateRows$: Subject<unknown[]>\` — \`.next([...rows])\` to update rows
- \`deleteRows$: Subject<unknown[]>\` — \`.next([...rows])\` to remove rows

### Public Methods
- \`applyTransaction(transaction: RowNodeTransaction): void\`
- \`getGridApi(): GridApi | undefined\`
- \`setInitialRowData(data: unknown[]): void\`

### Default GridOptions
sortable: true, filter: true, resizable: true, pagination: true (10 rows), paginationPageSizeSelector: [10,25,50,100], sideBar: columns+filters, animateRows: true, rowSelection: 'multiple', enableRangeSelection: true

### Features
- Auto-registers all AG Grid Community + Enterprise modules
- Auto-builds AG Grid theme from .dark class (MutationObserver)
- Queues transactions until grid is ready

### Usage
\`\`\`typescript
@Component({
  imports: [MacroAngularGrid],
  template: '<lib-macro-angular-grid [columns]="cols" [rowData]="data" [getRowId]="getRowId" />',
})
export class MyComponent {
  @ViewChild(MacroAngularGrid) grid!: MacroAngularGrid;
  cols: ColDef[] = [{ field: 'id' }, { field: 'name' }];
  data = [{ id: 1, name: 'Row 1' }];
  getRowId = (p: GetRowIdParams) => p.data.id;

  updateGrid() {
    this.grid.updateRows$.next([{ id: 1, name: 'Updated' }]);
  }
}
\`\`\``,

  transports: `# @macro/transports API (Unified Transport Library)

**Import:** \`import { NatsTransport, AmpsTransport, SolaceTransport, type TransportClient, type TransportMessage } from '@macro/transports';\`
**Angular:** \`import { NatsTransportService, AmpsTransportService, SolaceTransportService } from '@macro/transports/angular';\`
**React:** \`import { useNatsTransport, useAmpsTransport, useSolaceTransport, useTransportSubscription } from '@macro/transports/react';\`
**Source:** \`libs/transports/src/index.ts\`

## TransportClient interface (all transports implement this)
- \`readonly transportName: string\`
- \`connect(options): Promise<void>\`
- \`disconnect(): Promise<void>\`
- \`publish(topic: string, data: string | Record<string, unknown>): void\`
- \`subscribe(handler: MessageHandler, topic: string): Promise<string>\`
- \`subscribeAsObservable(topic): Promise<{ observable: Observable<TransportMessage>; subscriptionId: string }>\`
- \`subscribeAsSubject(topic): Promise<{ subject: Subject<TransportMessage>; subscriptionId: string }>\`
- \`unsubscribe(subscriptionId: string): Promise<void>\`
- \`readonly isConnected: boolean\`
- \`onError(handler: ErrorHandler): void\`
- \`getSubscriptionIds(): string[]\`

## TransportMessage
- \`topic: string\` — subject/topic
- \`data: string\` — raw string
- \`json<T>(): T\` — parse JSON
- \`reply?: string\` — for request/reply
- \`raw?: unknown\` — transport-specific raw message

## Connection Options
- AmpsTransport: \`{ url: 'ws://host:9100/amps/json' }\`
- SolaceTransport: \`{ hostUrl, vpnName, userName, password }\`
- NatsTransport: \`{ servers: 'ws://host:8224', name?, maxReconnectAttempts?, reconnectTimeWait? }\`

## Transport-specific extras
- **AmpsTransport**: \`sow(handler, topic, filter?, options?)\`, \`getClient()\`
- **SolaceTransport**: \`onEvent(handler)\`, \`getSession()\`
- **NatsTransport**: \`request(topic, data, timeout?)\`, \`getConnection()\`

## Angular Services (providedIn: 'root')
\`AmpsTransportService\`, \`SolaceTransportService\`, \`NatsTransportService\` — inject directly

## React Hooks
- \`useAmpsTransport(name?)\` / \`useSolaceTransport()\` / \`useNatsTransport(name?)\`
  Returns: \`{ client, connected, connect, disconnect }\`
- \`useTransportSubscription(client, topic, isConnected, maxMessages?)\`
  Returns: \`TransportMessage[]\`

## Usage
\`\`\`typescript
const client = new NatsTransport('my-app');
await client.connect({ servers: 'ws://localhost:8224' });
client.publish('orders.new', { symbol: 'AAPL', qty: 100 });
const { observable } = await client.subscribeAsObservable('prices.>');
observable.subscribe(msg => console.log(msg.json()));
\`\`\``,

  'macro-react-grid': `# @macro/macro-react-grid API

**Import:** \`import { MacroReactGrid, MacroReactGridRef, MacroReactGridProps } from '@macro/macro-react-grid';\`
**Source:** \`libs/macro-react-grid/src/index.ts\`

## MacroReactGrid Component (forwardRef)

### Props (MacroReactGridProps)
- \`columns?: string | ColDef[]\` — Column definitions
- \`rowData?: unknown[]\` — Initial row data
- \`gridOptions?: GridOptions\` — Merged with defaults
- \`getRowId?: (params: GetRowIdParams) => string\`

### Ref API (MacroReactGridRef via useRef)
- \`addRows$: Subject<unknown[]>\`
- \`updateRows$: Subject<unknown[]>\`
- \`deleteRows$: Subject<unknown[]>\`
- \`applyTransaction(transaction: RowNodeTransaction): void\`
- \`getGridApi(): GridApi | undefined\`

### Default GridOptions
Same as Angular wrapper: sortable, filter, resizable, pagination (10 rows), sideBar, animateRows, range selection

### Features
- Auto-registers all AG Grid Community + Enterprise modules
- Auto-builds AG Grid theme from .dark class (MutationObserver via useEffect)
- RxJS subjects wired to grid API via useEffect

### Usage
\`\`\`tsx
import { useRef } from 'react';
import { MacroReactGrid, MacroReactGridRef } from '@macro/macro-react-grid';

function MyComponent() {
  const gridRef = useRef<MacroReactGridRef>(null);
  const cols = [{ field: 'id' }, { field: 'name' }];

  const updateGrid = () => {
    gridRef.current?.updateRows$.next([{ id: 1, name: 'Updated' }]);
  };

  return (
    <MacroReactGrid
      ref={gridRef}
      columns={cols}
      rowData={[{ id: 1, name: 'Row 1' }]}
      getRowId={(p) => p.data.id}
    />
  );
}
\`\`\``,
};

export function registerGetLibraryApi(server: McpServer): void {
  server.tool(
    'get_library_api',
    'Get the full public API documentation for a specific @macro/* library',
    {
      library: z
        .enum([
          'logger',
          'transports',
          'nats',
          'amps',
          'solace',
          'utils',
          'openfin',
          'macro-design',
          'macro-angular-grid',
          'macro-react-grid',
        ])
        .describe('Library name (without @macro/ prefix). amps/solace/nats all map to the unified transports doc.'),
    },
    async ({ library }) => {
      // amps/solace/nats were unified into @macro/transports — alias them.
      const key = library === 'amps' || library === 'solace' || library === 'nats' ? 'transports' : library;
      return {
        content: [
          {
            type: 'text' as const,
            text: LIBRARY_APIS[key] ?? `Unknown library: ${library}`,
          },
        ],
      };
    }
  );
}
