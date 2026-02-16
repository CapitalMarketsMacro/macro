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

  amps: `# @macro/amps API

**Import:** \`import { AmpsClient, AmpsMessage, AmpsSowOptions } from '@macro/amps';\`
**Source:** \`libs/amps/src/index.ts\`

## AmpsClient class
- \`constructor(clientName?: string)\` — default: 'amps-client'
- \`connect(url: string): Promise<void>\` — e.g., 'ws://localhost:9100/amps/json'
- \`subscribe(handler: AmpsMessageHandler, topic: string, filter?: string): Promise<string>\`
- \`subscribeAsObservable(topic: string, filter?: string): Promise<{ observable: Observable<AmpsMessage>, subId: string }>\`
- \`subscribeAsSubject(topic: string, filter?: string): Promise<{ subject: Subject<AmpsMessage>, subId: string }>\`
- \`sow(handler: AmpsMessageHandler, topic: string, filter?: string, options?: AmpsSowOptions): Promise<void>\`
- \`publish(topic: string, data: string | Record<string, unknown>): void\`
- \`unsubscribe(subId: string): Promise<void>\`
- \`disconnect(): Promise<void>\`
- \`errorHandler(handler: AmpsErrorHandler): AmpsClient\` — chainable
- \`isConnected(): boolean\`
- \`getClient(): Client | null\` — raw AMPS client
- \`getSubject(subId: string): Subject<AmpsMessage> | undefined\`
- \`getSubscriptionIds(): string[]\`

## Types
- \`AmpsMessage { data: string | Record<string, unknown>; header?; topic?; subId?; sequence? }\`
- \`AmpsSowOptions { batchSize?; timeout? }\`
- \`AmpsMessageHandler = (message: AmpsMessage) => void\`
- \`AmpsErrorHandler = (error: Error) => void\`

## Usage
\`\`\`typescript
const client = new AmpsClient('my-app');
await client.connect('ws://localhost:9100/amps/json');
const { observable } = await client.subscribeAsObservable('orders', "/symbol='AAPL'");
observable.subscribe(msg => console.log(msg.data));
client.publish('orders', { symbol: 'AAPL', qty: 100 });
\`\`\``,

  solace: `# @macro/solace API

**Import:** \`import { SolaceClient, SolaceConnectionProperties, SolaceMessage } from '@macro/solace';\`
**Source:** \`libs/solace/src/index.ts\`

## SolaceClient class
- \`constructor(options?: { logLevel?: 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL' })\`
- \`connect(properties: SolaceConnectionProperties): Promise<void>\`
- \`subscribe(handler: SolaceMessageHandler, topic: string, properties?: SolaceSubscriptionProperties): Promise<string>\`
- \`subscribeAsObservable(topic: string, properties?): Promise<{ observable: Observable<SolaceMessage>, subscriptionId: string }>\`
- \`subscribeAsSubject(topic: string, properties?): Promise<{ subject: Subject<SolaceMessage>, subscriptionId: string }>\`
- \`publish(topic: string, data: string | Record<string, unknown> | ArrayBuffer, properties?): void\`
- \`unsubscribe(subscriptionId: string, topic?: string): Promise<void>\`
- \`disconnect(): Promise<void>\`
- \`errorHandler(handler: SolaceErrorHandler): SolaceClient\` — chainable
- \`eventHandler(handler: SolaceEventHandler): SolaceClient\` — chainable
- \`isConnected(): boolean\`
- \`getSession(): Session | null\`
- \`getSubject(subscriptionId: string): Subject<SolaceMessage> | undefined\`

## Types
- \`SolaceConnectionProperties { hostUrl: string; vpnName: string; userName: string; password: string; clientName?; connectTimeoutInMsecs?; reconnectRetries?; reconnectRetryWaitInMsecs? }\`
- \`SolaceMessage\` — solace.Message from solclientjs
- \`SolaceMessageHandler = (message: SolaceMessage) => void\`
- \`SolaceErrorHandler = (error: Error) => void\`
- \`SolaceEventHandler = (event: string, details?: unknown) => void\`

## Usage
\`\`\`typescript
const client = new SolaceClient();
await client.connect({ hostUrl: 'ws://localhost:8008', vpnName: 'default', userName: 'default', password: 'default' });
const { observable } = await client.subscribeAsObservable('orders/*');
observable.subscribe(msg => console.log(msg.getBinaryAttachment()));
\`\`\``,

  rxutils: `# @macro/rxutils API

**Import:** \`import { ConflationSubject, conflateByKey, ConflatedValue } from '@macro/rxutils';\`
**Source:** \`libs/rxutils/src/index.ts\`

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

## Angular Services (Injectable, providedIn: 'root')
| Service | Key Methods / Properties |
|---------|-------------------------|
| WorkspaceService | \`init(manifestUrl)\` — orchestrates full platform init |
| PlatformService | \`init(overrides)\` — OpenFin platform init |
| SettingsService | \`loadSettings()\` — load customSettings from manifest |
| HomeService | \`register()\`, \`deregister()\` — Home search provider |
| StoreService | \`register()\`, \`deregister()\` — Storefront catalog |
| DockService | \`register()\`, \`deregister()\` — Dock taskbar |
| ContextService | \`broadcast(context)\`, \`addContextListener(type, handler)\` |
| ChannelService | \`create(name)\`, \`connect(name)\`, \`dispatch(topic, data)\` |
| NotificationsService | \`create(notification)\`, \`clear(id)\` |
| ThemeService | \`isDark: Signal<boolean>\`, \`currentPalette: Signal<ThemePalette>\` |
| WorkspaceOverrideService | Override default workspace browser behavior |

## Base Services (framework-agnostic, prefix with Base)
\`BasePlatformService\`, \`BaseSettingsService\`, \`BaseContextService\`, \`BaseChannelService\`, \`BaseStoreService\`, \`BaseDockService\`, \`BaseHomeService\`, \`BaseNotificationsService\`, \`BaseWorkspaceOverrideService\`, \`BaseWorkspaceService\`, \`BaseThemeService\`

## Types
- \`ThemePalette\` — brand colors, background layers, text colors, input colors, status colors
- \`ThemeConfig { dark: ThemePalette; light: ThemePalette }\`
- \`themeConfig\` — preconfigured dark/light palettes (brandPrimary: '#0A76D3')

## Utility
- \`launchApp(appId: string)\` — Launch an OpenFin app by ID`,

  'macro-design': `# @macro/macro-design API

**Import:** \`import { getInitialIsDark, applyDarkMode, onSystemThemeChange, buildAgGridTheme, AG_GRID_FONTS, themeConfig } from '@macro/macro-design';\`
**Source:** \`libs/macro-design/src/index.ts\`

## Dark Mode Utilities
- \`getInitialIsDark(): boolean\` — Read from localStorage('theme') or prefers-color-scheme
- \`applyDarkMode(isDark: boolean): void\` — Toggles .dark on <html>, persists to localStorage
- \`onSystemThemeChange(cb: (isDark: boolean) => void): () => void\` — Returns cleanup function

## AG Grid Theme
- \`buildAgGridTheme(isDark: boolean): Theme\` — Returns themeAlpine + colorSchemeDarkBlue/Light + Macro fonts
- \`AG_GRID_FONTS\` — \`{ fontFamily: 'Noto Sans', headerFontFamily: 'Roboto', cellFontFamily: 'Ubuntu' }\`

## OpenFin Theme Config
- \`themeConfig: ThemeConfig\` — Dark/light palettes with all brand, background, text, input, status colors
- \`ThemePalette\` interface — brandPrimary, backgroundPrimary, textDefault, statusSuccess, etc.
- \`ThemeConfig\` interface — \`{ dark: ThemePalette; light: ThemePalette }\`

## CSS Files (import in app styles.css)
- \`libs/macro-design/src/lib/css/fonts.css\` — Noto Sans, Roboto, Ubuntu from Google Fonts
- \`libs/macro-design/src/lib/css/macro-design.css\` — OKLCH-based CSS variables for :root and .dark`,

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
          'amps',
          'solace',
          'rxutils',
          'openfin',
          'macro-design',
          'macro-angular-grid',
          'macro-react-grid',
        ])
        .describe('Library name (without @macro/ prefix)'),
    },
    async ({ library }) => ({
      content: [
        {
          type: 'text' as const,
          text: LIBRARY_APIS[library] ?? `Unknown library: ${library}`,
        },
      ],
    })
  );
}
