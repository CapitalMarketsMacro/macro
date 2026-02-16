import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Logger, LogLevel } from '@macro/logger';
import { Menubar, MenubarMenu, MenubarTrigger } from '@/components/ui/menubar';
import { getInitialIsDark, applyDarkMode, onSystemThemeChange } from '@macro/macro-design';
import TreasuryMarketDataComponent from './treasury-market-data/treasury-market-data.component';
import CommoditiesDashboardComponent from './commodities-dashboard/commodities-dashboard.component';

const logger = Logger.getLogger('ReactApp');

export function App() {
  useEffect(() => {
    // Example: Set global log level
    Logger.setGlobalLevel(LogLevel.DEBUG);
    logger.info('Global log level set', { level: Logger.getGlobalLevel() });

    // Example: Set log level for this specific logger
    logger.setLevel(LogLevel.DEBUG);
    logger.info('Logger level set', { level: logger.getLevel() });

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

  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(getInitialIsDark);

  useEffect(() => {
    applyDarkMode(isDark);
  }, [isDark]);

  useEffect(() => {
    return onSystemThemeChange((dark) => setIsDark(dark));
  }, []);

  const toggleTheme = () => {
    setIsDark((prev) => !prev);
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <Menubar>
          <MenubarMenu>
            <MenubarTrigger
              onClick={() => navigate('/treasury-market-data')}
              className={location.pathname === '/treasury-market-data' ? 'bg-accent' : ''}
            >
              Treasury Market Data
            </MenubarTrigger>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger
              onClick={() => navigate('/commodities-dashboard')}
              className={location.pathname === '/commodities-dashboard' ? 'bg-accent' : ''}
            >
              Commodities Dashboard
            </MenubarTrigger>
          </MenubarMenu>
        </Menubar>
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
        <div className="flex-1 p-4 overflow-auto">
          <Routes>
            <Route path="/treasury-market-data" element={<TreasuryMarketDataComponent />} />
            <Route path="/commodities-dashboard" element={<CommoditiesDashboardComponent />} />
            <Route path="/" element={<Navigate to="/treasury-market-data" replace />} />
          </Routes>
        </div>
      </div>
  );
}

export default App;
