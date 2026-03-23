# Macro Desktop MFE

NX 22.5 monorepo for **Capital Markets desktop applications**. Combines Angular 21, React 19, and OpenFin Workspace into a unified platform with shared libraries for real-time market data, enterprise messaging, analytics, and FDC3 interoperability.

<a alt="Nx logo" href="https://nx.dev" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="45"></a>

---

## Quick Start

```bash
npm install
npm start                    # Start all three apps (Angular :4200, React :4201, Workspace :4202)
npm run launch               # Launch OpenFin (after workspace is serving on 4202)
```

## Applications

| App | Port | Framework | Description |
|-----|------|-----------|-------------|
| **macro-angular** | 4200 | Angular 21 (zoneful), PrimeNG 21 | FX Market Data (G10 pairs), Treasury Microstructure charts |
| **macro-react** | 4201 | React 19, Vite 7, Tailwind 4, Shadcn | Treasury Market Data, Commodities Dashboard |
| **macro-workspace** | 4202 | Angular 21 (zoneless) | OpenFin Workspace platform shell, Analytics Dashboard |
| **market-data-server** | 3000 | Node.js WebSocket | Simulated FX + Treasury tick data (1-sec intervals) |
| **macro-mcp** | - | Node.js | Custom MCP server for scaffolding apps/libs |

### Start Commands

```bash
npm run start:angular        # Angular app only
npm run start:react          # React app only
npm run start:workspace      # Workspace platform only
npx nx serve market-data-server  # WebSocket data server
```

---

## Registered OpenFin Views

| App ID | Title | Type |
|--------|-------|------|
| macro-angular-fx-market-data | FX Market Data | view |
| macro-angular-treasury-microstructure | Treasury Microstructure | view |
| macro-react-treasury-market-data | Treasury Market Data | view |
| macro-react-commodities-dashboard | Commodities Dashboard | view |
| macro-angular-fdc3-instrument-viewer | FDC3 Instrument Viewer | view |
| macro-analytics-dashboard | Analytics Dashboard | view |
| macro-workspace-view1 | FDC3 Broadcaster | view |
| macro-workspace-view2 | FDC3 Listener | view |
| rates-desktop | Rates E-Trading Desktop | manifest |

---

## Shared Libraries

### Core

| Alias | Path | Purpose |
|-------|------|---------|
| `@macro/logger` | libs/logger | Pino-based structured logging |
| `@macro/macro-design` | libs/macro-design | CSS variables, dark mode, AG Grid theme, fonts -- single source of truth |
| `@macro/rxutils` | libs/rxutils | RxJS conflation utilities (double-buffer, high-frequency data) |

### AG Grid Wrappers

| Alias | Path | Purpose |
|-------|------|---------|
| `@macro/macro-angular-grid` | libs/macro-angular-grid | AG Grid 35 Enterprise Angular wrapper |
| `@macro/macro-react-grid` | libs/macro-react-grid | AG Grid 35 Enterprise React wrapper |

Both grid wrappers include:

- AG Grid Enterprise + Integrated Charts (AG Charts Enterprise)
- Real-time data updates via RxJS `updateRows$` Subject
- **Column Formatting** -- user-toggleable format mode with floating popover (Number, %, bps, $, K/M/B + configurable decimal places)
- **Formulas** -- `allowFormula: true` on numeric columns for spreadsheet-style calculations (`=SUM`, `=AVERAGE`)
- **Absolute Sorting** -- sort Change/Change% columns by magnitude regardless of sign
- Grid state save/restore (including user column formats)

### Unified Transports (`@macro/transports`)

A single library providing a common `TransportClient` interface across all messaging systems:

| Alias | Entry | Purpose |
|-------|-------|---------|
| `@macro/transports` | libs/transports/src/index.ts | Framework-agnostic base: `AmpsTransport`, `SolaceTransport`, `NatsTransport` |
| `@macro/transports/angular` | libs/transports/src/lib/angular/ | Angular DI services: `AmpsTransportService`, `SolaceTransportService`, `NatsTransportService` |
| `@macro/transports/react` | libs/transports/src/lib/react/ | React hooks: `useAmpsTransport()`, `useSolaceTransport()`, `useNatsTransport()`, `useTransportSubscription()` |

```typescript
// Framework-agnostic
import { NatsTransport } from '@macro/transports';
const client = new NatsTransport('my-app');
await client.connect({ servers: 'ws://localhost:8224' });
client.publish('orders.new', { symbol: 'AAPL', qty: 100 });
const { observable } = await client.subscribeAsObservable('prices.>');

// Angular -- inject the service
import { NatsTransportService } from '@macro/transports/angular';
private nats = inject(NatsTransportService);

// React -- use the hook
import { useNatsTransport } from '@macro/transports/react';
const { client, connected, connect } = useNatsTransport('my-app');
```

Transport-specific extras:

