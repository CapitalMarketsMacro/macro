import type {
  AmpsConnectionOptions,
  NatsConnectionOptions,
  NatsJetStreamConnectionOptions,
  SolaceConnectionOptions,
} from '@macro/transports';
import type { RollupConfig } from './rollup';

/** Transport backing a data source. NATS appears twice: core (live) and JetStream (snapshot+stream). */
export type TransportKind = 'amps' | 'nats' | 'nats-js' | 'solace' | 'websocket' | 'rest';

/**
 * Connection options for a snapshot-only REST source (see `rest-table-client.ts`): `url` is either
 * a table catalog (rows fetched from `url/<topic>`, tables discoverable via GET `url`) or, with an
 * empty `topic`, the rows endpoint itself. The API returns rows as a JSON array; there is no
 * stream — the blotter refreshes on demand (`BlotterFeed.refresh()`).
 */
export interface RestConnectionOptions {
  /** REST endpoint, e.g. `http://localhost:3000/prism/tables`. */
  url: string;
}

/**
 * Connection options for a plain-WebSocket table server (see `ws-table-client.ts`): the server
 * announces its tables on connect, the client subscribes to one (`BlotterSource.topic`), receives
 * a snapshot (JSON array) and then live updates (single rows or arrays).
 */
export interface WebSocketConnectionOptions {
  /** WebSocket endpoint, e.g. `ws://localhost:3000/prism`. */
  url: string;
}

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
export type WsConn = { transport: 'websocket' } & WebSocketConnectionOptions;
export type RestConn = { transport: 'rest' } & RestConnectionOptions;
export type BlotterConnection = AmpsConn | NatsConn | NatsJsConn | SolaceConn | WsConn | RestConn;

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
  /** AMPS topic / NATS subject / JetStream subject / Solace topic / WebSocket or REST table name (may be empty for REST when `connection.url` is the rows endpoint itself). */
  topic: string;
  /** AMPS SOW/subscribe filter (AMPS only). */
  filter?: string;
  /** Maximum number of records in the initial AMPS SOW result (AMPS only). */
  topN?: number;
  /** AMPS SOW result ordering, e.g. `/price DESC, /symbol ASC` (AMPS only). */
  orderBy?: string;
  /** Natural key → `getRowId`; required for `snapshot-update` / `streaming`. */
  keyField?: string;
  /** When set (or mode === 'streaming'), updates are conflated to this interval (ms). */
  conflationMs?: number;
  /** Row cap for `append` feeds (oldest trimmed past this). */
  maxRows?: number;
  /**
   * How to treat a message whose payload is a JSON array (a batch of rows). Defaults to `true`
   * (auto): each array element becomes its own row; a plain object payload is one row. Set `false`
   * to treat an array payload as a single record (the rare case where the array itself is the value).
   * A single row is always an object, never a top-level array, so auto-expansion never misfires.
   * Ignored for `websocket` sources, which always expand — there the array is protocol framing
   * (snapshot / batch update frames), never a value.
   */
  expandArrays?: boolean;
  columnMode: ColumnMode;
  /**
   * Optional roll-up view (group-by hierarchy + aggregated measures, Risk/PnL style). When absent
   * the blotter still offers a toggle with a suggestion inferred from the payload's field names.
   */
  rollup?: RollupConfig;
  /** Provenance: catalog entries are read-only; ad-hoc entries are editable/deletable. */
  origin?: 'catalog' | 'adhoc';
}

export const TRANSPORT_LABELS: Record<TransportKind, string> = {
  amps: 'AMPS',
  nats: 'NATS',
  'nats-js': 'NATS JetStream',
  solace: 'Solace',
  websocket: 'WebSocket',
  rest: 'REST API',
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
  websocket: true,
  rest: true,
};

/** Snapshot-only transports: no live stream — data changes only via `BlotterFeed.refresh()`. */
export const SNAPSHOT_ONLY: Record<TransportKind, boolean> = {
  amps: false,
  'nats-js': false,
  nats: false,
  solace: false,
  websocket: false,
  rest: true,
};
