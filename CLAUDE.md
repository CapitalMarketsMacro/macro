# CLAUDE.md - Macro Desktop MFE

## Project Overview

NX 23 monorepo for **Capital Markets desktop applications**. Combines Angular 21, React 19, and OpenFin Workspace 24.0.19 (HERE Core UI, runtime 44.146.101.5) into a unified platform with shared libraries for real-time market data, enterprise messaging, and FDC3 interoperability.

## Quick Reference

| App                    | Port | Framework             | Command                                  |
| ---------------------- | ---- | --------------------- | ---------------------------------------- |
| macro-angular          | 4200 | Angular 21 (zoneless) | `npm run start:angular`                  |
| macro-react            | 4201 | React 19 + Vite 8     | `npm run start:react`                    |
| macro-workspace        | 4202 | Angular 21 (zoneless) | `npm run start:workspace`                |
| macro-angular-fdc3     | 4203 | Angular 21 (zoneless) | `npm run start:fdc3`                     |
| prism                  | 4204 | Angular 21 (zoneless) | `npm run start:prism`                    |
| prism-react            | 4205 | React 19 + Vite 8     | `npm run start:prism-react`              |
| capital-markets-themes | 4206 | React 19 + Vite 8     | `npm run start:capital-markets-themes`   |
| market-data-server     | 3000 | Node.js WebSocket + REST | `npm run start:market-data-server`    |
| Core four apps         | -    | -                     | `npm start` (workspace, angular, react, fdc3) |

Launch OpenFin: `npm run launch` (after workspace is serving on 4202)

## Repository Structure

```
macro/
├── apps/
│   ├── macro-angular/          # Angular market data app (PrimeNG, AG Grid, AG Charts)
│   ├── macro-react/            # React market data app (Shadcn/Radix, Tailwind, AG Grid, Recharts)
│   ├── macro-workspace/        # OpenFin Workspace platform shell (Angular, zoneless)
│   ├── macro-angular-fdc3/     # FDC3 instrument viewer (Angular)
│   ├── prism/                  # Prism "Blotter as a Service" (Angular, PrimeNG)
│   ├── prism-react/            # Prism blotter (React 19 + Vite, Shadcn/Radix)
│   ├── capital-markets-themes/ # Theme showcase app (React 19 + Vite)
│   ├── market-data-server/     # WebSocket server (simulated FX + Treasury data) + Workspace Storage reference API
│   ├── macro-mcp/              # MCP server (stdio) — thin entrypoint over @macro/mcp-core
│   └── macro-mcp-agent/        # MCP server (HTTP/SSE) — same @macro/mcp-core, for remote deploy
├── libs/
│   ├── macro-design/           # Shared design tokens, CSS variables, dark mode, AG Grid theme
│   ├── logger/                 # Pino-based structured logging (@macro/logger)
│   ├── mcp-core/               # Shared MCP tools/resources/prompts (@macro/mcp-core) — used by both MCP servers
│   ├── transports/             # Unified messaging: AMPS, Solace, NATS incl. JetStream (@macro/transports + /angular + /react)
│   ├── openfin/                # OpenFin Workspace services + Angular DI + Snap + Analytics + unified Workspace Storage client (@macro/openfin)
│   ├── utils/                  # RxJS conflation utilities (@macro/utils)
│   ├── prism-core/             # Framework-free blotter core: sources, feeds, column inference, roll-ups (@macro/prism-core)
│   ├── macro-grid-format/      # Framework-free column-format engine + tool panels (@macro/macro-grid-format)
│   ├── macro-angular-grid/     # AG Grid 36 Enterprise Angular wrapper + column formatting
│   └── macro-react-grid/       # AG Grid 36 Enterprise React wrapper + column formatting
├── tools/
│   └── prism-broker-lab/       # Docker NATS/Solace brokers + data feeder for Prism (npm run prism:brokers / prism:feed)
├── tsconfig.base.json          # Path aliases: @macro/* -> libs/*/src/index.ts
├── nx.json                     # NX config (defaultBase: master)
└── package.json                # All scripts and dependencies
```

