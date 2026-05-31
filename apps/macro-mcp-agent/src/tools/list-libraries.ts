import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const LIBRARIES = [
  {
    name: '@macro/logger',
    importPath: '@macro/logger',
    description: 'Pino-based logging with SLF4J-style output. Works in browser and Node.js.',
    keyExports: ['Logger', 'LogLevel'],
  },
  {
    name: '@macro/transports',
    importPath: '@macro/transports',
    description:
      'Unified messaging transport library for AMPS, Solace, and NATS with a common TransportClient interface and RxJS Observable/Subject support. Angular DI via @macro/transports/angular, React hooks via @macro/transports/react.',
    keyExports: [
      'AmpsTransport',
      'SolaceTransport',
      'NatsTransport',
      'AmpsClient',
      'SolaceClient',
      'NatsClient',
      'TransportClient',
      'TransportMessage',
    ],
  },
  {
    name: '@macro/rxutils',
    importPath: '@macro/rxutils',
    description: 'RxJS conflation utilities for reducing high-frequency data updates.',
    keyExports: ['ConflationSubject', 'conflateByKey', 'ConflatedValue'],
  },
  {
    name: '@macro/openfin',
    importPath: '@macro/openfin',
    description: 'OpenFin platform services with Angular wrappers for workspace, dock, home, store, context sharing.',
    keyExports: ['WorkspaceService', 'PlatformService', 'SettingsService', 'HomeService', 'StoreService', 'DockService', 'ContextService', 'ChannelService', 'NotificationsService', 'ThemeService', 'WorkspaceOverrideService'],
  },
  {
    name: '@macro/macro-design',
    importPath: '@macro/macro-design',
    description: 'Design system: CSS variables, dark mode utilities, AG Grid theme builder, OpenFin theme config.',
    keyExports: ['getInitialIsDark', 'applyDarkMode', 'onSystemThemeChange', 'buildAgGridTheme', 'AG_GRID_FONTS', 'themeConfig', 'ThemePalette', 'ThemeConfig'],
  },
  {
    name: '@macro/macro-angular-grid',
    importPath: '@macro/macro-angular-grid',
    description: 'AG Grid Enterprise wrapper for Angular with built-in theming and RxJS row operation subjects.',
    keyExports: ['MacroAngularGrid'],
  },
  {
    name: '@macro/macro-react-grid',
    importPath: '@macro/macro-react-grid',
    description: 'AG Grid Enterprise wrapper for React with built-in theming and RxJS row operation subjects.',
    keyExports: ['MacroReactGrid', 'MacroReactGridRef', 'MacroReactGridProps'],
  },
];

export function registerListLibraries(server: McpServer): void {
  server.tool(
    'list_libraries',
    'List all @macro/* shared libraries in the monorepo with descriptions and key exports',
    {},
    async () => ({
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(LIBRARIES, null, 2),
        },
      ],
    })
  );
}
