import type OpenFin from '@openfin/core';
import { SnapServer, type ServerOptions, type SnapSnapshot } from '@openfin/snap-sdk';
import { Logger } from '@macro/logger';
import type { SnapProviderSettings } from './types';

const logger = Logger.getLogger('SnapService');

/**
 * Service for managing OpenFin Snap — window snapping/docking behavior.
 * Wraps @openfin/snap-sdk SnapServer with lifecycle management and
 * snapshot decoration/application for workspace persistence.
 */
export class SnapService {
  private server: SnapServer | undefined;
  private disableAutoReg: (() => Promise<void>) | undefined;

  /**
   * Initialize the Snap server and enable automatic window registration.
   * @param platformId The platform UUID used as the snap server id
   * @param settings Optional snap provider settings from manifest/settings
   */
  async init(platformId: string, settings?: SnapProviderSettings): Promise<void> {
    if (settings?.enabled === false) {
      logger.info('Snap provider disabled by configuration');
      return;
    }

    try {
      this.server = new SnapServer(platformId);
      const serverOptions: ServerOptions = {
        showDebug: settings?.serverOptions?.showDebug ?? false,
        disableUserUnstick: settings?.serverOptions?.disableUserUnstick ?? false,
        keyToStick: settings?.serverOptions?.keyToStick ?? false,
        disableGPUAcceleratedDragging: settings?.serverOptions?.disableGPUAcceleratedDragging ?? false,
        disableBlurDropPreview: settings?.serverOptions?.disableBlurDropPreview ?? false,
        autoHideClientTaskbarIcons: settings?.serverOptions?.autoHideClientTaskbarIcons ?? true,
        theme: settings?.serverOptions?.theme,
      };

      await this.server.start(serverOptions);
      this.disableAutoReg = await this.server.enableAutoWindowRegistration();
      logger.info('Snap initialized', { platformId });
    } catch (err) {
      logger.error('Error initializing Snap', err);
      this.server = undefined;
    }
  }

  /**
   * Whether the Snap server is running.
   */
  get isRunning(): boolean {
    return this.server !== undefined;
  }

  /**
   * Decorate a platform snapshot with the current snap layout.
   * Called from the workspace override's getSnapshot.
   */
  async decorateSnapshot(snapshot: OpenFin.Snapshot): Promise<OpenFin.Snapshot> {
    if (!this.server) return snapshot;
    try {
      return await this.server.decorateSnapshot(snapshot as SnapSnapshot);
    } catch (err) {
      logger.error('Failed to decorate snapshot with snap layout', err);
      return snapshot;
    }
  }

  /**
   * Prepare the snap server before applying a snapshot.
   * Called from the workspace override's applySnapshot before super.
   */
  async prepareToApplySnapshot(payload?: OpenFin.ApplySnapshotPayload): Promise<void> {
    if (!this.server) return;
    try {
      await this.server.prepareToApplySnapshot(payload);
    } catch (err) {
      logger.error('Failed to prepare snap snapshot', err);
    }
  }

  /**
   * Apply the snap layout from a decorated snapshot.
   * Called from the workspace override's applySnapshot after super.
   */
  async applySnapshot(snapshot: OpenFin.Snapshot): Promise<void> {
    if (!this.server) return;
    try {
      await this.server.applySnapshot(snapshot as SnapSnapshot);
    } catch (err) {
      logger.error('Failed to apply snap snapshot', err);
    }
  }

  /**
   * Stop the snap server and clean up.
   */
  async stop(): Promise<void> {
    if (!this.server) return;
    try {
      if (this.disableAutoReg) {
        await this.disableAutoReg();
        this.disableAutoReg = undefined;
      }
      await this.server.stop();
      logger.info('Snap server stopped');
    } catch (err) {
      logger.error('Error stopping Snap', err);
    } finally {
      this.server = undefined;
    }
  }
}
