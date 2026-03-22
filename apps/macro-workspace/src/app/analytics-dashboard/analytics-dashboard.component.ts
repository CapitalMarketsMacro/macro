import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { type TransportClient, type TransportMessage } from '@macro/transports';
import { NatsTransportService } from '@macro/transports/angular';
import { ThemeService } from '@macro/openfin';
import { Logger } from '@macro/logger';

const logger = Logger.getLogger('AnalyticsDashboard');

const NATS_WS_URL = 'ws://MontuNobleNumbat2404:8224';
const ANALYTICS_TOPIC = 'macro.analytics.>';
const MAX_EVENTS = 200;

interface AnalyticsEvent {
  id: number;
  timestamp: string;
  relativeTime: string;
  user: string;
  source: string;
  type: string;
  action: string;
  value?: string;
  data?: any;
}

const SOURCE_COLORS: Record<string, string> = {
  platform: '#3b82f6',
  browser: '#8b5cf6',
  dock: '#f59e0b',
  home: '#10b981',
  store: '#ec4899',
};

const SOURCE_ICONS: Record<string, string> = {
  platform: 'P',
  browser: 'B',
  dock: 'D',
  home: 'H',
  store: 'S',
};

@Component({
  selector: 'app-analytics-dashboard',
  standalone: true,
  imports: [JsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './analytics-dashboard.component.html',
  styleUrl: './analytics-dashboard.component.css',
})
export class AnalyticsDashboardComponent implements OnInit, OnDestroy {
  private readonly themeService = inject(ThemeService);
  private readonly transport: TransportClient = inject(NatsTransportService);
  private subId: string | null = null;
  private eventCounter = 0;

  // Signals
  readonly connected = signal(false);
  readonly connecting = signal(false);
  readonly events = signal<AnalyticsEvent[]>([]);
  readonly users = signal<string[]>([]);
  readonly selectedUser = signal<string>('');
  readonly paused = signal(false);
  readonly selectedEvent = signal<AnalyticsEvent | null>(null);

  // Derived
  readonly filteredEvents = computed(() => {
    const user = this.selectedUser();
    const all = this.events();
    return user ? all.filter((e) => e.user === user) : all;
  });

  readonly stats = computed(() => {
    const filtered = this.filteredEvents();
    const sources = new Map<string, number>();
    for (const e of filtered) {
      sources.set(e.source, (sources.get(e.source) || 0) + 1);
    }
    return Array.from(sources.entries())
      .map(([source, count]) => ({ source, count, color: this.getSourceColor(source) }))
      .sort((a, b) => b.count - a.count);
  });

  readonly eventRate = computed(() => {
    const filtered = this.filteredEvents();
    if (filtered.length < 2) return '0';
    const first = new Date(filtered[filtered.length - 1].timestamp).getTime();
    const last = new Date(filtered[0].timestamp).getTime();
    const seconds = (last - first) / 1000;
    if (seconds <= 0) return '0';
    return (filtered.length / seconds * 60).toFixed(0);
  });

  getSourceColor(source: string): string {
    return SOURCE_COLORS[source.toLowerCase()] || '#6B7280';
  }

  getSourceIcon(source: string): string {
    return SOURCE_ICONS[source.toLowerCase()] || source.charAt(0).toUpperCase();
  }

  async ngOnInit(): Promise<void> {
    this.themeService.syncWithOpenFinTheme();
    await this.connectTransport();
  }

  async ngOnDestroy(): Promise<void> {
    this.themeService.stopSyncing();
    if (this.subId) {
      await this.transport.unsubscribe(this.subId);
    }
    await this.transport.disconnect();
  }

  async connectTransport(): Promise<void> {
    this.connecting.set(true);
    try {
      await this.transport.connect({ servers: NATS_WS_URL });
      this.connected.set(true);
      logger.info('Connected to analytics transport', { transport: this.transport.transportName });

      this.subId = await this.transport.subscribe((msg) => this.onMessage(msg), ANALYTICS_TOPIC);
    } catch (err) {
      logger.error('Failed to connect analytics transport', err);
    } finally {
      this.connecting.set(false);
    }
  }

  selectUser(user: string): void {
    this.selectedUser.set(this.selectedUser() === user ? '' : user);
  }

  togglePause(): void {
    this.paused.set(!this.paused());
  }

  clearEvents(): void {
    this.events.set([]);
    this.users.set([]);
    this.selectedEvent.set(null);
  }

  selectEvent(event: AnalyticsEvent): void {
    this.selectedEvent.set(this.selectedEvent()?.id === event.id ? null : event);
  }

  private onMessage(msg: TransportMessage): void {
    if (this.paused()) return;

    try {
      const data = msg.json<any>();
      const event: AnalyticsEvent = {
        id: ++this.eventCounter,
        timestamp: data.timestamp || new Date().toISOString(),
        relativeTime: this.formatRelativeTime(data.timestamp),
        user: data.user || 'unknown',
        source: data.source || 'unknown',
        type: data.type || '',
        action: data.action || '',
        value: data.value,
        data: data.data,
      };

      const current = this.events();
      this.events.set([event, ...current.slice(0, MAX_EVENTS - 1)]);

      const currentUsers = this.users();
      if (!currentUsers.includes(event.user)) {
        this.users.set([...currentUsers, event.user].sort());
      }
    } catch (err) {
      logger.error('Error parsing analytics message', err);
    }
  }

  private formatRelativeTime(timestamp: string): string {
    const now = Date.now();
    const then = new Date(timestamp).getTime();
    const diff = Math.floor((now - then) / 1000);
    if (diff < 2) return 'just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  }
}
