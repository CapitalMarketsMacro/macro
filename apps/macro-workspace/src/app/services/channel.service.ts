import { Injectable } from '@angular/core';
import type { Context, Listener } from '@finos/fdc3';
import { shareReplay, Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ChannelService {
  private readonly channelSubject = new Subject<Context>();
  private listenerRef: Listener | null = null;

  readonly channel$ = this.channelSubject.asObservable().pipe(shareReplay(1));

  broadcast(channelName: string, context: Context) {
    if (typeof fdc3 === 'undefined') {
      console.warn('FDC3 desktop agent not available');
      return;
    }

    fdc3.getOrCreateChannel(channelName).then((channel) => channel.broadcast(context));
  }

  async registerChannelListener(channelName: string, contextType: string | null = null) {
    if (this.listenerRef) {
      this.removeListener();
    }
    if (typeof fdc3 === 'undefined') {
      console.warn('FDC3 desktop agent not available');
      return;
    }

    const channel = await fdc3.getOrCreateChannel(channelName);
    this.listenerRef = await channel.addContextListener(contextType, (context) => {
      this.channelSubject.next(context);
    });
  }

  removeListener() {
    if (this.listenerRef) {
      this.listenerRef.unsubscribe();
      this.listenerRef = null;
    }
  }
}