| Transport | Extra | Protocol |
|-----------|-------|----------|
| **AMPS** | `sow()` State-of-the-World queries | WebSocket |
| **Solace** | `onEvent()` session lifecycle events | WebSocket |
| **NATS** | `request()` request/reply pattern | WebSocket (`@nats-io/nats-core` v3) |

### Standalone Transport Libraries (legacy)

The original per-transport libraries remain for backward compatibility:

| Alias | Path | Purpose |
|-------|------|---------|
| `@macro/amps` | libs/amps | AMPS (60East) client wrapper |
| `@macro/solace` | libs/solace | Solace PubSub+ client wrapper |
| `@macro/nats` | libs/nats | NATS.js v3 WebSocket client wrapper |

### OpenFin Platform (`@macro/openfin`)

| Alias | Path | Purpose |
|-------|------|---------|
| `@macro/openfin` | libs/openfin | OpenFin Workspace services + Angular DI wrappers |
| `@macro/openfin/react` | libs/openfin (react.ts) | React hooks: `useViewState`, `useNotifications` |

Key services:

| Service | Purpose |
|---------|---------|
| **WorkspaceService** | Platform init orchestration (settings, theme, dock, home, store, snap, notifications) |
| **PlatformService** | Workspace platform init, toolbar buttons, custom actions (launch-app, toggle-theme, toggle-page-tabs) |
| **WorkspaceOverrideService** | Workspace CRUD, snapshot decoration (Snap), analytics publishing, theme override |
| **ThemeService** | Dark/light theme sync with OpenFin platform scheme |
| **ContextService** | FDC3 context broadcasting/listening, `currentChannel$` observable, `onContext<T>()` typed filter |
| **NotificationsService** | Notification Center with level-based API: `info()`, `success()`, `warning()`, `error()`, `critical()` |
| **SnapService** | OpenFin Snap window snapping/docking, snapshot decoration/restore |
| **AnalyticsNatsService** | Publishes workspace analytics to NATS (singleton via `getAnalyticsNats()`) |
| **ViewStateService** | View state persistence via `fin.me` options, auto-save with workspace flush |
| **Dock3Service** | Next-gen dock: favorites, content menu folders, app launching |
| **HomeService** | OpenFin Home: registration, search, app launching |
| **StoreService** | Storefront with favorites support |

---

## OpenFin Snap

Window snapping/docking powered by `@openfin/snap-sdk` 1.5.0:

- Auto-registers all platform windows on creation
- Drag windows near each other to snap; hold **SHIFT** to unstick
- Snap layout persists in workspace snapshots (decorator pattern on `getSnapshot`/`applySnapshot`)
- Configurable via `settings.json` under `snapProvider`

```json
{
  "snapProvider": {
    "enabled": true,
    "serverOptions": {
      "showDebug": false,
      "keyToStick": false,
      "autoHideClientTaskbarIcons": true
    }
  }
}
```

---

## Analytics

Real-time analytics pipeline: **OpenFin events -> NATS -> Analytics Dashboard**.

### Event Sources

| Source | Events |
|--------|--------|
| **Platform** | Lifecycle (Starting, PlatformCreated, PlatformReady, ComponentsRegistered, Initialized, Quitting, Quit, Error) |
| **Platform** | Workspace (Save, Delete, Restoring, Restored, RestoreFailed) |
| **Platform** | Theme (Toggle, Changed), App Launch, Browser (ShowPageTabs, HidePageTabs) |
| **Browser** | All OpenFin internal analytics (via `handleAnalytics` override) |
| **Dock** | App Launch (entry label + appId) |
| **Home** | Show, Open, Search Query, App Launch |
| **Store** | Storefront Show, Open, App Launch |

### NATS Topic Topology

```
macro.analytics.<user>.<source>.<type>.<action>
```

```bash
nats subscribe "macro.analytics.>"             # All events
nats subscribe "macro.analytics.mruda.>"       # Single user
nats subscribe "macro.analytics.*.platform.>"  # All users, platform events
```

Payload: `{ timestamp, user, source, type, action, value, entityId, data }`

### Analytics Dashboard

Angular component in macro-workspace (`/analytics` route), registered as OpenFin view `macro-analytics-dashboard`:

- Real-time NATS subscription to `macro.analytics.>`
- User selector sidebar for filtering activity per user
- Source breakdown with color-coded stats (Platform, Browser, Dock, Home, Store)
- Live event feed with click-to-expand detail panels (JSON data)
- Pause/resume, clear, event rate counter (evt/min)
- Theme-aware -- syncs with OpenFin dark/light via `ThemeService`
- Uses `NatsTransportService` from `@macro/transports/angular`

---

## FDC3 Interoperability

- FDC3 2.0 with `currentContextGroup: "green"` on all views
- `ContextService` provides `currentChannel$` observable and `onContext<T>()` typed method
- FX Market Data grid broadcasts `fdc3.instrument` on row click
- FDC3 Instrument Viewer displays received instrument context with history

---

## Theming

`@macro/macro-design` is the single source of truth for all design tokens.

