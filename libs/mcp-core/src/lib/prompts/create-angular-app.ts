import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerCreateAngularAppPrompt(server: McpServer): void {
  server.prompt(
    'create-angular-app',
    'Complete step-by-step instructions for creating a new Angular LOB app in the Macro monorepo',
    {
      appName: z.string().describe('App name in kebab-case (e.g., "credit-risk")'),
      businessDomain: z.string().describe('Business domain (e.g., "Credit Risk Management")'),
      dataSource: z
        .enum(['amps', 'solace', 'websocket', 'rest'])
        .optional()
        .describe('Primary data source type'),
    },
    async ({ appName, businessDomain, dataSource }) => {
      const ds = dataSource ?? 'rest';
      const port = '4204'; // 4200-4203 are taken by existing apps

      const text = `You are creating a new Angular LOB application called "${appName}" for ${businessDomain} in the Macro monorepo.
It mirrors the current \`apps/macro-angular\` app: Angular 21 (zoneless), standalone
components, PrimeNG (Aura), and the \`@macro/macro-design\` theme system via \`ThemeService\`.

Follow these 10 steps exactly:

## Step 1: Generate the NX app
\`\`\`bash
# nx 22.7: first positional is the project directory. Set the dev port in project.json afterwards.
npx nx g @nx/angular:app apps/${appName} --name=${appName} --style=css --routing --standalone
\`\`\`

## Step 2: Configure \`apps/${appName}/src/main.ts\`
- Import \`bootstrapApplication\` from \`@angular/platform-browser\`
- Import \`appConfig\` from \`./app/app.config\`
- Import \`App\` from \`./app/app\`
- Import \`Logger\` from \`@macro/logger\`
- Bootstrap the App with appConfig

## Step 3: Configure \`apps/${appName}/src/app/app.config.ts\`
- Use \`providePrimeNG\` with Aura preset and \`darkModeSelector: '.dark'\`
- Include \`provideRouter\`, \`provideAnimationsAsync\`, \`provideZonelessChangeDetection\`
- Include \`provideBrowserGlobalErrorListeners\`

## Step 4: Set up \`apps/${appName}/src/app/app.routes.ts\`
- Define routes for your business domain views
- Add a default redirect

## Step 5: Create root component \`apps/${appName}/src/app/app.ts\`
- Use standalone component with \`RouterOutlet\` and PrimeNG \`Menubar\`
- Inject the shared \`ThemeService\` from \`@macro/macro-design/angular\` (\`protected readonly theme = inject(ThemeService)\`) — it starts the theme controller automatically and exposes \`theme.isDark()\` / \`theme.toggle()\` as signals (no PLATFORM_ID boilerplate, no manual listeners)
- Add a theme toggle button (\`(click)="theme.toggle()"\`, label from \`theme.isDark()\`)
- Set up menu items with router links
- Track active route for menu highlighting

## Step 6: Configure \`apps/${appName}/src/styles.css\`
\`\`\`css
@import '../../../libs/macro-design/src/lib/css/fonts.css';
@import '../../../libs/macro-design/src/lib/css/macro-etrading.css';
@import '../../../libs/macro-design/src/lib/css/macro-design.css';

body {
  font-family: 'Ubuntu', sans-serif;
  background-color: var(--background);
  color: var(--foreground);
  transition: background-color 1s, color 1s;
}
\`\`\`

## Step 7: Create your first view component with AG Grid
- Import \`MacroAngularGrid\` from \`@macro/macro-angular-grid\`
- Define \`ColDef[]\` for your business domain fields
- Set \`getRowId\` for row identity tracking
- Use the grid's \`updateRows$\` subject for streaming updates

## Step 8: Wire up data connectivity
${ds === 'amps' ? `- Import \`AmpsClient\` from \`@macro/transports\` (or inject \`AmpsTransportService\` from \`@macro/transports/angular\`)
- Connect: \`await client.connect({ url: 'ws://localhost:9100/amps/json' })\`
- Subscribe: \`const { observable } = await client.subscribeAsObservable('your-topic')\`
- Read messages via the unified \`TransportMessage\` API: \`msg.json<YourType>()\` (or \`msg.data\` for the raw string)
- Use \`ConflationSubject\` from \`@macro/utils\` to conflate high-frequency updates
- Pipe conflated output to \`grid.updateRows$.next([value])\`` :
ds === 'solace' ? `- Import \`SolaceClient\` from \`@macro/transports\` (or inject \`SolaceTransportService\` from \`@macro/transports/angular\`)
- Connect with \`SolaceConnectionOptions\`: \`await client.connect({ hostUrl, vpnName, userName, password })\`
- Subscribe: \`const { observable } = await client.subscribeAsObservable('your/topic')\`
- Read messages via \`msg.json<YourType>()\` (unified TransportMessage)
- Use \`ConflationSubject\` from \`@macro/utils\` to conflate high-frequency updates
- Pipe conflated output to \`grid.updateRows$.next([value])\`` :
ds === 'websocket' ? `- Use the built-in market-data-server: \`ws://localhost:3000/marketData/fx\` or \`/marketData/tsy\`
- Connect via native WebSocket or a service
- Parse incoming JSON messages
- Use \`ConflationSubject\` from \`@macro/utils\` if needed
- Pipe to \`grid.updateRows$.next([data])\`` :
`- Create an Angular service with HttpClient
- Fetch data from your REST API
- Set grid data via \`grid.setInitialRowData(data)\` or \`grid.updateRows$.next([data])\``}

## Step 9: Register in OpenFin (optional)
- Easiest: run the \`register_openfin_app\` MCP tool — it writes the local + openshift view manifests, registers the app in both \`manifest.fin.json\` files and \`settings.json\`, and adds a Dock favorite
- Manual: create view manifests under \`apps/macro-workspace/public/local/\` and \`.../public/openshift/\` (NOT a flat root path), then add the app entry to both \`manifest.fin.json\` files
- Set FDC3 2.0 interop \`currentContextGroup\` to "green"

## Step 10: Verify
\`\`\`bash
npx nx serve ${appName}
\`\`\`
- Open http://localhost:${port}
- Verify dark/light mode toggle works
- Verify PrimeNG Menubar renders
- Verify AG Grid loads with your data
- Test data streaming if applicable

Use the \`macro://architecture\` resource for monorepo structure reference.
Use the \`macro://templates/angular\` resource for complete code templates.
Use the \`get_library_api\` tool for detailed API documentation of any @macro/* library.`;

      return {
        messages: [
          {
            role: 'user' as const,
            content: { type: 'text' as const, text },
          },
        ],
      };
    }
  );
}
