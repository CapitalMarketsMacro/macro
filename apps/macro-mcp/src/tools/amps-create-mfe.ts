import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { findWorkspaceRoot, addAppToJsonFile, addDockFavorite, toHeaderName } from './mcp-utils.js';
import { exploreAmps, type AmpsSchemaField } from './amps-explore.js';

// ── Column Generation ──

function generateColDefs(schema: AmpsSchemaField[]): string {
  const lines: string[] = [];
  for (let i = 0; i < schema.length; i++) {
    const f = schema[i];
    if (f.type === 'object' || f.type === 'array') continue;
    const parts: string[] = [];
    parts.push(`      field: '${f.field}'`);
    parts.push(`      headerName: '${toHeaderName(f.field)}'`);

    if (i === 0 && f.type === 'string') parts.push(`      pinned: 'left' as const`);
    if (f.type === 'number') {
      parts.push(`      type: 'numericColumn'`);
      parts.push(`      cellStyle: { textAlign: 'right' }`);
      parts.push(`      allowFormula: true`);
      if (f.field.toLowerCase().includes('change')) {
        parts.push(`      valueFormatter: (p: any) => p.value != null ? \`\${p.value >= 0 ? '+' : ''}\${p.value.toFixed(${f.decimals})}\` : ''`);
        parts.push(`      cellStyle: (p: any) => ({ textAlign: 'right', color: p.value > 0 ? '#10b981' : p.value < 0 ? '#ef4444' : 'inherit' })`);
        parts.push(`      sortingOrder: [{ direction: 'desc', type: 'absolute' }, { direction: 'asc', type: 'absolute' }, null] as any`);
      } else if (f.decimals > 0) {
        parts.push(`      valueFormatter: (p: any) => p.value != null ? p.value.toFixed(${f.decimals}) : ''`);
      } else {
        parts.push(`      valueFormatter: (p: any) => p.value != null ? p.value.toLocaleString() : ''`);
      }
    }
    lines.push(`    {\n${parts.join(',\n')},\n    }`);
  }
  return `[\n${lines.join(',\n')}\n  ]`;
}

