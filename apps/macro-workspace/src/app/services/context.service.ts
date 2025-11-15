import { Injectable } from '@angular/core';
import type { Context, Listener } from '@finos/fdc3';
import { Observable, Subject, shareReplay } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ContextService {
  private readonly contextSubject = new Subject<Context>();
  private listenerRef: Listener | null = null;

  readonly context$ = this.contextSubject.asObservable().pipe(shareReplay(1));

  broadcast(context: Context) {
    if (typeof fdc3 === 'undefined') {
      console.warn('FDC3 desktop agent not available');
      return;
    }

    fdc3.broadcast(context).then(() => {
      console.log('Context broadcast successfully');
    }).catch((err) => {
      console.error('Failed to broadcast context', err);
    });
  }

  async registerContextListener(contextType: string | null = null) {
    if (this.listenerRef) {
      this.removeListener();
    }

    if (typeof fdc3 === 'undefined') {
      console.warn('FDC3 desktop agent not available');
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
