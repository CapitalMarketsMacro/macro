import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';

const _getStatus$ = jest.fn().mockReturnValue(of('Platform initialized'));
const _init = jest.fn().mockReturnValue(of(true));
const _quit = jest.fn();
const _syncWithOpenFinTheme = jest.fn();
const _stopSyncing = jest.fn();
const _getApps = jest.fn().mockReturnValue([]);

jest.mock('@macro/openfin', () => {
  class MockWorkspaceService { getStatus$ = _getStatus$; init = _init; quit = _quit; }
  class MockThemeService { syncWithOpenFinTheme = _syncWithOpenFinTheme; stopSyncing = _stopSyncing; }
  class MockThemePresetService { getAvailablePresets = jest.fn().mockReturnValue([]); getActivePresetId = jest.fn().mockReturnValue('default'); setActivePresetId = jest.fn(); }
  class MockNotificationsService { info = jest.fn(); success = jest.fn(); warning = jest.fn(); error = jest.fn(); critical = jest.fn(); }
  class MockSettingsService { getApps = _getApps; }
  return {
    WorkspaceService: MockWorkspaceService,
    ThemeService: MockThemeService,
    ThemePresetService: MockThemePresetService,
    NotificationsService: MockNotificationsService,
    SettingsService: MockSettingsService,
  };
});

jest.mock('@macro/logger', () => ({
  Logger: { getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }) },
}));

import { ProviderComponent } from './provider.component';
import { WorkspaceService, ThemeService, ThemePresetService, NotificationsService, SettingsService } from '@macro/openfin';

describe('ProviderComponent', () => {
  let component: ProviderComponent;

  beforeEach(async () => {
    jest.clearAllMocks();
    _getStatus$.mockReturnValue(of('Platform initialized'));
    _init.mockReturnValue(of(true));

    await TestBed.configureTestingModule({
      imports: [ProviderComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: WorkspaceService, useValue: new WorkspaceService() },
        { provide: ThemeService, useValue: new ThemeService() },
        { provide: ThemePresetService, useValue: new ThemePresetService() },
        { provide: NotificationsService, useValue: new NotificationsService() },
        { provide: SettingsService, useValue: new SettingsService() },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    const fixture = TestBed.createComponent(ProviderComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should expose message$ observable', () => {
    expect(component.message$).toBeDefined();
  });

  describe('ngOnInit', () => {
    it('should sync theme with OpenFin', () => {
      component.ngOnInit();
      expect(_syncWithOpenFinTheme).toHaveBeenCalled();
    });

    it('should initialize workspace service', () => {
      component.ngOnInit();
      expect(_init).toHaveBeenCalled();
    });
  });

  describe('ngOnDestroy', () => {
    it('should stop theme syncing', () => {
      component.ngOnDestroy();
      expect(_stopSyncing).toHaveBeenCalled();
    });
  });

  describe('quit flow', () => {
    it('should show confirmation on requestQuit', () => {
      expect(component.showQuitConfirm()).toBe(false);
      component.requestQuit();
      expect(component.showQuitConfirm()).toBe(true);
    });

    it('should hide confirmation on cancelQuit', () => {
      component.requestQuit();
      component.cancelQuit();
      expect(component.showQuitConfirm()).toBe(false);
    });

    it('should call quit on confirmQuit', () => {
      component.requestQuit();
      component.confirmQuit();
      expect(_quit).toHaveBeenCalled();
      expect(component.showQuitConfirm()).toBe(false);
    });
  });
});
