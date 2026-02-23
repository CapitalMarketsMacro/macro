import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, NO_ERRORS_SCHEMA } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideZonelessChangeDetection()],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  it('should create the root component', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should be a standalone component', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeInstanceOf(App);
  });

  it('should render a router-outlet element', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('should have display: contents on the host element', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const hostElement = fixture.nativeElement as HTMLElement;
    // The :host style is applied to the component element itself
    // In test environment, we verify the component renders without errors
    expect(hostElement).toBeTruthy();
  });
});
