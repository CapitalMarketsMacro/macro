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
      const port = '4203'; // suggest next available port

      const text = `You are creating a new Angular LOB application called "${appName}" for ${businessDomain} in the Macro monorepo.

Follow these 10 steps exactly:

## Step 1: Generate the NX app
\`\`\`bash
npx nx g @nx/angular:app ${appName} --style=css --routing --standalone --port=${port}
\`\`\`

## Step 2: Configure \`apps/${appName}/src/main.ts\`
- Import \`bootstrapApplication\` from \`@angular/platform-browser\`
- Import \`appConfig\` from \`./app/app.config\`
- Import \`App\` from \`./app/app\`
- Import \`Logger\` from \`@macro/logger\`
- Bootstrap the App with appConfig

## Step 3: Configure \`apps/${appName}/src/app/app.config.ts\`
- Use \`providePrimeNG\` with Aura preset and \`darkModeSelector: '.dark'\`
- Include \`provideRouter\`, \`provideAnimationsAsync\`, \`provideZoneChangeDetection\`
- Include \`provideBrowserGlobalErrorListeners\`

## Step 4: Set up \`apps/${appName}/src/app/app.routes.ts\`
- Define routes for your business domain views
- Add a default redirect

## Step 5: Create root component \`apps/${appName}/src/app/app.ts\`
- Use standalone component with \`RouterOutlet\` and PrimeNG \`Menubar\`
- Initialize dark mode using \`getInitialIsDark()\`, \`applyDarkMode()\`, \`onSystemThemeChange()\` from \`@macro/macro-design\`
- Add a theme toggle button
- Set up menu items with router links
- Track active route for menu highlighting

## Step 6: Configure \`apps/${appName}/src/styles.css\`
\`\`\`css
@import '../../../libs/macro-design/src/lib/css/fonts.css';
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
${ds === 'amps' ? `- Import \`AmpsClient\` from \`@macro/amps\`
- Connect: \`await client.connect('ws://localhost:9100/amps/json')\`
- Subscribe: \`const { observable } = await client.subscribeAsObservable('your-topic')\`
- Use \`ConflationSubject\` from \`@macro/rxutils\` to conflate high-frequency updates
- Pipe conflated output to \`grid.updateRows$.next([value])\`` :
ds === 'solace' ? `- Import \`SolaceClient\` from \`@macro/solace\`
- Connect with \`SolaceConnectionProperties\`
- Subscribe: \`const { observable } = await client.subscribeAsObservable('your/topic')\`
- Use \`ConflationSubject\` from \`@macro/rxutils\` to conflate high-frequency updates
- Pipe conflated output to \`grid.updateRows$.next([value])\`` :
ds === 'websocket' ? `- Use the built-in market-data-server: \`ws://localhost:3000/marketData/fx\` or \`/marketData/tsy\`
- Connect via native WebSocket or a service
- Parse incoming JSON messages
- Use \`ConflationSubject\` from \`@macro/rxutils\` if needed
- Pipe to \`grid.updateRows$.next([data])\`` :
`- Create an Angular service with HttpClient
- Fetch data from your REST API
- Set grid data via \`grid.setInitialRowData(data)\` or \`grid.updateRows$.next([data])\``}

## Step 9: Register in OpenFin (optional)
- Create \`apps/macro-workspace/public/${appName}-view.fin.json\` with URL \`http://localhost:${port}\`
- Add app entry to \`manifest.fin.json\` under \`customSettings.apps\`
- Set FDC3 interop context group to "green"

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
