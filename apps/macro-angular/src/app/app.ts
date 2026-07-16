import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { Logger, LogLevel } from '@macro/logger';
import { Menubar } from 'primeng/menubar';
import { MenuItem } from 'primeng/api';
import { filter } from 'rxjs/operators';
import { ThemeService } from '@macro/macro-design/angular';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [RouterOutlet, Menubar],
})
export class App implements OnInit {
  private logger = Logger.getLogger('AngularApp');

  // Inject dependencies
  private router = inject(Router);
  // Shared macro ThemeService (default 'macro' theme; syncs system + OpenFin).
  protected readonly theme = inject(ThemeService);

  // Menu items for PrimeNG MenuBar. Signal + fresh item objects per update: the router-events
  // callback schedules no CD under zoneless, and the OnPush menubar needs a new reference anyway.
  public menuItems = signal<MenuItem[]>([]);

  /** Current dark-mode state from the shared macro ThemeService. */
  get isDark(): boolean {
    return this.theme.isDark();
  }

  ngOnInit(): void {
    // Initialize menu items
    this.initializeMenuItems();
    
    // Set log level
    Logger.setGlobalLevel(LogLevel.DEBUG);
    this.logger.info('Global log level set', { level: Logger.getGlobalLevel() });

    // Example: Set log level for this specific logger
    this.logger.setLevel(LogLevel.DEBUG);
    this.logger.info('Logger level set', { level: this.logger.getLevel() });

    const testData = {
      name: 'John Doe',
      age: 30,
      address: {
        street: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zip: '12345',
      },
    }

    this.logger.info('Console ', 'Good Stuff');
    this.logger.info('Test Data ', testData);

    // Debug log with complex nested structure
    this.logger.debug('Component DEBUG state', {
      component: 'AppComponent',
      state: {
        isLoading: false,
        data: {
          items: [1, 2, 3],
          metadata: {
            total: 100,
            page: 1,
            pageSize: 10,
          },
        },
      },
    });

    // Simple log message
    this.logger.info('Angular app initialized');

    // Log with JSON object (pretty printed)
    this.logger.info('User data loaded', {
      userId: 12345,
      username: 'john.doe',
      email: 'john.doe@example.com',
      preferences: {
        theme: 'dark',
        language: 'en',
        notifications: true,
      },
    });

    // Log error with error details
    this.logger.error('Failed to fetch data', {
      error: 'Network timeout',
      statusCode: 500,
      endpoint: '/api/users',
      timestamp: new Date().toISOString(),
    });

    // Log warning with nested object
    this.logger.warn('Deprecated API usage', {
      oldApi: '/api/v1/users',
      newApi: '/api/v2/users',
      migrationGuide: 'https://docs.example.com/migration',
    });
  }

  /**
   * Toggle theme between light and dark (delegates to the shared ThemeService).
   */
  toggleTheme(): void {
    this.theme.toggle();
  }

  /**
   * Initialize menu items for PrimeNG MenuBar
   */
  private initializeMenuItems(): void {
    this.menuItems.set([
      {
        label: 'FX Market Data',
        icon: 'pi pi-chart-line',
        routerLink: '/fx-market-data',
      },
      {
        label: 'Treasury Microstructure',
        icon: 'pi pi-chart-bar',
        routerLink: '/treasury-microstructure',
      },
      {
        label: 'Risk / PnL',
        icon: 'pi pi-chart-pie',
        routerLink: '/risk-pnl',
      },
    ]);
    
    // Subscribe to route changes to update active menu item
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        const currentUrl = this.router.url;
        this.menuItems.update((items) =>
          items.map((item) =>
            item.routerLink
              ? { ...item, styleClass: currentUrl === item.routerLink ? 'active-menu-item' : '' }
              : item
          )
        );
      });
  }
}
