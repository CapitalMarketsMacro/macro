# Prism — Blotter as a Service

A config-driven **Capital Markets blotter**. Launch it, **pick a data source** (AMPS / NATS core / NATS JetStream / Solace / plain WebSocket / REST) from a catalog — or define an **ad-hoc** one (connection + topic) — and get a **snapshot + real-time AG Grid** blotter. Sources are categorized by transport and by behaviour (live-ticking, snapshot-then-updates, append-heavy fills/orders).

Two apps share one framework-free core (**`@macro/prism-core`**):

| App | Stack | Dev port | Path |
| --- | --- | --- | --- |
| **Prism** (Angular) | Angular 21 (zoneful) + PrimeNG | **4204** | `apps/prism` |
| **Prism (React)** | React 19 + Vite + Shadcn/Radix | **4205** | `apps/prism-react` |

---

## TL;DR — see it working with live data

From the repo root:

```bash
# 0. install (once)
npm install --legacy-peer-deps

# 1. start the local brokers (NATS + JetStream + Solace) — needs Docker
npm run prism:brokers          # Solace takes ~30-60s to come up

# 2. publish simulated market data to those brokers
npm run prism:feed             # Ctrl-C to stop

# 3. run a blotter and open it
npm run start:prism            # Angular → http://localhost:4204
#   …or…
npm run start:prism-react      # React   → http://localhost:4205
```

In the app: click the toolbar source picker and open **NATS FX Quotes** (streaming), **JetStream Positions** (snapshot + updates), **NATS Analytics** (append), or **Solace UST Prices** (streaming). Then **New data source** to point at any broker/topic of your own.

Stop the brokers when done: `npm run prism:brokers:down` (add `-v` to wipe volumes).

