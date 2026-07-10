# Prism — Blotter as a Service

**Release Notes · Release 2026.07 · July 10, 2026**

Prism turns any real-time feed into a desk-grade trading blotter — no code, no rebuild, no redeploy. Point it at a messaging topic, a WebSocket endpoint, or a REST URL: Prism discovers your tables, infers capital-markets column formatting from the data itself, and streams updates into an AG Grid 36 Enterprise workbench with formatting, grouping, roll-ups, and analytics built in.

Prism ships as two functionally identical applications — **Angular 21** (PrimeNG) and **React 19** (Shadcn/Radix) — built on one shared, framework-free core (`@macro/prism-core`), and runs standalone in any modern browser or as FDC3-enabled views inside **OpenFin Workspace**.

---

## Contents

1. [Highlights](#highlights)
2. [Connect to anything — six transports](#connect-to-anything--six-transports)
3. [Three source behaviors](#three-source-behaviors)
4. [Source management](#source-management)
5. [Smart columns — desk-grade formatting from raw data](#smart-columns--desk-grade-formatting-from-raw-data)
6. [Roll-up views — Risk & PnL-style aggregation](#roll-up-views--risk--pnl-style-aggregation)
7. [Built for streaming — conflation and async transactions](#built-for-streaming--conflation-and-async-transactions)
8. [The grid workbench](#the-grid-workbench)
9. [Theming, OpenFin and interop](#theming-openfin-and-interop)
10. [Powered by AG Grid 36.0](#powered-by-ag-grid-360)
11. [Demo environment — try it in five minutes](#demo-environment--try-it-in-five-minutes)
12. [Release timeline](#release-timeline)
13. [Compatibility](#compatibility)
14. [Known limitations](#known-limitations)

---

## Highlights

- **Six transports, one blotter** — AMPS, NATS, NATS JetStream, Solace, plain **WebSocket** (new), and **REST API** (new) behind a single declarative source model.
- **Roll-up views** (new) — one click flips any blotter from a flat tape to a Risk/PnL-style grouped view with sum/avg measures, expand levels, and a grand-total row at the bottom; sources with no configuration get a sensible hierarchy suggested from their field names.
- **IRS Risk & PnL demo book** (new) — a simulated OIS swaps desk (SOFR / €STR / SONIA / TONA) with DV01, key-rate buckets that sum exactly to DV01, and a P&L explain that ties out to the penny, streamed over WebSocket and served as a REST snapshot.
- **One-click table discovery** (new) — WebSocket and REST endpoints announce their tables; pick one and the topic, key field, and behavior are filled in for you.
- **Quick search & Advanced Filter** (new) — subtle status-bar toggles reveal an inline search-all-columns box and AG Grid's Advanced Filter expression builder.
- **Duplicate as ad-hoc** (new) — clone any read-only catalog source into an editable copy in one click.
- **Fully zoneless Angular** (new) — the Angular blotter now runs without zone.js, on Angular's stable zoneless change detection.

---

## Connect to anything — six transports

A Prism source is a small declarative descriptor: transport, connection, topic/table, key field, behavior — that's the whole integration. The blotter does the rest.

| Transport | Label in UI | Initial snapshot | Live updates | Notes |
| --- | --- | --- | --- | --- |
| AMPS | `AMPS` | ✅ SOW query | ✅ | State-of-the-World snapshot then subscription (`sowAndSubscribe`), optional content filter, logon and heartbeat |
| NATS | `NATS` | — | ✅ | Live-only subject subscription; rows appear as they arrive |
| NATS JetStream | `NATS JetStream` | ✅ last-per-subject | ✅ | Stream replay delivers a last-value snapshot, then live |
| Solace | `Solace` | — | ✅ | Live-only topic subscription; host / VPN / credentials per source |
| WebSocket | `WebSocket` | ✅ snapshot frame | ✅ | Prism's plain-JSON table protocol: server announces tables → `subscribe` → `snapshot` array → `update` row/batch frames |
| REST | `REST API` | ✅ HTTP GET | manual | Snapshot-only: one GET returns rows as a JSON array; a toolbar **Refresh** re-fetches and diffs changes into the grid in place |

Snapshot-capable transports seed the grid before going live, so keyed blotters open fully populated. The WebSocket and REST clients are deliberately lenient with real-world servers: both treat bare JSON arrays as row batches and bare objects as single rows, and the REST client additionally accepts `{rows: [...]}` / `{data: [...]}` envelopes — so endpoints that were never built for Prism usually just work.

All broker connectivity rides `@macro/transports`, the shared messaging library that puts AMPS, Solace, and NATS (including JetStream) behind one `TransportClient` contract with callback, Observable, and Subject subscription styles.

## Three source behaviors

Every source declares how records map onto the grid:

| Behavior | Label in UI | Semantics |
| --- | --- | --- |
| Snapshot + updates | `Snapshot + Updates` | A stable keyed row set — updates patch rows in place by key field (positions, top-of-book, risk) |
| Append | `Append (events)` | Every message is a new row — a trade tape or order log, trimmed to an optional max-rows cap |
| Streaming | `Streaming (high-freq)` | Keyed like snapshot + updates, but always conflated before painting to bound the repaint rate |

Toolbar and picker badges color-code the behavior so users can tell a tape from a keyed book at a glance.

## Source management

- **Seeded catalog** — both blotters ship with 11 pre-wired, read-only sources across all six transports and five categories (FX, Rates, Risk, Orders, Analytics), loaded from a JSON catalog at startup.
- **Catalog browser** — a dedicated Data Sources page renders every source as a card, groupable by Category, Type, or Behavior, with Open / Edit / Delete / Duplicate actions.
- **In-place source picker** — click the source name in the blotter toolbar to search and switch sources without leaving the page; sources are grouped by category with transport, behavior, and ad-hoc badges.
- **Ad-hoc sources** — a "New data source" dialog creates sources at runtime with per-transport connection forms and validation. Ad-hoc sources persist in browser storage and survive reloads; catalog sources stay immutable, but **Duplicate as ad-hoc** clones one into an editable copy.
- **One-click discovery** — for WebSocket and REST endpoints, **Load tables** lists the tables the endpoint announces; picking one auto-fills the table name, key field, and behavior from the endpoint's suggestions.
- **Deep links** — the active source lives in the URL (`/blotter?source=<id>`), so a blotter can be bookmarked, shared, and restored per view by OpenFin layouts — several blotter views can each restore a different source.
- **Live toolbar** — color-coded connection status (idle → connecting → snapshot → live), live row count, a messages-per-second meter, Reconnect / Disconnect, and a REST **Refresh** button. Feed errors surface inline instead of failing silently.

## Smart columns — desk-grade formatting from raw data

Prism never asks you to define columns. In the default **Infer** mode, columns are built from a merged sample of the snapshot batch — sparse fields (a yield that is `null` on futures rows) still type correctly — with title-cased headers and the key field pinned left. Field-name heuristics then apply capital-markets conventions automatically:

- **DV01 / PV01 / KR01** → signed, thousands-separated dollars with positive/negative coloring
- **Spreads** → basis points; **yields / coupons / rates** → percentages
- **P&L** → sign-colored numbers; **sizes / notionals** → grouped integers
- **FX pairs** → pip-precision rates with the JPY convention; **timestamps / maturities** → dates and datetimes

A second **Auto (v36)** mode delegates column creation to AG Grid 36's automatic column generation instead — with the same inferred formats and roll-up decorations re-applied to the generated definitions. The toolbar switches modes live.

## Roll-up views — Risk & PnL-style aggregation

Any source may carry a roll-up configuration: a group-by hierarchy (e.g. desk → book → trader), per-field aggregations, initial expand depth, and a grand-total row. The blotter then renders a grouped view with a pinned auto-group column titled after the hierarchy ("Desk / Book / Trader"), sum/avg/min/max/count measures, the row-group panel for drag refinement, and a grand-total row at the bottom.

- **Suggested hierarchies** — sources with no configuration get one inferred from field names (desk, book, portfolio, strategy, trader, account, counterparty, …), so the toolbar **Roll-up** toggle works on any payload with plausible grouping fields.
- **Aggregation safety** — an explicit `"none"` aggregation excludes a field from group totals. The seeded IRS book uses it to keep native-currency notionals from ever being summed across currencies, while `notionalUsd` aggregates correctly.
- **Open rolled up** — sources can declare that they open grouped; the ad-hoc dialog exposes both the hierarchy and the toggle.
- **Honest state** — clearing all groups inside the grid flips the toolbar back to flat; the toggle never lies about what's on screen.

## Built for streaming — conflation and async transactions

- **Per-key conflation** — streaming sources (and any keyed source that opts in) conflate updates through a double-buffered map at a configurable interval (250 ms default): the latest value per key wins, ingestion never contends with painting, and a key's *first* appearance always renders immediately.
- **Async grid transactions** — updates flow into AG Grid through `applyTransactionAsync`, batching high-frequency ticks into efficient repaints.
- **Rate visibility** — a per-second message meter in the toolbar shows live throughput per blotter.
- **Clean lifecycle** — deliberate disconnects never surface as errors, failed connects tear down their conflation timers, and an in-flight REST fetch can never repopulate a blotter that was stopped.

## The grid workbench

Every Prism blotter inherits the full AG Grid 36 Enterprise feature set through the shared `@macro/macro-angular-grid` / `@macro/macro-react-grid` wrappers — identical in both frameworks:

- **Format tool panel** — a custom "Format" sidebar panel applies desk-grade display formats to any set of columns without code: 11 format kinds (Decimal, Integer, Percent, Basis points, Currency, Compact K/M/B, Multiplier, **Treasury ticks** — 32nds/64ths with half-tick "+" (`99-16+`), **FX rate** with automatic JPY pip convention, Date, Text style), with live preview, per-column apply/remove, and reset.
- **Business presets** — one-click preset gallery grouped by business area: Rates (Yield %, Spread (bps), DV01 ($mm), UST Price (32nds/64ths)), FX (5dp/JPY rates, points, pips), Risk/PnL (accounting-style P&L with red/green and parentheses, compact notionals, Greeks, VaR), plus Commodities, Text, and General.
- **Sign-based conditional coloring** — "+green / −red" or "−red only" cell coloring that adapts to light and dark themes via design-system market tokens.
- **Excel-style decimal steps** — "Increase Decimals" / "Decrease Decimals" in the header and right-click menus, persisted with the column's format.
- **Calculated columns** — users create formula columns from the column menu (`[bid] - [ask]`-style bracket expressions) with validation and deferred apply; the wrappers capture user formulas — including formats applied to them — in the grid's saved-state blob, so hosts that persist grid state restore them intact.
- **Show Values As** — % of grand total, column total, or parent row total on any value column in grouped and pivoted views; the wrappers capture the per-column selection in saved grid state (which AG Grid's native state API does not), so it survives a state save/restore.
- **Status-bar power toggles** — five unobtrusive checkboxes render inside the grid's own status bar: **Search** (inline quick-filter box across all columns, Escape to clear), **Adv Filter** (AG Grid's Advanced Filter expression builder), **Grouping**, **Pivot**, and **Pagination** — all off by default so the blotter opens clean.
- **Selection & analytics** — multi-row selection plus Excel-style cell-range selection feeding live Count / Sum / Min / Max / Avg aggregations in the status bar, and right-click **integrated charting** of any cell range (AG Charts Enterprise).
- **Aggregation-aware formatting** — group and footer cells render with the same capital-markets formats as leaf cells, including AG Grid's rich `avg` aggregation payloads.
- **State save/restore APIs** — the wrappers expose `getGridState()` / `applyGridState()`, extending AG Grid's native state with the three things it doesn't persist (column formats, calculated columns, Show Values As) in one JSON-safe blob.

## Theming, OpenFin and interop

- **Light & dark, one source of truth** — a header toggle (persisted, defaulting to OS preference) drives PrimeNG/Radix, Tailwind, and the AG Grid theme from a single design-system class; grids re-theme live, no reload.
- **Trading-desk typography** — Quartz-based AG Grid theme with Roboto chrome and IBM Plex Mono data cells for aligned digits, compact 22 px rows.
- **OpenFin Workspace** — both blotters are registered platform apps ("Prism — Blotter as a Service" and "Prism Blotter (React)") with store, dock, and home entries in both local and OpenShift environment configs; view manifests enable **FDC3 2.0** on the green context group.
- **Framework parity by construction** — both apps are thin shells over the same framework-free core; features land in Angular and React simultaneously.

## Powered by AG Grid 36.0

Prism runs **AG Grid 36.0 Enterprise** (released June 24, 2026) with AG Charts Enterprise 14 in both frameworks. AG Grid 36 is unusually well matched to a blotter-*as-a-service*: its headline features solve exactly the problems a generic, data-shape-agnostic blotter has — and Prism exercises all three, not just bundles them.

| AG Grid 36.0 feature | What it does | How Prism uses it |
| --- | --- | --- |
| **Calculated Columns** *(new in 36)* | End-user formula columns via a built-in column-menu dialog — no data-source change | Enabled in deferred-apply mode in both wrappers, which listen to the new create/edit/remove events and **capture user formulas in the grid's saved-state blob** — something the native state API doesn't do |
| **Show Values As** *(new in 36)* | Display aggregated values as % of grand / column / parent totals without preprocessing | Every column opts in (`enableShowValuesAs`), turning any roll-up into instant contribution analysis; the wrappers **capture the per-column mode in saved grid state** so a state restore brings it back |
| **Automatic Column Generation** *(new in 36)* | Generates column definitions from row data — for data shapes unknown at build time | The blotters' **Auto (v36)** column mode: AG Grid generates the columns, and Prism's `processAutoGeneratedColumnDefs` hook re-applies inferred capital-markets formats and roll-up grouping on top |
| **Theming API refinements** *(36 param changes)* | Faster, more customizable programmatic theming | One `buildAgGridTheme(isDark)` builder themes every grid in both frameworks, adapted to the v36 params, rebuilding live on dark-mode changes |
| **Single scrolling container** *(new in 36)* | Internal DOM consolidated from 9+ scroll containers into one | Smoother scrolling under sustained streaming updates — free performance for every blotter |
| **Leaner production bundles** *(new in 36)* | Dev-time validation removed from default production bundles | Smaller blotter payloads served to OpenFin views |
| **Framework reach** | Angular 20–22, React 16.8–19+, TypeScript ≥ 5.8.3, and official first-class **zoneless Angular** support | Prism's Angular app is fully zoneless and its React app is on React 19 — both squarely inside AG Grid 36's supported matrix |

Underneath the 36.0 features, Prism leans on the Enterprise pillars that make a blotter service viable at all: async transactions for streaming throughput, grid state for save/restore, custom status-bar panels and tool panels for the desk UX, Advanced Filter and quick filter for discovery, and row grouping / pivoting / aggregation for the roll-up views.

**Why this matters for Blotter as a Service:** a generic blotter cannot know your columns in advance — AG Grid 36's automatic column generation plus Prism's format inference close that gap. Your users will always need one more column and one more view — calculated columns, Show Values As, and the Format panel let them build those themselves, and the grid wrappers capture all three in one portable, JSON-safe state blob that AG Grid's native state API doesn't carry, ready for hosts to make durable. That is the difference between a grid and a service.

## Demo environment — try it in five minutes

```bash
# 1. Demo data server — WebSocket + REST tables on port 3000
npm run start:market-data-server

# 2. Either blotter (or both)
npm run start:prism          # Angular  → http://localhost:4204
npm run start:prism-react    # React    → http://localhost:4205

# 3. Optional: real brokers for the NATS / JetStream / Solace sources
npm run prism:brokers        # Docker: NATS 2.10 (+ JetStream) and Solace PubSub+
npm run prism:feed           # publishes FX quotes, analytics, positions, UST prices
```

Open a blotter and pick a source — good first stops:

- **WS IRS Risk / PnL** — the simulated OIS swaps book, opening rolled up desk → book → trader: watch DV01 and a tying P&L explain (`dayPnl ≡ carry + rollDown + curve + newTrade + fees + residual`) tick once a second, with key-rate buckets that sum exactly to DV01 and an accelerated day roll every ~20 minutes.
- **WS UST Market Data (snapshot)** — live top-of-book for 15 US-rates instruments (7 on-the-run Treasuries + 8 CME futures) with dealer 32nds displays like `99-16+` and real tick-size increments.
- **WS UST Trades (append)** — a trade tape with burst prints, opening rolled up by instrument type → symbol → side.
- **REST IRS Risk / PnL (snapshot)** — the same book over snapshot-only REST; press **Refresh** and watch the diff flash in.

The demo server's tables keep ticking even with zero subscribers, so REST snapshots always show an evolving book. The two AMPS sources require a user-supplied AMPS instance (AMPS is commercial software and not part of the Docker lab).

## Release timeline

| Date | Delivery | PR |
| --- | --- | --- |
| May 31 | Unified messaging transports: AMPS, Solace, NATS behind one API (`@macro/transports`) | #3 |
| Jun 24 | Capital-markets **Format tool panel** in both grid wrappers (`@macro/macro-grid-format`) | #32–#33 |
| Jun 24 | **AG Grid 35 → 36** and AG Charts 13 → 14 upgrade | #34 |
| Jun 24–25 | **Calculated columns** with persistence; v36 selection API migration; theme param adaptation | #35–#38 |
| Jun 25 | **Show Values As** with persistence; Risk/PnL demo view | #39 |
| Jun 29 | **Prism Angular app** (Blotter as a Service) with seeded catalog & ad-hoc sources + NATS JetStream transport | #43 |
| Jun 29 | Docker **broker lab** (NATS + Solace + data feeder) | #45 |
| Jun 29 | Framework-free core extracted to **`@macro/prism-core`** | #46 |
| Jun 29 | **Prism React app** on the shared core | #48 |
| Jun 30 | In-blotter **source picker** with inline ad-hoc create/edit/delete | #50–#51 |
| Jun 30 | Array-payload expansion; **Pagination toggle** + row-count / aggregation status panels | #54–#56 |
| Jul 2 | **Grouping & Pivot toggles**; Show Values As enablement; Excel-style decimal steps | #57–#58 |
| Jul 3 | **Plain WebSocket table source** + server endpoint; duplicate-as-ad-hoc | #60 |
| Jul 5 | **REST API source** with in-place Refresh + server REST mirror | #61 |
| Jul 5 | **Quick Filter search box & Advanced Filter toggles** | #65 |
| Jul 5 | All Angular apps **zoneless** (zone.js removed) | #68 |
| Jul 7 | **Roll-up views** for both blotters | #70 |
| Jul 7 | **IRS Risk & PnL source** (WS + REST) with tying P&L explain | #72 |

## Compatibility

| Component | Version |
| --- | --- |
| AG Grid Enterprise (+ Angular/React wrappers) | 36.0 |
| AG Charts Enterprise (integrated charts) | 14.0 |
| Angular (zoneless) | 21.2 |
| React | 19.2 |
| PrimeNG (Angular blotter UI) | 21.1 |
| Shadcn/Radix + Tailwind CSS 4 (React blotter UI) | — |
| OpenFin Workspace / FDC3 | 24.0.19 / FDC3 2.0 |
| TypeScript | 6.0 |
| Demo server (Node.js WebSocket + REST) | Node 22+ |

An AG Grid Enterprise license is required for production use.

## Known limitations

- **REST sources are snapshot-only by design** — no streaming updates and no msg/s meter; use the toolbar Refresh (or a WebSocket source) for live data.
- **No feed-level auto-reconnect** — connection loss surfaces as an inline error with one-click Reconnect; NATS and Solace sources additionally honor their brokers' native reconnect settings.
- **Grid layouts and user format edits are not yet persisted per source** in the Prism apps — persistence today covers ad-hoc source definitions and the selected source (which OpenFin layouts restore per view). The wrappers' `getGridState()` / `applyGridState()` APIs are available to hosts that need it now.
- **Conditional formatting is sign-based** (+green / −red) — there is no arbitrary threshold rule builder yet.
- **Show Values As** persists built-in modes only; the % of *row* total and % of *parent column* total variants are pivot-mode-only (AG Grid behavior).
- **Advanced Filter and per-column filters are mutually exclusive** while Advanced Filter is on (native AG Grid behavior); the quick-filter Search keeps working alongside.
- **FDC3 2.0 is enabled at the view level** (green context group); the blotters do not yet broadcast or listen to FDC3 context themselves.
- **AMPS demo sources** require your own AMPS instance — AMPS is commercial and not included in the Docker broker lab.

---

*Prism — Blotter as a Service is built on `@macro/prism-core`, `@macro/transports`, `@macro/macro-angular-grid`, `@macro/macro-react-grid`, `@macro/macro-grid-format`, and `@macro/macro-design` in the Capital Markets Macro platform monorepo.*
