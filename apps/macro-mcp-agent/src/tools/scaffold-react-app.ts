import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const FEATURES = ['ag-grid', 'ag-charts', 'amps', 'solace', 'openfin', 'conflation'] as const;

function generateReactScaffold(appName: string, description: string, port: number, features: string[]): string {
  const hasGrid = features.includes('ag-grid');
  const hasAmps = features.includes('amps');
  const hasSolace = features.includes('solace');
  const hasOpenfin = features.includes('openfin');
  const hasConflation = features.includes('conflation');

  let output = `# Scaffold React App: ${appName}

## Step 1: Generate the app
\`\`\`bash
npx nx g @nx/react:app ${appName} --style=css --routing --bundler=vite
\`\`\`

## Step 2: Create \`apps/${appName}/src/main.tsx\`
\`\`\`tsx
import * as ReactDOM from 'react-dom/client';
import { PrimeReactProvider } from '@primereact/core/config';
import Aura from '@primeuix/themes/aura';
import App from './app/app';
import './styles.css';

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
\`\`\`tsx
import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Logger } from '@macro/logger';
import { Menubar, MenubarMenu, MenubarTrigger } from '@/components/ui/menubar';
import { getInitialIsDark, applyDarkMode, onSystemThemeChange } from '@macro/macro-design';

const logger = Logger.getLogger('${appName}');

export function App() {
  useEffect(() => {
    logger.info('${description}');
  }, []);

  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(getInitialIsDark);

  useEffect(() => {
    applyDarkMode(isDark);
  }, [isDark]);

  useEffect(() => {
    return onSystemThemeChange((dark) => setIsDark(dark));
  }, []);

  const toggleTheme = () => setIsDark((prev) => !prev);

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
        <button onClick={toggleTheme} className="px-4 py-2 rounded-md bg-secondary text-secondary-foreground">
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
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
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

## Step 5: Create \`apps/${appName}/vite.config.ts\`
\`\`\`typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import path from 'path';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/${appName}',
  server: { port: ${port}, host: 'localhost' },
  preview: { port: ${port}, host: 'localhost' },
  plugins: [react(), nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@macro/logger': path.resolve(__dirname, '../../libs/logger/src/index.ts'),
      '@macro/macro-react-grid': path.resolve(__dirname, '../../libs/macro-react-grid/src/index.ts'),
      '@macro/macro-design': path.resolve(__dirname, '../../libs/macro-design/src/index.ts'),
    },
  },
  build: {
    outDir: '../../dist/apps/${appName}',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: { transformMixedEsModules: true },
  },
}));
\`\`\`
`;

  if (hasGrid) {
    output += `
## AG Grid Component Wiring
\`\`\`tsx
import { useRef, useEffect } from 'react';
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
`;
  }

  if (hasAmps) {
    output += `
## AMPS Integration
\`\`\`typescript
import { AmpsClient } from '@macro/amps';
${hasConflation ? "import { ConflationSubject } from '@macro/rxutils';" : ''}

const ampsClient = new AmpsClient('${appName}');
await ampsClient.connect('ws://localhost:9100/amps/json');

const { observable } = await ampsClient.subscribeAsObservable('your-topic');
${hasConflation ? `
const conflated = new ConflationSubject<string, YourDataType>(100);
observable.subscribe(msg => {
  const data = msg.data as YourDataType;
  conflated.next({ key: data.id, value: data });
});
conflated.subscribeToConflated(({ value }) => {
  gridRef.current?.updateRows$.next([value]);
});` : `observable.subscribe(msg => {
  gridRef.current?.updateRows$.next([msg.data]);
});`}
\`\`\`
`;
  }

  if (hasSolace) {
    output += `
## Solace Integration
\`\`\`typescript
import { SolaceClient } from '@macro/solace';
${hasConflation ? "import { ConflationSubject } from '@macro/rxutils';" : ''}

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
  const data = JSON.parse(msg.getBinaryAttachment() as string);
  conflated.next({ key: data.id, value: data });
});
conflated.subscribeToConflated(({ value }) => {
  gridRef.current?.updateRows$.next([value]);
});` : `observable.subscribe(msg => {
  gridRef.current?.updateRows$.next([JSON.parse(msg.getBinaryAttachment() as string)]);
});`}
\`\`\`
`;
  }

  if (hasOpenfin) {
    output += `
## OpenFin Registration
1. Create \`apps/macro-workspace/public/${appName}-view.fin.json\`:
\`\`\`json
{
  "url": "http://localhost:${port}",
  "fdc3InteropApi": "2.0",
  "interop": { "currentContextGroup": "green" }
}
\`\`\`

2. Add to \`apps/macro-workspace/public/manifest.fin.json\` → \`customSettings.apps\`:
\`\`\`json
{
  "appId": "${appName}-view",
  "name": "${appName}-view",
  "title": "${description}",
  "manifest": "http://localhost:4202/${appName}-view.fin.json",
  "manifestType": "view",
  "tags": ["view", "react"]
}
\`\`\`
`;
  }

  return output;
}

export function registerScaffoldReactApp(server: McpServer): void {
  server.tool(
    'scaffold_react_app',
    'Generate boilerplate code and NX commands for a new React LOB application in the Macro monorepo',
    {
      appName: z.string().describe('App name in kebab-case (e.g., "credit-risk")'),
      description: z.string().describe('Short description of the app'),
      port: z.number().optional().describe('Dev server port (default: 4203)'),
      features: z
        .array(z.enum(FEATURES))
        .optional()
        .describe('Optional features to include'),
    },
    async ({ appName, description, port, features }) => ({
      content: [
        {
          type: 'text' as const,
          text: generateReactScaffold(appName, description, port ?? 4203, features ?? []),
        },
      ],
    })
  );
}
