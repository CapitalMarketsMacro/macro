import { IncomingMessage, ServerResponse } from 'http';
import { createHash } from 'crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

/**
 * Workspace Storage API — phase-1 REFERENCE implementation of the Macro Workspace
 * Storage contract (see docs/api/workspace-storage-api.openapi.yaml), mounted at
 * /workspace/v1 on this server so the OpenFin workspace client
 * (RestWorkspaceStorageClient in @macro/openfin) can be verified end-to-end before
 * the phase-2 Java Spring Boot + MongoDB service exists.
 *
 * Contract highlights (fixed — the client already implements it):
 *  - User scoping via the X-User-Id request header (default 'anonymous'); phase 2
 *    replaces this interim scheme with a real identity token (OAuth2/JWT).
 *  - Errors are application/problem+json (RFC 9457): { type, title, status, detail }.
 *  - Single-resource GETs carry an ETag; OPTIONAL If-Match on PUT/DELETE -> 412 on
 *    mismatch (the phase-1 client never sends If-Match).
 *  - PUT -> 201 when created, 200 when replaced; body id must match the path id.
 *  - GET of a missing single resource -> 404 (client maps to undefined); DELETE of a
 *    missing resource -> 404 (client treats as success).
 *  - Workspace snapshots / page layouts / dock configs are opaque JSON — the client
 *    owns the schema, this server never inspects them.
 *
 * Storage: per-user in-memory maps, persisted to a JSON file (WORKSPACE_STORE_FILE,
 * default <cwd>/.workspace-store.json) via a debounced atomic write so demo data
 * survives restarts. /config/{name} serves the platform config JSON files from
 * WORKSPACE_CONFIG_DIR (default apps/macro-workspace/public/local) fresh per request.
 * /dock-apps (LOB-published dock apps) and /store-apps (LOB-published storefront
 * apps) are NOT user-scoped — shared across all users like /config, persisted at
 * the top level of the same store file — and PUTs are validated against the fixed
 * LobDockApp / LobStoreApp contracts (see validateLobDockApp / validateLobStoreApp).
 */

const PREFIX = '/workspace/v1';
const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 MB
const SAVE_DEBOUNCE_MS = 500;
const MAX_USERS = 500; // unauthenticated X-User-Id — bound memory; oldest evicted

/** Sentinel: the body reader already sent an error response (400/413) — stop routing. */
const BODY_HANDLED: unique symbol = Symbol('body-handled');

interface UserStore {
  workspaces: Map<string, unknown>;
  pages: Map<string, unknown>;
  dock: Map<string, unknown>;
  favorites: string[];
  preferences: Map<string, unknown>;
}

interface PersistedUserStore {
  workspaces?: Record<string, unknown>;
  pages?: Record<string, unknown>;
  dock?: Record<string, unknown>;
  favorites?: unknown[];
  preferences?: Record<string, unknown>;
}

/**
 * Validate a LOB dock app PUT body against the fixed client contract
 * (`LobDockApp` in `@macro/openfin` storage-types). Returns a human-readable
 * error string for the 400 problem detail, or null when the body is valid.
 * (Body-id-matches-path-id is enforced by handleDocument, per convention.)
 */
const LOB_DOCK_APP_KEYS = new Set([
  'id',
  'label',
  'iconUrl',
  'type',
  'url',
  'children',
  'tooltip',
  'lob',
  'sortOrder',
]);
const LOB_DOCK_APP_CHILD_KEYS = new Set(['id', 'label', 'url', 'iconUrl']);

