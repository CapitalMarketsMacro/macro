import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const OPENFIN_DOC = `# OpenFin Integration

## Overview
The Macro monorepo uses OpenFin's Workspace platform to host Angular and React LOB apps
as views within a unified desktop experience. The \`macro-workspace\` app (port 4202) acts
as the platform provider.

## manifest.fin.json (Platform Configuration)
Located at \`apps/macro-workspace/public/manifest.fin.json\`:

\`\`\`json
{
  "platform": {
    "uuid": "macro-workspace-platform",
    "icon": "http://localhost:4202/favicon.ico",
    "autoShow": true,
    "providerUrl": "http://localhost:4202/provider"
  },
  "customSettings": {
    "apps": [
      {
        "appId": "my-app-view",
        "name": "my-app-view",
        "title": "My App",
        "description": "Description of my app",
        "manifest": "http://localhost:4202/my-app-view.fin.json",
        "manifestType": "view",
        "icons": [{ "src": "http://localhost:4200/favicon.ico" }],
        "tags": ["view", "angular"]
      }
    ]
  }
}
\`\`\`

## View Manifest (.fin.json)
Each app route is registered as a view. Create a \`.fin.json\` file in \`apps/macro-workspace/public/\`:

\`\`\`json
{
  "url": "http://localhost:4200/my-route",
  "fdc3InteropApi": "2.0",
  "interop": {
    "currentContextGroup": "green"
  }
}
\`\`\`

## FDC3 Context Sharing
Views share data via FDC3 2.0 context groups. All views default to the "green" context group.

\`\`\`typescript
// Broadcasting context
const fdc3 = window.fdc3;
await fdc3.broadcast({
  type: 'fdc3.instrument',
  id: { ticker: 'AAPL' }
});

// Listening for context
fdc3.addContextListener('fdc3.instrument', (context) => {
  console.log('Received:', context.id.ticker);
});
\`\`\`

## @macro/openfin Services

The \`@macro/openfin\` library provides framework-agnostic base services with Angular wrappers:

| Service | Purpose |
|---------|---------|
| \`WorkspaceService\` | Initialize the OpenFin workspace platform (orchestrates all other services) |
| \`PlatformService\` | Initialize the OpenFin platform with workspace overrides |
| \`SettingsService\` | Load customSettings from manifest.fin.json |
| \`HomeService\` | Register with OpenFin Home (search provider) |
| \`StoreService\` | Register with OpenFin Storefront (app catalog) |
| \`DockService\` | Register with OpenFin Dock (taskbar) |
| \`ContextService\` | FDC3 context broadcasting and listening |
| \`ChannelService\` | OpenFin channel API for inter-app communication |
| \`NotificationsService\` | OpenFin notification center |
| \`ThemeService\` | Detect and react to OpenFin workspace theme changes |
| \`WorkspaceOverrideService\` | Override default workspace browser behavior |

### Angular Usage
\`\`\`typescript
import { WorkspaceService, ThemeService } from '@macro/openfin';

@Component({ ... })
export class PlatformProviderComponent {
  private workspaceService = inject(WorkspaceService);
  private themeService = inject(ThemeService);

  async ngOnInit() {
    await this.workspaceService.init('http://localhost:4202/manifest.fin.json');
    // ThemeService.isDark is a Signal<boolean>
    // ThemeService.currentPalette is a Signal<ThemePalette>
  }
}
\`\`\`

### Base Services (Framework-agnostic)
\`\`\`typescript
import {
  BasePlatformService,
  BaseSettingsService,
  BaseContextService,
  // ...
} from '@macro/openfin';
\`\`\`

## WorkspaceService Init Sequence
1. SettingsService loads \`customSettings\` from manifest
2. PlatformService initializes the platform with workspace overrides
3. HomeService registers with OpenFin Home
4. StoreService registers with OpenFin Storefront
5. DockService registers with OpenFin Dock

## Registering a New LOB App in OpenFin
1. Add a view \`.fin.json\` to \`apps/macro-workspace/public/\`
2. Add the app entry to \`manifest.fin.json\` under \`customSettings.apps\`
3. The app will appear in Home search, Storefront, and can be opened as a view
`;

export function registerOpenfin(server: McpServer): void {
  server.resource('openfin', 'macro://openfin', { mimeType: 'text/markdown' }, async () => ({
    contents: [
      {
        uri: 'macro://openfin',
        text: OPENFIN_DOC,
        mimeType: 'text/markdown',
      },
    ],
  }));
}
