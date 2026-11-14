# @macro/prism-core

The **framework-free core** of Prism — Blotter as a Service. Both blotter apps (`apps/prism`, Angular; `apps/prism-react`, React) are thin adapters over this library: the Angular app wraps it with signals, the React app with `useSyncExternalStore`.

## Modules

| Module | Exports | Purpose |
| --- | --- | --- |
| `blotter-source` | `BlotterSource`, transport/behaviour types | The data-source model: transport (AMPS / NATS core / NATS JetStream / Solace / WebSocket / REST), connection, topic, behaviour (`snapshot-update` / `append` / `streaming`), key field, conflation |
| `column-inference` | `inferColumns` | Capital-markets field-name heuristics → `@macro/macro-grid-format` specs (bid/ask/mid → price, spread → bps, changePercent → coloured %, qty → grouped int, pnl → coloured, yield/coupon → %, ids → pinned text) |
| `rollup` | `RollupConfig`, `suggestRollup` | Grouped-view config (`groupBy`, `aggregations`, `expandLevels`, `grandTotal`) + a suggestion inferred from field names; an aggregation of `"none"` excludes a numeric field from group totals |
| `blotter-feed` | `BlotterFeed`, `GridOps` | The transport→grid controller: maps behaviour × transport onto a grid via the small `GridOps` interface; status via `getState()` / `subscribe()`; `refresh()` diffs a new REST snapshot in place |
| `data-source-store` | `DataSourceStore` | Seeded catalog (fetch injected) + localStorage ad-hoc sources (create / edit / delete / duplicate) |
| `ws-table-client` | `WsTableClient` | Prism's plain-WebSocket JSON **table protocol** (`tables` → `subscribe` → `snapshot` → `update`); lenient with envelope-less servers |
| `rest-table-client` | `RestSnapshotClient` | Snapshot-only REST source: table catalog discovery + rows as bare JSON arrays (also accepts `{ rows }` / `{ data }` / single object) |

Actual message transports come from `@macro/transports`; the WS table protocol and REST client are Prism's own and live here. High-frequency feeds are conflated with `ConflationSubject` from `@macro/utils`.

The repo's `market-data-server` implements both protocol ends (`ws://localhost:3000/prism`, `http://localhost:3000/prism/tables`) with three tables: `ust_market_data`, `ust_trades`, `irs_risk_pnl`.

Full product docs (sources, modes, roll-ups, AMPS, troubleshooting): [`apps/prism/README.md`](../../apps/prism/README.md).

## Building & testing

```bash
npx nx build prism-core
npx nx test prism-core     # Jest — model / inference / rollup / feed / store / clients
```
