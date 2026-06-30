import { wsconnect, type NatsConnection } from '@nats-io/nats-core';
import {
  jetstream,
  jetstreamManager,
  DeliverPolicy,
  type JetStreamClient,
  type JetStreamManager,
  type ConsumerMessages,
  type JsMsg,
  type PubAck,
} from '@nats-io/jetstream';
import type { KvWatchEntry } from '@nats-io/kv';
import { Observable, Subject } from 'rxjs';
import { Logger } from '@macro/logger';
import type { TransportClient, TransportMessage, MessageHandler, ErrorHandler } from '../transport';
import type { NatsConnectionOptions } from './nats-transport';

const logger = Logger.getLogger('NatsJetStreamTransport');

/**
 * Connection options for a JetStream transport. Extends the core NATS options with JetStream
 * specifics. Connection itself still goes over the same websocket (`wsconnect`) as `NatsTransport`.
 */
export interface NatsJetStreamConnectionOptions extends NatsConnectionOptions {
  /** Default stream for consumer/snapshot operations (else resolved from the subject). */
  stream?: string;
  /** Default deliver policy for live `subscribe` (default `New`). */
  deliverPolicy?: DeliverPolicy;
  /** Optional KV bucket (lets `snapshotAndSubscribeKv` default its bucket). */
  bucket?: string;
  /** ms to wait before resolving `snapshotComplete` when the snapshot is empty (default 5000). */
  snapshotTimeout?: number;
}

/** Per-call snapshot options. */
export interface JetStreamSnapshotOptions {
  /** Stream to read from (else resolved from the subject via the JetStream manager). */
  stream?: string;
  /** `LastPerSubject` (default) = a blotter snapshot; `All`/`Last` also valid. */
  deliverPolicy?: DeliverPolicy;
  /** ms to wait before resolving `snapshotComplete` when the snapshot is empty. */
  snapshotTimeout?: number;
}

interface JsSubEntry {
  subject: Subject<TransportMessage>;
  /** Closes the ConsumerMessages / KV watcher and clears any pending timer. */
  stop: () => Promise<void>;
}

/**
 * NATS JetStream transport. Mirrors {@link AmpsTransport}'s snapshot+stream shape:
 * `snapshotAndSubscribe()` delivers the current state of the world (last value per subject) first,
 * resolves `snapshotComplete` when the backlog is drained, then keeps streaming live updates over
 * the same ordered consumer. Core fire-and-forget live `subscribe` is also available (DeliverPolicy.New).
 */
export class NatsJetStreamTransport implements TransportClient {
  readonly transportName = 'nats-jetstream';
  private nc: NatsConnection | null = null;
  private js: JetStreamClient | null = null;
  private jsm: JetStreamManager | null = null;
  private options: NatsJetStreamConnectionOptions | null = null;
  private clientName: string;
  private errorHandlerCallback: ErrorHandler | null = null;
  private subscriptionMap = new Map<string, JsSubEntry>();
  private subCounter = 0;

  constructor(clientName = 'nats-jetstream-client') {
    this.clientName = clientName;
  }

  // ── Lifecycle (same wsconnect as core NatsTransport) ──

