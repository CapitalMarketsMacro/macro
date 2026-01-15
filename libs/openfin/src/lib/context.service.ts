import type { Context, DesktopAgent, Listener } from '@finos/fdc3';
import { Observable, Subject, shareReplay } from 'rxjs';
import { Logger } from '@macro/logger';

const logger = Logger.getLogger('ContextService');

function getFdc3(): DesktopAgent | undefined {
  return (globalThis as unknown as { fdc3?: DesktopAgent }).fdc3;
}

/**
 * Context service for FDC3 context broadcasting and listening
 * Framework-agnostic implementation
 */
export class ContextService {
  private readonly contextSubject = new Subject<Context>();
  private listenerRef: Listener | null = null;

  readonly context$ = this.contextSubject.asObservable().pipe(shareReplay(1));

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

  removeListener() {
    if (this.listenerRef) {
      this.listenerRef.unsubscribe();
      this.listenerRef = null;
    }
  }
}

