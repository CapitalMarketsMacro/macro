import { useEffect } from 'react';
import { Logger, LogLevel } from '@macro/logger';

const logger = Logger.getLogger('ReactApp');

export function App() {
  useEffect(() => {
    // Example: Set global log level
    Logger.setGlobalLevel(LogLevel.DEBUG);
    console.log('Global log level set to:', Logger.getGlobalLevel());

    // Example: Set log level for this specific logger
    logger.setLevel(LogLevel.DEBUG);
    console.log('Logger level:', logger.getLevel());

    // Simple log message
    logger.info('React app initialized');

    // Log with JSON object (pretty printed)
    logger.info('User session started', {
      sessionId: 'sess_abc123',
      userId: 67890,
      userRole: 'admin',
      permissions: ['read', 'write', 'delete'],
      metadata: {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        loginTime: new Date().toISOString(),
      },
    });

    // Log error with error details
    logger.error('API request failed', {
      error: 'Unauthorized',
      statusCode: 401,
      endpoint: '/api/protected',
      retryCount: 3,
      lastAttempt: new Date().toISOString(),
    });

    // Log warning with configuration
    logger.warn('Feature flag enabled', {
      feature: 'newDashboard',
      enabled: true,
      rolloutPercentage: 50,
      affectedUsers: ['user1', 'user2', 'user3'],
    });

    // Debug log with complex nested structure
    logger.debug('Component render data', {
      component: 'App',
      props: {
        title: 'Hello World',
        count: 42,
      },
      state: {
        isLoading: false,
        hasError: false,
        data: {
          items: ['item1', 'item2', 'item3'],
          pagination: {
            currentPage: 1,
            totalPages: 10,
            itemsPerPage: 20,
          },
        },
      },
    });
  }, []);

  return <h1>Hello World</h1>;
}

export default App;
