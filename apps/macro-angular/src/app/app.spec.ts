import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { App } from './app';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock @macro/logger — use `var` so it's hoisted above jest.mock
// eslint-disable-next-line no-var
var mockLoggerInstance: any = {
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  setLevel: jest.fn(),
  getLevel: jest.fn().mockReturnValue(0),
};

jest.mock('@macro/logger', () => ({
  Logger: {
    getLogger: jest.fn(() => mockLoggerInstance),
    setGlobalLevel: jest.fn(),
    getGlobalLevel: jest.fn().mockReturnValue(0),
  },
  LogLevel: {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
  },
}));

// Mock the shared macro ThemeService (@macro/macro-design/angular). The component
// consumes it for dark/light state + toggling; its own logic (DOM class,
// persistence, system/OpenFin sync) is covered by the @macro/macro-design
// ThemeController unit tests.
jest.mock('@macro/macro-design/angular', () => ({
  ThemeService: class MockThemeService {},
}));

import { ThemeService } from '@macro/macro-design/angular';

const mockThemeState = { isDark: false };
const mockToggle = jest.fn();
const mockSetDark = jest.fn();
const mockSetTheme = jest.fn();

const mockThemeService = {
  isDark: () => mockThemeState.isDark,
  mode: () => (mockThemeState.isDark ? 'dark' : 'light'),
  palette: () => ({}),
  themeId: () => 'macro',
  toggle: (...args: unknown[]) => mockToggle(...args),
  setDark: (...args: unknown[]) => mockSetDark(...args),
  setTheme: (...args: unknown[]) => mockSetTheme(...args),
};

describe('App (root component)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockThemeState.isDark = false;

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: ThemeService, useValue: mockThemeService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(App, {
        set: { schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();
  });

  // -----------------------------------------------------------------------
  // Construction & creation
  // -----------------------------------------------------------------------
  it('should create the component', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should expose isDark=false when the theme service reports light', () => {
    mockThemeState.isDark = false;
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance.isDark).toBe(false);
  });

  it('should expose isDark=true when the theme service reports dark', () => {
    mockThemeState.isDark = true;
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance.isDark).toBe(true);
  });

  // -----------------------------------------------------------------------
  // ngOnInit
  // -----------------------------------------------------------------------
  it('should initialize menu items with three entries', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const items = fixture.componentInstance.menuItems;
    expect(items).toHaveLength(3);
    expect(items[0].label).toBe('FX Market Data');
    expect(items[0].routerLink).toBe('/fx-market-data');
    expect(items[1].label).toBe('Treasury Microstructure');
    expect(items[1].routerLink).toBe('/treasury-microstructure');
    expect(items[2].label).toBe('Risk / PnL');
    expect(items[2].routerLink).toBe('/risk-pnl');
  });

  it('should set logger global level and instance level on init', () => {
    const { Logger } = jest.requireMock('@macro/logger');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(Logger.setGlobalLevel).toHaveBeenCalledWith(0); // LogLevel.DEBUG
    expect(mockLoggerInstance.setLevel).toHaveBeenCalledWith(0);
  });

  it('should log various messages on init', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(mockLoggerInstance.info).toHaveBeenCalled();
    expect(mockLoggerInstance.debug).toHaveBeenCalled();
    expect(mockLoggerInstance.error).toHaveBeenCalled();
    expect(mockLoggerInstance.warn).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // toggleTheme delegates to the shared ThemeService
  // -----------------------------------------------------------------------
  it('should delegate toggleTheme to the theme service', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    fixture.componentInstance.toggleTheme();
    expect(mockToggle).toHaveBeenCalledTimes(1);
  });
});
