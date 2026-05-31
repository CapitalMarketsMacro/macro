/**
 * Angular adapter for the Macro theme system.
 *
 * Import from `@macro/macro-design/angular`:
 * ```ts
 * private readonly theme = inject(ThemeService);
 * // template: @if (theme.isDark()) { ... }  (click)="theme.toggle()"
 * ```
 *
 * Wraps the framework-agnostic {@link themeController} and exposes its state as
 * Angular signals. Provided in root, so every consumer shares the same state.
 */
import { Injectable, OnDestroy, computed, signal } from '@angular/core';
import { themeController, type ThemeMode, type ThemeState } from '../theme-controller';
import type { MacroThemeDefinition } from '../themes';
import type { ThemePalette } from '../theme.config';

@Injectable({ providedIn: 'root' })
export class ThemeService implements OnDestroy {
  private readonly _state = signal<ThemeState>(themeController.getSnapshot());
  private readonly unsubscribe: () => void;

  /** Full reactive state snapshot. */
  readonly state = this._state.asReadonly();
  /** `true` when dark mode is active. */
  readonly isDark = computed<boolean>(() => this._state().isDark);
  /** `'dark'` | `'light'`. */
  readonly mode = computed<ThemeMode>(() => this._state().mode);
  /** Active theme id (default `'macro'`). */
  readonly themeId = computed<string>(() => this._state().themeId);
  /** Active theme definition. */
  readonly theme = computed<MacroThemeDefinition>(() => this._state().theme);
  /** Active palette for the current mode. */
  readonly palette = computed<ThemePalette>(() => this._state().palette);

  constructor() {
    themeController.start();
    this._state.set(themeController.getSnapshot());
    this.unsubscribe = themeController.subscribe(() => this._state.set(themeController.getSnapshot()));
  }

  /** Flip dark/light (persists the user's choice). */
  toggle(): void {
    themeController.toggle();
  }

  /** Set dark/light explicitly (persists the user's choice). */
  setDark(isDark: boolean): void {
    themeController.setDark(isDark);
  }

  /** Switch the active named theme. */
  setTheme(themeId: string): void {
    themeController.setTheme(themeId);
  }

  ngOnDestroy(): void {
    this.unsubscribe();
  }
}

export { themeController } from '../theme-controller';
export type { ThemeState, ThemeMode } from '../theme-controller';
export type { MacroThemeDefinition } from '../themes';
export type { ThemePalette } from '../theme.config';
