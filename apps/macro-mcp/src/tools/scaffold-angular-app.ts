import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const FEATURES = ['ag-grid', 'ag-charts', 'amps', 'solace', 'openfin', 'conflation'] as const;

function generateAngularScaffold(appName: string, description: string, port: number, features: string[]): string {
  const hasGrid = features.includes('ag-grid');
  const hasCharts = features.includes('ag-charts');
  const hasAmps = features.includes('amps');
  const hasSolace = features.includes('solace');
  const hasOpenfin = features.includes('openfin');
  const hasConflation = features.includes('conflation');

  let output = `# Scaffold Angular App: ${appName}

## Step 1: Generate the app
\`\`\`bash
npx nx g @nx/angular:app ${appName} --style=css --routing --standalone --port=${port}
\`\`\`

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
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full',
  },
];
\`\`\`

## Step 5: Create \`apps/${appName}/src/app/app.ts\`
\`\`\`typescript
import { Component, OnInit, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { Logger } from '@macro/logger';
import { isPlatformBrowser } from '@angular/common';
import { Menubar } from 'primeng/menubar';
import { MenuItem } from 'primeng/api';
import { filter } from 'rxjs/operators';
import { getInitialIsDark, applyDarkMode, onSystemThemeChange } from '@macro/macro-design';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  standalone: true,
  imports: [RouterOutlet, Menubar],
})
export class App implements OnInit, OnDestroy {
  private logger = Logger.getLogger('${appName}');
  private platformId = inject(PLATFORM_ID);
  private router = inject(Router);

  public isDark = false;
  public menuItems: MenuItem[] = [];
  private cleanupSystemListener?: () => void;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.isDark = getInitialIsDark();
      this.cleanupSystemListener = onSystemThemeChange((isDark) => {
        this.isDark = isDark;
        this.applyTheme();
      });
    }
  }

  ngOnInit(): void {
    this.applyTheme();
    this.initializeMenuItems();
    this.logger.info('${appName} initialized');
  }

  ngOnDestroy(): void {
    this.cleanupSystemListener?.();
  }

  toggleTheme(): void {
    this.isDark = !this.isDark;
    this.applyTheme();
  }

  private applyTheme(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    applyDarkMode(this.isDark);
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
    <lib-macro-angular-grid
      [columns]="columns"
      [rowData]="rowData"
      [getRowId]="getRowId"
    />
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
  grid.updateRows$.next([value]);
});` : `observable.subscribe(msg => {
  grid.updateRows$.next([msg.data]);
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
  grid.updateRows$.next([value]);
});` : `observable.subscribe(msg => {
  grid.updateRows$.next([JSON.parse(msg.getBinaryAttachment() as string)]);
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
  "tags": ["view", "angular"]
}
\`\`\`
`;
  }

  return output;
}

export function registerScaffoldAngularApp(server: McpServer): void {
  server.tool(
    'scaffold_angular_app',
    'Generate boilerplate code and NX commands for a new Angular LOB application in the Macro monorepo',
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
          text: generateAngularScaffold(appName, description, port ?? 4203, features ?? []),
        },
      ],
    })
  );
}