function validateLobDockApp(body: Record<string, unknown>): string | null {
  const nonEmpty = (value: unknown): value is string =>
    typeof value === 'string' && value.trim() !== '';
  // The OpenAPI schema declares additionalProperties: false — enforce it so this
  // shared resource never carries fields the platform (or phase 2) doesn't know.
  for (const key of Object.keys(body)) {
    if (!LOB_DOCK_APP_KEYS.has(key)) return `Unknown field "${key}"`;
  }
  for (const field of ['id', 'label', 'iconUrl'] as const) {
    if (!nonEmpty(body[field]))
      return `"${field}" is required and must be a non-empty string`;
  }
  // Optional fields must still carry the schema's types — this shared, unauthenticated
  // resource feeds every user's dock, so schema-violating rows must never be stored.
  if (body['tooltip'] !== undefined && !nonEmpty(body['tooltip']))
    return '"tooltip" must be a non-empty string when present';
  if (body['lob'] !== undefined && !nonEmpty(body['lob']))
    return '"lob" must be a non-empty string when present';
  if (
    body['sortOrder'] !== undefined &&
    (typeof body['sortOrder'] !== 'number' ||
      !Number.isFinite(body['sortOrder']))
  )
    return '"sortOrder" must be a finite number when present';
  const type = body['type'];
  if (type !== 'icon' && type !== 'dropdown')
    return '"type" must be "icon" or "dropdown"';
  if (type === 'icon') {
    if (!nonEmpty(body['url']))
      return '"url" is required (non-empty string) when "type" is "icon"';
    return null;
  }
  const children = body['children'];
  if (!Array.isArray(children) || children.length === 0)
    return '"children" is required (non-empty array) when "type" is "dropdown"';
  for (let i = 0; i < children.length; i++) {
    const child = children[i] as Record<string, unknown> | null;
    if (child === null || typeof child !== 'object' || Array.isArray(child))
      return `children[${i}] must be an object with "id", "label" and "url"`;
    for (const key of Object.keys(child)) {
      if (!LOB_DOCK_APP_CHILD_KEYS.has(key))
        return `Unknown field "children[${i}].${key}"`;
    }
    for (const field of ['id', 'label', 'url'] as const) {
      if (!nonEmpty(child[field]))
        return `children[${i}].${field} is required and must be a non-empty string`;
    }
    if (child['iconUrl'] !== undefined && !nonEmpty(child['iconUrl']))
      return `children[${i}].iconUrl must be a non-empty string when present`;
  }
  return null;
}

/**
 * Validate a LOB store app PUT body against the fixed client contract
 * (`LobStoreApp` in `@macro/openfin` storage-types). Returns a human-readable
 * error string for the 400 problem detail, or null when the body is valid.
 * (Body-id-matches-path-id is enforced by handleDocument, per convention.)
 */
const LOB_STORE_APP_KEYS = new Set([
  'appId',
  'title',
  'manifest',
  'manifestType',
  'icons',
  'description',
  'images',
  'publisher',
  'contactEmail',
  'supportEmail',
  'tags',
  'category',
  'lob',
  'sortOrder',
]);
const LOB_STORE_APP_IMAGE_KEYS = new Set(['src']);

function validateLobStoreApp(body: Record<string, unknown>): string | null {
  const nonEmpty = (value: unknown): value is string =>
    typeof value === 'string' && value.trim() !== '';
  // The contract declares additionalProperties: false — enforce it so this
  // shared resource never carries fields the platform (or phase 2) doesn't know.
  for (const key of Object.keys(body)) {
    if (!LOB_STORE_APP_KEYS.has(key)) return `Unknown field "${key}"`;
  }
  for (const field of ['appId', 'title', 'manifest'] as const) {
    if (!nonEmpty(body[field]))
      return `"${field}" is required and must be a non-empty string`;
  }
  const manifestType = body['manifestType'];
  if (manifestType !== 'view' && manifestType !== 'manifest')
    return '"manifestType" must be "view" or "manifest"';
  // Store card icons: at least one entry, each { src: non-empty } and nothing else.
  const icons = body['icons'];
  if (!Array.isArray(icons) || icons.length === 0)
    return '"icons" is required and must be a non-empty array of { "src": string }';
  for (let i = 0; i < icons.length; i++) {
    const icon = icons[i] as Record<string, unknown> | null;
    if (icon === null || typeof icon !== 'object' || Array.isArray(icon))
      return `icons[${i}] must be an object with a non-empty "src"`;
    for (const key of Object.keys(icon)) {
      if (!LOB_STORE_APP_IMAGE_KEYS.has(key))
        return `Unknown field "icons[${i}].${key}"`;
    }
    if (!nonEmpty(icon['src']))
      return `icons[${i}].src is required and must be a non-empty string`;
  }
  // Optional fields must still carry the schema's types — this shared, unauthenticated
  // resource feeds every user's storefront, so schema-violating rows must never be stored.
  for (const field of [
    'description',
    'publisher',
    'contactEmail',
    'supportEmail',
    'category',
    'lob',
  ] as const) {
    if (body[field] !== undefined && !nonEmpty(body[field]))
      return `"${field}" must be a non-empty string when present`;
  }
  if (
    body['sortOrder'] !== undefined &&
    (typeof body['sortOrder'] !== 'number' ||
      !Number.isFinite(body['sortOrder']))
  )
    return '"sortOrder" must be a finite number when present';
  const tags = body['tags'];
  if (tags !== undefined) {
    if (!Array.isArray(tags))
      return '"tags" must be an array of non-empty strings when present';
    for (let i = 0; i < tags.length; i++) {
      if (!nonEmpty(tags[i])) return `tags[${i}] must be a non-empty string`;
    }
  }
  const images = body['images'];
  if (images !== undefined) {
    if (!Array.isArray(images))
      return '"images" must be an array of { "src": string } when present';
    for (let i = 0; i < images.length; i++) {
      const image = images[i] as Record<string, unknown> | null;
      if (image === null || typeof image !== 'object' || Array.isArray(image))
        return `images[${i}] must be an object with a non-empty "src"`;
      for (const key of Object.keys(image)) {
        if (!LOB_STORE_APP_IMAGE_KEYS.has(key))
          return `Unknown field "images[${i}].${key}"`;
      }
      if (!nonEmpty(image['src']))
        return `images[${i}].src is required and must be a non-empty string`;
    }
  }
  return null;
}