## Critical Architecture Rules

### Path Aliases

All shared libraries are imported via `@macro/*` (defined in `tsconfig.base.json`):

```typescript
import { Logger } from '@macro/logger';
import { NatsTransport, AmpsTransport, SolaceTransport } from '@macro/transports';
import { NatsTransportService, AmpsTransportService, SolaceTransportService } from '@macro/transports/angular';
import { useNatsTransport, useAmpsTransport, useSolaceTransport } from '@macro/transports/react';
import { WorkspaceService, ThemeService, ContextService, NotificationsService } from '@macro/openfin';
import { useViewState } from '@macro/openfin/react';
import { ConflationSubject } from '@macro/utils';
import { MacroAngularGrid } from '@macro/macro-angular-grid';
import { MacroReactGrid } from '@macro/macro-react-grid';
import { buildAgGridTheme, getInitialIsDark, applyDarkMode, onSystemThemeChange, themeConfig } from '@macro/macro-design';
```

### Theming - Single Source of Truth

`@macro/macro-design` owns ALL design tokens. Do NOT duplicate CSS variables or theme logic in apps.

- **CSS variables**: `libs/macro-design/src/lib/css/macro-design.css` (`:root` + `.dark`)
- **Fonts**: `libs/macro-design/src/lib/css/fonts.css` (Noto Sans, Roboto, Ubuntu)
- **AG Grid theme**: `buildAgGridTheme(isDark)` from `@macro/macro-design`
- **Dark mode**: `getInitialIsDark()`, `applyDarkMode(isDark)`, `onSystemThemeChange(cb)` from `@macro/macro-design`
- **Dark mode selector**: Both PrimeNG and PrimeReact use `darkModeSelector: '.dark'`
- **Tailwind dark mode**: `@custom-variant dark (&:is(.dark *))` (class-based, not media query)

Apps import shared CSS in their global `styles.css` BEFORE any framework CSS:

```css
@import '../../../libs/macro-design/src/lib/css/fonts.css';
@import '../../../libs/macro-design/src/lib/css/macro-design.css';
```

### Framework Conventions

**Angular (macro-angular, macro-workspace):**

- All components are `standalone: true`
- ALL Angular apps are **zoneless** (`provideZonelessChangeDetection()`, no zone.js polyfill); async state that templates render must live in signals
- PrimeNG 21 with Aura theme preset
- Component files: `.ts` (class), `.html` (template), `.css` (styles)
- Root component selector: `app-root`
- Use `inject()` function, not constructor injection
- App config in `app.config.ts`, routes in `app.routes.ts`

**React (macro-react):**

- React 19 + Vite 8
- React Router DOM 7.x for routing
- Shadcn UI (Radix primitives) for navigation components
- PrimeReact 11 with Aura theme preset
- Tailwind CSS 4 for utility styling
- Path alias `@/` maps to `src/` for component imports
- Components use function syntax with hooks
- AG Grid uses `forwardRef` pattern via `MacroReactGridRef`

**OpenFin (macro-workspace):**

