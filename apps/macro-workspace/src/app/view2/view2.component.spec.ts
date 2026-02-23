import { TestBed } from '@angular/core/testing';
import {
  provideZonelessChangeDetection,
  NO_ERRORS_SCHEMA,
} from '@angular/core';
import { Subject } from 'rxjs';
import { View2Component } from './view2.component';

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

// Mock @openfin/core to avoid import errors
jest.mock('@openfin/core', () => ({}), { virtual: true });

// Mock services
const mockContextSubject = new Subject<any>();
const mockChannelSubject = new Subject<any>();

const mockContextService = {
  registerContextListener: jest.fn(),
  context$: mockContextSubject.asObservable(),
  removeListener: jest.fn(),
};

const mockChannelService = {
  registerChannelListener: jest.fn(),
  channel$: mockChannelSubject.asObservable(),
  removeListener: jest.fn(),
};

const mockThemeService = {
  syncWithOpenFinTheme: jest.fn(),
  stopSyncing: jest.fn(),
};

jest.mock('@macro/openfin', () => ({
  ContextService: jest.fn().mockImplementation(() => mockContextService),
  ChannelService: jest.fn().mockImplementation(() => mockChannelService),
  ThemeService: jest.fn().mockImplementation(() => mockThemeService),
}));

import { ContextService, ChannelService, ThemeService } from '@macro/openfin';

