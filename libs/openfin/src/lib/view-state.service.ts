import { Logger } from '@macro/logger';

const logger = Logger.getLogger('ViewStateService');

const FLUSH_TOPIC = 'workspace:flush-view-state';

export interface ViewStateData {
  [namespace: string]: unknown;
}

interface OpenFinView {
  getOptions(): Promise<{ customData?: { viewState?: ViewStateData } }>;
  updateOptions(options: { customData: { viewState: ViewStateData } }): Promise<void>;
}

function getFinMe(): OpenFinView | undefined {
  return (globalThis as unknown as { fin?: { me?: OpenFinView } }).fin?.me;
}

/**
 * Framework-agnostic service for persisting view state across
 * OpenFin workspace save/restore cycles.
 *
 * State is stored in `fin.me.updateOptions({ customData: { viewState } })`
 * which is automatically captured in workspace snapshots.
 */
export class ViewStateService {
  private state: ViewStateData = {};
  private autoSaveTimer?: ReturnType<typeof setInterval>;
  private collectFn?: () => ViewStateData;
  private iabHandler?: () => void;

  /**
   * Restore all view state from the OpenFin view options.
   * Call this once on view init (e.g. ngAfterViewInit / useEffect).
   */
  async restoreState(): Promise<ViewStateData> {
    const view = getFinMe();
    if (!view) {
      logger.info('fin.me not available — running outside OpenFin, skipping restore');
      return this.state;
    }

    try {
      const opts = await view.getOptions();
      this.state = opts.customData?.viewState ?? {};
      logger.info('View state restored', { namespaces: Object.keys(this.state) });
    } catch (err) {
      logger.error('Failed to restore view state', err);
    }

    return this.state;
  }

  /**
   * Persist a namespaced piece of state.
   * Merges with existing namespaces so multiple providers coexist.
   */
  async saveState(namespace: string, data: unknown): Promise<void> {
    this.state[namespace] = data;

    const view = getFinMe();
    if (!view) {
      return;
    }

    try {
      await view.updateOptions({ customData: { viewState: this.state } });
    } catch (err) {
      logger.error('Failed to save view state', err);
    }
  }

  /**
   * In-memory read of a previously restored namespace.
   */
  getState(namespace: string): unknown {
    return this.state[namespace];
  }

  /**
   * Immediately collect and persist the current view state.
   * Called automatically when the workspace is saved, and can
   * also be called manually.
   */
  async flushState(): Promise<void> {
    if (!this.collectFn) return;

    const collected = this.collectFn();
    for (const [ns, data] of Object.entries(collected)) {
      this.state[ns] = data;
    }

    const view = getFinMe();
    if (view) {
      await view.updateOptions({ customData: { viewState: this.state } });
    }
  }

  /**
   * Register a collect function that will be called when the workspace
   * is saved. State is flushed on-demand only (no periodic timer).
   * Use this instead of `enableAutoSave` when you only want state
   * persisted at workspace-save time.
   * @param collectFn Returns partial ViewStateData to merge into state.
   */
  setCollector(collectFn: () => ViewStateData): void {
    this.clearCollector();
    this.collectFn = collectFn;
    this.subscribeToFlush();
  }

  /**
   * Remove the collect function and unsubscribe from flush events.
   */
  clearCollector(): void {
    this.unsubscribeFromFlush();
    this.collectFn = undefined;
  }

  /**
   * Periodically collect state via `collectFn` and persist it.
   * Also subscribes to workspace save events so state is flushed
   * immediately before a snapshot is captured.
   * @param collectFn Returns partial ViewStateData to merge into state.
   * @param intervalMs Interval in milliseconds (default 5 000).
   */
  enableAutoSave(collectFn: () => ViewStateData, intervalMs = 5000): void {
    this.disableAutoSave();
    this.collectFn = collectFn;

    this.autoSaveTimer = setInterval(async () => {
      try {
        await this.flushState();
      } catch (err) {
        logger.error('Auto-save failed', err);
      }
    }, intervalMs);

    this.subscribeToFlush();
  }

  /**
   * Stop the periodic auto-save timer and unsubscribe from flush events.
   */
  disableAutoSave(): void {
    if (this.autoSaveTimer != null) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = undefined;
    }
    this.clearCollector();
  }

  /**
   * Full cleanup — call on view destroy.
   */
  destroy(): void {
    this.disableAutoSave();
  }

  private subscribeToFlush(): void {
    const iab = (globalThis as any).fin?.InterApplicationBus;
    if (!iab) return;

    this.iabHandler = async () => {
      try {
        await this.flushState();
      } catch (err) {
        logger.error('Flush on workspace save failed', err);
      }
    };

    iab
      .subscribe({ uuid: '*' }, FLUSH_TOPIC, this.iabHandler)
      .catch((err: unknown) =>
        logger.error('Failed to subscribe to flush events', err),
      );
  }

  private unsubscribeFromFlush(): void {
    if (!this.iabHandler) return;

    const iab = (globalThis as any).fin?.InterApplicationBus;
    if (!iab) return;

    iab
      .unsubscribe({ uuid: '*' }, FLUSH_TOPIC, this.iabHandler)
      .catch((err: unknown) =>
        logger.error('Failed to unsubscribe from flush events', err),
      );
    this.iabHandler = undefined;
  }
}
