import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock logger with trackable spy instances - use vi.hoisted to avoid TDZ
const { mockLoggerInstance, mockSetGlobalLevel, mockGetGlobalLevel } = vi.hoisted(() => ({
  mockLoggerInstance: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    setLevel: vi.fn(),
    getLevel: vi.fn(),
  },
  mockSetGlobalLevel: vi.fn(),
  mockGetGlobalLevel: vi.fn(),
}));

vi.mock('@macro/logger', () => ({
  Logger: {
    getLogger: () => mockLoggerInstance,
    setGlobalLevel: (...args: any[]) => mockSetGlobalLevel(...args),
    getGlobalLevel: () => mockGetGlobalLevel(),
  },
  LogLevel: { DEBUG: 'debug', INFO: 'info', WARN: 'warn', ERROR: 'error' },
}));

const { mockApplyDarkMode, mockOnSystemThemeChange, mockGetInitialIsDark } = vi.hoisted(() => ({
  mockApplyDarkMode: vi.fn(),
  mockOnSystemThemeChange: vi.fn(() => vi.fn()),
  mockGetInitialIsDark: vi.fn(() => false),
}));

vi.mock('@macro/macro-design', () => ({
  getInitialIsDark: () => mockGetInitialIsDark(),
  applyDarkMode: (isDark: boolean) => mockApplyDarkMode(isDark),
  onSystemThemeChange: (cb: (dark: boolean) => void) => mockOnSystemThemeChange(cb),
}));

vi.mock('@macro/macro-react-grid', () => ({
  MacroReactGrid: vi.fn(() => <div data-testid="macro-react-grid">Mock Grid</div>),
}));

vi.mock('@macro/openfin/react', () => ({
  useViewState: () => [
    { enableAutoSave: vi.fn(), disableAutoSave: vi.fn() },
    {},
    false,
  ],
  useNotifications: () => ({
    create: vi.fn(),
    register: vi.fn(),
    deregister: vi.fn(),
    observeNotificationActions: vi.fn(),
  }),
}));

vi.mock('ag-grid-community', () => ({
  GetRowIdParams: {},
  GridState: {},
}));

// Mock recharts for CommoditiesDashboard
vi.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div>{children}</div>,
  Line: () => <div />,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  AreaChart: ({ children }: any) => <div>{children}</div>,
  Area: () => <div />,
}));

import App, { AppContent } from './app';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

beforeEach(() => {
  mockApplyDarkMode.mockClear();
  mockOnSystemThemeChange.mockClear();
  mockGetInitialIsDark.mockClear();
  mockGetInitialIsDark.mockReturnValue(false);
});