- Versions: `@openfin/workspace` + `@openfin/workspace-platform` **24.0.19** (HERE Core UI, currently Beta channel), `@openfin/core` + `@openfin/node-adapter` **44.101.5** (exact peer pair), manifest runtime **44.146.101.5**, bundled Notification Center **2.15.0**. Bump all of these in lockstep.
- While 24.x is on the Beta channel, the browser/home UI must be pinned via Desktop Owner Settings: `dos.json` (per-env) pins the `workspace` and `notification-center` system apps; `npm run dos` sets the HKCU pointer (backs up any prior value), `npm run dos:restore` undoes it. Without the pin, the RVM serves the Stable 23.2.x UI and v24 features silently disappear.
- Config is **environment-scoped** under `apps/macro-workspace/public/{local,openshift}/`, selected by the `?env=` query param on the provider URL (default `local`). Local uses `http://localhost:42xx/...`; OpenShift uses `https://{{OPENSHIFT_*_HOST}}/...` tokens substituted at deploy time.
- Platform manifest: `apps/macro-workspace/public/{local,openshift}/manifest.fin.json` (runtime/platform only — does **not** contain the app registry).
- **App registry: `apps/macro-workspace/public/{local,openshift}/apps.json`** — the source of truth for store + dock + home. Each entry: `{appId, name, title, description, manifest, manifestType, icons, tags, category}`; the `category` field drives storefront navigation. (There is no `customSettings.apps` array.)
- Dock (Dock 3.0): `dock-config.json` — `favorites[]` entries are `item`s (launch buttons) or `folder`s, which render as dock DROPDOWNS whose children come from the `contentMenu[]` folder with the SAME id (Dock 3.0 folder merging; current bar: **Showcase** = all sample apps + **Prism Blotters**). Icons accept a URL or `{light, dark}` theme variants. Dock3Service also enables `providerIconContentMenu` and a "Macro Tools" more-menu (Analytics Dashboard / Process Manager). **LOB dock apps**: lines of business publish custom dock entries via the storage API's shared `/dock-apps` resource (`{id, label, iconUrl, type: "icon"|"dropdown", url | children[], lob, sortOrder}`) — the platform reads them at dock init and merges them fail-soft with `lob:`-namespaced ids (`icon` → dock button + "LOB Apps" content catalog grouped by `lob`; `dropdown` → dock folder). Storefront: `storefront-config.json` (nav sections / landing / footer). Snap: `snap-config.json`. Entitlements: `entitlements.json`. `settings.json` holds `platformSettings`, optional `browserSettings` (Workspace v24 browser options: `allowDuplicatePageTitles`, `indicators` suppression, `tabSearchButton`), and the `storage` block (unified-storage environments, below).
- View manifests: `apps/macro-workspace/public/{local,openshift}/<name>.fin.json` (`{ url, fdc3InteropApi: "2.0", interop: { currentContextGroup: "green" } }`).
- FDC3 2.0 with `currentContextGroup: "green"` on all views
- **Unified Workspace Storage API**: ALL user persistence (saved workspaces + layouts, pages, dock customization, store favorites, theme preset, view titles, last-saved pointer) routes through `WorkspaceStorageClient` (`libs/openfin/src/lib/storage/`) — `local` mode = this machine's localStorage (legacy keys preserved), `dev`/`uat`/`prod` = a per-environment REST service (base URL per env from settings.json's `storage` block, user-scoped via `X-User-Id`). Active env precedence: `?storageEnv=` → saved picker choice (`macro:storage-env`) → `defaultEnvironment` → `local`; the provider window has a Storage picker (switch → platform restart). In REST mode apps/dock-config/storefront-config/snap-config load from the service's `/config/*` with static-file fallback on outage; `settings.json` + `entitlements.json` are bootstrap-tier and ALWAYS load from the static per-env folder. Contract: `docs/api/workspace-storage-api.openapi.yaml` (phase 2 = Java Spring Boot + MongoDB); phase-1 reference implementation: market-data-server at `/workspace/v1`
- View state persistence via `ViewStateService` / `useViewState()` hook

### Real-Time Data Patterns

