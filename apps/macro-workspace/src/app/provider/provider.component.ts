import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { WorkspaceService, ThemeService, ThemePresetService, NotificationsService, FavoritesService, SettingsService } from '@macro/openfin';
import type { ThemePresetInfo } from '@macro/openfin';
import type { NotificationOptions } from '@openfin/workspace/notifications';

@Component({
  selector: 'app-provider',
  template: `
    <div class="col fill gap20">
      <header class="row spread middle">
        <div class="col">
          <h1>OpenFin Platform Window</h1>
          <h1 class="tag">Workspace platform window</h1>
        </div>
        <div class="row middle gap10">
          <img src="logo.svg" alt="OpenFin" height="40px" />
        </div>
      </header>
      <main class="col gap10">
        <p>This window initializes the OpenFin Workspace platform.</p>
        <p>You can hide it by setting platform.autoShow=false in manifest.fin.json.</p>
        <p class="message" style="color: orange">Status: {{ message$ | async }}</p>

        <section class="col gap10" style="margin-top: 16px">
          <h2>Theme Presets</h2>
          <p class="hint">Select a workspace theme. The platform will restart to apply the new palette.</p>
          <div class="row gap10" style="flex-wrap: wrap">
            @for (preset of presets; track preset.id) {
              <button
                class="theme-btn"
                [class.active]="preset.id === activePresetId"
                (click)="applyPreset(preset)"
              >
                {{ preset.label }}
              </button>
            }
          </div>
        </section>

        <section class="col gap10" style="margin-top: 16px">
          <h2>Store Favorites</h2>
          <p class="hint">Star apps to pin them in the Store's Favorites section.</p>
          <div class="row gap10" style="flex-wrap: wrap">
            @for (app of storeApps; track app.appId) {
              <button
                class="theme-btn"
                [class.active]="isFavorite(app.appId)"
                (click)="toggleFavorite(app.appId)"
              >
                {{ isFavorite(app.appId) ? '★' : '☆' }} {{ app.title }}
              </button>
            }
          </div>
        </section>

        <section class="col gap10" style="margin-top: 16px">
          <h2>Notifications</h2>
          <p class="hint">Send test notifications to the Notification Center.</p>
          <div class="row gap10">
            <button class="theme-btn" (click)="sendTestNotification('info')">Info</button>
            <button class="theme-btn" (click)="sendTestNotification('warning')">Warning</button>
            <button class="theme-btn" (click)="sendTestNotification('critical')">Critical</button>
          </div>
        </section>
      </main>
    </div>
  `,
  styles: `
    .hint {
      font-size: 0.85em;
      opacity: 0.7;
    }
    .theme-btn {
      padding: 8px 16px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.08);
      color: inherit;
      cursor: pointer;
      font-size: 0.9em;
      transition: background 0.15s, border-color 0.15s;
    }
    .theme-btn:hover {
      background: rgba(255, 255, 255, 0.15);
    }
    .theme-btn.active {
      background: rgba(10, 118, 211, 0.3);
      border-color: #0a76d3;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class ProviderComponent implements OnInit, OnDestroy {
  private readonly workspaceService = inject(WorkspaceService);
  private readonly themeService = inject(ThemeService);
  private readonly themePresetService = inject(ThemePresetService);
  private readonly notificationsService = inject(NotificationsService);
  private readonly favoritesService = inject(FavoritesService);
  private readonly settingsService = inject(SettingsService);
  private readonly unsubscribe$ = new Subject<void>();

  readonly message$ = this.workspaceService.getStatus$();
  readonly presets: ThemePresetInfo[] = this.themePresetService.getAvailablePresets();
  activePresetId = this.themePresetService.getActivePresetId();
  readonly storeApps = this.settingsService.getApps();

  ngOnInit(): void {
    // Initialize theme service to sync with OpenFin theme
    this.themeService.syncWithOpenFinTheme();

    this.workspaceService
      .init()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe();
  }

  async applyPreset(preset: ThemePresetInfo): Promise<void> {
    if (preset.id === this.activePresetId) {
      return;
    }

    this.themePresetService.setActivePresetId(preset.id);
    this.activePresetId = preset.id;

    // Restart the OpenFin application to apply the new theme palettes
    if (typeof fin !== 'undefined') {
      await fin.Application.getCurrentSync().restart();
    }
  }

  isFavorite(appId: string): boolean {
    return this.favoritesService.isFavorite(appId);
  }

  toggleFavorite(appId: string): void {
    this.favoritesService.toggleFavorite(appId);
  }

  sendTestNotification(level: 'info' | 'warning' | 'critical'): void {
    const configs: Record<string, { title: string; body: string; indicator: string; indicatorText: string }> = {
      info: {
        title: 'Info Notification',
        body: 'This is an informational notification from the Macro workspace.',
        indicator: 'blue',
        indicatorText: 'Workspace',
      },
      warning: {
        title: 'Warning Notification',
        body: 'This is a warning notification. Please review your positions.',
        indicator: 'yellow',
        indicatorText: 'Workspace',
      },
      critical: {
        title: 'Critical Alert',
        body: 'Critical market event detected. Immediate attention required.',
        indicator: 'red',
        indicatorText: 'Workspace',
      },
    };

    const config = configs[level];
    this.notificationsService.create({
      title: config.title,
      body: config.body,
      icon: 'logo.svg',
      indicator: { color: config.indicator, text: config.indicatorText } as any,
      stream: { id: 'macro-workspace', displayName: 'Macro Workspace', appId: 'macro-workspace' },
      buttons: [
        { title: 'Dismiss', type: 'button', cta: false, onClick: { task: 'dismiss' } } as any,
      ],
    } as NotificationOptions);
  }

  ngOnDestroy(): void {
    this.themeService.stopSyncing();
    this.workspaceService.quit();
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }
}