describe('App', () => {
  it('should render successfully', () => {
    const { baseElement } = render(
      <MemoryRouter initialEntries={['/treasury-market-data']}>
        <AppContent />
      </MemoryRouter>
    );
    expect(baseElement).toBeTruthy();
  });

  it('should render navigation menu', () => {
    render(
      <MemoryRouter initialEntries={['/treasury-market-data']}>
        <AppContent />
      </MemoryRouter>
    );
    expect(screen.getByText('Treasury Market Data')).toBeTruthy();
    expect(screen.getByText('Commodities Dashboard')).toBeTruthy();
  });

  it('should render theme toggle button', () => {
    render(
      <MemoryRouter initialEntries={['/treasury-market-data']}>
        <AppContent />
      </MemoryRouter>
    );
    const themeButton = screen.getByLabelText('Toggle theme');
    expect(themeButton).toBeTruthy();
  });

  it('should show "Dark" text when in light mode', () => {
    mockGetInitialIsDark.mockReturnValue(false);
    render(
      <MemoryRouter initialEntries={['/treasury-market-data']}>
        <AppContent />
      </MemoryRouter>
    );
    expect(screen.getByText('Dark')).toBeTruthy();
  });

  it('should show "Light" text when in dark mode', () => {
    mockGetInitialIsDark.mockReturnValue(true);
    render(
      <MemoryRouter initialEntries={['/treasury-market-data']}>
        <AppContent />
      </MemoryRouter>
    );
    expect(screen.getByText('Light')).toBeTruthy();
  });

  it('should toggle theme when button is clicked', () => {
    mockGetInitialIsDark.mockReturnValue(false);
    render(
      <MemoryRouter initialEntries={['/treasury-market-data']}>
        <AppContent />
      </MemoryRouter>
    );

    // Initially light mode -> shows "Dark"
    expect(screen.getByText('Dark')).toBeTruthy();

    // Click toggle
    const themeButton = screen.getByLabelText('Toggle theme');
    fireEvent.click(themeButton);

    // Now should show "Light"
    expect(screen.getByText('Light')).toBeTruthy();
  });

  it('should call applyDarkMode on initial render', () => {
    mockGetInitialIsDark.mockReturnValue(false);
    render(
      <MemoryRouter initialEntries={['/treasury-market-data']}>
        <AppContent />
      </MemoryRouter>
    );
    expect(mockApplyDarkMode).toHaveBeenCalledWith(false);
  });

  it('should call applyDarkMode with true after toggling from light', () => {
    mockGetInitialIsDark.mockReturnValue(false);
    render(
      <MemoryRouter initialEntries={['/treasury-market-data']}>
        <AppContent />
      </MemoryRouter>
    );
    mockApplyDarkMode.mockClear();

    const themeButton = screen.getByLabelText('Toggle theme');
    fireEvent.click(themeButton);

    expect(mockApplyDarkMode).toHaveBeenCalledWith(true);
  });

  it('should register system theme change listener', () => {
    render(
      <MemoryRouter initialEntries={['/treasury-market-data']}>
        <AppContent />
      </MemoryRouter>
    );
    expect(mockOnSystemThemeChange).toHaveBeenCalledTimes(1);
    expect(typeof mockOnSystemThemeChange.mock.calls[0][0]).toBe('function');
  });

  it('should highlight Treasury Market Data nav when on that route', () => {
    render(
      <MemoryRouter initialEntries={['/treasury-market-data']}>
        <AppContent />
      </MemoryRouter>
    );
    const treasuryTrigger = screen.getByText('Treasury Market Data');
    expect(treasuryTrigger.className).toContain('bg-accent');
  });

  it('should not highlight Commodities Dashboard nav when on treasury route', () => {
    render(
      <MemoryRouter initialEntries={['/treasury-market-data']}>
        <AppContent />
      </MemoryRouter>
    );
    const commoditiesTrigger = screen.getByText('Commodities Dashboard');
    // The default class contains "focus:bg-accent" but should NOT have standalone "bg-accent" class
    // Split className and check that 'bg-accent' is not a standalone class token
    const classTokens = commoditiesTrigger.className.split(/\s+/);
    expect(classTokens).not.toContain('bg-accent');
  });

  it('should highlight Commodities Dashboard nav when on that route', () => {
    render(
      <MemoryRouter initialEntries={['/commodities-dashboard']}>
        <AppContent />
      </MemoryRouter>
    );
    const commoditiesTrigger = screen.getByText('Commodities Dashboard');
    expect(commoditiesTrigger.className).toContain('bg-accent');
  });

  it('should navigate to commodities when clicking the trigger', () => {
    render(
      <MemoryRouter initialEntries={['/treasury-market-data']}>
        <AppContent />
      </MemoryRouter>
    );

    const commoditiesTrigger = screen.getByText('Commodities Dashboard');
    fireEvent.click(commoditiesTrigger);

    // After navigation, the commodities trigger should be highlighted
    expect(commoditiesTrigger.className).toContain('bg-accent');
  });

  it('should navigate to treasury when clicking the trigger', () => {
    render(
      <MemoryRouter initialEntries={['/commodities-dashboard']}>
        <AppContent />
      </MemoryRouter>
    );

    const treasuryTrigger = screen.getByText('Treasury Market Data');
    fireEvent.click(treasuryTrigger);

    expect(treasuryTrigger.className).toContain('bg-accent');
  });

  it('should render content area', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/treasury-market-data']}>
        <AppContent />
      </MemoryRouter>
    );
    const contentArea = container.querySelector('.flex-1.p-4.overflow-auto');
    expect(contentArea).toBeTruthy();
  });

  it('should render the Treasury component on its route', () => {
    render(
      <MemoryRouter initialEntries={['/treasury-market-data']}>
        <AppContent />
      </MemoryRouter>
    );
    expect(screen.getByText('On-The-Run Treasury Market Data')).toBeTruthy();
  });

  it('should render the Commodities component on its route', () => {
    render(
      <MemoryRouter initialEntries={['/commodities-dashboard']}>
        <AppContent />
      </MemoryRouter>
    );
    expect(screen.getByText('Commodities Trading Dashboard')).toBeTruthy();
  });

  it('should redirect from / to /treasury-market-data', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppContent />
      </MemoryRouter>
    );
    // Should have redirected and show Treasury content
    expect(screen.getByText('On-The-Run Treasury Market Data')).toBeTruthy();
  });
});

describe('App (with BrowserRouter)', () => {
  it('should render the full App component with BrowserRouter', () => {
    const { baseElement } = render(<App />);
    expect(baseElement).toBeTruthy();
    // The App component wraps AppContent in a BrowserRouter
    // It also runs the useEffect with logger calls on mount
    expect(screen.getByText('Treasury Market Data')).toBeTruthy();
  });

  it('should run logger initialization on mount', () => {
    mockSetGlobalLevel.mockClear();
    mockLoggerInstance.info.mockClear();
    mockLoggerInstance.error.mockClear();
    mockLoggerInstance.warn.mockClear();
    mockLoggerInstance.debug.mockClear();

    render(<App />);

    // The useEffect in App() calls Logger.setGlobalLevel, logger.setLevel, etc.
    expect(mockSetGlobalLevel).toHaveBeenCalled();
    expect(mockLoggerInstance.info).toHaveBeenCalled();
    expect(mockLoggerInstance.error).toHaveBeenCalled();
    expect(mockLoggerInstance.warn).toHaveBeenCalled();
    expect(mockLoggerInstance.debug).toHaveBeenCalled();
  });
});
