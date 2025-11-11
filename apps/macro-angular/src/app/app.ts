import { Component, OnInit } from '@angular/core';
import { Logger, LogLevel } from '@macro/logger';
import { MacroAngularGrid } from '@macro/macro-angular-grid';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  standalone: true,
  imports: [MacroAngularGrid],
})
export class App implements OnInit {
  private logger = Logger.getLogger('AngularApp');

  ngOnInit(): void {
    // Example: Set global log level
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
}
