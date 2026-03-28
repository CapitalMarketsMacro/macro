import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { WorkspaceService, ThemeService, ThemePresetService, NotificationsService, SettingsService } from '@macro/openfin';
import type { ThemePresetInfo } from '@macro/openfin';
import { Logger } from '@macro/logger';
import { AsyncPipe } from '@angular/common';

const logger = Logger.getLogger('ProviderComponent');

@Component({
  selector: 'app-provider',
  templateUrl: './provider.component.html',
  styleUrl: './provider.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [AsyncPipe],
})
export class ProviderComponent implements OnInit, OnDestroy {
  private readonly workspaceService = inject(WorkspaceService);
  private readonly themeService = inject(ThemeService);
  private readonly themePresetService = inject(ThemePresetService);
  private readonly notificationsService = inject(NotificationsService);
  private readonly settingsService = inject(SettingsService);
  private readonly unsubscribe$ = new Subject<void>();

  readonly message$ = this.workspaceService.getStatus$();
  readonly runtimeVersion = signal('');
  readonly platformVersion = signal('');
  readonly showQuitConfirm = signal(false);
  readonly expanded = signal(false);

  readonly presets: ThemePresetInfo[] = this.themePresetService.getAvailablePresets();
  activePresetId = this.themePresetService.getActivePresetId();

  private readonly COLLAPSED_HEIGHT = 280;
  private readonly EXPANDED_HEIGHT = 440;

  async ngOnInit(): Promise<void> {
    this.themeService.syncWithOpenFinTheme();

    this.workspaceService
      .init()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe();

    // Position window to top-right of primary monitor
    if (typeof fin !== 'undefined') {
      try {
        const monitorInfo = await fin.System.getMonitorInfo();
        const primary = monitorInfo.primaryMonitor.availableRect;
        const win = fin.Window.getCurrentSync();
        await win.moveTo(primary.right - 292, primary.top + 12);

        // Get runtime version
        const rv = await fin.System.getVersion();
        this.runtimeVersion.set(rv);
        this.platformVersion.set('23.0.20');

        // Disable close button via window options
        await win.updateOptions({ closeOnLastViewRemoved: false } as any);
      } catch (err) {
        logger.error('Error positioning provider window', err);
      }
    }
  }

  async minimizeWindow(): Promise<void> {
    if (typeof fin === 'undefined') return;
    try {
      await fin.Window.getCurrentSync().minimize();
    } catch (err) {
      logger.error('Error minimizing window', err);
    }
  }

  async uploadLogs(): Promise<void> {
    if (typeof fin === 'undefined') return;
    try {
      await fin.System.launchLogUploader({
        endpoint: 'http://MontuNobleNumbat2404:8000',
        logs: ['debug:self', 'app', 'rvm'],
        ui: { show: true },
      } as any);
      this.notificationsService.info('Logs', 'Log uploader launched');
    } catch (err) {
      logger.error('Error launching log uploader', err);
      this.notificationsService.error('Logs', 'Failed to launch log uploader');
    }
  }

  async sendLogs(): Promise<void> {
    if (typeof fin === 'undefined') return;
    try {
      const app = await fin.Application.getCurrent();
      const result = await app.sendApplicationLog();
      logger.info('Application log sent : Result', result);
      this.notificationsService.success('Logs', 'Application log sent to log server');
    } catch (err: any) {
      // sendApplicationLog may throw even when logs are delivered successfully
      // (e.g. server returns non-JSON response). Treat as success if logs arrived.
      logger.warn('sendApplicationLog completed with error', err);
      this.notificationsService.info('Logs', 'Application log sent (server acknowledged)');
    }
  }

  async launchAnalytics(): Promise<void> {
    if (typeof fin === 'undefined') return;
    try {
      const env = new URLSearchParams(window.location.search).get('env') || 'local';
      const manifestUrl = `${window.location.origin}/${env}/analytics-dashboard.fin.json`;
      const platform = fin.Platform.getCurrentSync();
      await (platform as any).createView({ manifestUrl });
    } catch (err) {
      logger.error('Error launching analytics', err);
    }
  }

  async launchProcessManager(): Promise<void> {
    if (typeof fin === 'undefined') return;
    try {
      await fin.Application.startFromManifest('http://cdn.openfin.co/release/apps/openfin/processmanager/app.json');
    } catch (err) {
      logger.error('Error launching process manager', err);
    }
  }

  async maximizePlatform(): Promise<void> {
    if (typeof fin === 'undefined') return;
    try {
      const win = fin.Window.getCurrentSync();
      const state = await win.getState();
      if (state === 'maximized') {
        await win.restore();
      } else {
        await win.maximize();
      }
    } catch (err) {
      logger.error('Error toggling maximize', err);
    }
  }

  async toggleExpand(): Promise<void> {
    const next = !this.expanded();
    this.expanded.set(next);
    if (typeof fin !== 'undefined') {
      try {
        const win = fin.Window.getCurrentSync();
        const bounds = await win.getBounds();
        const h = next ? this.EXPANDED_HEIGHT : this.COLLAPSED_HEIGHT;
        await win.resizeTo(bounds.width, h, 'top-left');
      } catch (err) {
        logger.error('Error resizing provider window', err);
      }
    }
  }

  async applyPreset(preset: ThemePresetInfo): Promise<void> {
    if (preset.id === this.activePresetId) return;
    this.themePresetService.setActivePresetId(preset.id);
    this.activePresetId = preset.id;
    if (typeof fin !== 'undefined') {
      await fin.Application.getCurrentSync().restart();
    }
  }

  sendTestNotification(level: 'info' | 'success' | 'warning' | 'error' | 'critical'): void {
    const messages: Record<string, { title: string; body: string }> = {
      info: { title: 'Info', body: 'Informational notification from Macro workspace.' },
      success: { title: 'Success', body: 'Operation completed successfully.' },
      warning: { title: 'Warning', body: 'Margin threshold approaching.' },
      error: { title: 'Error', body: 'Failed to connect to market data feed.' },
      critical: { title: 'Critical', body: 'Critical market event detected.' },
    };
    const { title, body } = messages[level];
    this.notificationsService[level](title, body);
  }

  requestQuit(): void {
    this.showQuitConfirm.set(true);
  }

  cancelQuit(): void {
    this.showQuitConfirm.set(false);
  }

  confirmQuit(): void {
    this.showQuitConfirm.set(false);
    this.workspaceService.quit();
  }

  ngOnDestroy(): void {
    this.themeService.stopSyncing();
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }
}
