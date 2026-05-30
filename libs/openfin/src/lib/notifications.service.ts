import type { NotificationActionEvent, NotificationOptions, IndicatorColor } from '@openfin/workspace/notifications';
import { Observable } from 'rxjs';
import type { PlatformSettings } from './types';
import { Logger } from '@macro/logger';

// Lazy-load the notifications API to avoid crashing in non-OpenFin browser environments.
// The @openfin/workspace/notifications module reads fin.me.uuid at import time.
async function getNotificationsApi() {
  return await import('@openfin/workspace/notifications');
}

const logger = Logger.getLogger('NotificationsService');

/**
 * Serialize an error for structured logging. `Error` objects have no enumerable
 * own properties, so logging them directly yields `{}` and hides the message.
 */
function serializeError(error: unknown): unknown {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return error;
}

/** Severity level for convenience notification methods. */
export type NotificationLevel = 'info' | 'success' | 'warning' | 'error' | 'critical';

/** v24 toast display mode. */
export type NotificationToastMode = 'sticky' | 'transient' | 'none';

/** Options accepted by the level-based convenience methods. */
export interface LevelNotificationOptions {
  title: string;
  body: string;
  /** Source identifier shown in Notification Center (defaults to platform id). */
  source?: string;
  /** Custom icon URL (defaults to platform icon). */
  icon?: string;
  /** v24: Toast display mode — 'sticky' persists, 'transient' auto-dismisses, 'none' goes straight to center. */
  toast?: NotificationToastMode;
  /** v24: Priority 1 (highest) to 4 (lowest) — affects ordering in Notification Center. */
  priority?: 1 | 2 | 3 | 4;
  /** v24: Sound mode — 'default' plays sound, 'silent' suppresses it. */
  sound?: 'default' | 'silent';
}

/** Maps severity levels to OpenFin indicator colors. */
const LEVEL_INDICATOR_COLORS: Record<NotificationLevel, IndicatorColor> = {
  info: 'blue' as IndicatorColor,
  success: 'green' as IndicatorColor,
  warning: 'yellow' as IndicatorColor,
  error: 'red' as IndicatorColor,
  critical: 'magenta' as IndicatorColor,
};

const LEVEL_LABELS: Record<NotificationLevel, string> = {
  info: 'Info',
  success: 'Success',
  warning: 'Warning',
  error: 'Error',
  critical: 'Critical',
};

/**
 * Notifications service for managing OpenFin notifications.
 * Framework-agnostic implementation.
 *
 * Registration is explicit — call `register(platformSettings)` during
 * workspace startup rather than auto-registering in the constructor.
 */
export class NotificationsService {
  private readonly MAX_CREATE_ATTEMPTS = 5;
  private readonly CREATE_RETRY_DELAY_MS = 200;
  private platformId?: string;
  private platformIcon?: string;
  private platformTitle?: string;
  /**
   * The notifications client environment is initialized per-window (per JS realm).
   * The provider window initializes it via `register()`; views/child windows that
   * only send notifications must initialize their own environment before `create()`
   * or every dispatch throws "Environment is not initialized..".
   */
  private clientInitialized = false;
  private clientInitPromise?: Promise<void>;

  async register(platformSettings: PlatformSettings): Promise<void> {
    if (typeof fin === 'undefined') return;

    this.platformId = platformSettings.id;
    this.platformIcon = platformSettings.icon;
    this.platformTitle = platformSettings.title;
    try {
      const { register: registerPlatform } = await getNotificationsApi();
      await registerPlatform({
        notificationsPlatformOptions: {
          id: platformSettings.id,
          icon: platformSettings.icon,
          title: platformSettings.title,
        },
      });
      // register() also initializes the client environment in this window.
      this.clientInitialized = true;
      logger.info('Notifications platform registered', { id: platformSettings.id });
    } catch (error) {
      logger.error('Error registering notifications platform', { error: serializeError(error) });
    }
  }

  /**
   * Ensure the notifications client environment is initialized in the current window.
   *
   * Views and other child windows that only *send* notifications (never register the
   * platform) still need their own client environment. Calling the notifications
   * `register()` with no platform options initializes the environment without
   * overriding the configuration set by the provider. Idempotent — initializes once.
   */
  async ensureClientInitialized(): Promise<void> {
    if (typeof fin === 'undefined' || this.clientInitialized) return;
    if (this.clientInitPromise) return this.clientInitPromise;

    this.clientInitPromise = (async () => {
      const { register: registerPlatform } = await getNotificationsApi();
      await registerPlatform();
      this.clientInitialized = true;
      logger.info('Notifications client environment initialized');
    })();

    try {
      await this.clientInitPromise;
    } finally {
      this.clientInitPromise = undefined;
    }
  }

  observeNotificationActions(): Observable<NotificationActionEvent> {
    if (typeof fin === 'undefined') {
      return new Observable<NotificationActionEvent>((observer) => {
        observer.complete();
      });
    }

    return new Observable<NotificationActionEvent>((observer) => {
      getNotificationsApi()
        .then(({ addEventListener }) => {
          addEventListener('notification-action', (event) => observer.next(event));
        })
        .catch((error) => {
          logger.error('Unable to attach notification action listener', error);
          observer.complete();
        });
    });
  }

