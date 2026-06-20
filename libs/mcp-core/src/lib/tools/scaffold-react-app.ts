import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const FEATURES = ['ag-grid', 'ag-charts', 'amps', 'solace', 'nats', 'openfin', 'conflation'] as const;

function generateReactScaffold(appName: string, description: string, port: number, features: string[]): string {
  const hasGrid = features.includes('ag-grid');
  const hasAmps = features.includes('amps');
  const hasSolace = features.includes('solace');
  const hasNats = features.includes('nats');
  const hasOpenfin = features.includes('openfin');
  const hasConflation = features.includes('conflation');

  let output = `# Scaffold React App: ${appName}

> Mirrors the current \`apps/macro-react\` app: React 19 + Vite 8, PrimeReact (Aura)
> + Tailwind 4, and the \`@macro/macro-design\` theme system (default theme \`macro\`).

## Step 1: Generate the app
\`\`\`bash
# nx 22.7: the first positional is the project directory.
npx nx g @nx/react:app apps/${appName} --name=${appName} --style=css --routing --bundler=vite --unitTestRunner=vitest
\`\`\`

## Step 2: Create \`apps/${appName}/src/main.tsx\`
Call \`themeController.start()\` before \`createRoot\` so the \`.dark\` class is applied
before first paint (no flash of the wrong theme).
\`\`\`tsx
import * as ReactDOM from 'react-dom/client';
import { PrimeReactProvider } from '@primereact/core/config';
import Aura from '@primeuix/themes/aura';
import { themeController } from '@macro/macro-design/react';
import App from './app/app';
import './styles.css';

// Apply the macro theme (default 'macro') + dark/light class before first paint.
themeController.start();

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <PrimeReactProvider theme={{ preset: Aura, options: { darkModeSelector: '.dark' } }}>
    <App />
  </PrimeReactProvider>
);
\`\`\`

## Step 3: Create \`apps/${appName}/src/app/app.tsx\`
Theme state comes from the shared \`useTheme()\` hook — no local \`useState\`, no manual
listeners. \`basename\` lets the app be hosted under \`/${appName}/\` (for OpenFin embedding).
\`\`\`tsx
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Logger } from '@macro/logger';
import { useTheme } from '@macro/macro-design/react';
import { Menubar, MenubarMenu, MenubarTrigger } from '@/components/ui/menubar';

const logger = Logger.getLogger('${appName}');

export function App() {
  useEffect(() => {
    logger.info('${description}');
  }, []);

  return (
    <BrowserRouter basename="/${appName}">
      <AppContent />
    </BrowserRouter>
  );
}

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  // Shared macro theme — syncs system + OpenFin, persists user choice.
  const { isDark, toggle } = useTheme();

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <Menubar>
          <MenubarMenu>
            <MenubarTrigger
              onClick={() => navigate('/dashboard')}
              className={location.pathname === '/dashboard' ? 'bg-accent' : ''}
            >
              Dashboard
            </MenubarTrigger>
          </MenubarMenu>
        </Menubar>
        <button onClick={toggle} aria-label="Toggle theme" className="px-4 py-2 rounded-md bg-secondary text-secondary-foreground">
          {isDark ? 'Light' : 'Dark'}
        </button>
      </div>
      <div className="flex-1 p-4 overflow-auto">
        <Routes>
          <Route path="/dashboard" element={<div>Dashboard</div>} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
\`\`\`

## Step 4: Create \`apps/${appName}/src/styles.css\`
Import the 3-file \`@macro/macro-design\` CSS chain (in this order) BEFORE PrimeIcons/Tailwind.
\`\`\`css
/* Shared design tokens from @macro/macro-design */
@import '../../../libs/macro-design/src/lib/css/fonts.css';
@import '../../../libs/macro-design/src/lib/css/macro-etrading.css';
@import '../../../libs/macro-design/src/lib/css/macro-design.css';

/* PrimeIcons */
@import 'primeicons/primeicons.css';

@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
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
Note \`base: '/${appName}/'\` (OpenFin embedding) and the full \`@macro/*\` alias block,
incl. the \`/react\` subpath aliases the theme system needs. Longer subpath keys must
come BEFORE their parents.
\`\`\`typescript
/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import path from 'path';

export default defineConfig(() => ({
  root: __dirname,
  base: '/${appName}/',
  cacheDir: '../../node_modules/.vite/apps/${appName}',
  server: { port: ${port}, host: 'localhost' },
  preview: { port: ${port}, host: 'localhost' },
  plugins: [react(), nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@macro/logger': path.resolve(__dirname, '../../libs/logger/src/index.ts'),
      '@macro/macro-react-grid': path.resolve(__dirname, '../../libs/macro-react-grid/src/index.ts'),
      '@macro/macro-design/react': path.resolve(__dirname, '../../libs/macro-design/src/lib/react/index.ts'),
      '@macro/macro-design': path.resolve(__dirname, '../../libs/macro-design/src/index.ts'),
      '@macro/openfin/theme-sync': path.resolve(__dirname, '../../libs/openfin/src/lib/theme-sync.ts'),
      '@macro/openfin/react': path.resolve(__dirname, '../../libs/openfin/src/lib/react.ts'),
      '@macro/openfin': path.resolve(__dirname, '../../libs/openfin/src/index.ts'),
      '@macro/transports/react': path.resolve(__dirname, '../../libs/transports/src/lib/react/index.ts'),
      '@macro/transports': path.resolve(__dirname, '../../libs/transports/src/index.ts'),
    },
  },
  build: {
    outDir: '../../dist/apps/${appName}',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: { transformMixedEsModules: true },
  },
  test: {
    name: '${appName}',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/apps/${appName}',
      provider: 'v8' as const,
    },
  },
}));
\`\`\`
`;

  if (hasGrid) {
    output += `
## AG Grid Component Wiring
\`\`\`tsx
import { useRef } from 'react';
import { MacroReactGrid, MacroReactGridRef } from '@macro/macro-react-grid';
import { ColDef, GetRowIdParams } from 'ag-grid-community';

const columns: ColDef[] = [
  { field: 'id', headerName: 'ID' },
  // Add your columns here
];

export function DataGrid() {
  const gridRef = useRef<MacroReactGridRef>(null);

  return (
    <div style={{ height: 600 }}>
      <MacroReactGrid
        ref={gridRef}
        columns={columns}
        rowData={[]}
        getRowId={(params: GetRowIdParams) => params.data.id}
      />
    </div>
  );
}
\`\`\`
> \`MacroReactGrid\` applies \`buildAgGridTheme(isDark)\` automatically (watches the
> \`.dark\` class) — no theme wiring needed.
`;
  }

  if (hasAmps) {
    output += `
## AMPS Integration (\`@macro/transports\`)
\`connect()\` takes an \`AmpsConnectionOptions\` object (\`{ url }\`). Messages are unified
\`TransportMessage\`s — use \`msg.json()\` to parse, \`msg.data\` for the raw string.
\`\`\`typescript
import { AmpsClient } from '@macro/transports';
${hasConflation ? "import { ConflationSubject } from '@macro/utils';" : ''}

const ampsClient = new AmpsClient('${appName}');
await ampsClient.connect({ url: 'ws://localhost:9100/amps/json' });

const { observable } = await ampsClient.subscribeAsObservable('your-topic');
${hasConflation ? `
const conflated = new ConflationSubject<string, YourDataType>(100);
observable.subscribe(msg => {
  const data = msg.json<YourDataType>();
  conflated.next({ key: data.id, value: data });
});
conflated.subscribeToConflated(({ value }) => {
  gridRef.current?.updateRows$.next([value]);
});` : `observable.subscribe(msg => {
  gridRef.current?.updateRows$.next([msg.json<YourDataType>()]);
});`}
\`\`\`
`;
  }

  if (hasSolace) {
    output += `
## Solace Integration (\`@macro/transports\`)
\`\`\`typescript
import { SolaceClient } from '@macro/transports';
${hasConflation ? "import { ConflationSubject } from '@macro/utils';" : ''}

const solaceClient = new SolaceClient();
await solaceClient.connect({
  hostUrl: 'ws://localhost:8008',
  vpnName: 'default',
  userName: 'default',
  password: 'default',
});

const { observable } = await solaceClient.subscribeAsObservable('your/topic');
${hasConflation ? `
const conflated = new ConflationSubject<string, YourDataType>(100);
observable.subscribe(msg => {
  const data = msg.json<YourDataType>();
  conflated.next({ key: data.id, value: data });
});
conflated.subscribeToConflated(({ value }) => {
  gridRef.current?.updateRows$.next([value]);
});` : `observable.subscribe(msg => {
  gridRef.current?.updateRows$.next([msg.json<YourDataType>()]);
});`}
\`\`\`
`;
  }

  if (hasNats) {
    output += `
## NATS Integration (\`@macro/transports\`)
\`\`\`typescript
import { NatsClient } from '@macro/transports';
${hasConflation ? "import { ConflationSubject } from '@macro/utils';" : ''}

const natsClient = new NatsClient('${appName}');
await natsClient.connect({ servers: 'ws://localhost:8224' });

const { observable } = await natsClient.subscribeAsObservable('prices.>');
observable.subscribe(msg => {
  gridRef.current?.updateRows$.next([msg.json<YourDataType>()]);
});
\`\`\`
> Or use the React hook: \`const { client, connected, connect } = useNatsTransport('${appName}')\`
> from \`@macro/transports/react\`.
`;
  }

  if (hasOpenfin) {
    output += `
## OpenFin Registration
Use the \`register_openfin_app\` MCP tool to wire this app into the workspace — it
writes the local + openshift view manifests, registers the app in both
\`manifest.fin.json\` files and \`settings.json\`, and adds a Dock favorite:
\`\`\`
register_openfin_app({ appId: '${appName}', title: '${description}', url: 'http://localhost:${port}', framework: 'react' })
\`\`\`
Manifests live under \`apps/macro-workspace/public/local/\` and \`.../public/openshift/\`
(not a flat root path). Each view manifest sets FDC3 2.0 with
\`interop.currentContextGroup: 'green'\`.
`;
  }

  return output;
}

export function registerScaffoldReactApp(server: McpServer): void {
  server.tool(
    'scaffold_react_app',
    'Generate boilerplate code and NX commands for a new React LOB application in the Macro monorepo, matching the current macro-react app + @macro/macro-design theme system',
    {
      appName: z.string().describe('App name in kebab-case (e.g., "credit-risk")'),
      description: z.string().describe('Short description of the app'),
      port: z.number().optional().describe('Dev server port (default: 4204; 4200-4203 are taken by existing apps)'),
      features: z
        .array(z.enum(FEATURES))
        .optional()
        .describe('Optional features to include'),
    },
    async ({ appName, description, port, features }) => ({
      content: [
        {
          type: 'text' as const,
          text: generateReactScaffold(appName, description, port ?? 4204, features ?? []),
        },
      ],
    })
  );
}