function getKeyFields(compositeKey: string | null, detectedKeys: string[]): string[] {
  if (compositeKey) return compositeKey.replace(/^\//,'').split('+').map(k => k.replace(/^\//,''));
  if (detectedKeys.length > 0) return [detectedKeys[0]];
  return [];
}

function generateGetRowIdFn(keys: string[]): string {
  if (keys.length === 0) return `(params: any) => String(params.node?.rowIndex ?? Math.random())`;
  if (keys.length === 1) return `(params: any) => String(params.data?.${keys[0]} ?? '')`;
  return `(params: any) => [${keys.map(k => `params.data?.${k}`).join(', ')}].join('-')`;
}

function generateKeyExpr(keys: string[]): string {
  if (keys.length === 0) return `String(Math.random())`;
  if (keys.length === 1) return `String(data.${keys[0]} ?? '')`;
  return `[${keys.map(k => `data.${k}`).join(', ')}].join('-')`;
}

function generateInterface(schema: AmpsSchemaField[]): string {
  return schema
    .filter(f => f.type !== 'object' && f.type !== 'array')
    .map(f => `  ${f.field}${f.nullable ? '?' : ''}: ${f.type === 'number' ? 'number' : f.type === 'boolean' ? 'boolean' : 'string'};`)
    .join('\n');
}

// ── Angular Code Generator ──

function generateAngularFiles(
  appName: string, topic: string, ampsUrl: string,
  schema: AmpsSchemaField[], keys: string[], conflationMs: number, filter?: string,
): Record<string, string> {
  const colDefs = generateColDefs(schema);
  const getRowId = generateGetRowIdFn(keys);
  const keyExpr = generateKeyExpr(keys);
  const iface = generateInterface(schema);
  const className = appName.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('') + 'Component';

  const componentTs = `import { Component, OnInit, OnDestroy, ViewChild, signal, inject } from '@angular/core';
import { MacroAngularGrid } from '@macro/macro-angular-grid';
import { AmpsTransportService } from '@macro/transports/angular';
import { ConflationSubject } from '@macro/rxutils';
import { Logger } from '@macro/logger';
import type { TransportMessage } from '@macro/transports';
import type { ColDef } from 'ag-grid-community';

const logger = Logger.getLogger('${className}');

interface DataRow {
${iface}
  _rowId: string;
}

@Component({
  selector: 'app-${appName}',
  standalone: true,
  imports: [MacroAngularGrid],
  templateUrl: './${appName}.component.html',
  styleUrl: './${appName}.component.css',
})
export class ${className} implements OnInit, OnDestroy {
  private transport = inject(AmpsTransportService);
  @ViewChild(MacroAngularGrid) grid!: MacroAngularGrid;

  readonly connected = signal(false);
  readonly messageCount = signal(0);
  readonly error = signal<string | null>(null);

  readonly ampsUrl = '${ampsUrl}';
  readonly topic = '${topic}';

  columns: ColDef[] = ${colDefs};

  getRowId = (params: any) => params.data?._rowId ?? '';

  gridOptions = {
    pagination: false,
    animateRows: false,
  };

  rowData: DataRow[] = [];

  private subscriptionId: string | null = null;
  private conflation: ConflationSubject<string, DataRow> | null = null;
  private batchBuffer: DataRow[] = [];
  private batchTimer: any = null;

  async ngOnInit(): Promise<void> {
    await this.connectToAmps();
  }

  async connectToAmps(): Promise<void> {
    try {
      this.error.set(null);
      await this.transport.connect({ url: this.ampsUrl });
      this.connected.set(true);
      logger.info('Connected to AMPS', { url: this.ampsUrl });

      // Set up conflation
      this.conflation = new ConflationSubject<string, DataRow>(${conflationMs});
      this.conflation.subscribeToConflated((item) => {
        this.batchBuffer.push(item.value);
      });

      // Flush batched updates to grid
      this.batchTimer = setInterval(() => {
        if (this.batchBuffer.length > 0) {
          this.grid?.updateRows$.next([...this.batchBuffer]);
          this.batchBuffer = [];
        }
      }, ${conflationMs});

      // SOW + Subscribe (atomic): initial snapshot then live updates
      // The transport handles group_begin/group_end internally
      const { observable, subscriptionId, sowComplete } = await this.transport.sowAndSubscribe(
        this.topic, ${filter ? `'${filter}'` : 'undefined'},
      );
      this.subscriptionId = subscriptionId;

      const sowRows: DataRow[] = [];
      let sowDone = false;

      observable.subscribe({
        next: (msg: TransportMessage) => {
          try {
            const data = msg.json<any>();
            if (!data) return;
            const row: DataRow = { ...data, _rowId: ${keyExpr.replace(/\bdata\./g, 'data.')} };

            if (!sowDone) {
              sowRows.push(row);
            } else {
              this.conflation?.next({ key: row._rowId, value: row });
              this.messageCount.update(c => c + 1);
            }
          } catch (err) {
            logger.error('Parse error', err);
          }
        },
        error: (err: any) => {
          logger.error('Subscription error', err);
          this.error.set(String(err));
        },
      });

      // Wait for SOW to complete, then load initial data
      await sowComplete;
      sowDone = true;
      this.rowData = sowRows;
      if (this.grid) {
        this.grid.setInitialRowData(sowRows);
      }
      logger.info('SOW complete', { count: sowRows.length });

    } catch (err: any) {
      logger.error('Connection failed', err);
      this.error.set(err.message || String(err));
      this.connected.set(false);
    }
  }

  ngOnDestroy(): void {
    if (this.batchTimer) clearInterval(this.batchTimer);
    this.conflation?.complete();
    if (this.subscriptionId) this.transport.unsubscribe(this.subscriptionId);
    this.transport.disconnect();
  }
}
`;

  const componentHtml = `<div style="display: flex; flex-direction: column; height: 100vh; background: var(--background); color: var(--foreground); font-family: 'Noto Sans', sans-serif;">
  <div style="padding: 10px 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 12px;">
    <h1 style="font-size: 15px; font-weight: 600; margin: 0;">${topic}</h1>
    @if (connected()) {
      <span style="font-size: 10px; padding: 2px 8px; border-radius: 10px; background: rgba(16,185,129,0.15); color: #10b981;">Live</span>
    }
    <span style="font-size: 11px; color: var(--muted-foreground); margin-left: auto;">{{ messageCount() }} updates</span>
  </div>
  @if (error()) {
    <div style="padding: 8px 16px; background: rgba(239,68,68,0.1); color: #ef4444; font-size: 12px;">{{ error() }}</div>
  }
  <div style="flex: 1;">
    <lib-macro-angular-grid
      [columns]="columns"
      [rowData]="rowData"
      [getRowId]="getRowId"
      [gridOptions]="gridOptions">
    </lib-macro-angular-grid>
  </div>
</div>
`;

  const componentCss = '';

  const appConfig = `import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes),
  ],
};
`;

  const appRoutes = `import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./${appName}/${appName}.component').then(m => m.${className}),
  },
  { path: '**', redirectTo: '' },
];
`;

  const appTs = `import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { applyDarkMode } from '@macro/macro-design';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet></router-outlet>',
})
export class App implements OnInit {
  ngOnInit() {
    applyDarkMode(true);
  }
}
`;

  const mainTs = `import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
`;

  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${topic}</title>
  <base href="/" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  <app-root></app-root>
</body>
</html>
`;

  const stylesCss = `@import '../../../libs/macro-design/src/lib/css/fonts.css';
@import '../../../libs/macro-design/src/lib/css/macro-design.css';
`;

  return {
    [`src/app/${appName}/${appName}.component.ts`]: componentTs,
    [`src/app/${appName}/${appName}.component.html`]: componentHtml,
    [`src/app/${appName}/${appName}.component.css`]: componentCss,
    [`src/app/app.config.ts`]: appConfig,
    [`src/app/app.routes.ts`]: appRoutes,
    [`src/app/app.ts`]: appTs,
    [`src/main.ts`]: mainTs,
    [`src/index.html`]: indexHtml,
    [`src/styles.css`]: stylesCss,
  };
}

// ── React Code Generator ──

function generateReactFiles(
  appName: string, topic: string, ampsUrl: string, basePath: string,
  schema: AmpsSchemaField[], keys: string[], conflationMs: number, filter?: string,
): Record<string, string> {
  const colDefs = generateColDefs(schema);
  const getRowId = generateGetRowIdFn(keys);
  const keyExpr = generateKeyExpr(keys);
  const iface = generateInterface(schema);

  const appTsx = `import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { MacroReactGrid, MacroReactGridRef } from '@macro/macro-react-grid';
import { applyDarkMode, onSystemThemeChange } from '@macro/macro-design';
import { AmpsTransport, type TransportMessage } from '@macro/transports';
import { ConflationSubject } from '@macro/rxutils';
import { Logger } from '@macro/logger';

const logger = Logger.getLogger('${appName}');

interface DataRow {
${iface}
  _rowId: string;
}

const AMPS_URL = '${ampsUrl}';
const TOPIC = '${topic}';
const FILTER = ${filter ? `'${filter}'` : 'undefined'};

function DataGrid() {
  const gridRef = useRef<MacroReactGridRef>(null);
  const [rowData, setRowData] = useState<DataRow[]>([]);
  const [connected, setConnected] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const ampsRef = useRef(new AmpsTransport('${appName}'));

  const columns = useMemo(() => ${colDefs}, []);
  const getRowId = useMemo(() => ${getRowId}, []);

  useEffect(() => {
    let mounted = true;
    const amps = ampsRef.current;
    const conflation = new ConflationSubject<string, DataRow>(${conflationMs});
    const batchBuffer: DataRow[] = [];

    conflation.subscribeToConflated((item) => { batchBuffer.push(item.value); });

    const batchTimer = setInterval(() => {
      if (batchBuffer.length > 0 && mounted) {
        gridRef.current?.updateRows$.next([...batchBuffer]);
        setMessageCount(c => c + batchBuffer.length);
        batchBuffer.length = 0;
      }
    }, ${conflationMs});

    (async () => {
      try {
        await amps.connect({ url: AMPS_URL });
        if (mounted) setConnected(true);
        logger.info('Connected to AMPS');

        const { observable, subscriptionId, sowComplete } = await amps.sowAndSubscribe(TOPIC, FILTER);

        const sowRows: DataRow[] = [];
        let sowDone = false;

        observable.subscribe({
          next: (msg: TransportMessage) => {
            if (!mounted) return;
            try {
              const data = msg.json<any>();
              if (!data) return;
              const row: DataRow = { ...data, _rowId: ${keyExpr.replace(/\bdata\./g, 'data.')} };
              if (!sowDone) {
                sowRows.push(row);
              } else {
                conflation.next({ key: row._rowId, value: row });
              }
            } catch {}
          },
          error: (err: any) => {
            if (mounted) setError(String(err));
          },
        });

        await sowComplete;
        sowDone = true;
        if (mounted) setRowData(sowRows);
        logger.info('SOW complete', { count: sowRows.length });
      } catch (err: any) {
        if (mounted) setError(err.message || String(err));
      }
    })();

    return () => {
      mounted = false;
      clearInterval(batchTimer);
      conflation.complete();
      amps.disconnect();
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--background)', color: 'var(--foreground)', fontFamily: "'Noto Sans', sans-serif" }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <h1 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>${topic}</h1>
        {connected && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>Live</span>}
        <span style={{ fontSize: 11, color: 'var(--muted-foreground)', marginLeft: 'auto' }}>{messageCount} updates</span>
      </div>
      {error && <div style={{ padding: '8px 16px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 12 }}>{error}</div>}
      <div style={{ flex: 1 }}>
        <MacroReactGrid ref={gridRef} columns={columns} rowData={rowData} getRowId={getRowId}
          gridOptions={{ pagination: false, animateRows: false }} />
      </div>
    </div>
  );
}

export function App() {
  const [isDark, setIsDark] = useState(true);
  useEffect(() => { applyDarkMode(isDark); }, [isDark]);
  useEffect(() => onSystemThemeChange((d) => setIsDark(d)), []);

  return (
    <BrowserRouter basename="${basePath}">
      <DataGrid />
    </BrowserRouter>
  );
}

export default App;
`;

  const mainTsx = `import * as ReactDOM from 'react-dom/client';
import App from './app/app';
import '../../../libs/macro-design/src/lib/css/fonts.css';
import '../../../libs/macro-design/src/lib/css/macro-design.css';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);
`;

  const viteConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import path from 'path';

export default defineConfig(() => ({
  root: __dirname,
  base: '${basePath}',
  server: { port: \${PORT}, host: 'localhost' },
  preview: { port: \${PORT}, host: 'localhost' },
  plugins: [react(), nxViteTsPaths()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@macro/logger': path.resolve(__dirname, '../../libs/logger/src/index.ts'),
      '@macro/macro-design': path.resolve(__dirname, '../../libs/macro-design/src/index.ts'),
      '@macro/macro-react-grid': path.resolve(__dirname, '../../libs/macro-react-grid/src/index.ts'),
      '@macro/transports': path.resolve(__dirname, '../../libs/transports/src/index.ts'),
      '@macro/transports/react': path.resolve(__dirname, '../../libs/transports/src/lib/react/index.ts'),
      '@macro/rxutils': path.resolve(__dirname, '../../libs/rxutils/src/index.ts'),
    },
  },
  build: {
    outDir: '../../dist/apps/${appName}',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: { transformMixedEsModules: true },
  },
}));
`;

  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><title>${topic}</title><base href="${basePath}" /></head>
<body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>
`;

  return {
    'src/app/app.tsx': appTsx,
    'src/main.tsx': mainTsx,
    'vite.config.ts': viteConfig,
    'index.html': indexHtml,
  };
}

// ── Main MFE Creator ──

async function createAmpsMfeAsync(
  ampsUrl: string, topic: string, framework: 'angular' | 'react',
  appName: string, title: string, port: number, description: string,
  filter: string | undefined, compositeKey: string | undefined, conflationMs: number,
  configUrl: string | undefined,
): Promise<{ success: boolean; summary: string; steps: string[] }> {
  const root = findWorkspaceRoot();
  const appDir = path.join(root, 'apps', appName);
  const publicLocal = path.join(root, 'apps/macro-workspace/public/local');
  const publicOpenshift = path.join(root, 'apps/macro-workspace/public/openshift');
  const basePath = `/${appName}/`;
  const steps: string[] = [];

  try {
    if (fs.existsSync(appDir)) {
      return { success: false, summary: `apps/${appName} already exists`, steps };
    }

    // ── Introspect AMPS ──
    steps.push('Connecting to AMPS to detect schema...');
    const explore = await exploreAmps(ampsUrl || '', topic, filter, configUrl, 20, 8000);

    // Use detected WebSocket URL if ampsUrl not provided
    const effectiveUrl = ampsUrl || explore.detectedWsUrl || '';
    if (!effectiveUrl) {
      return { success: false, summary: 'No AMPS WebSocket URL — provide ampsUrl or configUrl with a websocket transport', steps };
    }

    const schema = explore.schema;
    const keys = getKeyFields(compositeKey || explore.compositeKey, explore.detectedKeys);
    steps.push(`Schema: ${schema.length} fields, ${explore.messageCount} samples, keys: [${keys.join(', ')}]`);

    // ── Generate NX app ──
    const generator = framework === 'angular'
      ? `npx nx g @nx/angular:app ${appName} --directory=apps/${appName} --style=css --routing=true --e2eTestRunner=none --skipFormat`
      : `npx nx g @nx/react:app ${appName} --directory=apps/${appName} --style=css --bundler=vite --routing=false --e2eTestRunner=none --skipFormat`;

    try {
      execSync(generator, { cwd: root, stdio: 'pipe', timeout: 120000 });
      steps.push(`Generated NX ${framework} app`);
    } catch {
      fs.mkdirSync(path.join(appDir, 'src/app'), { recursive: true });
      steps.push('Created app structure manually');
    }

    // ── Generate code ──
    const files = framework === 'angular'
      ? generateAngularFiles(appName, topic, effectiveUrl, schema, keys, conflationMs, filter)
      : generateReactFiles(appName, topic, effectiveUrl, basePath, schema, keys, conflationMs, filter);

    for (const [relPath, content] of Object.entries(files)) {
      const fullPath = path.join(appDir, relPath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      const finalContent = content.replace(/\$\{PORT\}/g, String(port));
      fs.writeFileSync(fullPath, finalContent);
    }
    steps.push(`Generated ${framework} component with AMPS sowAndSubscribe + conflation + AG Grid`);

    // ── OpenFin registration ──
    const localView = { url: `http://localhost:${port}${framework === 'react' ? basePath : '/'}`, fdc3InteropApi: '2.0', interop: { currentContextGroup: 'green' } };
    const envVar = `OPENSHIFT_${appName.replace(/-/g, '_').toUpperCase()}_HOST`;
    const osView = { url: `https://{{${envVar}}}${framework === 'react' ? basePath : '/'}`, fdc3InteropApi: '2.0', interop: { currentContextGroup: 'green' } };

    fs.writeFileSync(path.join(publicLocal, `${appName}.fin.json`), JSON.stringify(localView, null, 2) + '\n');
    fs.writeFileSync(path.join(publicOpenshift, `${appName}.fin.json`), JSON.stringify(osView, null, 2) + '\n');

    const localEntry = {
      appId: appName, name: appName, title, description,
      manifest: `http://localhost:4202/local/${appName}.fin.json`, manifestType: 'view',
      icons: [{ src: 'http://localhost:4202/icons/platform.svg' }],
      contactEmail: 'contact@example.com', supportEmail: 'support@example.com',
      publisher: 'OpenFin', intents: [], images: [],
      tags: ['view', framework, 'amps', topic.split('/')[0]],
    };
    const osEntry = { ...localEntry,
      manifest: `https://{{OPENSHIFT_WORKSPACE_HOST}}/openshift/${appName}.fin.json`,
      icons: [{ src: 'https://{{OPENSHIFT_WORKSPACE_HOST}}/icons/platform.svg' }],
    };

    addAppToJsonFile(path.join(publicLocal, 'manifest.fin.json'), localEntry);
    addAppToJsonFile(path.join(publicLocal, 'settings.json'), localEntry);
    addAppToJsonFile(path.join(publicOpenshift, 'manifest.fin.json'), osEntry);
    addAppToJsonFile(path.join(publicOpenshift, 'settings.json'), osEntry);
    addDockFavorite(path.join(publicLocal, 'settings.json'), {
      type: 'item', id: `fav-${appName}`, label: title,
      icon: 'http://localhost:4202/icons/platform.svg', appId: appName,
    });
    steps.push('OpenFin registered (manifests + dock)');

    // ── package.json ──
    const pkgPath = path.join(root, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkg.scripts[`start:${appName}`] = `nx serve ${appName}`;
    pkg.scripts[`build:${appName}`] = `nx build ${appName}`;
    if (pkg.scripts['build:apps'] && !pkg.scripts['build:apps'].includes(appName)) {
      pkg.scripts['build:apps'] = pkg.scripts['build:apps'].replace(/--projects=([^\s]+)/, `--projects=$1,${appName}`);
    }
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    steps.push('Updated package.json scripts');

    const colCount = schema.filter(f => f.type !== 'object' && f.type !== 'array').length;
    return {
      success: true, steps,
      summary: `Created "${title}" (apps/${appName})

  AMPS:       ${effectiveUrl} -> ${topic}
  Framework:  ${framework}
  Port:       ${port}
  Columns:    ${colCount} auto-generated
  Key:        ${keys.join(' + ') || 'auto'}
  Conflation: ${conflationMs}ms
  Pattern:    sowAndSubscribe (SOW snapshot -> live updates)

To run:
  npm run start:${appName}
  npm run launch  (appears in OpenFin dock)`,
    };
  } catch (err: any) {
    return { success: false, summary: `Failed: ${err.message}`, steps };
  }
}

// ── MCP Registration ──

export function registerAmpsCreateMfe(server: McpServer): void {
  server.tool(
    'amps_create_mfe',
    'Create a complete Angular or React MFE that displays live AMPS data in AG Grid. Auto-connects to AMPS, detects schema, generates columns with proper formatting, wires sowAndSubscribe+conflation+grid, registers in OpenFin. One command.',
    {
      ampsUrl: z.string().optional().describe('AMPS WebSocket URL. If omitted, auto-detected from configUrl.'),
      topic: z.string().describe('AMPS topic (e.g., "rates/marketData")'),
      framework: z.enum(['angular', 'react']).describe('Target framework'),
      appName: z.string().describe('App name in kebab-case (e.g., "rates-blotter")'),
      title: z.string().describe('Display title for OpenFin'),
      port: z.number().describe('Dev server port (4204+)'),
      description: z.string().optional().describe('Short description'),
      filter: z.string().optional().describe('AMPS filter expression'),
      compositeKey: z.string().optional().describe('Composite key (e.g., "/MarketId+/Id")'),
      conflationMs: z.number().optional().describe('Conflation interval ms (default: 100)'),
      configUrl: z.string().optional().describe('AMPS config URL (e.g., "http://host:8085/amps/instance/config.xml")'),
    },
    async ({ ampsUrl, topic, framework, appName, title, port, description, filter, compositeKey, conflationMs, configUrl }) => {
      const result = await createAmpsMfeAsync(
        ampsUrl ?? '', topic, framework, appName, title, port,
        description ?? `${title} — live AMPS data from ${topic}`,
        filter, compositeKey, conflationMs ?? 100, configUrl,
      );
      const text = result.success
        ? `${result.summary}\n\nSteps:\n${result.steps.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}`
        : `ERROR: ${result.summary}\n\nSteps:\n${result.steps.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}`;
      return { content: [{ type: 'text' as const, text }] };
    }
  );
}
