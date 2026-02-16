import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerCreateReactAppPrompt(server: McpServer): void {
  server.prompt(
    'create-react-app',
    'Complete step-by-step instructions for creating a new React LOB app in the Macro monorepo',
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
      const port = '4203';

      const text = `You are creating a new React LOB application called "${appName}" for ${businessDomain} in the Macro monorepo.

Follow these 10 steps exactly:

## Step 1: Generate the NX app
\`\`\`bash
npx nx g @nx/react:app ${appName} --style=css --routing --bundler=vite
\`\`\`

## Step 2: Configure \`apps/${appName}/src/main.tsx\`
- Import \`ReactDOM\` from \`react-dom/client\`
- Wrap App in \`PrimeReactProvider\` with Aura preset and \`darkModeSelector: '.dark'\`
- Import styles.css

## Step 3: Create \`apps/${appName}/src/app/app.tsx\`
- Use \`BrowserRouter\` with \`Routes\` and \`Route\`
- Use Shadcn UI \`Menubar\` components from \`@/components/ui/menubar\`
- Initialize dark mode using \`getInitialIsDark()\`, \`applyDarkMode()\`, \`onSystemThemeChange()\` from \`@macro/macro-design\`
- Add a theme toggle button with Tailwind classes
- Track active route for menu highlighting via \`useLocation\`

## Step 4: Configure \`apps/${appName}/src/styles.css\`
\`\`\`css
@import '../../../libs/macro-design/src/lib/css/fonts.css';
@import '../../../libs/macro-design/src/lib/css/macro-design.css';
@import 'primeicons/primeicons.css';

@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
}

@layer base {
  * { @apply border-border outline-ring/50; }
  body {
    @apply bg-background text-foreground;
    font-family: 'Noto Sans', sans-serif;
    transition: background-color 2s, color 2s;
  }
}
\`\`\`

## Step 5: Configure \`apps/${appName}/vite.config.ts\`
- Set server port to ${port}
- Add path aliases: \`@\` → \`./src\`, \`@macro/logger\`, \`@macro/macro-react-grid\`, \`@macro/macro-design\`
- Use \`nxViteTsPaths()\` and \`nxCopyAssetsPlugin\` plugins

## Step 6: Set up Shadcn UI components
- Initialize Shadcn: create \`components.json\` and \`src/components/ui/\` directory
- Add Menubar component via Shadcn CLI or copy from macro-react

## Step 7: Create your first view component with AG Grid
- Import \`MacroReactGrid\` and \`MacroReactGridRef\` from \`@macro/macro-react-grid\`
- Use \`useRef<MacroReactGridRef>\` for grid reference
- Define \`ColDef[]\` for your business domain fields
- Set \`getRowId\` for row identity tracking

## Step 8: Wire up data connectivity
${ds === 'amps' ? `- Import \`AmpsClient\` from \`@macro/amps\`
- Connect in a useEffect: \`await client.connect('ws://localhost:9100/amps/json')\`
- Subscribe: \`const { observable } = await client.subscribeAsObservable('your-topic')\`
- Use \`ConflationSubject\` from \`@macro/rxutils\` to conflate updates
- Pipe to \`gridRef.current?.updateRows$.next([value])\`` :
ds === 'solace' ? `- Import \`SolaceClient\` from \`@macro/solace\`
- Connect in a useEffect with \`SolaceConnectionProperties\`
- Subscribe: \`const { observable } = await client.subscribeAsObservable('your/topic')\`
- Use \`ConflationSubject\` from \`@macro/rxutils\` to conflate updates
- Pipe to \`gridRef.current?.updateRows$.next([value])\`` :
ds === 'websocket' ? `- Use the built-in market-data-server: \`ws://localhost:3000/marketData/fx\` or \`/marketData/tsy\`
- Connect via native WebSocket in useEffect
- Parse incoming JSON messages
- Use \`ConflationSubject\` from \`@macro/rxutils\` if needed
- Pipe to \`gridRef.current?.updateRows$.next([data])\`` :
`- Use fetch or axios in a useEffect
- Fetch data from your REST API
- Set grid data directly via rowData prop or \`gridRef.current?.updateRows$.next([data])\``}

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
- Verify Shadcn Menubar renders
- Verify AG Grid loads with your data
- Verify Tailwind utility classes work

Use the \`macro://architecture\` resource for monorepo structure reference.
Use the \`macro://templates/react\` resource for complete code templates.
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