- Market data flows via WebSocket from `market-data-server` (port 3000)
- FX endpoint: `ws://localhost:3000/marketData/fx` (15 G10 pairs, 1-sec ticks)
- Treasury endpoint: `ws://localhost:3000/marketData/tsy` (11 securities, 1-sec ticks)
- Prism tables endpoint: `ws://localhost:3000/prism` — JSON table protocol (on-connect `tables` list → `subscribe` → `snapshot` array → `update` row/rows) consumed by the Prism blotters' **WebSocket** source (`WsTableClient` in `@macro/prism-core`); tables `ust_market_data` (keyed by `symbol`), `ust_trades` (append) + `irs_risk_pnl` (keyed by `tradeId`)
- Prism REST mirror: `http://localhost:3000/prism/tables` (catalog) + `/prism/tables/<name>` (rows as a bare JSON array, CORS on) — consumed by the blotters' snapshot-only **REST** source (`RestSnapshotClient` in `@macro/prism-core`; manual refresh via `BlotterFeed.refresh()` diffs the new snapshot in place)
- IRS Risk & PnL table (`irs_risk_pnl`, WS + REST): simulated IR swaps desk book — one row per OIS position (SOFR/€STR/SONIA/TONA) booked desk → book → trader, with DV01 (USD/bp, bond-style sign), KR01 key-rate buckets that sum to DV01, and a P&L explain that ties out (`dayPnl ≡ carry + rollDown + curve + newTrade + fees + residual`); par-curve random walk reprices positions per (ccy, tenor) point, with an accelerated ~20-min day roll. Seeded `WS IRS Risk / PnL` + `REST IRS Risk / PnL` sources (category Risk) open rolled up. Per-currency `notional` must never be summed — `notionalUsd` is the aggregatable field
- Prism roll-ups: a blotter source may carry `rollup: { groupBy, aggregations?, enabled?, expandLevels?, grandTotal? }` (`RollupConfig` in `@macro/prism-core`) — the blotters render a Risk/PnL-style grouped view (hidden `rowGroup` columns, sum/avg measures, bottom grand-total row). Sources without one get a suggestion inferred from field names (`suggestRollup`); the toolbar Roll-up toggle flips flat ⇄ grouped and both ad-hoc dialogs expose group-by + "Open rolled up" (blank group-by + enabled opens on the suggestion). An aggregation of `"none"` excludes a numeric field from group totals (e.g. mixed-currency notionals)
- Workspace Storage reference API: `http://localhost:3000/workspace/v1` — phase-1 implementation of the unified storage contract (workspaces / pages / dock / favorites / preferences per `X-User-Id`, `/config/*` passthrough, and the shared `/dock-apps` LOB dock-app registry — validated PUTs, not user-scoped; ETag/If-Match, RFC 9457 `problem+json` errors, debounced file persistence to `.workspace-store.json`). Contract: OpenAPI 1.1.0 + Postman collection in `docs/api/`
- For high-frequency data, use `ConflationSubject` from `@macro/utils` (double-buffer algorithm)
- Angular grid updates via `updateRows$` Subject on `MacroAngularGrid`
- React grid updates via `ref.current?.updateRows$` Subject on `MacroReactGridRef`

## Code Style & Formatting

- **Prettier**: single quotes (`"singleQuote": true`), default everything else
- **EditorConfig**: UTF-8, 2-space indentation, LF newlines, final newline
- **ESLint**: NX flat config with `@nx/enforce-module-boundaries` enabled
- **TypeScript**: 6.0.3, strict-ish (skipLibCheck, experimentalDecorators)

## Testing

**Unit tests:**

- Angular apps + libs: **Jest 30** (`@nx/jest`, `jest-preset-angular`)
- React app + libs: **Vitest 4** (`@nx/vite`)
- `@macro/macro-design`: Jest with jsdom environment
- Run all (CI entry point): `npm run test` — runs every project with coverage via `scripts/test-ci.mjs`, then writes a **merged LCOV report to `coverage/lcov.info`** and a **merged JUnit report to `junit.xml`** at the repo root (per-project files land in `coverage/{apps,libs}/<name>/` and `reports/`)
- Run all without coverage/reports: `npm run test:all` (`nx run-many --target=test --all`)
- Run one: `npx nx test <project-name>` (e.g., `npx nx test logger`)

## Building

```bash
npm run build                  # CI entry point: builds every app (production) into dist/apps/<name>
npm run build:angular          # Build Angular app
npm run build:react            # Build React app
npm run build:workspace        # Build OpenFin workspace
npm run build:logger           # Build logger lib (for npm publish)
npx nx run-many --target=build --all  # Build everything
```

Output goes to `dist/` directory. The app list for `npm run build` lives in the `build:apps:ci` script in `package.json` — add new apps there so CI builds them.

## Continuous Integration

`.github/workflows/ci.yml` runs on pushes to `master`, on pull requests, and via manual dispatch: `npm ci` → `npm run build` → `npm run test` (Node 22, ubuntu-latest), then uploads `junit.xml` + `coverage/lcov.info` as the `test-reports` artifact.

