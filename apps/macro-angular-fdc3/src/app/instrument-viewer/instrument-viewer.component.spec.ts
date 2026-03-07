import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { InstrumentViewerComponent } from './instrument-viewer.component';
import { Subject, of } from 'rxjs';
import { filter } from 'rxjs/operators';

jest.mock('@macro/logger', () => ({
  Logger: {
    getLogger: () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }),
  },
}));

// Must provide explicit factory — auto-mock pulls in @openfin/* which fails in Jest
jest.mock('@macro/openfin', () => ({
  ContextService: jest.fn(),
}));

import { ContextService } from '@macro/openfin';

describe('InstrumentViewerComponent', () => {
  let contextSubject: Subject<any>;
  let channelSubject: Subject<string | null>;

  beforeEach(async () => {
    contextSubject = new Subject<any>();
    channelSubject = new Subject<string | null>();

    const mockContextService = {
      context$: contextSubject.asObservable(),
      currentChannel$: channelSubject.asObservable(),
      registerContextListener: jest.fn().mockResolvedValue(undefined),
      onContext: jest.fn().mockImplementation((contextType: string) =>
        contextSubject.asObservable().pipe(filter((ctx) => ctx.type === contextType)),
      ),
      removeListener: jest.fn(),
      broadcast: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [InstrumentViewerComponent],
      providers: [
        { provide: ContextService, useValue: mockContextService },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(InstrumentViewerComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('should start with no current instrument', () => {
    const fixture = TestBed.createComponent(InstrumentViewerComponent);
    const component = fixture.componentInstance;
    expect(component.currentInstrument).toBeNull();
  });

  it('should start with empty history', () => {
    const fixture = TestBed.createComponent(InstrumentViewerComponent);
    const component = fixture.componentInstance;
    expect(component.contextHistory).toEqual([]);
  });

  it('should show empty state when no instrument received', fakeAsync(() => {
    const fixture = TestBed.createComponent(InstrumentViewerComponent);
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.empty-state')).toBeTruthy();
    expect(compiled.querySelector('.instrument-card')).toBeNull();
  }));

  it('should extract base currency from ticker', () => {
    const fixture = TestBed.createComponent(InstrumentViewerComponent);
    const component = fixture.componentInstance;
    expect(component.getBase('EURUSD')).toBe('EUR');
  });

  it('should extract quote currency from ticker', () => {
    const fixture = TestBed.createComponent(InstrumentViewerComponent);
    const component = fixture.componentInstance;
    expect(component.getQuote('EURUSD')).toBe('USD');
  });

  it('should return channel display name capitalized', () => {
    const fixture = TestBed.createComponent(InstrumentViewerComponent);
    const component = fixture.componentInstance;
    component.channelColor = 'green';
    expect(component.getChannelDisplayName()).toBe('Green');
  });

  it('should return None when no channel', () => {
    const fixture = TestBed.createComponent(InstrumentViewerComponent);
    const component = fixture.componentInstance;
    component.channelColor = null;
    expect(component.getChannelDisplayName()).toBe('None');
  });

  it('should update current instrument when context is received', fakeAsync(() => {
    const fixture = TestBed.createComponent(InstrumentViewerComponent);
    fixture.detectChanges();
    tick(); // resolve registerContextListener promise

    contextSubject.next({
      type: 'fdc3.instrument',
      id: { ticker: 'EURUSD' },
      name: 'EUR/USD',
    });

    const component = fixture.componentInstance;
    expect(component.currentInstrument).toBeTruthy();
    expect(component.currentInstrument!.id.ticker).toBe('EURUSD');
  }));

  it('should add to history when context is received', fakeAsync(() => {
    const fixture = TestBed.createComponent(InstrumentViewerComponent);
    fixture.detectChanges();
    tick();

    contextSubject.next({
      type: 'fdc3.instrument',
      id: { ticker: 'GBPUSD' },
      name: 'GBP/USD',
    });

    const component = fixture.componentInstance;
    expect(component.contextHistory.length).toBe(1);
    expect(component.contextHistory[0].instrument.id.ticker).toBe('GBPUSD');
  }));

  it('should show instrument card after receiving context', fakeAsync(() => {
    const fixture = TestBed.createComponent(InstrumentViewerComponent);
    fixture.detectChanges();
    tick();

    contextSubject.next({
      type: 'fdc3.instrument',
      id: { ticker: 'USDJPY' },
      name: 'USD/JPY',
    });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.instrument-card')).toBeTruthy();
    expect(compiled.querySelector('.empty-state')).toBeNull();
  }));
});
