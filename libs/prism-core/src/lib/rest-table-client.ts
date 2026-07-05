import type { WsTableInfo } from './ws-table-client';

/**
 * Snapshot-only REST client for the Prism blotter (framework-free, browser `fetch`).
 *
 * Mirrors the WebSocket table protocol over plain HTTP GET:
 *  - `GET <url>`          → table catalog `{ tables: [{ name, title?, description?, keyField?, mode? }] }`
 *  - `GET <url>/<table>`  → the table's rows as a JSON array
 *
 * Lenient by design so it also works against arbitrary REST endpoints: the catalog may be a bare
 * array of table infos, and a rows response may be a bare array (the normal case), `{ rows: [...] }`,
 * `{ data: [...] }`, or a single object (wrapped as one row). With an empty `table`, `url` itself is
 * treated as the rows endpoint. There is no stream — callers re-fetch to refresh.
 */

/** Table metadata shape shared with the WebSocket protocol (`WsTableInfo`). */
export type RestTableInfo = WsTableInfo;

export type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  json(): Promise<unknown>;
}>;

const defaultFetch: FetchLike = (url, init) => fetch(url, init);

export class RestSnapshotClient {
  constructor(private readonly fetchFn: FetchLike = defaultFetch) {}

  /** Fetch the table catalog from `url`. Accepts `{ tables: [...] }` or a bare array of infos. */
  async listTables(url: string, timeoutMs = 10_000): Promise<RestTableInfo[]> {
    const payload = await this.getJson(url, timeoutMs);
    const tables = Array.isArray(payload)
      ? payload
      : payload != null && typeof payload === 'object' && Array.isArray((payload as { tables?: unknown }).tables)
        ? (payload as { tables: unknown[] }).tables
        : null;
    if (!tables) {
      throw new Error(`${url} did not return a table catalog ({ tables: [...] } or an array of tables)`);
    }
    return tables.filter(
      (t): t is RestTableInfo => t != null && typeof t === 'object' && typeof (t as RestTableInfo).name === 'string',
    );
  }

  /**
   * Fetch one snapshot of rows: `GET url/<table>` (or `GET url` when `table` is empty).
   * Rows are normally a bare JSON array; `{ rows }` / `{ data }` envelopes and a single
   * object are tolerated.
   */
  async fetchRows(url: string, table: string, timeoutMs = 15_000): Promise<unknown[]> {
    const target = table ? joinTableUrl(url, table) : url;
    const payload = await this.getJson(target, timeoutMs);
    if (Array.isArray(payload)) return payload;
    if (payload != null && typeof payload === 'object') {
      const env = payload as { rows?: unknown; data?: unknown };
      if (Array.isArray(env.rows)) return env.rows;
      if (Array.isArray(env.data)) return env.data;
      return [payload]; // a single object is one row
    }
    throw new Error(`${target} did not return JSON rows (array expected)`);
  }

  private async getJson(url: string, timeoutMs: number): Promise<unknown> {
    const controller = new AbortController();
    // The timer must stay armed through the BODY read too — a server that sends headers then
    // stalls the body would otherwise hang the caller forever.
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      let res: Awaited<ReturnType<FetchLike>>;
      try {
        res = await this.fetchFn(url, { signal: controller.signal });
      } catch (e) {
        throw new Error(
          controller.signal.aborted
            ? `Request timed out after ${timeoutMs}ms: ${url}`
            : `Could not reach ${url}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
      if (!res.ok) {
        throw new Error(`${url} responded ${res.status} ${res.statusText}`.trim());
      }
      try {
        return await res.json();
      } catch {
        throw new Error(
          controller.signal.aborted
            ? `Request timed out after ${timeoutMs}ms reading the body: ${url}`
            : `${url} did not return valid JSON`,
        );
      }
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Append the table as a path segment, keeping any query string at the end (`/api?k=v` + `t` → `/api/t?k=v`). */
function joinTableUrl(url: string, table: string): string {
  const qIdx = url.indexOf('?');
  const base = (qIdx >= 0 ? url.slice(0, qIdx) : url).replace(/\/+$/, '');
  const query = qIdx >= 0 ? url.slice(qIdx) : '';
  return `${base}/${encodeURIComponent(table)}${query}`;
}

/**
 * One-shot table discovery for the ad-hoc source dialogs: `GET url` and read the catalog.
 * Rejects if the endpoint is unreachable or is not a table catalog.
 */
export function discoverRestTables(url: string, timeoutMs = 10_000): Promise<RestTableInfo[]> {
  return new RestSnapshotClient().listTables(url, timeoutMs);
}
