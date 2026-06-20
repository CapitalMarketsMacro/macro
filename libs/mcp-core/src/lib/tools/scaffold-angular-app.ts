import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const FEATURES = ['ag-grid', 'ag-charts', 'amps', 'solace', 'nats', 'openfin', 'conflation'] as const;

function generateAngularScaffold(appName: string, description: string, port: number, features: string[]): string {
  const hasGrid = features.includes('ag-grid');
  const hasAmps = features.includes('amps');
  const hasSolace = features.includes('solace');
  const hasNats = features.includes('nats');
  const hasOpenfin = features.includes('openfin');
  const hasConflation = features.includes('conflation');

  let output = `# Scaffold Angular App: ${appName}

> Mirrors the current \`apps/macro-angular\` app: Angular 21 (zoneful), standalone
> components, PrimeNG (Aura), and the \`@macro/macro-design\` theme system via
> \`ThemeService\` (default theme \`macro\`).

## Step 1: Generate the app
\`\`\`bash
# nx 22.7: the first positional is the project directory (apps/<name>),
# otherwise the app lands in the repo root. --name keeps the project name clean.
npx nx g @nx/angular:app apps/${appName} --name=${appName} --style=css --routing --standalone
\`\`\`
Then set the dev port in \`apps/${appName}/project.json\` (the \`serve\` target's
\`options.port\`) to \`${port}\` — ports 4200–4203 are already taken by existing apps.

## Step 2: Create \`apps/${appName}/src/main.ts\`
\`\`\`typescript
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { Logger } from '@macro/logger';

const logger = Logger.getLogger('${appName}');
logger.info('${description}');
bootstrapApplication(App, appConfig).catch((err) => logger.error('Bootstrap error', err));
\`\`\`

## Step 3: Create \`apps/${appName}/src/app/app.config.ts\`
\`\`\`typescript
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import { appRoutes } from './app.routes';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAnimationsAsync(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes),
    providePrimeNG({
      theme: {
        preset: Aura,
        options: { darkModeSelector: '.dark' },
      },
    }),
  ],
};
\`\`\`

## Step 4: Create \`apps/${appName}/src/app/app.routes.ts\`
\`\`\`typescript
import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  // { path: 'dashboard', loadComponent: () => import('./dashboard/dashboard').then(m => m.Dashboard) },
];
\`\`\`

## Step 5: Create \`apps/${appName}/src/app/app.ts\`
Inject the shared \`ThemeService\` (from \`@macro/macro-design/angular\`). It starts the
theme controller automatically and exposes state as signals — no \`PLATFORM_ID\`
boilerplate, no manual listeners. (Uses an inline \`template\` so there is no separate
\`app.html\` to keep in sync; split it out if you prefer.)
\`\`\`typescript
import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { Logger } from '@macro/logger';
import { Menubar } from 'primeng/menubar';
import { MenuItem } from 'primeng/api';
import { filter } from 'rxjs/operators';
import { ThemeService } from '@macro/macro-design/angular';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Menubar],
  template: \\\`
    <div style="display: flex; flex-direction: column; height: 100vh;">
      <div style="border-bottom: 1px solid var(--border);">
        <p-menubar [model]="menuItems" styleClass="border-none">
          <ng-template #end>
            <button (click)="theme.toggle()" [attr.aria-label]="'Toggle theme'"
              style="padding: 0.5rem 1rem; border-radius: 0.375rem; background-color: var(--secondary); color: var(--secondary-foreground); border: none; cursor: pointer;">
              {{ theme.isDark() ? 'Light' : 'Dark' }}
            </button>
          </ng-template>
        </p-menubar>
      </div>
      <div style="flex: 1; min-height: 0; padding: 1rem;">
        <router-outlet></router-outlet>
      </div>
    </div>
  \\\`,
})
export class App implements OnInit {
  private logger = Logger.getLogger('${appName}');
  private router = inject(Router);
  // Shared macro ThemeService — default 'macro' theme; syncs system + OpenFin.
  protected readonly theme = inject(ThemeService);

  public menuItems: MenuItem[] = [];

  ngOnInit(): void {
    this.initializeMenuItems();
    this.logger.info('${appName} initialized');
  }

  private initializeMenuItems(): void {
    this.menuItems = [
      { label: 'Dashboard', icon: 'pi pi-home', routerLink: '/dashboard' },
    ];
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        const currentUrl = this.router.url;
        this.menuItems.forEach(item => {
          if (item.routerLink) {
            item.styleClass = currentUrl === item.routerLink ? 'active-menu-item' : '';
          }
        });
      });
  }
}
\`\`\`

## Step 6: Create \`apps/${appName}/src/styles.css\`
Import the 3-file \`@macro/macro-design\` CSS chain (in this order) before any other CSS.
\`\`\`css
/* Shared design tokens from @macro/macro-design */
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
`;

  if (hasGrid) {
    output += `
## AG Grid Component Wiring
\`\`\`typescript
import { Component, ViewChild } from '@angular/core';
import { MacroAngularGrid } from '@macro/macro-angular-grid';
import { ColDef, GetRowIdParams } from 'ag-grid-community';

@Component({
  selector: 'app-data-grid',
  standalone: true,
  imports: [MacroAngularGrid],
  template: \\\`
    <lib-macro-angular-grid [columns]="columns" [rowData]="rowData" [getRowId]="getRowId" />
  \\\`,
  styles: [':host { display: block; height: 600px; }'],
})
export class DataGridComponent {
  @ViewChild(MacroAngularGrid) grid!: MacroAngularGrid;

  columns: ColDef[] = [
    { field: 'id', headerName: 'ID' },
    // Add your columns here
  ];
  rowData: unknown[] = [];
  getRowId = (params: GetRowIdParams) => params.data.id;
}
\`\`\`
> \`MacroAngularGrid\` applies \`buildAgGridTheme(isDark)\` automatically (watches the
> \`.dark\` class) — no theme wiring needed.
`;
  }

  if (hasAmps) {
    output += `
## AMPS Integration (\`@macro/transports\`)
\`connect()\` takes an \`AmpsConnectionOptions\` object (\`{ url }\`). Messages are unified
\`TransportMessage\`s — use \`msg.json()\` to parse, \`msg.data\` for the raw string. For
Angular DI, inject \`AmpsTransportService\` from \`@macro/transports/angular\` instead.
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
  grid.updateRows$.next([value]);
});` : `observable.subscribe(msg => {
  grid.updateRows$.next([msg.json<YourDataType>()]);
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
  grid.updateRows$.next([value]);
});` : `observable.subscribe(msg => {
  grid.updateRows$.next([msg.json<YourDataType>()]);
});`}
\`\`\`
`;
  }

  if (hasNats) {
    output += `
## NATS Integration (\`@macro/transports\`)
\`\`\`typescript
import { NatsClient } from '@macro/transports';

const natsClient = new NatsClient('${appName}');
await natsClient.connect({ servers: 'ws://localhost:8224' });

const { observable } = await natsClient.subscribeAsObservable('prices.>');
observable.subscribe(msg => {
  grid.updateRows$.next([msg.json<YourDataType>()]);
});
\`\`\`
> For Angular DI, inject \`NatsTransportService\` from \`@macro/transports/angular\`.
`;
  }

  if (hasOpenfin) {
    output += `
## OpenFin Registration
Use the \`register_openfin_app\` MCP tool to wire this app into the workspace — it
writes the local + openshift view manifests, registers the app in both
\`manifest.fin.json\` files and \`settings.json\`, and adds a Dock favorite:
\`\`\`
register_openfin_app({ appId: '${appName}', title: '${description}', url: 'http://localhost:${port}', framework: 'angular' })
\`\`\`
Manifests live under \`apps/macro-workspace/public/local/\` and \`.../public/openshift/\`
(not a flat root path). Each view manifest sets FDC3 2.0 with
\`interop.currentContextGroup: 'green'\`.
`;
  }

  return output;
}

export function registerScaffoldAngularApp(server: McpServer): void {
  server.tool(
    'scaffold_angular_app',
    'Generate boilerplate code and NX commands for a new Angular LOB application in the Macro monorepo, matching the current macro-angular app + @macro/macro-design theme system',
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
          text: generateAngularScaffold(appName, description, port ?? 4204, features ?? []),
        },
      ],
    })
  );
}
