import type { NotificationActionEvent, NotificationOptions } from '@openfin/workspace/notifications';
import {
  addEventListener,
  create as createNotification,
  deregister as deregisterPlatform,
  register as registerPlatform,
} from '@openfin/workspace/notifications';
import { Observable } from 'rxjs';
import type { PlatformSettings } from './types';
import { Logger } from '@macro/logger';

const logger = Logger.getLogger('NotificationsService');

/**
 * Notifications service for managing OpenFin notifications.
 * Framework-agnostic implementation.
 *
 * Registration is explicit — call `register(platformSettings)` during
 * workspace startup rather than auto-registering in the constructor.
 */
export class NotificationsService {
  private platformId?: string;

  async register(platformSettings: PlatformSettings): Promise<void> {
    if (typeof fin === 'undefined') return;

    this.platformId = platformSettings.id;
    try {
      await registerPlatform({
        notificationsPlatformOptions: {
          id: platformSettings.id,
          icon: platformSettings.icon,
          title: platformSettings.title,
        },
      });
      logger.info('Notifications platform registered', { id: platformSettings.id });
    } catch (error) {
      logger.error('Error registering notifications platform', error);
    }
  }

  observeNotificationActions(): Observable<NotificationActionEvent> {
    if (typeof fin === 'undefined') {
      return new Observable<NotificationActionEvent>((observer) => {
        observer.complete();
      });
    }

    return new Observable<NotificationActionEvent>((observer) => {
      addEventListener('notification-action', (event) => observer.next(event));
    });
  }

  async deregister(): Promise<void> {
    if (typeof fin === 'undefined' || !this.platformId) return;

    await deregisterPlatform(this.platformId);
    logger.info('Notifications platform deregistered', { id: this.platformId });
  }

  create(config: NotificationOptions): void {
    if (typeof fin === 'undefined') return;

    createNotification(config);
  }
}

