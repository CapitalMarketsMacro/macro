import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, NavigationEnd } from '@angular/router';
import { PLATFORM_ID } from '@angular/core';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Subject } from 'rxjs';
import { App } from './app';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock @macro/logger
const mockLoggerInstance = {
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

// Mock @macro/macro-design
const mockCleanup = jest.fn();
const mockOnSystemThemeChange = jest.fn().mockReturnValue(mockCleanup);
const mockGetInitialIsDark = jest.fn().mockReturnValue(false);
const mockApplyDarkMode = jest.fn();

jest.mock('@macro/macro-design', () => ({
  getInitialIsDark: (...args: unknown[]) => mockGetInitialIsDark(...args),
  applyDarkMode: (...args: unknown[]) => mockApplyDarkMode(...args),
  onSystemThemeChange: (...args: unknown[]) => mockOnSystemThemeChange(...args),
}));

describe('App (root component)', () => {
  let routerEventsSubject: Subject<unknown>;

  beforeEach(async () => {
    jest.clearAllMocks();
    routerEventsSubject = new Subject();

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'browser' },
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

  it('should have isDark false by default when getInitialIsDark returns false', () => {
    mockGetInitialIsDark.mockReturnValue(false);
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance.isDark).toBe(false);
  });

  it('should have isDark true when getInitialIsDark returns true', () => {
    mockGetInitialIsDark.mockReturnValue(true);
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance.isDark).toBe(true);
  });

  it('should register a system theme change listener in browser platform', () => {
    TestBed.createComponent(App);
    expect(mockOnSystemThemeChange).toHaveBeenCalledTimes(1);
    expect(typeof mockOnSystemThemeChange.mock.calls[0][0]).toBe('function');
  });

  // -----------------------------------------------------------------------
  // ngOnInit
  // -----------------------------------------------------------------------
  it('should call applyDarkMode on init', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges(); // triggers ngOnInit
    expect(mockApplyDarkMode).toHaveBeenCalled();
  });

  it('should initialize menu items with two entries', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const items = fixture.componentInstance.menuItems;
    expect(items).toHaveLength(2);
    expect(items[0].label).toBe('FX Market Data');
    expect(items[0].routerLink).toBe('/fx-market-data');
    expect(items[1].label).toBe('Treasury Microstructure');
    expect(items[1].routerLink).toBe('/treasury-microstructure');
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

    // info is called multiple times in ngOnInit
    expect(mockLoggerInstance.info).toHaveBeenCalled();
    expect(mockLoggerInstance.debug).toHaveBeenCalled();
    expect(mockLoggerInstance.error).toHaveBeenCalled();
    expect(mockLoggerInstance.warn).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // toggleTheme
  // -----------------------------------------------------------------------
  it('should toggle isDark from false to true', () => {
    mockGetInitialIsDark.mockReturnValue(false);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    mockApplyDarkMode.mockClear();
    fixture.componentInstance.toggleTheme();

    expect(fixture.componentInstance.isDark).toBe(true);
    expect(mockApplyDarkMode).toHaveBeenCalledWith(true);
  });

  it('should toggle isDark from true to false', () => {
    mockGetInitialIsDark.mockReturnValue(true);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    mockApplyDarkMode.mockClear();
    fixture.componentInstance.toggleTheme();

    expect(fixture.componentInstance.isDark).toBe(false);
    expect(mockApplyDarkMode).toHaveBeenCalledWith(false);
  });

  it('should toggle theme twice and return to original state', () => {
    mockGetInitialIsDark.mockReturnValue(false);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    fixture.componentInstance.toggleTheme();
    expect(fixture.componentInstance.isDark).toBe(true);

    fixture.componentInstance.toggleTheme();
    expect(fixture.componentInstance.isDark).toBe(false);
  });

  // -----------------------------------------------------------------------
  // System theme change callback
  // -----------------------------------------------------------------------
  it('should update isDark when system theme changes', () => {
    mockGetInitialIsDark.mockReturnValue(false);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    // Capture the callback that was registered
    const callback = mockOnSystemThemeChange.mock.calls[0][0];
    expect(callback).toBeDefined();

    // Simulate system switching to dark
    mockApplyDarkMode.mockClear();
    callback(true);
    expect(fixture.componentInstance.isDark).toBe(true);
    expect(mockApplyDarkMode).toHaveBeenCalledWith(true);

    // Simulate system switching back to light
    mockApplyDarkMode.mockClear();
    callback(false);
    expect(fixture.componentInstance.isDark).toBe(false);
    expect(mockApplyDarkMode).toHaveBeenCalledWith(false);
  });

  // -----------------------------------------------------------------------
  // ngOnDestroy
  // -----------------------------------------------------------------------
  it('should call cleanup on destroy', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    fixture.destroy();

    expect(mockCleanup).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // Server platform guard (applyTheme should no-op)
  // -----------------------------------------------------------------------
  describe('when platform is server', () => {
    beforeEach(async () => {
      await TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [App],
        providers: [
          provideRouter([]),
          { provide: PLATFORM_ID, useValue: 'server' },
        ],
        schemas: [NO_ERRORS_SCHEMA],
      })
        .overrideComponent(App, {
          set: { schemas: [NO_ERRORS_SCHEMA] },
        })
        .compileComponents();
    });

    it('should not call onSystemThemeChange on server', () => {
      mockOnSystemThemeChange.mockClear();
      TestBed.createComponent(App);
      expect(mockOnSystemThemeChange).not.toHaveBeenCalled();
    });

    it('should not call applyDarkMode when toggling on server', () => {
      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();
      mockApplyDarkMode.mockClear();

      fixture.componentInstance.toggleTheme();
      expect(mockApplyDarkMode).not.toHaveBeenCalled();
    });
  });
});
