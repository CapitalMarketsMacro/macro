import { Component, OnInit, OnDestroy, inject, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Logger } from '@macro/logger';
import { ContextService } from '@macro/openfin';
import type { Context } from '@finos/fdc3';
import { Subscription } from 'rxjs';

interface InstrumentContext extends Context {
  type: 'fdc3.instrument';
  id: {
    ticker: string;
    [key: string]: string;
  };
  name?: string;
}

interface ContextHistoryEntry {
  instrument: InstrumentContext;
  receivedAt: Date;
}

@Component({
  selector: 'app-instrument-viewer',
  templateUrl: './instrument-viewer.component.html',
  styleUrl: './instrument-viewer.component.css',
  standalone: true,
  imports: [CommonModule],
})
export class InstrumentViewerComponent implements OnInit, OnDestroy {
  private logger = Logger.getLogger('InstrumentViewerComponent');
  private contextService = inject(ContextService);
  private ngZone = inject(NgZone);
  private contextSub?: Subscription;
  private channelSub?: Subscription;

  currentInstrument: InstrumentContext | null = null;
  contextHistory: ContextHistoryEntry[] = [];
  channelColor: string | null = null;
  isListening = false;

  ngOnInit(): void {
    this.logger.info('Instrument Viewer component initialized');

    this.channelSub = this.contextService.currentChannel$.subscribe((channel) => {
      this.ngZone.run(() => {
        this.channelColor = channel;
      });
      this.logger.info('Channel changed', { channel });
    });

    this.contextSub = this.contextService
      .onContext<InstrumentContext>('fdc3.instrument')
      .subscribe((instrument) => {
        this.ngZone.run(() => {
          this.currentInstrument = instrument;
          this.contextHistory.unshift({ instrument, receivedAt: new Date() });
          if (this.contextHistory.length > 20) {
            this.contextHistory.length = 20;
          }
        });
        this.logger.info('Received instrument context', {
          ticker: instrument.id.ticker,
          name: instrument.name,
        });
      });

    this.isListening = true;
    this.logger.info('Listening for fdc3.instrument contexts');
  }

  ngOnDestroy(): void {
    this.contextSub?.unsubscribe();
    this.channelSub?.unsubscribe();
    this.contextService.removeListener();
    this.logger.info('Instrument Viewer component destroyed');
  }

  getBase(ticker: string): string {
    return ticker.substring(0, 3);
  }

  getQuote(ticker: string): string {
    return ticker.substring(3);
  }

  getChannelDisplayName(): string {
    if (!this.channelColor) return 'None';
    // OpenFin channel IDs are like "green", "red", "orange", etc.
    return this.channelColor.charAt(0).toUpperCase() + this.channelColor.slice(1);
  }

  getChannelDotColor(): string {
    if (!this.channelColor) return '#888';
    const colors: Record<string, string> = {
      green: '#00CC88',
      red: '#FF5E60',
      orange: '#FF8C4C',
      blue: '#4C9AFF',
      purple: '#B07CFF',
      yellow: '#FFD60A',
    };
    return colors[this.channelColor] ?? '#888';
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
}
