import { Component, OnInit, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Logger, LogLevel } from '@macro/logger';
import { isPlatformBrowser } from '@angular/common';
import { getInitialIsDark, applyDarkMode, onSystemThemeChange } from '@macro/macro-design';
import { onOpenFinThemeChange } from '@macro/openfin/theme-sync';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  standalone: true,
  imports: [RouterOutlet],
})
export class App implements OnInit, OnDestroy {
  private logger = Logger.getLogger('AngularFdc3App');
  private platformId = inject(PLATFORM_ID);

  public isDark = false;
  private cleanupSystemListener?: () => void;
  private cleanupOpenFinListener?: () => void;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.isDark = getInitialIsDark();
      this.cleanupSystemListener = onSystemThemeChange((isDark) => {
        this.isDark = isDark;
        this.applyTheme();
      });
      this.cleanupOpenFinListener = onOpenFinThemeChange((isDark) => {
        this.isDark = isDark;
        this.applyTheme();
      });
    }
  }

  ngOnInit(): void {
    this.applyTheme();
    Logger.setGlobalLevel(LogLevel.DEBUG);
    this.logger.info('FDC3 Instrument Viewer initialized');
  }

  ngOnDestroy(): void {
    this.cleanupSystemListener?.();
    this.cleanupOpenFinListener?.();
  }

  private applyTheme(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    applyDarkMode(this.isDark);
  }
}
