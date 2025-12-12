import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { ChannelService, ContextService, ThemeService } from '@macro/openfin';
import { OpenFin } from '@openfin/core';

@Component({
  selector: 'app-view2',
  template: `
    <div class="col fill gap20">
      <header class="row spread middle">
        <div class="col">
          <h1>OpenFin Angular View 2</h1>
          <h1 class="tag">Angular app view in an OpenFin workspace</h1>
        </div>
        <div class="row middle gap10">
          <img src="logo.svg" alt="OpenFin" height="40px" />
        </div>
      </header>
      <main class="col gap10 left width-full">
        @if (message()) {
        <fieldset class="width-full">
          <label for="message">Context Received</label>
          <pre id="message" class="width-full" style="min-height: 110px">{{
            message()
          }}</pre>
        </fieldset>
        <button (click)="clearMessage()">Clear</button>
        }
      </main>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class View2Component implements OnInit, OnDestroy {
  private readonly contextService = inject(ContextService);
  private readonly channelService = inject(ChannelService);
  private readonly themeService = inject(ThemeService);
  private contextSubscription: Subscription | null = null;
  private channelSubscription: Subscription | null = null;

  readonly message = signal('');

  private providerBus: OpenFin.ChannelProvider | undefined;

  ngOnInit(): void {
    // Initialize and sync with OpenFin theme
    this.themeService.syncWithOpenFinTheme();

    this.contextService.registerContextListener('fdc3.instrument');
    this.contextSubscription = this.contextService.context$.subscribe(
      (context) => {
        this.message.set(JSON.stringify(context, undefined, '  '));
      }
    );

    this.channelService.registerChannelListener(
      'CUSTOM-APP-CHANNEL',
      'fdc3.instrument'
    );
    this.channelSubscription = this.channelService.channel$.subscribe(
      (context) => {
        this.message.set(JSON.stringify(context, undefined, '  '));
        this.providerBus?.publish('example-topic', JSON.stringify(context));
      }
    );

    this.makeProvider();
  }

  async makeProvider() {
    // entity creates a channel and becomes the channelProvider
    this.providerBus = await fin.InterApplicationBus.Channel.create(
      'channelName'
    );

    this.providerBus.onConnection((identity, payload) => {
      // can reject a connection here by throwing an error
      console.log(
        'Client connection request identity: ',
        JSON.stringify(identity)
      );
      console.log(
        'Client connection request payload: ',
        JSON.stringify(payload)
      );
    });

    this.providerBus.register('example-topic', (payload, identity) => {
      // register a callback for a 'topic' to which clients can dispatch an action
      console.log('Action dispatched by client: ', JSON.stringify(identity));
      console.log('Payload sent in dispatch: ', JSON.stringify(payload));
    });
  }

  ngOnDestroy(): void {
    this.contextSubscription?.unsubscribe();
    this.channelSubscription?.unsubscribe();
    this.contextService.removeListener();
    this.channelService.removeListener();
  }

  clearMessage() {
    this.message.set('');
  }
}
