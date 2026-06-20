import type { AuthService } from './auth.service';

/**
 * Entitlements (authorization) service.
 *
 * Decides whether the current user may LAUNCH a given app. Apps remain visible to
 * everyone; only launch is gated. An app with no required entitlements (or no entry)
 * is launchable by all; otherwise the user must hold at least one (any-of) required
 * entitlement. Reads its data from {@link AuthService} (one shared fetch of
 * `entitlements.json`).
 */
export class EntitlementsService {
  private apps: Record<string, string[]> = {};
  private userEntitlements = new Set<string>();
  private loaded = false;
  private loading: Promise<void> | null = null;

  constructor(private readonly authService: AuthService) {}

  /** Ensure the user's entitlements + the app requirements map are loaded (idempotent). */
  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    if (!this.loading) {
      this.loading = (async () => {
        const cfg = await this.authService.getEntitlementsConfig();
        const user = await this.authService.getUser();
        this.apps = cfg.apps ?? {};
        this.userEntitlements = new Set(user.entitlements ?? []);
        this.loaded = true;
      })();
    }
    return this.loading;
  }

  /** Entitlements required to launch `appId` (empty = open to all). */
  getRequiredEntitlements(appId: string): string[] {
    return this.apps[appId] ?? [];
  }

  /** Whether the current user may launch `appId`. Call {@link ensureLoaded} first. */
  canLaunch(appId: string): boolean {
    const required = this.getRequiredEntitlements(appId);
    if (required.length === 0) return true;
    return required.some((entitlement) => this.userEntitlements.has(entitlement));
  }

  /** The current user's entitlement set (copy). */
  getEntitlements(): Set<string> {
    return new Set(this.userEntitlements);
  }
}
