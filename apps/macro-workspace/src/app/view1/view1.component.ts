import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subject, takeUntil, tap } from 'rxjs';
import { ChannelService } from '../services/channel.service';
import { ContextService } from '../services/context.service';
import { NotificationsService } from '../services/notifications.service';

@Component({
  selector: 'app-view1',
  template: `
    <div class="col fill gap20">
      <header class="row spread middle">
        <div class="col">
          <h1>OpenFin Angular View 1</h1>
          <h1 class="tag">Angular app view in an OpenFin workspace</h1>
        </div>
        <div class="row middle gap10">
          <img src="logo.svg" alt="OpenFin" height="40px" />
        </div>
      </header>
      <main class="col gap10 left">
        <button (click)="showNotification()">Show Notification</button>
        <button (click)="broadcastFDC3Context()">Broadcast FDC3 Context</button>
        <button (click)="broadcastFDC3ContextAppChannel()">Broadcast Context on App Channel</button>
      </main>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class View1Component implements OnInit, OnDestroy {
  private readonly notificationsService = inject(NotificationsService);
  private readonly contextService = inject(ContextService);
  private readonly channelService = inject(ChannelService);
  private readonly unsubscribe$ = new Subject<void>();

  ngOnInit(): void {
    this.notificationsService
      .observeNotificationActions()
      .pipe(
        tap((event) => console.log('Notification clicked', event.result['customData'])),
        takeUntil(this.unsubscribe$),
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    if (this.hasFin()) {
      this.notificationsService.deregister(fin.me.identity.uuid);
    }
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

  showNotification() {
    if (!this.hasFin()) {
      console.warn('OpenFin runtime not detected');
      return;
    }

    this.notificationsService.create({
      platform: fin.me.identity.uuid,
      title: 'Simple Notification',
      body: 'This is a simple notification',
      toast: 'transient',
      buttons: [
        {
          title: 'Click me',
          type: 'button',
          cta: true,
          onClick: {
            customData: 'Arbitrary custom data',
          },
        },
      ],
    });
  }

  broadcastFDC3Context() {
    this.contextService.broadcast({
      type: 'fdc3.instrument',
      name: 'Microsoft Corporation',
      id: { ticker: 'MSFT' },
    });
  }

  broadcastFDC3ContextAppChannel() {
    this.channelService.broadcast('CUSTOM-APP-CHANNEL', {
      type: 'fdc3.instrument',
      name: 'Apple Inc.',
      id: { ticker: 'AAPL' },
    });
  }

  private hasFin() {
    return typeof fin !== 'undefined';
  }
}
