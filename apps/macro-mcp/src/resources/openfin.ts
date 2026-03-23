import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const OPENFIN_DOC = `# OpenFin Integration

## Overview
The Macro monorepo uses OpenFin's Workspace platform to host Angular and React LOB apps
as views within a unified desktop experience. The \`macro-workspace\` app (port 4202) acts
as the platform provider.

## Platform Capabilities
- **Workspace persistence** — save/restore named workspaces with full snapshot support
- **Snap** — window snapping/docking via @openfin/snap-sdk (drag windows near each other to snap, SHIFT to unstick)
- **FDC3 2.0** — context broadcasting/listening across views via color-linked channels
- **Notifications** — level-based API (info, success, warning, error, critical) with indicator colors
- **Analytics** — all user actions published to NATS in real-time, viewable in Analytics Dashboard
- **Theme** — dark/light mode with custom palettes, synced across all views
- **Dock** — next-gen dock with favorites, content menu folders
- **Home** — search provider for quick app launching
- **Storefront** — app catalog with favorites

## Registering a New App as an OpenFin View

### Step 1: Create a view manifest
Create \`apps/macro-workspace/public/<app-name>.fin.json\`:
\`\`\`json
{
  "url": "http://localhost:<port>/<route>",
  "fdc3InteropApi": "2.0",
  "interop": {
    "currentContextGroup": "green"
  }
}
\`\`\`

### Step 2: Register in manifest.fin.json AND settings.json
Add to \`customSettings.apps\` array in both files:
\`\`\`json
{
  "appId": "my-app-view",
  "name": "my-app-view",
  "title": "My App",
  "description": "Description",
  "manifest": "http://localhost:4202/my-app-view.fin.json",
  "manifestType": "view",
  "icons": [{ "src": "http://localhost:4202/icons/platform.svg" }],
  "contactEmail": "contact@example.com",
  "supportEmail": "support@example.com",
  "publisher": "OpenFin",
  "intents": [],
  "images": [],
  "tags": ["view", "angular"]
}
\`\`\`

### Step 3: Add to Dock (optional)
In \`settings.json\` under \`dock3.favorites\`:
\`\`\`json
{
  "type": "item",
  "id": "fav-my-app",
  "label": "My App",
  "icon": "http://localhost:4202/icons/platform.svg",
  "appId": "my-app-view"
}
\`\`\`

### manifestType Options
| Type | Behavior |
|------|----------|
| \`view\` | Opens as a view tab within a browser window |
| \`manifest\` | Fetches manifest, extracts views, creates named browser window |
| \`snapshot\` | Applies a full workspace snapshot |
| \`external\` | Launches an external process |

## @macro/openfin Services

### Angular Services (Injectable, providedIn: 'root')

| Service | Key Methods |
|---------|------------|
| WorkspaceService | \`init()\` orchestrates full platform startup, \`quit()\` shuts down |
| PlatformService | \`initializeWorkspacePlatform()\`, \`updateToolbarButtons()\` |
| ThemeService | \`syncWithOpenFinTheme()\`, \`stopSyncing()\`, \`isDark\` signal, \`currentPalette\` signal |
| ContextService | \`broadcast(context)\`, \`currentChannel$\`, \`onContext<T>(type)\` |
| NotificationsService | \`info(title, body)\`, \`success()\`, \`warning()\`, \`error()\`, \`critical()\`, \`create(options)\` |
| ViewStateService | \`restoreState()\`, \`setCollector(fn)\`, \`enableAutoSave(fn, interval)\`, \`destroy()\` |
| SnapService | \`init(platformId, settings)\`, \`stop()\`, \`decorateSnapshot()\`, \`applySnapshot()\` |
| Dock3Service | \`init(settings, apps, dock3Config)\`, \`shutdown()\` |
| HomeService | \`register(settings)\`, \`show()\` |
| StoreService | \`register(settings)\`, \`show()\` |

### React Hooks
\`\`\`typescript
import { useViewState, useNotifications } from '@macro/openfin/react';

const [viewState, savedState, isRestored] = useViewState();
const notifications = useNotifications();
\`\`\`

### Base Services (framework-agnostic)
All services have a \`Base\` prefixed export: \`BaseWorkspaceService\`, \`BasePlatformService\`, etc.

## Snap Configuration
In \`settings.json\`:
\`\`\`json
{
  "snapProvider": {
    "enabled": true,
    "serverOptions": {
      "showDebug": false,
      "keyToStick": false,
      "autoHideClientTaskbarIcons": true
    }
  }
}
\`\`\`

## Analytics Pipeline
Events published to NATS: \`macro.analytics.<user>.<source>.<type>.<action>\`

Sources: Platform (lifecycle, workspace, theme), Browser (internal analytics), Dock, Home, Store.

Analytics Dashboard available as OpenFin view (\`macro-analytics-dashboard\`).

## WorkspaceService Init Sequence
1. Load settings + theme presets
2. Initialize workspace platform with overrides
3. Wait for platform-api-ready
4. Register components (Dock, Home, Store, Notifications, Snap) in parallel
5. Show Home
6. Restore last saved workspace
7. Update toolbar buttons
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
