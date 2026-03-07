import type { Context, DesktopAgent, Listener } from '@finos/fdc3';
import { Observable, Subject, Subscription, shareReplay, distinctUntilChanged, filter } from 'rxjs';
import { Logger } from '@macro/logger';

const logger = Logger.getLogger('ContextService');

const CHANNEL_POLL_INTERVAL_MS = 1000;

function getFdc3(): DesktopAgent | undefined {
  return (globalThis as unknown as { fdc3?: DesktopAgent }).fdc3;
}

/**
 * Context service for FDC3 context broadcasting and listening
 * Framework-agnostic implementation
 */
export class ContextService {
  private readonly contextSubject = new Subject<Context>();
  private readonly channelSubject = new Subject<string | null>();
  private listenerRef: Listener | null = null;
  private channelPollInterval: ReturnType<typeof setInterval> | null = null;
  private channelPollRefCount = 0;

  readonly context$ = this.contextSubject.asObservable().pipe(shareReplay(1));

  /**
   * Observable that emits the current context group id (e.g. 'green', 'red')
   * whenever it changes. Emits null when not joined to any group.
   * Polling starts on first subscription and stops when all subscribers unsubscribe.
   */
  readonly currentChannel$: Observable<string | null> = new Observable<string | null>((subscriber) => {
    this.channelPollRefCount++;

    const sub = this.channelSubject.pipe(distinctUntilChanged()).subscribe(subscriber);

    if (this.channelPollRefCount === 1) {
      this.startChannelPolling();
    }

    return () => {
      sub.unsubscribe();
      this.channelPollRefCount--;
      if (this.channelPollRefCount === 0) {
        this.stopChannelPolling();
      }
    };
  });

  broadcast(context: Context) {
    const fdc3 = getFdc3();
    if (!fdc3) {
      logger.warn('FDC3 desktop agent not available');
      return;
    }

    fdc3.broadcast(context).then(() => {
      logger.info('Context broadcast successfully');
    }).catch((err) => {
      logger.error('Failed to broadcast context', err);
    });
  }

  async registerContextListener(contextType: string | null = null) {
    if (this.listenerRef) {
      this.removeListener();
    }

    const fdc3 = getFdc3();
    if (!fdc3) {
      logger.warn('FDC3 desktop agent not available');
      return;
    }

    this.listenerRef = await fdc3.addContextListener(contextType, (context) => {
      this.contextSubject.next(context);
    });
  }

  /**
   * Register a listener for a specific context type and return a filtered observable.
   * Automatically registers the FDC3 context listener. Caller should unsubscribe
   * the returned subscription, which also cleans up the FDC3 listener.
   */
  onContext<T extends Context = Context>(contextType: string): Observable<T> {
    this.registerContextListener(contextType);
    return this.context$.pipe(
      filter((ctx): ctx is T => ctx.type === contextType),
    );
  }

  removeListener() {
    if (this.listenerRef) {
      this.listenerRef.unsubscribe();
      this.listenerRef = null;
    }
  }

  private startChannelPolling(): void {
    const fdc3 = getFdc3();
    if (!fdc3) {
      this.channelSubject.next(null);
      logger.warn('FDC3 not available - channel polling skipped');
      return;
    }

    this.pollCurrentChannel(fdc3);
    this.channelPollInterval = setInterval(() => {
      this.pollCurrentChannel(fdc3);
    }, CHANNEL_POLL_INTERVAL_MS);
  }

  private stopChannelPolling(): void {
    if (this.channelPollInterval) {
      clearInterval(this.channelPollInterval);
      this.channelPollInterval = null;
    }
  }

  private async pollCurrentChannel(fdc3: DesktopAgent): Promise<void> {
    try {
      const channel = await fdc3.getCurrentChannel();
      this.channelSubject.next(channel?.id ?? null);
    } catch {
      // ignore polling errors
    }
  }
}

