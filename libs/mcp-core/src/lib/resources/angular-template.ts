import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const ANGULAR_TEMPLATE_DOC = `# Angular LOB App Template

Complete pattern for creating a new Angular LOB application in the Macro monorepo.

## 1. main.ts
\`\`\`typescript
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { Logger } from '@macro/logger';

const logger = Logger.getLogger('MyAppMain');

logger.info('My App starting');
bootstrapApplication(App, appConfig).catch((err) => logger.error('Bootstrap error', err));
\`\`\`

## 2. app.config.ts
\`\`\`typescript
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
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
    provideZonelessChangeDetection(),
    provideRouter(appRoutes),
    providePrimeNG({
      theme: {
        preset: Aura,
        options: {
          darkModeSelector: '.dark',
        },
      },
    }),
  ],
};
\`\`\`

## 3. app.routes.ts
\`\`\`typescript
import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: 'my-view',
    loadComponent: () => import('./my-view/my-view.component').then(m => m.MyViewComponent),
  },
  {
    path: '',
    redirectTo: '/my-view',
    pathMatch: 'full',
  },
];
\`\`\`

## 4. app.ts (Root Component)
Inject the shared \`ThemeService\` (\`@macro/macro-design/angular\`) — it starts the theme
controller and exposes \`isDark()\`/\`toggle()\` as signals. Uses an inline \`template\` so
there is no separate \`app.html\` to keep in sync (split it out if you prefer).
\`\`\`typescript
import { Component, OnInit, inject, signal } from '@angular/core';
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
        <p-menubar [model]="menuItems()" styleClass="border-none">
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
  private logger = Logger.getLogger('App');
  private router = inject(Router);
  // Shared macro ThemeService — default 'macro' theme; syncs system + OpenFin.
  protected readonly theme = inject(ThemeService);

  // Signal + fresh item objects per update: the router-events callback schedules no CD
  // under zoneless, and the OnPush menubar needs a new reference anyway.
  public menuItems = signal<MenuItem[]>([]);

  ngOnInit(): void {
    this.initializeMenuItems();
    this.logger.info('App initialized');
  }

  private initializeMenuItems(): void {
    this.menuItems.set([
      { label: 'My View', icon: 'pi pi-chart-line', routerLink: '/my-view' },
    ]);
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        const currentUrl = this.router.url;
        this.menuItems.update(items =>
          items.map(item =>
            item.routerLink
              ? { ...item, styleClass: currentUrl === item.routerLink ? 'active-menu-item' : '' }
              : item
          )
        );
      });
  }
}
\`\`\`

## 5. styles.css
\`\`\`css
/* Shared design tokens from @macro/macro-design (3-file chain, in order) */
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

## 6. project.json (key parts)
\`\`\`json
{
  "name": "my-angular-app",
  "projectType": "application",
  "targets": {
    "build": {
      "executor": "@angular/build:application",
      "options": {
        "outputPath": "dist/apps/my-angular-app",
        "browser": "apps/my-angular-app/src/main.ts",
        "polyfills": [],
        "tsConfig": "apps/my-angular-app/tsconfig.app.json",
        "styles": ["apps/my-angular-app/src/styles.css"]
      }
    },
    "serve": {
      "executor": "@angular/build:dev-server",
      "options": { "port": 4204 }
    }
  }
}
\`\`\`

## 7. Example AG Grid Component
\`\`\`typescript
import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { MacroAngularGrid } from '@macro/macro-angular-grid';
import { ColDef, GetRowIdParams } from 'ag-grid-community';

@Component({
  selector: 'app-my-grid',
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
export class MyGridComponent implements OnInit, OnDestroy {
  @ViewChild(MacroAngularGrid) grid!: MacroAngularGrid;

  columns: ColDef[] = [
    { field: 'id', headerName: 'ID' },
    { field: 'name', headerName: 'Name' },
    { field: 'value', headerName: 'Value' },
  ];

  rowData: unknown[] = [];

  getRowId = (params: GetRowIdParams) => params.data.id;

  ngOnInit(): void {
    // Push updates via grid.updateRows$.next([...rows])
  }

  ngOnDestroy(): void {
    // Cleanup subscriptions
  }
}
\`\`\`
`;

export function registerAngularTemplate(server: McpServer): void {
  server.resource('angular-template', 'macro://templates/angular', { mimeType: 'text/markdown' }, async () => ({
    contents: [
      {
        uri: 'macro://templates/angular',
        text: ANGULAR_TEMPLATE_DOC,
        mimeType: 'text/markdown',
      },
    ],
  }));
}
