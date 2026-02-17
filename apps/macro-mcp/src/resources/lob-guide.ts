import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const LOB_GUIDE_DOC = `# LOB Implementation Guide

A 7-step guide for Lines of Business (LOB) teams to build trading applications on this monorepo.

## Step 1: Create Your Application

\`\`\`bash
# Angular app
npx nx generate @nx/angular:application my-lob-angular --directory=apps/my-lob-angular --standalone

# React app
npx nx generate @nx/react:application my-lob-react --directory=apps/my-lob-react --bundler=vite
\`\`\`

> **Tip:** Use the \`scaffold_angular_app\` or \`scaffold_react_app\` MCP tools for complete boilerplate with feature selection.

## Step 2: Use Shared Libraries

All \`@macro/*\` libraries are available immediately via TypeScript path aliases (configured in \`tsconfig.base.json\`):

\`\`\`typescript
// Logging
import { Logger } from '@macro/logger';
const logger = Logger.getLogger('MyLobApp');

// AG Grid
import { MacroAngularGrid } from '@macro/macro-angular-grid';  // or MacroReactGrid

// Messaging (pick your transport)
import { AmpsClient } from '@macro/amps';
import { SolaceClient } from '@macro/solace';

// Conflation for high-frequency data
import { ConflationSubject } from '@macro/rxutils';

// OpenFin services (if running in OpenFin)
import { ContextService, ChannelService, ThemeService } from '@macro/openfin';

// Design tokens and theming
import { getInitialIsDark, applyDarkMode, buildAgGridTheme } from '@macro/macro-design';
\`\`\`

## Step 3: Register in OpenFin Workspace

Add your app to \`apps/macro-workspace/public/manifest.fin.json\` under \`customSettings.apps\`:

\`\`\`json
{
  "appId": "my-lob-app",
  "name": "my-lob-app",
  "title": "My LOB Application",
  "description": "Description for Home search and Store",
  "manifest": "http://localhost:4202/my-lob-app.fin.json",
  "manifestType": "view",
  "icons": [{ "src": "http://localhost:YOUR_PORT/favicon.ico" }],
  "contactEmail": "team@example.com",
  "supportEmail": "support@example.com",
  "publisher": "My LOB Team",
  "intents": [],
  "images": [],
  "tags": ["view", "my-lob"]
}
\`\`\`

Create the view manifest \`apps/macro-workspace/public/my-lob-app.fin.json\`:

\`\`\`json
{
  "url": "http://localhost:YOUR_PORT",
  "fdc3InteropApi": "2.0",
  "interop": {
    "currentContextGroup": "green"
  }
}
\`\`\`

> **Tip:** Use the \`register_openfin_app\` MCP tool to generate both files automatically.

## Step 4: Connect Real-Time Data

Replace client-side simulation with AMPS or Solace:

\`\`\`typescript
// AMPS example with conflation for grid updates
const amps = new AmpsClient('my-lob-fx');
await amps.connect('ws://amps-server:9007/amps/json');

const conflation = new ConflationSubject<string, FxRate>(100);  // 100ms

amps.subscribeAsObservable('/topic/fx-rates')
  .subscribe((msg) => {
    const rate = msg.data as FxRate;
    conflation.next({ key: rate.symbol, value: rate });
  });

conflation.subscribeToConflated(({ key, value }) => {
  gridComponent.updateRows$.next([value]);
});
\`\`\`

For the local WebSocket market data server:

\`\`\`typescript
const ws = new WebSocket('ws://localhost:3000/marketData/fx');
ws.onopen = () => ws.send(JSON.stringify({ type: 'subscribe' }));
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'marketData') {
    gridComponent.updateRows$.next(msg.data.pairs);
  }
};
\`\`\`

> **Tip:** Use the \`add-data-connectivity\` MCP prompt for complete transport setup code.

## Step 5: Add FDC3 Context Sharing

Enable cross-app communication:

\`\`\`typescript
// Broadcast when user clicks a row
onRowClicked(row: FxRate) {
  contextService.broadcast({
    type: 'fdc3.instrument',
    name: row.symbol,
    id: { ticker: row.symbol }
  });
}

// Listen for context from other apps
contextService.registerContextListener('fdc3.instrument');
contextService.context$.subscribe((ctx) => {
  const ticker = ctx.id?.ticker;
  highlightRow(ticker);
});
\`\`\`

> **Tip:** Use the \`add-fdc3-context\` MCP prompt for framework-specific FDC3 code.

## Step 6: Theme Integration

**6a. Import shared CSS** in your app's global \`styles.css\`:

\`\`\`css
/* Must come before any framework-specific CSS */
@import '../../../libs/macro-design/src/lib/css/fonts.css';
@import '../../../libs/macro-design/src/lib/css/macro-design.css';
\`\`\`

**6b. Use dark mode utilities** in your root component:

\`\`\`typescript
import { getInitialIsDark, applyDarkMode, onSystemThemeChange } from '@macro/macro-design';
\`\`\`

**6c. Configure PrimeNG/PrimeReact** to respond to the \`.dark\` class:

For PrimeNG (Angular):
\`\`\`typescript
providePrimeNG({
  theme: { preset: Aura, options: { darkModeSelector: '.dark' } }
})
\`\`\`

For PrimeReact (React):
\`\`\`tsx
<PrimeReactProvider theme={{ preset: Aura, options: { darkModeSelector: '.dark' } }}>
  <App />
</PrimeReactProvider>
\`\`\`

For Tailwind (React): Use \`@custom-variant dark (&:is(.dark *))\` and reference CSS variables.

> **Tip:** Use the \`add-theme-support\` MCP prompt for complete theme setup code.

## Step 7: Create a Shared Library (Optional)

If you have reusable logic:

\`\`\`bash
# TypeScript library (framework-agnostic)
npx nx generate @nx/js:library my-lob-utils --directory=libs/my-lob-utils --bundler=tsc

# Angular library
npx nx generate @nx/angular:library my-lob-ng --directory=libs/my-lob-ng

# React library
npx nx generate @nx/react:library my-lob-react --directory=libs/my-lob-react
\`\`\`

Add the path alias to \`tsconfig.base.json\`:
\`\`\`json
"@macro/my-lob-utils": ["libs/my-lob-utils/src/index.ts"]
\`\`\`

> **Tip:** Use the \`scaffold_library\` MCP tool to generate the NX command, tsconfig alias, and index.ts boilerplate.

## Quick Reference: MCP Tools for Each Step

| Step | MCP Tool/Prompt |
|------|----------------|
| 1. Create app | \`scaffold_angular_app\` / \`scaffold_react_app\` |
| 2. Use libraries | \`list_libraries\` / \`get_library_api\` |
| 3. Register in OpenFin | \`register_openfin_app\` |
| 4. Connect data | \`add-data-connectivity\` prompt |
| 5. FDC3 context | \`add-fdc3-context\` prompt |
| 6. Theme integration | \`add-theme-support\` prompt |
| 7. Shared library | \`scaffold_library\` |
`;

export function registerLobGuide(server: McpServer): void {
  server.resource('lob-guide', 'macro://lob-guide', { mimeType: 'text/markdown' }, async () => ({
    contents: [
      {
        uri: 'macro://lob-guide',
        text: LOB_GUIDE_DOC,
        mimeType: 'text/markdown',
      },
    ],
  }));
}
