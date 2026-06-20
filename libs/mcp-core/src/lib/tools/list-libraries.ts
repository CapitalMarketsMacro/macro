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
    name: '@macro/utils',
    importPath: '@macro/utils',
    description: 'RxJS conflation utilities for reducing high-frequency data updates.',
    keyExports: ['ConflationSubject', 'conflateByKey', 'ConflatedValue'],
  },
  {
    name: '@macro/openfin',
    importPath: '@macro/openfin',
    description:
      'OpenFin Workspace/Platform services. Angular wrappers (WorkspaceService, etc.) are the default exports from @macro/openfin; React hooks (e.g. useViewState) from @macro/openfin/react; OpenFin theme sync from @macro/openfin/theme-sync. Framework-agnostic base services are exported with a Base prefix (BaseWorkspaceService, ...).',
    keyExports: [
      'WorkspaceService',
      'PlatformService',
      'SettingsService',
      'HomeService',
      'StoreService',
      'DockService',
      'Dock3Service',
      'ContextService',
      'ChannelService',
      'NotificationsService',
      'ThemeService',
      'ThemePresetService',
      'SnapService',
      'ViewStateService',
      'WorkspaceOverrideService',
      'launchApp',
      'onOpenFinThemeChange',
    ],
  },
  {
    name: '@macro/macro-design',
    importPath: '@macro/macro-design',
    description:
      'Design system & single source of truth for theming. Core CSS tokens (3-file chain: fonts.css, macro-etrading.css, macro-design.css), the framework-agnostic ThemeController + named-theme registry (default theme "macro"), and the AG Grid theme builder. Angular state via ThemeService from @macro/macro-design/angular; React state via useTheme() from @macro/macro-design/react.',
    keyExports: [
      'ThemeController',
      'themeController',
      'ThemeService',
      'useTheme',
      'MACRO_THEME',
      'MACRO_THEMES',
      'DEFAULT_THEME_ID',
      'getTheme',
      'getPalette',
      'buildAgGridTheme',
      'AG_GRID_FONTS',
      'themeConfig',
      'ThemeState',
      'MacroThemeDefinition',
      'ThemePalette',
      'ThemeConfig',
    ],
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
