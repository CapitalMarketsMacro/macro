import { TestBed } from '@angular/core/testing';
import {
  provideZonelessChangeDetection,
  NO_ERRORS_SCHEMA,
} from '@angular/core';
import { Observable, of, Subject } from 'rxjs';
import { View1Component } from './view1.component';

// Mock @macro/logger
jest.mock('@macro/logger', () => ({
  Logger: {
    getLogger: jest.fn().mockReturnValue({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }),
  },
}));

// Mock services
const mockNotificationsService = {
  observeNotificationActions: jest.fn().mockReturnValue(
    new Observable((observer) => {
      observer.complete();
    })
  ),
  deregister: jest.fn().mockResolvedValue(undefined),
  create: jest.fn(),
};

const mockContextService = {
  broadcast: jest.fn(),
};

const mockChannelService = {
  broadcast: jest.fn(),
};

const mockThemeService = {
  syncWithOpenFinTheme: jest.fn(),
  stopSyncing: jest.fn(),
};

jest.mock('@macro/openfin', () => ({
  NotificationsService: jest
    .fn()
    .mockImplementation(() => mockNotificationsService),
  ContextService: jest.fn().mockImplementation(() => mockContextService),
  ChannelService: jest.fn().mockImplementation(() => mockChannelService),
  ThemeService: jest.fn().mockImplementation(() => mockThemeService),
}));

import {
  NotificationsService,
  ContextService,
  ChannelService,
  ThemeService,
} from '@macro/openfin';

