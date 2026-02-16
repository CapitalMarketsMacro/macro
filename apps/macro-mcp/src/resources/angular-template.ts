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
  private logger = Logger.getLogger('App');
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
    this.logger.info('App initialized');
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
      { label: 'My View', icon: 'pi pi-chart-line', routerLink: '/my-view' },
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

## 5. styles.css
\`\`\`css
/* Shared design tokens from @macro/macro-design */
@import '../../../libs/macro-design/src/lib/css/fonts.css';
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
        "polyfills": ["zone.js"],
        "tsConfig": "apps/my-angular-app/tsconfig.app.json",
        "styles": ["apps/my-angular-app/src/styles.css"]
      }
    },
    "serve": {
      "executor": "@angular/build:dev-server",
      "options": { "port": 4203 }
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
