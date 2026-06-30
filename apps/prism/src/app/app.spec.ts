import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { ThemeService } from '@macro/macro-design/angular';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: ThemeService, useValue: { isDark: () => false, toggle: () => undefined } },
      ],
    }).compileComponents();
  });

  it('creates the shell with a Catalog menu item', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as unknown as { menuItems: { label?: string }[] };
    expect(app).toBeTruthy();
    expect(app.menuItems.some((i) => i.label === 'Catalog')).toBe(true);
  });
});
