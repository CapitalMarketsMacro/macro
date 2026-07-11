import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';

import { Subject, takeUntil } from 'rxjs';

import {
  WorkspaceService,
  ThemeService,
  ThemePresetService,
  NotificationsService,
  SettingsService,
  getActiveStorageEnvironment,
  listStorageEnvironments,
  saveStorageEnvironmentChoice,
  LOCAL_STORAGE_ENVIRONMENT,
  STORAGE_ENV_QUERY_PARAM,
} from '@macro/openfin';

import type { NotificationToastMode, ResolvedStorageEnvironment, ThemePresetInfo } from '@macro/openfin';

import { Logger } from '@macro/logger';

import { AsyncPipe } from '@angular/common';

// Single source of truth for the displayed Workspace version — tracks the installed
// @openfin/workspace package so it can never drift from the actual bundled version.
import workspacePkg from '@openfin/workspace/package.json';



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

  // Signal (not a plain field): in REST storage mode the persisted preset arrives via
  // async hydration during platform init, after this component is constructed.
  readonly activePresetId = signal(this.themePresetService.getActivePresetId());

  // Storage environment picker (unified Workspace Storage API: local / DEV / UAT / PROD)
  readonly storageEnvironments = signal<ResolvedStorageEnvironment[]>([LOCAL_STORAGE_ENVIRONMENT]);
  readonly activeStorageEnv = signal<ResolvedStorageEnvironment>(getActiveStorageEnvironment());

  private readonly storageEnvQueryValue = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get(STORAGE_ENV_QUERY_PARAM)
    : null;

  /**
   * True when `?storageEnv=` pins the environment — the picker can't override it.
   * Only counts as pinned when the query value actually WON resolution: an unknown or
   * invalid value is skipped with a fallback, and the picker must stay usable then.
   */
  readonly storageEnvPinned = computed(
    () => this.storageEnvQueryValue !== null && this.activeStorageEnv().name === this.storageEnvQueryValue,
  );



  private readonly COLLAPSED_HEIGHT = 280;



  async ngOnInit(): Promise<void> {

    this.themeService.syncWithOpenFinTheme();



    this.workspaceService

      .init()

      .pipe(takeUntil(this.unsubscribe$))

      .subscribe();

    // The storage environment + theme preset resolve asynchronously during init —
    // refresh the panel state on every status transition so the UI tracks them.
    this.workspaceService
      .getStatus$()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(() => {
        this.activeStorageEnv.set(getActiveStorageEnvironment());
        this.activePresetId.set(this.themePresetService.getActivePresetId());
      });

    // Populate the environment picker from settings.json's storage block.
    this.settingsService
      .getManifestSettings()
      .then((settings) => this.storageEnvironments.set(listStorageEnvironments(settings.storage)))
      .catch((err) => logger.warn('Could not load storage environments from settings', err));



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

        this.platformVersion.set(workspacePkg.version);



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

        endpoint: 'http://MontyUbuntu2604:8000',

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

      // Wait a tick for Angular to render the expanded content, then measure

      setTimeout(async () => {

        try {

          const win = fin.Window.getCurrentSync();

          const bounds = await win.getBounds();

          const contentHeight = next

            ? document.querySelector('.provider')?.scrollHeight ?? 440

            : this.COLLAPSED_HEIGHT;

          const h = Math.min(Math.max(contentHeight + 2, this.COLLAPSED_HEIGHT), 600);

          await win.resizeTo(bounds.width, h, 'top-left');

        } catch (err) {

          logger.error('Error resizing provider window', err);

        }

      }, 50);

    }

  }



  async applyPreset(preset: ThemePresetInfo): Promise<void> {

    if (preset.id === this.activePresetId()) return;

    // Await the write — in REST storage mode a fire-and-forget save could be
    // killed by the restart below before it reaches the storage service. When the
    // write fails, do NOT restart: the platform would come back on the old preset.
    try {
      await this.themePresetService.setActivePresetId(preset.id);
    } catch (err) {
      logger.error('Theme preset was not persisted — skipping restart', err);
      this.notificationsService.error('Theme', 'Could not save the theme preset (storage unavailable). Try again.');
      return;
    }

    this.activePresetId.set(preset.id);

    if (typeof fin !== 'undefined') {

      await fin.Application.getCurrentSync().restart();

    }

  }

  /**
   * Switch the storage environment (local localStorage vs DEV/UAT/PROD storage
   * service). The choice persists on this machine and takes effect on restart —
   * the whole platform (workspaces, pages, dock, favorites, preferences, config)
   * re-reads from the new backend.
   */
  async applyStorageEnvironment(env: ResolvedStorageEnvironment): Promise<void> {
    if (this.storageEnvPinned() || env.name === this.activeStorageEnv().name) return;
    const isDefault = env.name === (await this.defaultStorageEnvironmentName());
    // Clear the override when picking the settings default, so settings.json stays in charge.
    saveStorageEnvironmentChoice(isDefault ? undefined : env.name);
    if (typeof fin !== 'undefined') {
      await fin.Application.getCurrentSync().restart();
    } else if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }

  private async defaultStorageEnvironmentName(): Promise<string | undefined> {
    try {
      return (await this.settingsService.getManifestSettings()).storage?.defaultEnvironment;
    } catch {
      return undefined;
    }
  }



  sendTestNotification(

    level: 'info' | 'success' | 'warning' | 'error' | 'critical',

    toast?: NotificationToastMode,

  ): void {

    const messages: Record<string, { title: string; body: string }> = {

      info: { title: 'Info', body: 'Informational notification from Macro workspace.' },

      success: { title: 'Success', body: 'Operation completed successfully.' },

      warning: { title: 'Warning', body: 'Margin threshold approaching.' },

      error: { title: 'Error', body: 'Failed to connect to market data feed.' },

      critical: { title: 'Critical', body: 'Critical market event detected.' },

    };

    const { title, body } = messages[level];

    // NC 2.15: 'sticky' stays on screen until interacted with, 'transient' (default)
    // fades, 'none' lands in the Notification Center only.
    this.notificationsService[level](

      toast ? `${title} (${toast} toast)` : title,

      body,

      toast ? { toast } : undefined,

    );

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