/** configName -> file name inside WORKSPACE_CONFIG_DIR. NOT user-scoped (platform config per environment). */
const CONFIG_FILES: Record<string, string> = {
  settings: 'settings.json',
  apps: 'apps.json',
  'dock-config': 'dock-config.json',
  'storefront-config': 'storefront-config.json',
  'snap-config': 'snap-config.json',
  entitlements: 'entitlements.json',
};

export class WorkspaceStorageApi {
  private readonly users = new Map<string, UserStore>();
  /** LOB dock apps — NOT user-scoped: published by lines of business, shared across all users. */
  private readonly dockApps = new Map<string, unknown>();
  /** LOB store apps — NOT user-scoped: published by lines of business, shared across all users. */
  private readonly storeApps = new Map<string, unknown>();
  private readonly storeFile: string;
  private readonly configDir: string;
  private saveTimer?: ReturnType<typeof setTimeout>;
  private dirty = false;

  constructor() {
    this.storeFile =
      process.env.WORKSPACE_STORE_FILE ||
      join(process.cwd(), '.workspace-store.json');
    this.configDir =
      process.env.WORKSPACE_CONFIG_DIR ||
      join(process.cwd(), 'apps/macro-workspace/public/local');
    this.loadStore();
    // Flush a pending debounced save on process exit so demo data is not lost on Ctrl-C.
    process.on('exit', () => {
      if (this.dirty) this.writeStoreNow();
    });
  }

