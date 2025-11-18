import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';
import { ColorSchemeOptionType, getCurrentSync } from '@openfin/workspace-platform';
import { BehaviorSubject, Observable } from 'rxjs';
import { themeConfig, type ThemePalette } from './theme.config';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly currentTheme$ = new BehaviorSubject<'dark' | 'light'>('dark');
  private readonly currentPalette$ = new BehaviorSubject<ThemePalette>(themeConfig.dark);

  readonly isDark = signal(true);
  readonly currentPalette = signal<ThemePalette>(themeConfig.dark);

  constructor() {
    this.initializeTheme();
  }

  /**
   * Initialize theme from OpenFin workspace platform
   */
  private async initializeTheme(): Promise<void> {
    if (typeof fin === 'undefined') {
      return;
    }

    try {
      const workspacePlatform = getCurrentSync();
      const scheme = await workspacePlatform.Theme.getSelectedScheme();
      const isDarkMode = scheme === ColorSchemeOptionType.Dark;
      this.applyTheme(isDarkMode ? 'dark' : 'light');
    } catch (error) {
      console.error('Error initializing theme', error);
      this.applyTheme('dark');
    }
  }

  /**
   * Apply theme to the document
   */
  applyTheme(theme: 'dark' | 'light'): void {
    const palette = theme === 'dark' ? themeConfig.dark : themeConfig.light;
    
    this.isDark.set(theme === 'dark');
    this.currentPalette.set(palette);
    this.currentTheme$.next(theme);
    this.currentPalette$.next(palette);

    // Apply CSS variables to document root
    const root = this.document.documentElement;
    
    // Apply all palette colors as CSS variables with both naming conventions
    Object.entries(palette).forEach(([key, value]) => {
      if (value) {
        // Set with kebab-case (e.g., --brand-primary)
        const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
        root.style.setProperty(cssVar, value);
        
        // Also set with theme- prefix for openfin.css compatibility (e.g., --theme-brand-primary)
        const themeVar = `--theme-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
        root.style.setProperty(themeVar, value);
      }
    });

    // Toggle dark class for CSS selectors
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.add('theme-dark');
      root.classList.remove('theme-light');
    } else {
      root.classList.remove('dark');
      root.classList.add('theme-light');
      root.classList.remove('theme-dark');
    }
  }

  /**
   * Get current theme as observable
   */
  getTheme$(): Observable<'dark' | 'light'> {
    return this.currentTheme$.asObservable();
  }

  /**
   * Get current palette as observable
   */
  getPalette$(): Observable<ThemePalette> {
    return this.currentPalette$.asObservable();
  }

  /**
   * Toggle between dark and light theme
   */
  async toggleTheme(): Promise<void> {
    if (typeof fin === 'undefined') {
      const currentTheme = this.currentTheme$.getValue();
      this.applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
      return;
    }

    try {
      const workspacePlatform = getCurrentSync();
      const currentScheme = await workspacePlatform.Theme.getSelectedScheme();
      const newScheme =
        currentScheme === ColorSchemeOptionType.Dark
          ? ColorSchemeOptionType.Light
          : ColorSchemeOptionType.Dark;
      await workspacePlatform.Theme.setSelectedScheme(newScheme);
      // Theme will be updated via the listener
    } catch (error) {
      console.error('Error toggling theme', error);
    }
  }

  private syncInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Listen to OpenFin theme changes and sync
   */
  async syncWithOpenFinTheme(): Promise<void> {
    if (typeof fin === 'undefined') {
      return;
    }

    // Clear any existing interval
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    try {
      const workspacePlatform = getCurrentSync();
      
      // Initial sync
      const scheme = await workspacePlatform.Theme.getSelectedScheme();
      const isDarkMode = scheme === ColorSchemeOptionType.Dark;
      this.applyTheme(isDarkMode ? 'dark' : 'light');
      
      // Poll for theme changes (OpenFin doesn't have a direct event for theme changes)
      this.syncInterval = setInterval(async () => {
        try {
          const currentScheme = await workspacePlatform.Theme.getSelectedScheme();
          const isDarkMode = currentScheme === ColorSchemeOptionType.Dark;
          const currentTheme = this.currentTheme$.getValue();
          const newTheme = isDarkMode ? 'dark' : 'light';
          
          if (currentTheme !== newTheme) {
            this.applyTheme(newTheme);
          }
        } catch {
          // Silently handle errors during polling
        }
      }, 500); // Check every 500ms for more responsive updates
    } catch (error) {
      console.error('Error syncing with OpenFin theme', error);
    }
  }

  /**
   * Stop syncing with OpenFin theme
   */
  stopSyncing(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
}