- **CSS variables**: `:root` + `.dark` in `macro-design.css` (oklch color space)
- **Fonts**: Noto Sans, Roboto, Roboto Mono, Ubuntu
- **AG Grid**: `buildAgGridTheme(isDark)` from `@macro/macro-design`
- **Dark mode**: class-based (`.dark` on `<html>`), synced via `ThemeService.syncWithOpenFinTheme()`
- **PrimeNG/PrimeReact**: `darkModeSelector: '.dark'`
- **Tailwind**: `@custom-variant dark (&:is(.dark *))`
- **OpenFin**: theme palettes in `themeConfig` or loaded from JSON presets

---

## Repository Structure

```
macro/
├── apps/
│   ├── macro-angular/              # Angular market data app
│   ├── macro-react/                # React market data app
│   ├── macro-workspace/            # OpenFin Workspace platform shell + Analytics Dashboard
│   │   └── public/
│   │       ├── manifest.fin.json   # Platform manifest (11 registered apps)
│   │       ├── settings.json       # Apps, dock, snap provider config
│   │       └── *.fin.json          # View manifests
│   ├── market-data-server/         # WebSocket data server
│   ├── macro-mcp/                  # Custom MCP scaffolding server
│   └── *-e2e/                      # Playwright E2E tests
├── libs/
│   ├── macro-design/               # Design tokens, CSS variables, themes
│   ├── logger/                     # Pino structured logging
│   ├── transports/                 # Unified messaging transports
│   │   ├── src/lib/amps/           #   AMPS adapter
│   │   ├── src/lib/solace/         #   Solace adapter
│   │   ├── src/lib/nats/           #   NATS adapter
│   │   ├── src/lib/angular/        #   Angular DI services
│   │   └── src/lib/react/          #   React hooks
│   ├── amps/                       # Standalone AMPS client
│   ├── solace/                     # Standalone Solace client
│   ├── nats/                       # Standalone NATS client
│   ├── openfin/                    # OpenFin services + Angular DI
│   ├── rxutils/                    # RxJS conflation
│   ├── macro-angular-grid/         # AG Grid 35 Angular wrapper
│   └── macro-react-grid/           # AG Grid 35 React wrapper
├── tsconfig.base.json              # Path aliases (@macro/*)
├── nx.json                         # NX config (defaultBase: master)
└── package.json                    # Scripts and dependencies
```

---

## Testing

```bash
npx nx run-many --target=test --all           # All unit tests
npx nx test <project-name>                    # Single project
npx nx test openfin                           # OpenFin services (323 tests)
npx nx test nats                              # NATS client (32 tests)
npx nx test macro-angular-grid                # Angular grid (54 tests)
npx nx test macro-react-grid                  # React grid
npm run e2e:angular                           # Playwright E2E
npm run e2e:react
npm run e2e:workspace
```

## Building

```bash
npm run build:angular
npm run build:react
npm run build:workspace
npx nx run-many --target=build --all
```

Output: `dist/` directory.

---

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| Angular | 21 | Framework (macro-angular, macro-workspace) |
| React | 19 | Framework (macro-react) |
| AG Grid Enterprise | 35.1.0 | Data grids with formulas, absolute sorting |
| AG Charts Enterprise | 13.1.0 | Integrated charts |
| PrimeNG | 21.1.3 | Angular UI components |
| PrimeReact | 11.0.0-alpha.10 | React UI components |
| Tailwind CSS | 4 | Utility styling (React) |
| @openfin/workspace-platform | 22.3.29 | OpenFin Workspace shell |
| @openfin/snap-sdk | 1.5.0 | Window snapping/docking |
| @nats-io/nats-core | 3.3.1 | NATS WebSocket client |
| RxJS | 7.x | Reactive streams |
| NX | 22.5 | Monorepo tooling |

## OpenFin Manifest Permissions

The platform manifest includes comprehensive permissions:

- **System**: `getOSInfo`, `launchExternalProcess` (assets + downloads + executables), `terminateExternalProcess`, `downloadAsset`, `serveAsset`, `openUrlWithBrowser`, `readRegistryValue`, `registerCustomProtocol`, `unregisterCustomProtocol`, `checkCustomProtocolState`, `launchLogUploader`
- **Application**: `setFileDownloadLocation`, `getFileDownloadLocation`
- **Clipboard**: read/write for text, HTML, RTF, images
- **Web APIs**: `clipboard-read`, `clipboard-sanitized-write`, `notifications`, `openExternal`, `fullscreen`

## MCP Servers

6 MCP servers configured in `.mcp.json`:

- **ag-mcp** -- AG Grid documentation search
- **primeng** -- PrimeNG component documentation
- **nx-mcp** -- NX workspace commands
- **angular-cli** -- Angular CLI tools, best practices, documentation
- **tailwindcss** -- Tailwind CSS utilities and docs
- **macro-mcp** -- Custom scaffolding for new apps/libs in this monorepo
