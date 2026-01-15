import type { Channel, Context, DesktopAgent, Listener } from '@finos/fdc3';
import { shareReplay, Subject } from 'rxjs';
import { Logger } from '@macro/logger';

const logger = Logger.getLogger('ChannelService');

function getFdc3(): DesktopAgent | undefined {
  return (globalThis as unknown as { fdc3?: DesktopAgent }).fdc3;
}

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
    const fdc3 = getFdc3();
    if (!fdc3) {
      logger.warn('FDC3 desktop agent not available');
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
    const fdc3 = getFdc3();
    if (!fdc3) {
      logger.warn('FDC3 desktop agent not available');
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
    const fdc3 = getFdc3();
    if (!fdc3) {
      logger.warn('FDC3 desktop agent not available');
      return null;
    }

    if (!this.myChannelPromise) {
      this.myChannelPromise = fdc3
        .getOrCreateChannel('my-channel')
        .catch((error) => {
          logger.error('Failed to initialise my-channel provider', error);
          this.myChannelPromise = null;
          throw error;
        });
    }

    return this.myChannelPromise;
  }
}
