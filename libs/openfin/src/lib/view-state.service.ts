import { Logger } from '@macro/logger';

const logger = Logger.getLogger('ViewStateService');

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
   * Periodically collect state via `collectFn` and persist it.
   * @param collectFn Returns partial ViewStateData to merge into state.
   * @param intervalMs Interval in milliseconds (default 5 000).
   */
  enableAutoSave(collectFn: () => ViewStateData, intervalMs = 5000): void {
    this.disableAutoSave();

    this.autoSaveTimer = setInterval(async () => {
      try {
        const collected = collectFn();
        for (const [ns, data] of Object.entries(collected)) {
          this.state[ns] = data;
        }

        const view = getFinMe();
        if (view) {
          await view.updateOptions({ customData: { viewState: this.state } });
        }
      } catch (err) {
        logger.error('Auto-save failed', err);
      }
    }, intervalMs);
  }

  /**
   * Stop the periodic auto-save timer.
   */
  disableAutoSave(): void {
    if (this.autoSaveTimer != null) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = undefined;
    }
  }

  /**
   * Full cleanup — call on view destroy.
   */
  destroy(): void {
    this.disableAutoSave();
  }
}