> **No Docker?** The **WS UST** and **REST UST** catalog sources need only the repo's Node market-data server:
> `npm run start:market-data-server` — then open **WS UST Market Data** (snapshot + keyed updates),
> **WS UST Trades** (append), or **REST UST Market Data** (snapshot only + manual **Refresh**) from the
> picker. See [Plain WebSocket](#plain-websocket-table-protocol) and [REST](#rest-snapshot-only).

> Requirements: **Node 18+** (Node 22+ recommended), **npm** (install with `--legacy-peer-deps`), and **Docker** (Docker Desktop on Windows) for the broker lab. Brokers expose **WebSocket** endpoints — browsers/OpenFin can only reach them over `ws://`.

---

## What's running where

| Endpoint | Used by the seeded catalog | Notes |
| --- | --- | --- |
| `ws://localhost:9222` | NATS core + JetStream | WebSocket listener (not TCP 4222) |
| `ws://localhost:8008` | Solace PubSub+ web messaging | admin UI at `http://localhost:8080` (admin/admin) |
| `ws://localhost:9008/amps/json` | AMPS | **not** in Docker — see [AMPS](#amps) |
| `ws://localhost:3000/prism` | Plain WebSocket (table protocol) | `npm run start:market-data-server` — no Docker needed |
| `http://localhost:3000/prism/tables` | REST (snapshot only) | same server; rows as bare JSON arrays |

The seed catalog lives at `apps/prism/public/data-sources.json` (Angular) and `apps/prism-react/public/data-sources.json` (React) and is pre-wired to these ports, so live data shows up with no edits. Full broker-lab docs: [`tools/prism-broker-lab/README.md`](../../tools/prism-broker-lab/README.md).

---

## Using the blotter

Prism opens straight to a **blotter** (`/blotter`); a fresh instance shows a **Select data source** prompt.

1. **Source picker** — click the source name in the toolbar (or **Select data source** on an empty blotter) to open the picker: **search**, browse sources grouped by category, and switch the blotter to any of them **in place**. Ad-hoc sources have inline **edit** / **delete**. The chosen source is written to the URL (`/blotter?source=<id>`), so it persists when you save a blotter as part of an **OpenFin layout** — open several blotters, point each at a different source, and save them together; each restores its own source.
2. **New / ad-hoc source** — **New data source** (in the picker or the empty state) opens a dialog: choose a transport, fill the connection + topic, pick a **behaviour** and (for keyed feeds) a **key field**. It's saved to your browser (localStorage) and opens immediately. Delete it later from the picker or the catalog. Catalog sources are read-only — use the **duplicate** button on a catalog entry (in the picker or the catalog) to create an editable ad-hoc copy pre-filled from it.
3. **Catalog** (`/sources`) — the full grid of every source grouped by **Category / Type / Behavior**, for browsing/managing them all at once. Reachable from the header nav or the picker's **Browse all**.
4. **Toolbar & grid** — connection status, row count, msgs/sec, **Reconnect** / **Disconnect**, and the **column-mode toggle**. The grid's **status bar** shows the **filtered-of-total row count**, the **selected-row count**, and live **aggregations of the selected cells** (Count / Sum / Min / Max / Avg). Bottom-right toggles: **Search** (reveals an inline quick-filter box that searches every column as you type; Esc clears), **Adv Filter** (AG Grid's Advanced Filter expression builder above the grid), **Grouping**, **Pivot**, and **Pagination** (all off by default).

### Source behaviour (mode)
- **Snapshot + Updates** — stable keyed rows; the snapshot seeds the grid, live messages update rows in place by `keyField` (positions, top-of-book, risk).
- **Append** — every message is a new row (orders / fills / executions), trimmed to `maxRows`.
- **Streaming** — high-frequency keyed quotes, conflated (`conflationMs`) before painting.

**AMPS** (SOW), **NATS JetStream** (last-per-subject), **WebSocket** (table snapshot) and **REST** (the whole payload) deliver a true initial snapshot; NATS core and Solace are live-only (rows appear as they tick). **REST is snapshot-only** — there is no stream; a **Refresh** button in the blotter toolbar re-fetches and diffs the new snapshot into the grid in place (adds / in-place updates / removals).

**Array payloads** — if a message's payload is a JSON **array** of objects (a batch of rows), Prism expands each element into its own row automatically (snapshot or live). A single row is always an object, so this never misfires. The ad-hoc dialog has an **Expand array payloads into rows** toggle (on by default) — uncheck it only if you want the whole array treated as one record. WebSocket table sources **always** expand (there the array is protocol framing — snapshot / batch frames), so the toggle is hidden for them.

### Column building
- **Infer** (default) — columns are inferred from the first record and capital-markets formatting is auto-applied (prices, yields → %, spreads → bps, qty → grouped ints, P&L → coloured, dates). Keeps the Format tool panel + calculated columns fully usable.
- **Auto (v36)** — AG Grid v36 `autoGenerateColumnDefs`. Best for snapshot-seeded sources; toggle to **Infer** if a live-only source shows no columns.

---

## AMPS

AMPS is commercial — there is **no public Docker image**, so it is not in the broker lab. To use your own AMPS instance:

1. Ensure its **websocket / JSON transport** is reachable (e.g. `ws://<host>:9008/amps/json`) with SOW-enabled topics.
2. Point Prism at it — edit `connection.url` for the AMPS entries in `public/data-sources.json`, **or** just use **Add ad-hoc source** at runtime (transport = AMPS, URL = `ws://<your-host>:9008/amps/json`, topic = your SOW topic, key field = the record's natural key).

The seeded AMPS entries expect topics `fx_spot` (key `symbol`) and `orders`.

---

## Plain WebSocket (table protocol)

For servers that are just a **WebSocket endpoint** (no broker), Prism speaks a small JSON table
protocol (`WsTableClient` in `@macro/prism-core`):

1. On connect the server announces its tables: `{ "type": "tables", "tables": [{ "name", "title", "description", "keyField", "mode" }] }`.
2. The client subscribes: `{ "type": "subscribe", "table": "<name>" }`.
3. The server acks (`subscribed`), sends a **snapshot as a JSON array** — `{ "type": "snapshot", "table", "rows": [...] }` —
   then streams updates as a **single row** (`{ "type": "update", "table", "row": {...} }`) **or an array**
   (`{ "type": "update", "table", "rows": [...] }`).

In the **ad-hoc dialog**, pick transport **WebSocket**, enter the URL, click **Load tables**, and choose a
table — the server's suggested key field and behaviour are filled in for you. The client is lenient with
envelope-less servers too: a bare JSON array is a batch of rows, a bare object is one row, and the snapshot
phase ends on the first live row if no `snapshot` frame ever arrives.

The repo's **`market-data-server`** implements the protocol at `ws://localhost:3000/prism` with two tables
over a shared US-rates universe (7 cash **OTR Treasuries** + 8 **CME futures**, Sep-26 contracts):

| Table | Behaviour | Key | Contents |
| --- | --- | --- | --- |
| `ust_market_data` | Snapshot + Updates | `symbol` | Top-of-book (bid/ask/mid/last, 32nds displays, yields, OI) |
| `ust_trades` | Append | `tradeId` | Trade prints (side, price, size, venue, counterparty) |

---

## REST (snapshot only)

For plain HTTP APIs there is a **REST** transport: one `GET`, rows as a **JSON array**, no stream.
The blotter toolbar gains a **Refresh** button that re-fetches and diffs the new snapshot into the
grid **in place** — new keys are added, existing rows update (with cell flash), vanished keys are
removed. Behaviour is pinned to *Snapshot + Updates*.

Discovery mirrors the WebSocket flow: `GET <url>` returns the table catalog
(`{ "tables": [{ "name", "title", "description", "keyField", "mode" }] }`) and rows come from
`GET <url>/<table>`. Arbitrary endpoints work too — leave the **Table** blank and the URL itself is
fetched; the client accepts a bare array (normal), `{ "rows": [...] }`, `{ "data": [...] }`, or a
single object.

The repo's **`market-data-server`** serves the same two UST tables over REST at
`http://localhost:3000/prism/tables` (CORS enabled), and the snapshots keep evolving server-side, so
each Refresh shows movement.

---

## Run inside the OpenFin workspace

Both blotters are registered in the workspace store + dock (category **Blotters**):

```bash
npm run start:workspace        # serves the workspace on 4202
npm run start:prism            # 4204 (and/or)
npm run start:prism-react      # 4205
npm run launch                 # launch OpenFin (after the workspace is serving)
```

Find **Prism — Blotter as a Service** / **Prism Blotter (React)** in the store (Blotters) and on the dock.

---

## Architecture

- **`@macro/prism-core`** (`libs/prism-core`, framework-free) — the shared brains: the `BlotterSource` model, `column-inference` (CM field-name heuristics → `@macro/macro-grid-format` specs), **`BlotterFeed`** (maps mode × transport onto a grid via a small `GridOps` interface; status via `getState()`/`subscribe()`), and **`DataSourceStore`** (catalog + localStorage ad-hoc; catalog fetch injected). The Angular app wraps it with signals; the React app with `useSyncExternalStore`.
- **Grid** — `@macro/macro-angular-grid` / `@macro/macro-react-grid` (AG Grid 36 wrappers, streaming via `updateRows$`/`addRows$`, the Format tool panel, calculated columns, and the v36 auto-column passthrough).
- **Transports** — `@macro/transports` (`AmpsTransport`, `NatsTransport`, `NatsJetStreamTransport`, `SolaceTransport`); plain-WebSocket table sources use `WsTableClient` and snapshot-only REST sources use `RestSnapshotClient`, both from `@macro/prism-core` itself (the table protocol is Prism's own). High-frequency feeds are conflated with `ConflationSubject` from `@macro/utils`.

---

## Build & test

```bash
npx nx build prism            # Angular app
npx nx build prism-react      # React app
npx nx test  prism-core       # shared core (model / inference / feed / store)
npx nx test  prism            # Angular app
npx nx test  prism-react      # React app
npx nx typecheck prism-react  # React type-check
```

---

## Troubleshooting

- **Grid is empty / no data** — make sure `npm run prism:feed` is running and the broker for that source is up (`npm run prism:brokers`). Payloads must be **JSON**.
- **Can't connect** — brokers must expose **WebSocket** ports (NATS needs its `websocket` listener, not 4222). Over `https`, switch the catalog URLs to `wss://`.
- **No columns in Auto (v36) mode on a live-only source** — toggle to **Infer** (auto-gen reads the initial row data; live-only rows arrive as transactions).
- **Solace from the Node feeder fails** — NATS still feeds; you can also publish from Solace's *Try-Me!* page at `http://localhost:8080`.