  async deregister(): Promise<void> {
    if (typeof fin === 'undefined' || !this.platformId) return;

    const { deregister: deregisterPlatform } = await getNotificationsApi();
    await deregisterPlatform(this.platformId);
    logger.info('Notifications platform deregistered', { id: this.platformId });
  }

  create(config: NotificationOptions): void {
    if (typeof fin === 'undefined') return;

    void this.createWithRetry(config);
  }

  private async createWithRetry(config: NotificationOptions, attempt = 1): Promise<void> {
    try {
      // Initialize this window's notifications environment before dispatching.
      // Without this, create() from a view throws "Environment is not initialized..".
      await this.ensureClientInitialized();
      const { create } = await getNotificationsApi();
      await create(config);
    } catch (error) {
      if (this.isEnvironmentNotInitializedError(error) && attempt < this.MAX_CREATE_ATTEMPTS) {
        logger.warn('Notifications environment not initialized yet; retrying create', {
          attempt,
          nextAttempt: attempt + 1,
        });
        // The environment failed to initialize on this attempt; force a re-init next try.
        this.clientInitialized = false;
        await new Promise((resolve) => setTimeout(resolve, this.CREATE_RETRY_DELAY_MS));
        await this.createWithRetry(config, attempt + 1);
        return;
      }
      logger.error('Error creating notification', {
        attempt,
        title: config.title,
        error: serializeError(error),
      });
    }
  }

  private isEnvironmentNotInitializedError(error: unknown): boolean {
    if (error instanceof Error) {
      return error.message.includes('Environment is not initialized');
    }
    return String(error).includes('Environment is not initialized');
  }

  /**
   * Send a notification with a pre-configured severity level.
   * Automatically sets the indicator color, label, stream, and icon.
   */
  notify(level: NotificationLevel, options: LevelNotificationOptions): void {
    const source = options.source ?? this.platformTitle ?? 'Workspace';
    const streamId = this.platformId ?? 'macro-workspace';

    this.create({
      title: options.title,
      body: options.body,
      icon: options.icon ?? this.platformIcon ?? '',
      indicator: { color: LEVEL_INDICATOR_COLORS[level], text: LEVEL_LABELS[level] },
      stream: { id: streamId, displayName: source, appId: streamId },
      // v24: Toast display mode, priority, and sound options
      ...(options.toast && { toast: options.toast }),
      ...(options.priority && { priority: options.priority }),
      ...(options.sound && { soundOptions: { mode: options.sound } }),
    } as NotificationOptions);
  }

  /** Informational notification (blue indicator). */
  info(title: string, body: string, options?: Partial<LevelNotificationOptions>): void {
    this.notify('info', { title, body, ...options });
  }

  /** Success notification (green indicator). */
  success(title: string, body: string, options?: Partial<LevelNotificationOptions>): void {
    this.notify('success', { title, body, ...options });
  }

  /** Warning notification (yellow indicator). */
  warning(title: string, body: string, options?: Partial<LevelNotificationOptions>): void {
    this.notify('warning', { title, body, ...options });
  }

  /** Error notification (red indicator). */
  error(title: string, body: string, options?: Partial<LevelNotificationOptions>): void {
    this.notify('error', { title, body, ...options });
  }

  /** Critical notification (magenta indicator). */
  critical(title: string, body: string, options?: Partial<LevelNotificationOptions>): void {
    this.notify('critical', { title, body, ...options });
  }

  /**
   * Schedule a reminder for an existing notification.
   * The notification will reappear in the Notification Center at the specified time.
   * @param notificationId - ID of the notification to set the reminder for
   * @param reminderDate - When the reminder should fire (must be in the future)
   * @returns true if the reminder was set successfully
   */
  async setReminder(notificationId: string, reminderDate: Date): Promise<boolean> {
    if (typeof fin === 'undefined') return false;
    try {
      const api = await getNotificationsApi() as any;
      if (typeof api.setReminder !== 'function') {
        logger.warn('setReminder not supported by this workspace version');
        return false;
      }
      return await api.setReminder(notificationId, reminderDate);
    } catch (err) {
      logger.error('Failed to set notification reminder', { notificationId, err });
      return false;
    }
  }

  /**
   * Cancel a previously scheduled reminder.
   * @param notificationId - ID of the notification whose reminder should be cancelled
   * @returns true if the reminder was cancelled successfully
   */
  async cancelReminder(notificationId: string): Promise<boolean> {
    if (typeof fin === 'undefined') return false;
    try {
      const api = await getNotificationsApi() as any;
      if (typeof api.cancelReminder !== 'function') {
        logger.warn('cancelReminder not supported by this workspace version');
        return false;
      }
      return await api.cancelReminder(notificationId);
    } catch (err) {
      logger.error('Failed to cancel notification reminder', { notificationId, err });
      return false;
    }
  }
}

