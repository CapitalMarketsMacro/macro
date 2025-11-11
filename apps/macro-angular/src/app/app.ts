import { Component, OnInit } from '@angular/core';
import { Logger, LogLevel } from '@macro/logger';
import { MacroAngularGrid } from '@macro/macro-angular-grid';
import { ColDef } from 'ag-grid-community';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  standalone: true,
  imports: [MacroAngularGrid],
})
export class App implements OnInit {
  private logger = Logger.getLogger('AngularApp');

  // Example: Columns as JSON string
  public columnsJson: string = JSON.stringify([
    { field: 'id', headerName: 'ID', width: 100 },
    { field: 'name', headerName: 'Name', width: 200 },
    { field: 'age', headerName: 'Age', width: 100 },
    { field: 'email', headerName: 'Email', width: 250 },
  ]);

  // Example: Columns as array (alternative approach)
  public columnsArray: ColDef[] = [
    { field: 'id', headerName: 'ID', width: 100 },
    { field: 'name', headerName: 'Name', width: 200 },
    { field: 'age', headerName: 'Age', width: 100 },
    { field: 'email', headerName: 'Email', width: 250 },
  ];

  // Example: Row data
  public rowData = [
    { id: 1, name: 'John Doe', age: 30, email: 'john.doe@example.com' },
    { id: 2, name: 'Jane Smith', age: 25, email: 'jane.smith@example.com' },
    { id: 3, name: 'Bob Johnson', age: 35, email: 'bob.johnson@example.com' },
    { id: 4, name: 'Alice Williams', age: 28, email: 'alice.williams@example.com' },
  ];

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
