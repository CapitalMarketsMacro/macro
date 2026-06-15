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
      const port = '4204';

      const text = `You are creating a new React LOB application called "${appName}" for ${businessDomain} in the Macro monorepo.
It mirrors the current \`apps/macro-react\` app: React 19 + Vite 8, PrimeReact (Aura) +
Tailwind 4, and the \`@macro/macro-design\` theme system (default theme \`macro\`).

Follow these 10 steps exactly:

## Step 1: Generate the NX app
\`\`\`bash
# nx 22.7: first positional is the project directory.
npx nx g @nx/react:app apps/${appName} --name=${appName} --style=css --routing --bundler=vite --unitTestRunner=vitest
\`\`\`

## Step 2: Configure \`apps/${appName}/src/main.tsx\`
- Import \`ReactDOM\` from \`react-dom/client\`
- Import \`themeController\` from \`@macro/macro-design/react\` and call \`themeController.start()\` BEFORE \`createRoot\` (applies the \`.dark\` class before first paint)
- Wrap App in \`PrimeReactProvider\` with Aura preset and \`darkModeSelector: '.dark'\`
- Import styles.css

## Step 3: Create \`apps/${appName}/src/app/app.tsx\`
- Use \`BrowserRouter\` with \`basename="/${appName}"\`, \`Routes\` and \`Route\`
- Use Shadcn UI \`Menubar\` components from \`@/components/ui/menubar\`
- Get theme state from the shared \`useTheme()\` hook (\`@macro/macro-design/react\`): \`const { isDark, toggle } = useTheme()\` — no local useState, no manual listeners
- Add a theme toggle button (\`onClick={toggle}\`) with Tailwind classes
- Track active route for menu highlighting via \`useLocation\`

## Step 4: Configure \`apps/${appName}/src/styles.css\`
\`\`\`css
@import '../../../libs/macro-design/src/lib/css/fonts.css';
@import '../../../libs/macro-design/src/lib/css/macro-etrading.css';
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
- Set \`base: '/${appName}/'\` (so the app can be embedded under \`/${appName}/\` in OpenFin)
- Add path aliases (longer subpath keys BEFORE parents): \`@\` → \`./src\`, \`@macro/logger\`, \`@macro/macro-react-grid\`, \`@macro/macro-design/react\`, \`@macro/macro-design\`, \`@macro/openfin/theme-sync\`, \`@macro/openfin/react\`, \`@macro/openfin\`, \`@macro/transports/react\`, \`@macro/transports\`
- Use \`nxViteTsPaths()\` and \`nxCopyAssetsPlugin\` plugins, and include the vitest \`test\` block

## Step 6: Set up Shadcn UI components
- Initialize Shadcn: create \`components.json\` and \`src/components/ui/\` directory
- Add Menubar component via Shadcn CLI or copy from macro-react

## Step 7: Create your first view component with AG Grid
- Import \`MacroReactGrid\` and \`MacroReactGridRef\` from \`@macro/macro-react-grid\`
- Use \`useRef<MacroReactGridRef>\` for grid reference
- Define \`ColDef[]\` for your business domain fields
- Set \`getRowId\` for row identity tracking

## Step 8: Wire up data connectivity
${ds === 'amps' ? `- Import \`AmpsClient\` from \`@macro/transports\`
- Connect in a useEffect: \`await client.connect({ url: 'ws://localhost:9100/amps/json' })\`
- Subscribe: \`const { observable } = await client.subscribeAsObservable('your-topic')\`
- Read messages via the unified \`TransportMessage\` API: \`msg.json<YourType>()\` (or \`msg.data\` for the raw string)
- Use \`ConflationSubject\` from \`@macro/rxutils\` to conflate updates
- Pipe to \`gridRef.current?.updateRows$.next([value])\`` :
ds === 'solace' ? `- Import \`SolaceClient\` from \`@macro/transports\`
- Connect in a useEffect with \`SolaceConnectionOptions\`: \`await client.connect({ hostUrl, vpnName, userName, password })\`
- Subscribe: \`const { observable } = await client.subscribeAsObservable('your/topic')\`
- Read messages via \`msg.json<YourType>()\` (unified TransportMessage)
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
- Easiest: run the \`register_openfin_app\` MCP tool — it writes the local + openshift view manifests, registers the app in both \`manifest.fin.json\` files and \`settings.json\`, and adds a Dock favorite
- Manual: create view manifests under \`apps/macro-workspace/public/local/\` and \`.../public/openshift/\` (NOT a flat root path), then add the app entry to both \`manifest.fin.json\` files
- Set FDC3 2.0 interop \`currentContextGroup\` to "green"

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
