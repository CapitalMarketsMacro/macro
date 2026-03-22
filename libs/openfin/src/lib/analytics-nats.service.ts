import { NatsTransport } from '@macro/transports';
import { Logger } from '@macro/logger';

const logger = Logger.getLogger('AnalyticsNatsService');

const NATS_WS_URL = 'ws://MontuNobleNumbat2404:8224';
const TOPIC_PREFIX = 'macro.analytics';

/**
 * Publishes OpenFin Workspace analytics events to NATS via @macro/nats.
 * Singleton accessor: getAnalyticsNats()
 */
export class AnalyticsNatsService {
  private client = new NatsTransport('macro-workspace-analytics');
  private connected = false;
  private connecting = false;
  private username: string | null = null;

  private async getUsername(): Promise<string> {
    if (this.username) return this.username;
    try {
      const env = await fin.System.getEnvironmentVariable('USERNAME');
      this.username = env || 'unknown';
    } catch {
      this.username = 'unknown';
    }
    return this.username;
  }

  async connect(): Promise<void> {
    if (this.connected || this.connecting) return;
    this.connecting = true;
    try {
      await this.client.connect({ servers: NATS_WS_URL });
      this.connected = true;
    } catch (err) {
      logger.error('Failed to connect analytics to NATS', err);
    } finally {
      this.connecting = false;
    }
  }

  async publish(event: {
    source: string;
    type: string;
    action: string;
    value?: string;
    entityId?: { uuid: string; name: string };
    data?: any;
  }): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
    if (!this.connected) return;

    const user = await this.getUsername();
    const topic = `${TOPIC_PREFIX}.${sanitize(user)}.${sanitize(event.source)}.${sanitize(event.type)}.${sanitize(event.action)}`;

    try {
      this.client.publish(topic, {
        timestamp: new Date().toISOString(),
        user,
        source: event.source,
        type: event.type,
        action: event.action,
        value: event.value,
        entityId: event.entityId,
        data: event.data,
      });
    } catch (err) {
      logger.error('Failed to publish analytics', { topic, err });
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.disconnect();
      this.connected = false;
    }
  }
}

function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
}

// Singleton
let _instance: AnalyticsNatsService | null = null;
export function getAnalyticsNats(): AnalyticsNatsService {
  if (!_instance) _instance = new AnalyticsNatsService();
  return _instance;
}