describe('View2Component', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    // Ensure fin is undefined in test environment
    (globalThis as any).fin = undefined;

    await TestBed.configureTestingModule({
      imports: [View2Component],
      providers: [
        provideZonelessChangeDetection(),
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
    const fixture = TestBed.createComponent(View2Component);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should initialize message signal as empty string', () => {
    const fixture = TestBed.createComponent(View2Component);
    expect(fixture.componentInstance.message()).toBe('');
  });

  describe('ngOnInit', () => {
    it('should sync theme with OpenFin on init', () => {
      // Mock fin for makeProvider
      (globalThis as any).fin = {
        InterApplicationBus: {
          Channel: {
            create: jest.fn().mockResolvedValue({
              onConnection: jest.fn(),
              register: jest.fn(),
              publish: jest.fn(),
            }),
          },
        },
      };

      const fixture = TestBed.createComponent(View2Component);
      fixture.componentInstance.ngOnInit();
      expect(mockThemeService.syncWithOpenFinTheme).toHaveBeenCalled();
    });

    it('should register context listener for fdc3.instrument', () => {
      (globalThis as any).fin = {
        InterApplicationBus: {
          Channel: {
            create: jest.fn().mockResolvedValue({
              onConnection: jest.fn(),
              register: jest.fn(),
              publish: jest.fn(),
            }),
          },
        },
      };

      const fixture = TestBed.createComponent(View2Component);
      fixture.componentInstance.ngOnInit();
      expect(mockContextService.registerContextListener).toHaveBeenCalledWith(
        'fdc3.instrument'
      );
    });

    it('should register channel listener for CUSTOM-APP-CHANNEL', () => {
      (globalThis as any).fin = {
        InterApplicationBus: {
          Channel: {
            create: jest.fn().mockResolvedValue({
              onConnection: jest.fn(),
              register: jest.fn(),
              publish: jest.fn(),
            }),
          },
        },
      };

      const fixture = TestBed.createComponent(View2Component);
      fixture.componentInstance.ngOnInit();
      expect(
        mockChannelService.registerChannelListener
      ).toHaveBeenCalledWith('CUSTOM-APP-CHANNEL', 'fdc3.instrument');
    });

    it('should update message signal when context$ emits', () => {
      (globalThis as any).fin = {
        InterApplicationBus: {
          Channel: {
            create: jest.fn().mockResolvedValue({
              onConnection: jest.fn(),
              register: jest.fn(),
              publish: jest.fn(),
            }),
          },
        },
      };

      const fixture = TestBed.createComponent(View2Component);
      fixture.componentInstance.ngOnInit();

      const testContext = {
        type: 'fdc3.instrument',
        name: 'Test',
        id: { ticker: 'TST' },
      };
      mockContextSubject.next(testContext);

      expect(fixture.componentInstance.message()).toBe(
        JSON.stringify(testContext, undefined, '  ')
      );
    });

    it('should update message signal when channel$ emits', () => {
      (globalThis as any).fin = {
        InterApplicationBus: {
          Channel: {
            create: jest.fn().mockResolvedValue({
              onConnection: jest.fn(),
              register: jest.fn(),
              publish: jest.fn(),
            }),
          },
        },
      };

      const fixture = TestBed.createComponent(View2Component);
      fixture.componentInstance.ngOnInit();

      const testContext = {
        type: 'fdc3.instrument',
        name: 'Apple',
        id: { ticker: 'AAPL' },
      };
      mockChannelSubject.next(testContext);

      expect(fixture.componentInstance.message()).toBe(
        JSON.stringify(testContext, undefined, '  ')
      );
    });

    it('should publish to providerBus when channel$ emits after makeProvider resolves', async () => {
      const mockProviderBus = {
        onConnection: jest.fn(),
        register: jest.fn(),
        publish: jest.fn(),
      };
      (globalThis as any).fin = {
        InterApplicationBus: {
          Channel: {
            create: jest.fn().mockResolvedValue(mockProviderBus),
          },
        },
      };

      const fixture = TestBed.createComponent(View2Component);
      fixture.componentInstance.ngOnInit();

      // Wait for makeProvider to resolve so providerBus is set
      await (globalThis as any).fin.InterApplicationBus.Channel.create();

      const testContext = {
        type: 'fdc3.instrument',
        name: 'Apple',
        id: { ticker: 'AAPL' },
      };
      mockChannelSubject.next(testContext);

      expect(mockProviderBus.publish).toHaveBeenCalledWith(
        'example-topic',
        JSON.stringify(testContext)
      );
    });

    it('should call makeProvider on init', () => {
      const mockProviderBus = {
        onConnection: jest.fn(),
        register: jest.fn(),
        publish: jest.fn(),
      };
      (globalThis as any).fin = {
        InterApplicationBus: {
          Channel: {
            create: jest.fn().mockResolvedValue(mockProviderBus),
          },
        },
      };

      const spy = jest.spyOn(
        fixture_factory().componentInstance,
        'makeProvider'
      );

      function fixture_factory() {
        const fixture = TestBed.createComponent(View2Component);
        jest.spyOn(fixture.componentInstance, 'makeProvider');
        fixture.componentInstance.ngOnInit();
        return fixture;
      }

      // makeProvider is called during ngOnInit
      const fixture = fixture_factory();
      expect(fixture.componentInstance.makeProvider).toHaveBeenCalled();
    });
  });

  describe('makeProvider', () => {
    it('should create an InterApplicationBus channel when fin is defined', async () => {
      const mockProviderBus = {
        onConnection: jest.fn(),
        register: jest.fn(),
        publish: jest.fn(),
      };
      (globalThis as any).fin = {
        InterApplicationBus: {
          Channel: {
            create: jest.fn().mockResolvedValue(mockProviderBus),
          },
        },
      };

      const fixture = TestBed.createComponent(View2Component);
      await fixture.componentInstance.makeProvider();

      expect(
        (globalThis as any).fin.InterApplicationBus.Channel.create
      ).toHaveBeenCalledWith('channelName');
      expect(mockProviderBus.onConnection).toHaveBeenCalled();
      expect(mockProviderBus.register).toHaveBeenCalledWith(
        'example-topic',
        expect.any(Function)
      );
    });

    it('should handle onConnection callback without errors', async () => {
      let onConnectionCb: Function = () => {};
      let registerCb: Function = () => {};
      const mockProviderBus = {
        onConnection: jest.fn((cb: Function) => {
          onConnectionCb = cb;
        }),
        register: jest.fn((_topic: string, cb: Function) => {
          registerCb = cb;
        }),
        publish: jest.fn(),
      };
      (globalThis as any).fin = {
        InterApplicationBus: {
          Channel: {
            create: jest.fn().mockResolvedValue(mockProviderBus),
          },
        },
      };

      const fixture = TestBed.createComponent(View2Component);
      await fixture.componentInstance.makeProvider();

      // Exercise the onConnection callback
      expect(() =>
        onConnectionCb({ uuid: 'test-uuid', name: 'test' }, { data: 'payload' })
      ).not.toThrow();

      // Exercise the register callback
      expect(() =>
        registerCb({ topic: 'data' }, { uuid: 'client-uuid', name: 'client' })
      ).not.toThrow();
    });

    it('should throw when fin is undefined', async () => {
      (globalThis as any).fin = undefined;
      const fixture = TestBed.createComponent(View2Component);
      await expect(
        fixture.componentInstance.makeProvider()
      ).rejects.toThrow();
    });
  });

  describe('ngOnDestroy', () => {
    it('should call removeListener on contextService', () => {
      const fixture = TestBed.createComponent(View2Component);
      fixture.componentInstance.ngOnDestroy();
      expect(mockContextService.removeListener).toHaveBeenCalled();
    });

    it('should call removeListener on channelService', () => {
      const fixture = TestBed.createComponent(View2Component);
      fixture.componentInstance.ngOnDestroy();
      expect(mockChannelService.removeListener).toHaveBeenCalled();
    });

    it('should unsubscribe context subscription if active', () => {
      (globalThis as any).fin = {
        InterApplicationBus: {
          Channel: {
            create: jest.fn().mockResolvedValue({
              onConnection: jest.fn(),
              register: jest.fn(),
              publish: jest.fn(),
            }),
          },
        },
      };

      const fixture = TestBed.createComponent(View2Component);
      fixture.componentInstance.ngOnInit();

      // Verify that the component properly cleans up
      expect(() => fixture.componentInstance.ngOnDestroy()).not.toThrow();
      expect(mockContextService.removeListener).toHaveBeenCalled();
      expect(mockChannelService.removeListener).toHaveBeenCalled();
    });
  });

  describe('clearMessage', () => {
    it('should reset the message signal to empty string', () => {
      const fixture = TestBed.createComponent(View2Component);
      // Set a message first
      fixture.componentInstance.message.set('some context data');
      expect(fixture.componentInstance.message()).toBe('some context data');

      // Clear it
      fixture.componentInstance.clearMessage();
      expect(fixture.componentInstance.message()).toBe('');
    });
  });

  describe('template', () => {
    it('should render the heading text', () => {
      const fixture = TestBed.createComponent(View2Component);
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('h1')?.textContent).toContain(
        'OpenFin Angular View 2'
      );
    });

    it('should render the OpenFin logo image', () => {
      const fixture = TestBed.createComponent(View2Component);
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const img = compiled.querySelector('img');
      expect(img).toBeTruthy();
      expect(img?.getAttribute('alt')).toBe('OpenFin');
    });

    it('should not render the fieldset when message is empty', () => {
      const fixture = TestBed.createComponent(View2Component);
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('fieldset')).toBeFalsy();
      expect(compiled.querySelector('button')).toBeFalsy();
    });

    it('should render the fieldset and Clear button when message is set', () => {
      const fixture = TestBed.createComponent(View2Component);
      fixture.componentInstance.message.set('{"type":"fdc3.instrument"}');
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('fieldset')).toBeTruthy();
      const clearButton = compiled.querySelector('button');
      expect(clearButton).toBeTruthy();
      expect(clearButton?.textContent).toContain('Clear');
    });

    it('should display the message content in the pre element', () => {
      const fixture = TestBed.createComponent(View2Component);
      const testMessage = '{"type":"fdc3.instrument","name":"Test"}';
      fixture.componentInstance.message.set(testMessage);
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const pre = compiled.querySelector('pre');
      expect(pre).toBeTruthy();
      expect(pre?.textContent?.trim()).toContain(testMessage);
    });

    it('should call clearMessage when Clear button is clicked', () => {
      const fixture = TestBed.createComponent(View2Component);
      fixture.componentInstance.message.set('some data');
      fixture.detectChanges();
      const spy = jest.spyOn(fixture.componentInstance, 'clearMessage');
      const compiled = fixture.nativeElement as HTMLElement;
      const clearButton = compiled.querySelector('button');
      clearButton?.click();
      expect(spy).toHaveBeenCalled();
    });
  });
});