- Plain `npm ci` works because `.npmrc` sets `legacy-peer-deps=true` (TypeScript 6 is ahead of `@angular/build`'s declared peer range).
- `scripts/test-ci.mjs` merges the reports even when tests fail (then exits non-zero), so CI publishers can pick them up on red builds.
- Every test target must declare `{workspaceRoot}/reports/{projectName}-junit.xml` in its `outputs` — NX cache replays only restore declared outputs, and a missing declaration silently drops that project from the merged `junit.xml`.

## NX Commands

```bash
npx nx graph                          # Dependency visualization
npx nx affected --target=test         # Test only affected projects
npx nx affected --target=build        # Build only affected projects
npx nx show project <name> --web      # Project details
```

Default base branch is `master`.

## MCP Servers Available

This repo has 5 MCP servers configured in `.mcp.json`:

- **ag-mcp**: AG Grid documentation search
- **primeng**: PrimeNG component documentation
- **angular-cli**: Angular CLI tools, best practices, documentation
- **tailwindcss**: Tailwind CSS utilities and docs
- **macro-mcp**: Custom scaffolding for new apps/libs in this monorepo (requires a one-time `npm run build:mcp`)

An **nx-mcp** server (NX workspace commands) is additionally provided by the NX Claude Code plugin.

## Adding a New Application

> OpenFin config is environment-scoped under `apps/macro-workspace/public/{local,openshift}/` — do steps 4–6 in **both** env folders (local `http://localhost:42xx`, openshift `{{OPENSHIFT_*_HOST}}` tokens). All surfaces are config-driven, so no `libs/openfin` code change is needed.

1. Generate with NX: `npx nx generate @nx/angular:application <name> --directory=apps/<name>` (pick a free serve port — 4200–4206 are taken)
2. Import shared CSS from `@macro/macro-design` in the app's `styles.css`
3. Use `@macro/*` libraries for grids, logging, messaging, theming
4. Create a view manifest `public/{local,openshift}/<name>.fin.json` (`{ "url": "...", "fdc3InteropApi": "2.0", "interop": { "currentContextGroup": "green" } }`)
5. Register the app in `public/{local,openshift}/apps.json` — add an entry with `appId`, `manifest` → the view-manifest URL, `manifestType: "view"`, `icons`, `tags`, and a `category`. This alone surfaces it in the store, home search, and as a launch target.
6. Add a dock entry in `public/{local,openshift}/dock-config.json` — sample apps go INSIDE the `showcase` content-menu folder (its sub-folders by framework); only give an app its own `favorites[]` entry/folder when it warrants top-level dock real estate (folder favorites need a same-id `contentMenu` folder for their children). Then wire storefront nav in `storefront-config.json` (a nav item whose `category` matches — OpenFin caps nav at 3 sections / 5 items, and the dynamic Favorites section occupies one slot, so add categories as items in an existing section rather than a 4th section), and add an icon under `public/icons/`.
7. Register the app for CI: add it to the `build:apps:ci` script in `package.json` so `npm run build` builds it into `dist/apps/<name>`. Its tests are auto-discovered by `npm run test`, but declare `{workspaceRoot}/reports/{projectName}-junit.xml` in the test target's `outputs` so NX cache replays keep the merged JUnit report complete
8. Add a path alias to `tsconfig.base.json` only if creating a new lib

## Adding a New Shared Library

1. Generate: `npx nx generate @nx/js:library <name> --directory=libs/<name> --bundler=tsc`
2. Add path alias to `tsconfig.base.json`: `"@macro/<name>": ["libs/<name>/src/index.ts"]`
3. Export public API from `libs/<name>/src/index.ts`

## Key Files to Know

| File                                             | Purpose                                      |
| ------------------------------------------------ | -------------------------------------------- |
| `tsconfig.base.json`                             | All `@macro/*` path aliases                  |
| `nx.json`                                        | Build targets, caching, plugins, generators  |
| `apps/macro-workspace/public/{local,openshift}/apps.json` | OpenFin app registry (per-env; source of truth for store + dock + home) |
| `apps/macro-workspace/public/{local,openshift}/dock-config.json` | Dock favorites + content menu (per-env)      |
| `apps/macro-workspace/public/{local,openshift}/storefront-config.json` | Storefront nav sections / landing / footer (per-env) |
| `apps/macro-workspace/public/{local,openshift}/manifest.fin.json` | OpenFin platform/runtime manifest (per-env; NOT the app registry) |
| `apps/macro-workspace/public/{local,openshift}/settings.json` | `platformSettings` + optional `browserSettings` + `storage` block (unified-storage environments: local/dev/uat/prod service URLs, `defaultEnvironment`) |
| `docs/api/workspace-storage-api.openapi.yaml`    | Workspace Storage API contract (OpenAPI 3.1) — phase-2 Spring Boot + MongoDB implements it; phase-1 reference lives in market-data-server at `/workspace/v1` |
| `apps/macro-workspace/public/{local,openshift}/dos.json` | Desktop Owner Settings: pins workspace 24.0.19 + notification-center 2.15.0 system apps (applied via `npm run dos`) |
| `libs/macro-design/src/lib/css/macro-design.css` | All CSS variables (`:root` + `.dark`)        |
| `libs/macro-design/src/lib/ag-grid-theme.ts`     | AG Grid theme builder                        |
| `libs/macro-design/src/lib/dark-mode.ts`         | Dark mode utilities                          |
| `libs/macro-design/src/lib/theme.config.ts`      | Theme palettes for OpenFin                   |
| `libs/openfin/src/index.ts`                      | All OpenFin service exports                  |
| `apps/macro-angular/src/app/app.config.ts`       | Angular app providers (PrimeNG, zoneless CD) |
| `apps/macro-react/src/main.tsx`                  | React entry (PrimeReact provider config)     |
| `apps/macro-workspace/src/app/app.config.ts`     | Workspace app config (zoneless)              |
| `.github/workflows/ci.yml`                       | CI workflow: `npm ci` → `npm run build` → `npm run test` on master pushes + PRs; uploads `test-reports` artifact |
| `scripts/test-ci.mjs`                            | `npm run test` runner — Jest/Vitest split, merges LCOV → `coverage/lcov.info` and JUnit → root `junit.xml` |
| `.github/copilot-instructions.md`                | Condensed AG Grid 36 / format-panel / calc / Show-Values-As rules + gotchas (auto-loaded by Copilot) |
| `docs/copilot/ag-grid-36-format-panel-port.md`   | Full verbatim port guide for the above (engine, tool panel, persistence side-channels) |

## Common Pitfalls

- Do NOT add `:root` or `.dark` CSS variable blocks in individual apps -- use `@macro/macro-design`
- ALL Angular apps are **zoneless** -- template-bound state updated from WebSocket/interval/FDC3/AG-Grid-event callbacks MUST be a signal (or pushed imperatively through a component API); a plain field mutation will never repaint
- AG Grid Enterprise requires the license; both grid wrappers register `AllEnterpriseModule`
- The React app uses `@/` path alias (mapped to `src/`) for Shadcn component imports
- OpenFin APIs (`fin.*`) are only available when running inside the OpenFin runtime; services gracefully no-op in browsers
- PrimeReact is on alpha (`11.0.0-alpha.10`) -- check for breaking changes
- The `clone` library is used in AG Charts for immutable option updates
- AG Grid's built-in `avg` aggregation yields a rich `{ count, value }` object on group/footer rows (so parent levels can re-aggregate) — `@macro/macro-grid-format` value formatters unwrap it; custom formatters must too, or aggregated cells render blank/raw
- Workspace storage posture: reads DEGRADE (log + empty result — an outage must never brick platform boot), writes THROW (a failed save must never look successful) — keep that split in storage-backed features. Never route `settings.json`/`entitlements.json` through the storage API: they bootstrap it
- In blotter `onColumnRowGroupChanged`-style grid handlers, filter by `event.source` — the wrappers' own columnDefs pushes fire `gridOptionsChanged`/`gridInitializing`; only user gestures (`api`, `uiColumnDragged`, …) should drive app state

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->
