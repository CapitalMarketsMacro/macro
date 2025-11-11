import { useEffect, useMemo, useState } from 'react';
import { Logger, LogLevel } from '@macro/logger';
import { MacroReactGrid } from '@macro/macro-react-grid';
import { ColDef } from 'ag-grid-community';

const logger = Logger.getLogger('ReactApp');

export function App() {
  // Theme state
  const [isDark, setIsDark] = useState(() => {
    // Check if user has a preference stored
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme');
      if (stored) {
        return stored === 'dark';
      }
      // Check system preference
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  // Toggle theme function
  const toggleTheme = () => {
    setIsDark((prev) => !prev);
  };

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

  // Example: Columns as JSON string
  const columnsJson = useMemo(
    () =>
      JSON.stringify([
        { field: 'id', headerName: 'ID', width: 100 },
        { field: 'name', headerName: 'Name', width: 200 },
        { field: 'age', headerName: 'Age', width: 100 },
        { field: 'email', headerName: 'Email', width: 250 },
      ]),
    []
  );

  // Example: Columns as array (alternative approach)
  const columnsArray: ColDef[] = useMemo(
    () => [
      { field: 'id', headerName: 'ID', width: 100 },
      { field: 'name', headerName: 'Name', width: 200 },
      { field: 'age', headerName: 'Age', width: 100 },
      { field: 'email', headerName: 'Email', width: 250 },
    ],
    []
  );

  // Example: Row data
  const rowData = useMemo(
    () => [
      { id: 1, name: 'John Doe', age: 30, email: 'john.doe@example.com' },
      { id: 2, name: 'Jane Smith', age: 25, email: 'jane.smith@example.com' },
      { id: 3, name: 'Bob Johnson', age: 35, email: 'bob.johnson@example.com' },
      { id: 4, name: 'Alice Williams', age: 28, email: 'alice.williams@example.com' },
    ],
    []
  );

  return (
    <>
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h1 className="text-2xl font-bold">Hello MACRO React</h1>
        <button
          onClick={toggleTheme}
          className="px-4 py-2 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors flex items-center gap-2"
          aria-label="Toggle theme"
        >
          {isDark ? (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2" />
                <path d="M12 20v2" />
                <path d="m4.93 4.93 1.41 1.41" />
                <path d="m17.66 17.66 1.41 1.41" />
                <path d="M2 12h2" />
                <path d="M20 12h2" />
                <path d="m6.34 17.66-1.41 1.41" />
                <path d="m19.07 4.93-1.41 1.41" />
              </svg>
              <span>Light</span>
            </>
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
              </svg>
              <span>Dark</span>
            </>
          )}
        </button>
      </div>
      <div className="p-4">
        <div style={{ height: '400px', width: '100%' }}>
          <MacroReactGrid columns={columnsJson} rowData={rowData} />
        </div>
      </div>
    </>
  );
}

export default App;
