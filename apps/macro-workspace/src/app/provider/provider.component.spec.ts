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
  class MockThemePresetService { getAvailablePresets = jest.fn().mockReturnValue([]); getActivePresetId = jest.fn().mockReturnValue('default'); setActivePresetId = jest.fn().mockResolvedValue(undefined); }
  class MockNotificationsService { info = jest.fn(); success = jest.fn(); warning = jest.fn(); error = jest.fn(); critical = jest.fn(); }
  class MockSettingsService {
    getApps = _getApps;
    getManifestSettings = jest.fn().mockResolvedValue({
      platformSettings: { id: 'p', title: 't', icon: '' },
      storage: { defaultEnvironment: 'local' },
    });
  }
  const localEnv = { name: 'local', config: { mode: 'localStorage', label: 'Local (this machine)' } };
  return {
    WorkspaceService: MockWorkspaceService,
    ThemeService: MockThemeService,
    ThemePresetService: MockThemePresetService,
    NotificationsService: MockNotificationsService,
    SettingsService: MockSettingsService,
    LOCAL_STORAGE_ENVIRONMENT: localEnv,
    STORAGE_ENV_QUERY_PARAM: 'storageEnv',
    getActiveStorageEnvironment: jest.fn().mockReturnValue(localEnv),
    listStorageEnvironments: jest.fn().mockReturnValue([localEnv]),
    saveStorageEnvironmentChoice: jest.fn(),
  };
});

jest.mock('@macro/logger', () => ({
  Logger: { getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }) },
}));

import { ProviderComponent } from './provider.component';
import { WorkspaceService, ThemeService, ThemePresetService, NotificationsService, SettingsService, saveStorageEnvironmentChoice } from '@macro/openfin';

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

  describe('applyStorageEnvironment', () => {
    const devEnv = { name: 'dev', config: { mode: 'rest', baseUrl: 'http://storage.test/workspace/v1' } } as never;
    const localEnvPick = { name: 'local', config: { mode: 'localStorage' } } as never;

    it('no-ops when re-picking the active environment', async () => {
      await component.applyStorageEnvironment(localEnvPick);
      expect(saveStorageEnvironmentChoice).not.toHaveBeenCalled();
    });

    it('persists a non-default environment choice', async () => {
      await component.applyStorageEnvironment(devEnv);
      expect(saveStorageEnvironmentChoice).toHaveBeenCalledWith('dev');
    });

    it('clears the override when picking the settings default (settings.json stays in charge)', async () => {
      const settings = TestBed.inject(SettingsService) as unknown as { getManifestSettings: jest.Mock };
      settings.getManifestSettings.mockResolvedValue({
        platformSettings: { id: 'p', title: 't', icon: '' },
        storage: { defaultEnvironment: 'dev' },
      });
      await component.applyStorageEnvironment(devEnv);
      expect(saveStorageEnvironmentChoice).toHaveBeenCalledWith(undefined);
    });

    it('no-ops when the environment is pinned by an effective ?storageEnv=', async () => {
      window.history.pushState({}, '', '/?storageEnv=local');
      try {
        const fixture = TestBed.createComponent(ProviderComponent);
        const pinned = fixture.componentInstance;
        expect(pinned.storageEnvPinned()).toBe(true);
        await pinned.applyStorageEnvironment(devEnv);
        expect(saveStorageEnvironmentChoice).not.toHaveBeenCalled();
      } finally {
        window.history.pushState({}, '', '/');
      }
    });

    it('does not report pinned when the query value did not win resolution', () => {
      window.history.pushState({}, '', '/?storageEnv=bogus');
      try {
        const fixture = TestBed.createComponent(ProviderComponent);
        // active env (mock) is 'local' ≠ 'bogus' — the rejected pin must not lock the picker
        expect(fixture.componentInstance.storageEnvPinned()).toBe(false);
      } finally {
        window.history.pushState({}, '', '/');
      }
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
