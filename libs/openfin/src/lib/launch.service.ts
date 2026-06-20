import type { App } from '@openfin/workspace';
import { Logger } from '@macro/logger';
import { launchApp } from './launch';
import type { EntitlementsService } from './entitlements.service';
import type { NotificationsService } from './notifications.service';

const logger = Logger.getLogger('LaunchService');

/**
 * Central launch guard. Every place that launches an app (storefront, home, dock,
 * platform custom action) routes through here so entitlement gating is enforced
 * uniformly: apps are visible to all, but a launch the user isn't entitled to is
 * blocked and surfaced as a notification.
 */
export class LaunchService {
  constructor(
    private readonly entitlementsService: EntitlementsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Launch `app` if the current user is entitled; otherwise block and notify.
   * @returns `true` if launched, `false` if blocked.
   */
  async launch(app: App): Promise<boolean> {
    await this.entitlementsService.ensureLoaded();
    if (!this.entitlementsService.canLaunch(app.appId)) {
      const required = this.entitlementsService.getRequiredEntitlements(app.appId);
      logger.warn('Launch blocked — user not entitled', { appId: app.appId, required });
      this.notificationsService.warning(
        'Access restricted',
        `You are not entitled to launch "${app.title || app.appId}". Required: ${required.join(', ')}. Contact your administrator.`,
      );
      return false;
    }
    await launchApp(app);
    return true;
  }
}
