import { Component, OnInit, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { Logger, LogLevel } from '@macro/logger';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import { Menubar } from 'primeng/menubar';
import { MenuItem } from 'primeng/api';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  standalone: true,
  imports: [RouterOutlet, Menubar],
})
export class App implements OnInit, OnDestroy {
  private logger = Logger.getLogger('AngularApp');
  
  // Inject dependencies
  private document = inject(DOCUMENT);
  private platformId = inject(PLATFORM_ID);
  private router = inject(Router);
  
  // Theme state
  public isDark = false;
  
  // Menu items for PrimeNG MenuBar
  public menuItems: MenuItem[] = [];
  private mediaQuery?: MediaQueryList;
  private mediaQueryListener?: (e: MediaQueryListEvent) => void;

  constructor() {
    // Initialize theme state
    if (isPlatformBrowser(this.platformId)) {
      const stored = localStorage.getItem('theme');
      if (stored) {
        this.isDark = stored === 'dark';
      } else {
        // Check system preference
        this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        this.isDark = this.mediaQuery.matches;
        
        // Listen for system theme changes
        this.mediaQueryListener = (e: MediaQueryListEvent) => {
          if (!localStorage.getItem('theme')) {
            this.isDark = e.matches;
            this.applyTheme();
          }
        };
        this.mediaQuery.addEventListener('change', this.mediaQueryListener);
      }
    }
  }

  ngOnInit(): void {
    // Apply initial theme
    this.applyTheme();
    
    // Initialize menu items
    this.initializeMenuItems();
    
    // Set log level
    Logger.setGlobalLevel(LogLevel.DEBUG);
    console.log('Global log level set to:', Logger.getGlobalLevel());

    // Example: Set log level for this specific logger
    this.logger.setLevel(LogLevel.DEBUG);
    console.log('Logger level:', this.logger.getLevel());

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

  ngOnDestroy(): void {
    // Clean up media query listener
    if (this.mediaQuery && this.mediaQueryListener) {
      this.mediaQuery.removeEventListener('change', this.mediaQueryListener);
    }
  }

  /**
   * Toggle theme between light and dark
   */
  toggleTheme(): void {
    this.isDark = !this.isDark;
    this.applyTheme();
  }

  /**
   * Apply theme to document root
   */
  private applyTheme(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const root = this.document.documentElement;
    if (this.isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }

  /**
   * Initialize menu items for PrimeNG MenuBar
   */
  private initializeMenuItems(): void {
    this.menuItems = [
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
    ];
    
    // Subscribe to route changes to update active menu item
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
