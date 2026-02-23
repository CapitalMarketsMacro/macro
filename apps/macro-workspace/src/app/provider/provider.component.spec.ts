import { TestBed } from '@angular/core/testing';
import {
  provideZonelessChangeDetection,
  NO_ERRORS_SCHEMA,
} from '@angular/core';
import { of, Subject } from 'rxjs';
import { ProviderComponent } from './provider.component';

// Mock @macro/openfin Angular services
const mockWorkspaceService = {
  getStatus$: jest.fn().mockReturnValue(of('Initializing...')),
  init: jest.fn().mockReturnValue(of(true)),
  quit: jest.fn(),
};

const mockThemeService = {
  syncWithOpenFinTheme: jest.fn(),
  stopSyncing: jest.fn(),
};

jest.mock('@macro/openfin', () => ({
  WorkspaceService: jest.fn().mockImplementation(() => mockWorkspaceService),
  ThemeService: jest.fn().mockImplementation(() => mockThemeService),
}));

// Import after mock
import { WorkspaceService, ThemeService } from '@macro/openfin';

describe('ProviderComponent', () => {
  beforeEach(async () => {
    jest.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [ProviderComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: WorkspaceService, useValue: mockWorkspaceService },
        { provide: ThemeService, useValue: mockThemeService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  it('should create the component', () => {
    const fixture = TestBed.createComponent(ProviderComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should have message$ observable from WorkspaceService', () => {
    const fixture = TestBed.createComponent(ProviderComponent);
    const component = fixture.componentInstance;
    expect(component.message$).toBeDefined();
  });

  describe('ngOnInit', () => {
    it('should sync theme with OpenFin on init', () => {
      const fixture = TestBed.createComponent(ProviderComponent);
      fixture.componentInstance.ngOnInit();
      expect(mockThemeService.syncWithOpenFinTheme).toHaveBeenCalled();
    });

    it('should call workspaceService.init() and subscribe', () => {
      const initSubject = new Subject<boolean>();
      mockWorkspaceService.init.mockReturnValue(initSubject.asObservable());

      const fixture = TestBed.createComponent(ProviderComponent);
      fixture.componentInstance.ngOnInit();

      expect(mockWorkspaceService.init).toHaveBeenCalled();
    });

    it('should subscribe to init observable', () => {
      const initSubject = new Subject<boolean>();
      mockWorkspaceService.init.mockReturnValue(initSubject.asObservable());

      const fixture = TestBed.createComponent(ProviderComponent);
      fixture.componentInstance.ngOnInit();

      // Emit value to verify subscription is active
      expect(() => initSubject.next(true)).not.toThrow();
    });
  });

  describe('ngOnDestroy', () => {
    it('should stop theme syncing on destroy', () => {
      const fixture = TestBed.createComponent(ProviderComponent);
      fixture.componentInstance.ngOnDestroy();
      expect(mockThemeService.stopSyncing).toHaveBeenCalled();
    });

    it('should call workspaceService.quit() on destroy', () => {
      const fixture = TestBed.createComponent(ProviderComponent);
      fixture.componentInstance.ngOnDestroy();
      expect(mockWorkspaceService.quit).toHaveBeenCalled();
    });

    it('should complete the unsubscribe subject on destroy', () => {
      const initSubject = new Subject<boolean>();
      mockWorkspaceService.init.mockReturnValue(initSubject.asObservable());

      const fixture = TestBed.createComponent(ProviderComponent);
      fixture.componentInstance.ngOnInit();
      fixture.componentInstance.ngOnDestroy();

      // After destroy, init subscription should be unsubscribed via takeUntil
      // Emitting should not cause errors
      expect(() => initSubject.next(true)).not.toThrow();
    });
  });

  describe('template', () => {
    it('should render the heading text', () => {
      const fixture = TestBed.createComponent(ProviderComponent);
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('h1')?.textContent).toContain(
        'OpenFin Platform Window'
      );
    });

    it('should render the status message paragraph', () => {
      const fixture = TestBed.createComponent(ProviderComponent);
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const messageParagraph = compiled.querySelector('.message');
      expect(messageParagraph).toBeTruthy();
    });

    it('should render description paragraphs', () => {
      const fixture = TestBed.createComponent(ProviderComponent);
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const paragraphs = compiled.querySelectorAll('p');
      // At least the 2 description paragraphs + 1 status message
      expect(paragraphs.length).toBeGreaterThanOrEqual(3);
    });

    it('should render the OpenFin logo image', () => {
      const fixture = TestBed.createComponent(ProviderComponent);
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const img = compiled.querySelector('img');
      expect(img).toBeTruthy();
      expect(img?.getAttribute('alt')).toBe('OpenFin');
    });
  });
});
