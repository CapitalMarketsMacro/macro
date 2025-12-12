import type { Channel, Context, Listener } from '@finos/fdc3';
import { shareReplay, Subject } from 'rxjs';

/**
 * Channel service for FDC3 channel-based context broadcasting
 * Framework-agnostic implementation
 */
export class ChannelService {
  private readonly channelSubject = new Subject<Context>();
  private listenerRef: Listener | null = null;
  private myChannelPromise: Promise<Channel> | null = null;

  readonly channel$ = this.channelSubject.asObservable().pipe(shareReplay(1));

  broadcast(channelName: string, context: Context) {
    if (typeof fdc3 === 'undefined') {
      console.warn('FDC3 desktop agent not available');
      return;
    }

    fdc3.getOrCreateChannel(channelName).then((channel) => channel.broadcast(context));
  }

  async broadcastMyChannel(context: Context) {
    const channel = await this.getMyChannel();
    channel?.broadcast(context);
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

  async registerMyChannelListener(contextType: string | null = null) {
    if (this.listenerRef) {
      this.removeListener();
    }

    const channel = await this.getMyChannel();
    if (!channel) {
      return;
    }

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

  private getMyChannel() {
    if (typeof fdc3 === 'undefined') {
      console.warn('FDC3 desktop agent not available');
      return null;
    }

    if (!this.myChannelPromise) {
      this.myChannelPromise = fdc3
        .getOrCreateChannel('my-channel')
        .catch((error) => {
          console.error('Failed to initialise my-channel provider', error);
          this.myChannelPromise = null;
          throw error;
        });
    }

    return this.myChannelPromise;
  }
}