  /**
   * Serve every path under /workspace/v1. Returns false when the path is not ours so
   * the caller can try other handlers / 404. CORS is wide open on every response
   * (including errors) — the OpenFin workspace runs on another localhost port.
   */
  handleRest(req: IncomingMessage, res: ServerResponse): boolean {
    const url = new URL(
      req.url || '',
      `http://${req.headers.host ?? 'localhost'}`,
    );
    const pathname = url.pathname.replace(/\/+$/, '');
    if (pathname !== PREFIX && !pathname.startsWith(`${PREFIX}/`)) return false;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,DELETE,OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type,X-User-Id,If-Match',
    );
    res.setHeader('Access-Control-Expose-Headers', 'ETag');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return true;
    }

    this.route(req, res, url, pathname).catch((error) => {
      console.error('Workspace Storage API error:', error);
      if (!res.headersSent) {
        this.problem(res, 500, 'Internal Server Error', String(error));
      } else {
        res.end();
      }
    });
    return true;
  }

  // ── routing ──

  private async route(
    req: IncomingMessage,
    res: ServerResponse,
    url: URL,
    pathname: string,
  ): Promise<void> {
    let segments: string[];
    try {
      segments = pathname
        .slice(PREFIX.length)
        .split('/')
        .filter(Boolean)
        .map(decodeURIComponent);
    } catch {
      // Malformed percent-encoding (e.g. %zz) must not crash the process.
      this.problem(
        res,
        400,
        'Bad Request',
        'Malformed percent-encoding in URL',
      );
      return;
    }
    const method = req.method ?? 'GET';

    // GET /health — no user scope
    if (segments.length === 1 && segments[0] === 'health') {
      if (method !== 'GET')
        return this.problem(
          res,
          405,
          'Method Not Allowed',
          `${method} is not supported on /health`,
        );
      return this.sendJson(res, 200, {
        status: 'ok',
        service: 'workspace-storage-api',
        uptimeSec: Math.round(process.uptime()),
        users: this.users.size,
        dockApps: this.dockApps.size,
        storeApps: this.storeApps.size,
        persistedTo: this.storeFile,
      });
    }

    // /config/{configName} — no user scope (platform config per environment)
    if (segments[0] === 'config') {
      if (segments.length !== 2)
        return this.problem(
          res,
          404,
          'Not Found',
          `Config endpoints are /config/{name}. Known names: ${Object.keys(CONFIG_FILES).join(', ')}`,
        );
      return this.handleConfig(res, method, segments[1]);
    }

    // /dock-apps — NOT user-scoped: LOB-published dock apps shared across all
    // users, like /config (X-User-Id is ignored; LOBs PUT, the platform GETs).
    if (segments[0] === 'dock-apps') {
      if (segments.length === 1) {
        if (method !== 'GET')
          return this.problem(
            res,
            405,
            'Method Not Allowed',
            `${method} is not supported on /dock-apps`,
          );
        // Never 404 — no published dock apps is just an empty list. Sorted by
        // sortOrder ascending with undefined last; sort() is stable, so
        // insertion order breaks ties.
        const orderOf = (row: unknown): number => {
          const value = (row as { sortOrder?: unknown } | null)?.sortOrder;
          return typeof value === 'number' ? value : Number.POSITIVE_INFINITY;
        };
        const rows = [...this.dockApps.values()].sort((a, b) => {
          const aOrder = orderOf(a);
          const bOrder = orderOf(b);
          return aOrder === bOrder ? 0 : aOrder < bOrder ? -1 : 1;
        });
        return this.sendJson(res, 200, rows);
      }
      if (segments.length === 2)
        return this.handleDocument(
          req,
          res,
          method,
          this.dockApps,
          segments[1],
          'id',
          validateLobDockApp,
        );
    }

    // /store-apps — NOT user-scoped: LOB-published storefront apps shared across
    // all users, like /config (X-User-Id is ignored; LOBs PUT, the platform GETs).
    if (segments[0] === 'store-apps') {
      if (segments.length === 1) {
        if (method !== 'GET')
          return this.problem(
            res,
            405,
            'Method Not Allowed',
            `${method} is not supported on /store-apps`,
          );
        // Never 404 — no published store apps is just an empty list. Sorted by
        // sortOrder ascending with undefined last; sort() is stable, so
        // insertion order breaks ties.
        const orderOf = (row: unknown): number => {
          const value = (row as { sortOrder?: unknown } | null)?.sortOrder;
          return typeof value === 'number' ? value : Number.POSITIVE_INFINITY;
        };
        const rows = [...this.storeApps.values()].sort((a, b) => {
          const aOrder = orderOf(a);
          const bOrder = orderOf(b);
          return aOrder === bOrder ? 0 : aOrder < bOrder ? -1 : 1;
        });
        return this.sendJson(res, 200, rows);
      }
      if (segments.length === 2)
        return this.handleDocument(
          req,
          res,
          method,
          this.storeApps,
          segments[1],
          'appId',
          validateLobStoreApp,
        );
    }

    // Everything below is user-scoped via the X-User-Id header (interim scheme).
    const store = this.storeOf(this.userIdOf(req));

    if (segments[0] === 'workspaces') {
      if (segments.length === 1) {
        if (method !== 'GET')
          return this.problem(
            res,
            405,
            'Method Not Allowed',
            `${method} is not supported on /workspaces`,
          );
        const query = (url.searchParams.get('query') ?? '')
          .trim()
          .toLowerCase();
        let rows = [...store.workspaces.values()];
        if (query) {
          rows = rows.filter((row) => {
            const doc = row as { workspaceId?: unknown; title?: unknown };
            return (
              String(doc.title ?? '')
                .toLowerCase()
                .includes(query) ||
              String(doc.workspaceId ?? '')
                .toLowerCase()
                .includes(query)
            );
          });
        }
        return this.sendJson(res, 200, rows);
      }
      if (segments.length === 2)
        return this.handleDocument(
          req,
          res,
          method,
          store.workspaces,
          segments[1],
          'workspaceId',
        );
    }

    if (segments[0] === 'pages') {
      if (segments.length === 1) {
        if (method !== 'GET')
          return this.problem(
            res,
            405,
            'Method Not Allowed',
            `${method} is not supported on /pages`,
          );
        return this.sendJson(res, 200, [...store.pages.values()]);
      }
      if (segments.length === 2)
        return this.handleDocument(
          req,
          res,
          method,
          store.pages,
          segments[1],
          'pageId',
        );
    }

    if (segments[0] === 'dock' && segments.length === 2) {
      return this.handleDocument(
        req,
        res,
        method,
        store.dock,
        segments[1],
        'id',
      );
    }

    if (segments[0] === 'favorites' && segments.length === 1) {
      if (method === 'GET') {
        // Never 404 — an unsaved favorites list is just empty.
        const body = { appIds: store.favorites };
        return this.sendJson(res, 200, body, this.etagOf(body));
      }
      if (method === 'PUT') {
        const body = await this.readJsonBody(req, res);
        if (body === BODY_HANDLED) return;
        const appIds = (body as { appIds?: unknown } | null)?.appIds;
        if (
          !Array.isArray(appIds) ||
          appIds.some((id) => typeof id !== 'string')
        ) {
          return this.problem(
            res,
            400,
            'Bad Request',
            'Body must be { "appIds": string[] }',
          );
        }
        if (!this.ifMatchOk(req, res, { appIds: store.favorites })) return;
        store.favorites = appIds as string[];
        this.scheduleSave();
        const saved = { appIds: store.favorites };
        return this.sendJson(res, 200, saved, this.etagOf(saved));
      }
      return this.problem(
        res,
        405,
        'Method Not Allowed',
        `${method} is not supported on /favorites`,
      );
    }

    if (segments[0] === 'preferences') {
      if (segments.length === 1) {
        if (method !== 'GET')
          return this.problem(
            res,
            405,
            'Method Not Allowed',
            `${method} is not supported on /preferences`,
          );
        return this.sendJson(
          res,
          200,
          [...store.preferences.entries()].map(([key, value]) => ({
            key,
            value,
          })),
        );
      }
      if (segments.length === 2)
        return this.handlePreference(req, res, method, store, segments[1]);
    }

    this.problem(
      res,
      404,
      'Not Found',
      `Unknown Workspace Storage endpoint: ${method} ${pathname}`,
    );
  }

  /**
   * Generic single-document resource: /workspaces/{id}, /pages/{id}, /dock/{id},
   * /dock-apps/{id}, /store-apps/{appId}. `validate` (optional) runs on PUT after the id-match check
   * and returns a 400 problem detail string, or null when the body is valid.
   */
  private async handleDocument(
    req: IncomingMessage,
    res: ServerResponse,
    method: string,
    map: Map<string, unknown>,
    id: string,
    idField: string,
    validate?: (body: Record<string, unknown>) => string | null,
  ): Promise<void> {
    const existing = map.get(id);
    switch (method) {
      case 'GET':
        if (existing === undefined)
          return this.problem(
            res,
            404,
            'Not Found',
            `No resource with ${idField} "${id}"`,
          );
        return this.sendJson(res, 200, existing, this.etagOf(existing));
      case 'PUT': {
        const body = await this.readJsonBody(req, res);
        if (body === BODY_HANDLED) return;
        if (body === null || typeof body !== 'object' || Array.isArray(body)) {
          return this.problem(
            res,
            400,
            'Bad Request',
            'Body must be a JSON object',
          );
        }
        const bodyId = (body as Record<string, unknown>)[idField];
        if (bodyId !== id) {
          return this.problem(
            res,
            400,
            'Bad Request',
            `Body ${idField} ("${String(bodyId)}") must match the path id ("${id}")`,
          );
        }
        const invalid = validate?.(body as Record<string, unknown>);
        if (invalid) {
          return this.problem(res, 400, 'Bad Request', invalid);
        }
        if (!this.ifMatchOk(req, res, existing)) return;
        map.set(id, body);
        this.scheduleSave();
        return this.sendJson(
          res,
          existing === undefined ? 201 : 200,
          body,
          this.etagOf(body),
        );
      }
      case 'DELETE':
        if (existing === undefined)
          return this.problem(
            res,
            404,
            'Not Found',
            `No resource with ${idField} "${id}"`,
          );
        if (!this.ifMatchOk(req, res, existing)) return;
        map.delete(id);
        this.scheduleSave();
        res.writeHead(204);
        res.end();
        return;
      default:
        return this.problem(
          res,
          405,
          'Method Not Allowed',
          `${method} is not supported here`,
        );
    }
  }

  /** /preferences/{key} — the GET representation (and ETag basis) is { key, value }. */
  private async handlePreference(
    req: IncomingMessage,
    res: ServerResponse,
    method: string,
    store: UserStore,
    key: string,
  ): Promise<void> {
    const exists = store.preferences.has(key);
    const current = exists
      ? { key, value: store.preferences.get(key) }
      : undefined;
    switch (method) {
      case 'GET':
        if (current === undefined)
          return this.problem(
            res,
            404,
            'Not Found',
            `No preference with key "${key}"`,
          );
        return this.sendJson(res, 200, current, this.etagOf(current));
      case 'PUT': {
        const body = await this.readJsonBody(req, res);
        if (body === BODY_HANDLED) return;
        if (
          body === null ||
          typeof body !== 'object' ||
          Array.isArray(body) ||
          !('value' in body)
        ) {
          return this.problem(
            res,
            400,
            'Bad Request',
            'Body must be { "value": <any JSON value> }',
          );
        }
        if (!this.ifMatchOk(req, res, current)) return;
        store.preferences.set(key, (body as { value: unknown }).value);
        this.scheduleSave();
        const saved = { key, value: store.preferences.get(key) };
        return this.sendJson(
          res,
          exists ? 200 : 201,
          saved,
          this.etagOf(saved),
        );
      }
      case 'DELETE':
        if (current === undefined)
          return this.problem(
            res,
            404,
            'Not Found',
            `No preference with key "${key}"`,
          );
        if (!this.ifMatchOk(req, res, current)) return;
        store.preferences.delete(key);
        this.scheduleSave();
        res.writeHead(204);
        res.end();
        return;
      default:
        return this.problem(
          res,
          405,
          'Method Not Allowed',
          `${method} is not supported here`,
        );
    }
  }

  /** /config/{name} — served fresh from disk per request (dev tool); PUT is a phase-2 admin operation. */
  private handleConfig(
    res: ServerResponse,
    method: string,
    name: string,
  ): void {
    if (method === 'PUT') {
      return this.problem(
        res,
        501,
        'Not Implemented',
        'PUT /config/* is an admin operation reserved for the phase-2 service',
      );
    }
    if (method !== 'GET') {
      return this.problem(
        res,
        405,
        'Method Not Allowed',
        `${method} is not supported on /config/${name}`,
      );
    }
    // Own-key lookup only: a plain object would resolve inherited names like
    // "constructor" or "__proto__" to truthy non-strings and bypass the 404 guard.
    const fileName = Object.prototype.hasOwnProperty.call(CONFIG_FILES, name)
      ? CONFIG_FILES[name]
      : undefined;
    if (!fileName) {
      return this.problem(
        res,
        404,
        'Not Found',
        `Unknown config "${name}". Known names: ${Object.keys(CONFIG_FILES).join(', ')}`,
      );
    }
    const filePath = join(this.configDir, fileName);
    let text: string;
    try {
      text = readFileSync(filePath, 'utf8');
    } catch {
      return this.problem(
        res,
        404,
        'Not Found',
        `Config file not found: ${filePath}`,
      );
    }
    try {
      JSON.parse(text);
    } catch {
      return this.problem(
        res,
        500,
        'Internal Server Error',
        `Config file is not valid JSON: ${filePath}`,
      );
    }
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(text),
      ETag: `"${createHash('sha1').update(text).digest('hex')}"`,
    });
    res.end(text);
  }

  // ── request plumbing ──

  private userIdOf(req: IncomingMessage): string {
    const raw = req.headers['x-user-id'];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return value?.trim() || 'anonymous';
  }

  private storeOf(userId: string): UserStore {
    let store = this.users.get(userId);
    if (!store) {
      // Bound the per-user stores: X-User-Id is unauthenticated, so without a cap a
      // header-spinning client could exhaust memory. Oldest-inserted user is evicted
      // (fine for a dev/demo reference; phase 2 enforces identity + quotas properly).
      if (this.users.size >= MAX_USERS) {
        const oldest = this.users.keys().next().value;
        if (oldest !== undefined) {
          this.users.delete(oldest);
          console.warn(
            `Workspace store user cap (${MAX_USERS}) reached — evicted "${oldest}"`,
          );
        }
      }
      store = {
        workspaces: new Map(),
        pages: new Map(),
        dock: new Map(),
        favorites: [],
        preferences: new Map(),
      };
      this.users.set(userId, store);
    }
    return store;
  }

  /** Strong-enough ETag: sha1 of the resource's JSON GET representation, quoted. */
  private etagOf(value: unknown): string {
    return `"${createHash('sha1').update(JSON.stringify(value)).digest('hex')}"`;
  }

  /**
   * OPTIONAL If-Match precondition on PUT/DELETE. Returns true to proceed; sends 412
   * and returns false on mismatch. Per RFC 9110, If-Match (including `*`) fails when
   * the resource has no current representation.
   */
  private ifMatchOk(
    req: IncomingMessage,
    res: ServerResponse,
    current: unknown,
  ): boolean {
    const raw = req.headers['if-match'];
    const ifMatch = (Array.isArray(raw) ? raw.join(',') : raw)?.trim();
    if (!ifMatch) return true;
    if (current === undefined) {
      this.problem(
        res,
        412,
        'Precondition Failed',
        'If-Match given but the resource does not exist',
      );
      return false;
    }
    if (ifMatch === '*') return true;
    const currentTag = this.etagOf(current);
    if (
      ifMatch
        .split(',')
        .map((tag) => tag.trim())
        .includes(currentTag)
    )
      return true;
    this.problem(
      res,
      412,
      'Precondition Failed',
      `If-Match does not match the current representation (${currentTag})`,
    );
    return false;
  }

  /**
   * Read + parse a JSON request body (5 MB cap). On 413/400 the error response is
   * already sent and BODY_HANDLED is resolved so the route handler just returns.
   */
  private readJsonBody(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<unknown> {
    return new Promise((resolve) => {
      const chunks: Buffer[] = [];
      let size = 0;
      let done = false;
      req.on('data', (chunk: Buffer) => {
        if (done) return;
        size += chunk.length;
        if (size > MAX_BODY_BYTES) {
          done = true;
          this.problem(
            res,
            413,
            'Content Too Large',
            `Request body exceeds ${MAX_BODY_BYTES} bytes`,
          );
          req.resume(); // drain the rest so the connection can complete
          resolve(BODY_HANDLED);
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        if (done) return;
        done = true;
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch {
          this.problem(
            res,
            400,
            'Bad Request',
            'Request body is not valid JSON',
          );
          resolve(BODY_HANDLED);
        }
      });
      req.on('error', () => {
        if (!done) {
          done = true;
          resolve(BODY_HANDLED);
        }
      });
    });
  }

  private sendJson(
    res: ServerResponse,
    status: number,
    payload: unknown,
    etag?: string,
  ): void {
    const body = JSON.stringify(payload);
    const headers: Record<string, string | number> = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    };
    if (etag) headers['ETag'] = etag;
    res.writeHead(status, headers);
    res.end(body);
  }

  /** RFC 9457 problem+json error response. */
  private problem(
    res: ServerResponse,
    status: number,
    title: string,
    detail: string,
  ): void {
    const body = JSON.stringify({ type: 'about:blank', title, status, detail });
    res.writeHead(status, {
      'Content-Type': 'application/problem+json',
      'Content-Length': Buffer.byteLength(body),
    });
    res.end(body);
  }

  // ── file persistence (demo-grade: survive restarts) ──

  private loadStore(): void {
    let raw: string;
    try {
      raw = readFileSync(this.storeFile, 'utf8');
    } catch {
      console.warn(
        `Workspace store file not found (${this.storeFile}) — starting empty`,
      );
      return;
    }
    try {
      const parsed = JSON.parse(raw) as {
        users?: Record<string, PersistedUserStore>;
        dockApps?: Record<string, unknown>;
        storeApps?: Record<string, unknown>;
      };
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        !parsed.users ||
        typeof parsed.users !== 'object'
      ) {
        throw new Error('missing "users" object');
      }
      for (const [userId, user] of Object.entries(parsed.users)) {
        this.users.set(userId, {
          workspaces: new Map(Object.entries(user?.workspaces ?? {})),
          pages: new Map(Object.entries(user?.pages ?? {})),
          dock: new Map(Object.entries(user?.dock ?? {})),
          favorites: Array.isArray(user?.favorites)
            ? user.favorites.filter(
                (id): id is string => typeof id === 'string',
              )
            : [],
          preferences: new Map(Object.entries(user?.preferences ?? {})),
        });
      }
      // Top-level (shared) LOB dock/store apps — tolerate older store files without the keys.
      if (parsed.dockApps && typeof parsed.dockApps === 'object') {
        for (const [id, app] of Object.entries(parsed.dockApps)) {
          this.dockApps.set(id, app);
        }
      }
      if (parsed.storeApps && typeof parsed.storeApps === 'object') {
        for (const [id, app] of Object.entries(parsed.storeApps)) {
          this.storeApps.set(id, app);
        }
      }
      console.log(
        `Workspace store loaded from ${this.storeFile} (${this.users.size} user(s), ${this.dockApps.size} dock app(s), ${this.storeApps.size} store app(s))`,
      );
    } catch (error) {
      console.warn(
        `Workspace store file is corrupt (${this.storeFile}) — starting empty:`,
        error,
      );
      this.users.clear();
      this.dockApps.clear();
      this.storeApps.clear();
    }
  }

  private scheduleSave(): void {
    this.dirty = true;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = undefined;
      this.writeStoreNow();
    }, SAVE_DEBOUNCE_MS);
  }

  /** Atomic write: temp file in the same directory, then rename over the store file. */
  private writeStoreNow(): void {
    try {
      mkdirSync(dirname(this.storeFile), { recursive: true });
      const tmp = `${this.storeFile}.tmp`;
      writeFileSync(tmp, JSON.stringify(this.serialize(), null, 2));
      renameSync(tmp, this.storeFile);
      this.dirty = false;
    } catch (error) {
      console.error(
        `Failed to persist workspace store to ${this.storeFile}:`,
        error,
      );
    }
  }

  private serialize(): {
    version: number;
    savedAt: string;
    dockApps: Record<string, unknown>;
    storeApps: Record<string, unknown>;
    users: Record<string, Required<PersistedUserStore>>;
  } {
    // Null-prototype container: a user id of "__proto__"/"constructor" must round-trip
    // as data instead of touching the object's prototype (and being dropped on load).
    const users: Record<string, Required<PersistedUserStore>> = Object.create(
      null,
    );
    for (const [userId, store] of this.users) {
      users[userId] = {
        workspaces: Object.fromEntries(store.workspaces),
        pages: Object.fromEntries(store.pages),
        dock: Object.fromEntries(store.dock),
        favorites: store.favorites,
        preferences: Object.fromEntries(store.preferences),
      };
    }
    return {
      version: 1,
      savedAt: new Date().toISOString(),
      dockApps: Object.fromEntries(this.dockApps),
      storeApps: Object.fromEntries(this.storeApps),
      users,
    };
  }
}