describe('View1Component', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    // Ensure fin is undefined in test environment
    (globalThis as any).fin = undefined;

    await TestBed.configureTestingModule({
      imports: [View1Component],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
        { provide: ContextService, useValue: mockContextService },
        { provide: ChannelService, useValue: mockChannelService },
        { provide: ThemeService, useValue: mockThemeService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  afterEach(() => {
    (globalThis as any).fin = undefined;
  });

  it('should create the component', () => {
    const fixture = TestBed.createComponent(View1Component);
    expect(fixture.componentInstance).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should sync theme with OpenFin on init', () => {
      const fixture = TestBed.createComponent(View1Component);
      fixture.componentInstance.ngOnInit();
      expect(mockThemeService.syncWithOpenFinTheme).toHaveBeenCalled();
    });

    it('should observe notification actions on init', () => {
      const fixture = TestBed.createComponent(View1Component);
      fixture.componentInstance.ngOnInit();
      expect(
        mockNotificationsService.observeNotificationActions
      ).toHaveBeenCalled();
    });

    it('should subscribe to notification actions observable', () => {
      const notifSubject = new Subject<any>();
      mockNotificationsService.observeNotificationActions.mockReturnValue(
        notifSubject.asObservable()
      );

      const fixture = TestBed.createComponent(View1Component);
      fixture.componentInstance.ngOnInit();

      // Should not throw when emitting
      expect(() =>
        notifSubject.next({ result: { customData: 'test' } })
      ).not.toThrow();
    });
  });

  describe('ngOnDestroy', () => {
    it('should not call deregister on view destroy (deregistration is handled by workspace)', () => {
      const fixture = TestBed.createComponent(View1Component);
      fixture.componentInstance.ngOnDestroy();
      expect(mockNotificationsService.deregister).not.toHaveBeenCalled();
    });

    it('should complete the unsubscribe subject on destroy', () => {
      const notifSubject = new Subject<any>();
      mockNotificationsService.observeNotificationActions.mockReturnValue(
        notifSubject.asObservable()
      );

      const fixture = TestBed.createComponent(View1Component);
      fixture.componentInstance.ngOnInit();
      fixture.componentInstance.ngOnDestroy();

      // After destroy, subscription should be unsubscribed via takeUntil
      expect(() =>
        notifSubject.next({ result: { customData: 'test' } })
      ).not.toThrow();
    });
  });

  describe('showNotification', () => {
    it('should warn and return when fin is undefined', () => {
      const fixture = TestBed.createComponent(View1Component);
      fixture.componentInstance.showNotification();
      expect(mockNotificationsService.create).not.toHaveBeenCalled();
    });

    it('should call notificationsService.create when fin is defined', () => {
      (globalThis as any).fin = {
        me: { identity: { uuid: 'test-uuid' }, isOpenFin: true },
      };

      const fixture = TestBed.createComponent(View1Component);
      fixture.componentInstance.showNotification();

      expect(mockNotificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          platform: 'test-uuid',
          title: 'Simple Notification',
          body: 'This is a simple notification',
          toast: 'transient',
          buttons: expect.arrayContaining([
            expect.objectContaining({
              title: 'Click me',
              type: 'button',
              cta: true,
            }),
          ]),
        })
      );
    });
  });

  describe('broadcastFDC3Context', () => {
    it('should broadcast an fdc3.instrument context for MSFT', () => {
      const fixture = TestBed.createComponent(View1Component);
      fixture.componentInstance.broadcastFDC3Context();
      expect(mockContextService.broadcast).toHaveBeenCalledWith({
        type: 'fdc3.instrument',
        name: 'Microsoft Corporation',
        id: { ticker: 'MSFT' },
      });
    });
  });

  describe('broadcastFDC3ContextAppChannel', () => {
    it('should broadcast an fdc3.instrument context for AAPL on custom app channel', () => {
      const fixture = TestBed.createComponent(View1Component);
      fixture.componentInstance.broadcastFDC3ContextAppChannel();
      expect(mockChannelService.broadcast).toHaveBeenCalledWith(
        'CUSTOM-APP-CHANNEL',
        {
          type: 'fdc3.instrument',
          name: 'Apple Inc.',
          id: { ticker: 'AAPL' },
        }
      );
    });
  });

  describe('template', () => {
    it('should render the heading text', () => {
      const fixture = TestBed.createComponent(View1Component);
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('h1')?.textContent).toContain(
        'OpenFin Angular View 1'
      );
    });

    it('should render Show Notification button', () => {
      const fixture = TestBed.createComponent(View1Component);
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const buttons = compiled.querySelectorAll('button');
      const notifButton = Array.from(buttons).find((b) =>
        b.textContent?.includes('Show Notification')
      );
      expect(notifButton).toBeTruthy();
    });

    it('should render Broadcast FDC3 Context button', () => {
      const fixture = TestBed.createComponent(View1Component);
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const buttons = compiled.querySelectorAll('button');
      const fdc3Button = Array.from(buttons).find((b) =>
        b.textContent?.includes('Broadcast FDC3 Context')
      );
      expect(fdc3Button).toBeTruthy();
    });

    it('should render Broadcast Context on App Channel button', () => {
      const fixture = TestBed.createComponent(View1Component);
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const buttons = compiled.querySelectorAll('button');
      const channelButton = Array.from(buttons).find((b) =>
        b.textContent?.includes('Broadcast Context on App Channel')
      );
      expect(channelButton).toBeTruthy();
    });

    it('should render exactly 3 buttons', () => {
      const fixture = TestBed.createComponent(View1Component);
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const buttons = compiled.querySelectorAll('button');
      expect(buttons.length).toBe(3);
    });

    it('should render the OpenFin logo image', () => {
      const fixture = TestBed.createComponent(View1Component);
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const img = compiled.querySelector('img');
      expect(img).toBeTruthy();
      expect(img?.getAttribute('alt')).toBe('OpenFin');
    });

    it('should call showNotification when the notification button is clicked', () => {
      const fixture = TestBed.createComponent(View1Component);
      fixture.detectChanges();
      const spy = jest.spyOn(
        fixture.componentInstance,
        'showNotification'
      );
      const compiled = fixture.nativeElement as HTMLElement;
      const buttons = compiled.querySelectorAll('button');
      const notifButton = Array.from(buttons).find((b) =>
        b.textContent?.includes('Show Notification')
      );
      notifButton?.click();
      expect(spy).toHaveBeenCalled();
    });

    it('should call broadcastFDC3Context when the FDC3 button is clicked', () => {
      const fixture = TestBed.createComponent(View1Component);
      fixture.detectChanges();
      const spy = jest.spyOn(
        fixture.componentInstance,
        'broadcastFDC3Context'
      );
      const compiled = fixture.nativeElement as HTMLElement;
      const buttons = compiled.querySelectorAll('button');
      // The second button is "Broadcast FDC3 Context"
      buttons[1]?.click();
      expect(spy).toHaveBeenCalled();
    });

    it('should call broadcastFDC3ContextAppChannel when the App Channel button is clicked', () => {
      const fixture = TestBed.createComponent(View1Component);
      fixture.detectChanges();
      const spy = jest.spyOn(
        fixture.componentInstance,
        'broadcastFDC3ContextAppChannel'
      );
      const compiled = fixture.nativeElement as HTMLElement;
      const buttons = compiled.querySelectorAll('button');
      // The third button is "Broadcast Context on App Channel"
      buttons[2]?.click();
      expect(spy).toHaveBeenCalled();
    });
  });
});