  async connect(options: NatsJetStreamConnectionOptions): Promise<void> {
    if (this.nc) throw new Error('Already connected to NATS JetStream. Disconnect first.');
    this.options = options;
    try {
      this.nc = await wsconnect({
        servers: options.servers,
        name: options.name ?? this.clientName,
        maxReconnectAttempts: options.maxReconnectAttempts ?? -1,
        reconnectTimeWait: options.reconnectTimeWait ?? 2000,
      });
      this.js = jetstream(this.nc);
      this.jsm = await jetstreamManager(this.nc);
      logger.info('Connected to NATS JetStream', { server: options.servers, name: this.clientName });
      this.nc.closed().then((err) => {
        if (err) {
          logger.warn('NATS JetStream connection closed with error', err);
          this.errorHandlerCallback?.(err instanceof Error ? err : new Error(String(err)));
        } else {
          logger.info('NATS JetStream connection closed');
        }
        this.nc = null;
        this.js = null;
        this.jsm = null;
      });
    } catch (error) {
      this.nc = null;
      this.js = null;
      this.jsm = null;
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  async disconnect(): Promise<void> {
    if (!this.nc) return;
    for (const [, entry] of this.subscriptionMap) {
      entry.subject.complete();
      try {
        await entry.stop();
      } catch {
        /* ignore individual teardown errors */
      }
    }
    this.subscriptionMap.clear();
    try {
      await this.nc.drain();
    } finally {
      this.nc = null;
      this.js = null;
      this.jsm = null;
    }
    logger.info('NATS JetStream disconnected');
  }

  get isConnected(): boolean {
    return this.nc !== null;
  }

  // ── Publish ──

  /** Core fire-and-forget publish (the TransportClient contract). */
  publish(topic: string, data: string | Record<string, unknown>): void {
    if (!this.nc) throw new Error('Not connected to NATS.');
    this.nc.publish(topic, typeof data === 'string' ? data : JSON.stringify(data));
  }

  /** Persisted JetStream publish with an ack. */
  async jsPublish(subject: string, data: string | Record<string, unknown>): Promise<PubAck> {
    if (!this.js) throw new Error('Not connected to JetStream.');
    return this.js.publish(subject, typeof data === 'string' ? data : JSON.stringify(data));
  }

  // ── Live subscribe (ordered consumer, DeliverPolicy.New) ──

  async subscribe(handler: MessageHandler, topic: string): Promise<string> {
    const rxSubject = new Subject<TransportMessage>();
    const sub = rxSubject.subscribe((m) => handler(m));
    const subId = await this.startLive(topic, rxSubject, () => sub.unsubscribe());
    return subId;
  }

  async subscribeAsObservable(
    topic: string,
  ): Promise<{ observable: Observable<TransportMessage>; subscriptionId: string }> {
    const { subject, subscriptionId } = await this.subscribeAsSubject(topic);
    return { observable: subject.asObservable(), subscriptionId };
  }

  async subscribeAsSubject(
    topic: string,
  ): Promise<{ subject: Subject<TransportMessage>; subscriptionId: string }> {
    const rxSubject = new Subject<TransportMessage>();
    const subscriptionId = await this.startLive(topic, rxSubject);
    return { subject: rxSubject, subscriptionId };
  }

  // ── Snapshot + stream (mirrors AMPS sowAndSubscribe) ──

  /**
   * Snapshot then live: an ordered consumer with `DeliverPolicy.LastPerSubject` delivers the last
   * value for every matching subject (the blotter snapshot), then keeps delivering live updates.
   * `snapshotComplete` resolves on the first delivered message whose `info.pending === 0` (backlog
   * drained), with a safety timeout for the empty-snapshot case.
   */
  async snapshotAndSubscribe(
    subject: string,
    options: JetStreamSnapshotOptions = {},
  ): Promise<{ observable: Observable<TransportMessage>; subscriptionId: string; snapshotComplete: Promise<void> }> {
    if (!this.js) throw new Error('Not connected to JetStream.');
    const stream = await this.resolveStream(subject, options.stream);
    const rxSubject = new Subject<TransportMessage>();
    const subId = `njs-snap-${++this.subCounter}`;

    const snap = { done: false, timer: undefined as ReturnType<typeof setTimeout> | undefined };
    let resolveSnapshot!: () => void;
    const snapshotComplete = new Promise<void>((r) => { resolveSnapshot = r; });
    const finishSnapshot = (): void => {
      if (snap.done) return;
      snap.done = true;
      if (snap.timer) clearTimeout(snap.timer);
      resolveSnapshot();
    };

    const consumer = await this.js.consumers.get(stream, {
      filter_subjects: subject,
      deliver_policy: options.deliverPolicy ?? DeliverPolicy.LastPerSubject,
    });

    const messages: ConsumerMessages = await consumer.consume({
      callback: (m: JsMsg) => {
        rxSubject.next(this.wrapJsMsg(m));
        // Backlog drained at delivery time = end of the snapshot batch (then live).
        if (!snap.done && m.info.pending === 0) finishSnapshot();
        // Ordered consumers are AckPolicy.None — m.ack() is a no-op, no manual ack required.
      },
    });

    snap.timer = setTimeout(finishSnapshot, options.snapshotTimeout ?? this.options?.snapshotTimeout ?? 5000);

    this.subscriptionMap.set(subId, {
      subject: rxSubject,
      stop: async () => { clearTimeout(snap.timer); await messages.close(); },
    });
    logger.info('JetStream snapshot+subscribe', { subId, subject, stream });
    return { observable: rxSubject.asObservable(), subscriptionId: subId, snapshotComplete };
  }

  /**
   * KV-backed snapshot + stream (optional). Reads the last value of every matching key, then
   * watches for changes. `@nats-io/kv` is loaded lazily so it stays an optional peer dependency.
   * Snapshot-done is detected on `entry.delta === 0` (last of the initial batch) or the first
   * `entry.isUpdate === true` (live transition).
   */
  async snapshotAndSubscribeKv(
    bucket: string,
    keyFilter: string | string[] = '>',
    options: { snapshotTimeout?: number } = {},
  ): Promise<{ observable: Observable<TransportMessage>; subscriptionId: string; snapshotComplete: Promise<void> }> {
    if (!this.nc) throw new Error('Not connected to NATS.');
    const { Kvm, KvWatchInclude } = await import('@nats-io/kv');
    const kv = await new Kvm(this.nc).open(bucket);
    const watcher = await kv.watch({ key: keyFilter, include: KvWatchInclude.LastValue });

    const rxSubject = new Subject<TransportMessage>();
    const subId = `njs-kv-${++this.subCounter}`;
    const snap = { done: false, timer: undefined as ReturnType<typeof setTimeout> | undefined };
    let resolveSnapshot!: () => void;
    const snapshotComplete = new Promise<void>((r) => { resolveSnapshot = r; });
    const finishSnapshot = (): void => {
      if (snap.done) return;
      snap.done = true;
      if (snap.timer) clearTimeout(snap.timer);
      resolveSnapshot();
    };

    (async () => {
      for await (const e of watcher) {
        rxSubject.next(this.wrapKvEntry(e));
        if (!snap.done && (e.isUpdate || e.delta === 0)) finishSnapshot();
      }
      rxSubject.complete();
    })();

    snap.timer = setTimeout(finishSnapshot, options.snapshotTimeout ?? this.options?.snapshotTimeout ?? 5000);

    this.subscriptionMap.set(subId, {
      subject: rxSubject,
      stop: async () => { clearTimeout(snap.timer); await watcher.stop(); },
    });
    logger.info('JetStream KV snapshot+subscribe', { subId, bucket });
    return { observable: rxSubject.asObservable(), subscriptionId: subId, snapshotComplete };
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    const entry = this.subscriptionMap.get(subscriptionId);
    if (!entry) return;
    entry.subject.complete();
    await entry.stop();
    this.subscriptionMap.delete(subscriptionId);
    logger.info('Unsubscribed', { subscriptionId });
  }

  onError(handler: ErrorHandler): void {
    this.errorHandlerCallback = handler;
  }

  getSubscriptionIds(): string[] {
    return Array.from(this.subscriptionMap.keys());
  }

  getConnection(): NatsConnection | null {
    return this.nc;
  }

  getJetStream(): JetStreamClient | null {
    return this.js;
  }

  // ── internals ──

  /** Start a live (DeliverPolicy.New) ordered consumer feeding an RxJS subject. */
  private async startLive(
    subject: string,
    rxSubject: Subject<TransportMessage>,
    extraStop?: () => void,
  ): Promise<string> {
    if (!this.js) throw new Error('Not connected to JetStream.');
    const stream = await this.resolveStream(subject);
    const consumer = await this.js.consumers.get(stream, {
      filter_subjects: subject,
      deliver_policy: this.options?.deliverPolicy ?? DeliverPolicy.New,
    });
    const messages = await consumer.consume({
      callback: (m: JsMsg) => rxSubject.next(this.wrapJsMsg(m)),
    });
    const subId = `njs-sub-${++this.subCounter}`;
    this.subscriptionMap.set(subId, {
      subject: rxSubject,
      stop: async () => { extraStop?.(); await messages.close(); },
    });
    logger.info('JetStream live subscribe', { subId, subject, stream });
    return subId;
  }

  /** Resolve the owning stream for a subject (uses the configured stream, else asks the manager). */
  private async resolveStream(subject: string, override?: string): Promise<string> {
    const configured = override ?? this.options?.stream;
    if (configured) return configured;
    if (!this.jsm) throw new Error('No stream configured and JetStreamManager unavailable.');
    return this.jsm.streams.find(subject);
  }

  private wrapJsMsg(m: JsMsg): TransportMessage {
    const data = new TextDecoder().decode(m.data);
    return { topic: m.subject, data, json: <T = unknown>() => JSON.parse(data) as T, raw: m };
  }

  private wrapKvEntry(e: KvWatchEntry): TransportMessage {
    const data = e.string();
    return { topic: e.key, data, json: <T = unknown>() => JSON.parse(data) as T, raw: e };
  }
}
