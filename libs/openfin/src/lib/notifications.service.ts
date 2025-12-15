import type { NotificationActionEvent, NotificationOptions } from '@openfin/workspace/notifications';
import {
  addEventListener,
  create as createNotification,
  deregister as deregisterPlatform,
  register as registerPlatform,
} from '@openfin/workspace/notifications';
import { Observable, Subject, takeUntil, tap } from 'rxjs';
import type { SettingsService } from './settings.service';
import { Logger } from '@macro/logger';

const logger = Logger.getLogger('NotificationsService');

/**
 * Notifications service for managing OpenFin notifications
 * Framework-agnostic implementation
 */
export class NotificationsService {
  private readonly unsubscribe$ = new Subject<void>();

  constructor(private readonly settingsService: SettingsService) {
    this.register();
  }

  private register() {
    if (typeof fin === 'undefined') {
      return;
    }

    this.settingsService
      .getManifestSettings()
      .then(({ platformSettings }) => {
        registerPlatform({
          notificationsPlatformOptions: platformSettings,
        });
      })
      .catch((error) => {
        logger.error('Error registering notifications platform', error);
      });
  }

  observeNotificationActions() {
    if (typeof fin === 'undefined') {
      return new Observable<NotificationActionEvent>((observer) => {
        observer.complete();
      });
    }

    return new Observable<NotificationActionEvent>((observer) => {
      addEventListener('notification-action', (event) => observer.next(event));
    });
  }

  async deregister(platformId: string) {
    if (typeof fin === 'undefined') {
      return;
    }

    this.unsubscribe$.next();
    this.unsubscribe$.complete();
    await deregisterPlatform(platformId);
  }

  create(config: NotificationOptions) {
    if (typeof fin === 'undefined') {
      return;
    }

    createNotification(config);
  }
}

