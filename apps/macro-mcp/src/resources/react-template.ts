import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const REACT_TEMPLATE_DOC = `# React LOB App Template

Complete pattern for creating a new React LOB application in the Macro monorepo.

## 1. main.tsx
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

## 2. app.tsx
\`\`\`tsx
import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Logger } from '@macro/logger';
import { Menubar, MenubarMenu, MenubarTrigger } from '@/components/ui/menubar';
import { getInitialIsDark, applyDarkMode, onSystemThemeChange } from '@macro/macro-design';
import MyView from './my-view/my-view';

const logger = Logger.getLogger('ReactApp');

export function App() {
  useEffect(() => {
    logger.info('React app initialized');
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
              onClick={() => navigate('/my-view')}
              className={location.pathname === '/my-view' ? 'bg-accent' : ''}
            >
              My View
            </MenubarTrigger>
          </MenubarMenu>
        </Menubar>
        <button onClick={toggleTheme} className="px-4 py-2 rounded-md bg-secondary text-secondary-foreground">
          {isDark ? 'Light' : 'Dark'}
        </button>
      </div>
      <div className="flex-1 p-4 overflow-auto">
        <Routes>
          <Route path="/my-view" element={<MyView />} />
          <Route path="/" element={<Navigate to="/my-view" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
\`\`\`

## 3. styles.css
\`\`\`css
/* Shared design tokens from @macro/macro-design */
@import '../../../libs/macro-design/src/lib/css/fonts.css';
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
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
    font-family: 'Noto Sans', sans-serif;
    transition: background-color 2s, color 2s;
  }
}
\`\`\`

## 4. vite.config.ts
\`\`\`typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import path from 'path';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/my-react-app',
  server: {
    port: 4203,
    host: 'localhost',
  },
  preview: {
    port: 4203,
    host: 'localhost',
  },
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
    outDir: '../../dist/apps/my-react-app',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
}));
\`\`\`

## 5. Example AG Grid Component
\`\`\`tsx
import { useRef, useEffect } from 'react';
import { MacroReactGrid, MacroReactGridRef } from '@macro/macro-react-grid';
import { ColDef, GetRowIdParams } from 'ag-grid-community';

const columns: ColDef[] = [
  { field: 'id', headerName: 'ID' },
  { field: 'name', headerName: 'Name' },
  { field: 'value', headerName: 'Value' },
];

export function MyGridComponent() {
  const gridRef = useRef<MacroReactGridRef>(null);

  useEffect(() => {
    // Push updates via gridRef.current?.updateRows$.next([...rows])
  }, []);

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

export default MyGridComponent;
\`\`\`
`;

export function registerReactTemplate(server: McpServer): void {
  server.resource('react-template', 'macro://templates/react', { mimeType: 'text/markdown' }, async () => ({
    contents: [
      {
        uri: 'macro://templates/react',
        text: REACT_TEMPLATE_DOC,
        mimeType: 'text/markdown',
      },
    ],
  }));
}
