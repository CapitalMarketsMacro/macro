import type {
  AmpsConnectionOptions,
  NatsConnectionOptions,
  NatsJetStreamConnectionOptions,
  SolaceConnectionOptions,
} from '@macro/transports';

/** Transport backing a data source. NATS appears twice: core (live) and JetStream (snapshot+stream). */
export type TransportKind = 'amps' | 'nats' | 'nats-js' | 'solace';

/**
 * How records map onto the grid:
 *  - `snapshot-update`: a stable, keyed row set; the snapshot seeds the grid and live messages
 *    update rows IN PLACE by `keyField` (positions, top-of-book, risk).
 *  - `append`: every message is a NEW immutable row (orders / fills / executions), appended and
 *    trimmed to `maxRows`.
 *  - `streaming`: high-frequency keyed quotes — like snapshot-update but ALWAYS conflated
 *    (`conflationMs`) before hitting the grid, to bound the paint rate.
 */
export type BlotterMode = 'snapshot-update' | 'append' | 'streaming';

/** How the grid's columns are built for this source. */
export type ColumnMode = 'infer' | 'auto-gen';

/** Connection options per transport, discriminated by `transport` (the transport lib's own types). */
export type AmpsConn = { transport: 'amps' } & AmpsConnectionOptions;
export type NatsConn = { transport: 'nats' } & NatsConnectionOptions;
export type NatsJsConn = { transport: 'nats-js' } & NatsJetStreamConnectionOptions;
export type SolaceConn = { transport: 'solace' } & SolaceConnectionOptions;
export type BlotterConnection = AmpsConn | NatsConn | NatsJsConn | SolaceConn;

/** A data source the blotter can connect to — from the seed catalog or user-defined (ad-hoc). */
export interface BlotterSource {
  /** Stable slug; used as the per-source transport client name and the `?source=` deep link. */
  id: string;
  name: string;
  description?: string;
  /** Business area (FX, Rates, Orders, …) — also used for catalog grouping. */
  category: string;
  transport: TransportKind;
  mode: BlotterMode;
  connection: BlotterConnection;
  /** AMPS topic / NATS subject / JetStream subject / Solace topic. */
  topic: string;
  /** AMPS SOW/subscribe filter (AMPS only). */
  filter?: string;
  /** Natural key → `getRowId`; required for `snapshot-update` / `streaming`. */
  keyField?: string;
  /** When set (or mode === 'streaming'), updates are conflated to this interval (ms). */
  conflationMs?: number;
  /** Row cap for `append` feeds (oldest trimmed past this). */
  maxRows?: number;
  columnMode: ColumnMode;
  /** Provenance: catalog entries are read-only; ad-hoc entries are editable/deletable. */
  origin?: 'catalog' | 'adhoc';
}

export const TRANSPORT_LABELS: Record<TransportKind, string> = {
  amps: 'AMPS',
  nats: 'NATS',
  'nats-js': 'NATS JetStream',
  solace: 'Solace',
};

export const MODE_LABELS: Record<BlotterMode, string> = {
  'snapshot-update': 'Snapshot + Updates',
  append: 'Append (events)',
  streaming: 'Streaming (high-freq)',
};

/** Transports that can deliver an initial snapshot (the rest start empty / live-only). */
export const SNAPSHOT_CAPABLE: Record<TransportKind, boolean> = {
  amps: true,
  'nats-js': true,
  nats: false,
  solace: false,
};
