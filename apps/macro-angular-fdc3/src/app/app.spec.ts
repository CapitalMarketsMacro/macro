import { TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { App } from './app';

jest.mock('@macro/logger', () => ({
  Logger: {
    getLogger: () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }),
    setGlobalLevel: jest.fn(),
    getGlobalLevel: jest.fn().mockReturnValue(0),
  },
  LogLevel: { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 },
}));

jest.mock('@macro/macro-design', () => ({
  getInitialIsDark: () => false,
  applyDarkMode: jest.fn(),
  onSystemThemeChange: jest.fn(() => jest.fn()),
}));

jest.mock('@macro/openfin/theme-sync', () => ({
  onOpenFinThemeChange: jest.fn(() => jest.fn()),
}));

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App, RouterModule.forRoot([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
