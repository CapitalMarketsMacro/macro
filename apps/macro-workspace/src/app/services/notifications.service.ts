import { inject, Injectable } from '@angular/core';
import type { NotificationActionEvent, NotificationOptions } from '@openfin/workspace/notifications';
import {
  addEventListener,
  create as createNotification,
  deregister as deregisterPlatform,
  register as registerPlatform,
} from '@openfin/workspace/notifications';
import { Observable, Subject, takeUntil, tap } from 'rxjs';
import { SettingsService } from './settings.service';

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly settingsService = inject(SettingsService);
  private readonly unsubscribe$ = new Subject<void>();

  constructor() {
    this.register();
  }

  private register() {
    if (typeof fin === 'undefined') {
      return;
    }

    this.settingsService
      .getManifestSettings()
      .pipe(
        tap(({ platformSettings }) => {
          registerPlatform({
            notificationsPlatformOptions: platformSettings,
          });
        }),
        takeUntil(this.unsubscribe$),
      )
      .subscribe();
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
