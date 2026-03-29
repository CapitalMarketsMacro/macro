# Macro Desktop MFE

NX 22.5 monorepo for **Capital Markets desktop applications**. Combines Angular 21, React 19, and OpenFin Workspace (HERE Core UI 23.0.20) into a unified platform with shared libraries for real-time market data, enterprise messaging, analytics, and FDC3 interoperability.

<a alt="Nx logo" href="https://nx.dev" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="45"></a>

---

## Quick Start

```bash
npm install
npm start                    # Start all apps (Angular :4200, React :4201, Workspace :4202)
npm run launch               # Launch OpenFin (after workspace is serving)
```

## Applications

| App | Port | Framework | Description |
|-----|------|-----------|-------------|
| **macro-angular** | 4200 | Angular 21, PrimeNG 21 | FX Market Data, Treasury Microstructure charts |
| **macro-react** | 4201 | React 19, Vite 7, Tailwind 4, Shadcn | Treasury Market Data, Commodities Dashboard |
| **macro-workspace** | 4202 | Angular 21 (zoneless) | OpenFin platform shell, Analytics Dashboard, Provider window |
| **macro-angular-fdc3** | 4203 | Angular 21 | FDC3 Instrument Viewer |
| **market-data-server** | 3000 | Node.js WebSocket | Simulated FX + Treasury tick data |
| **macro-mcp** | - | Node.js | Custom MCP server for scaffolding, Figma import |

---

## Importing a Figma Make App

The `macro-mcp` server provides a fully automated tool to import React apps designed in Figma Make into this monorepo as OpenFin views.

### From a zip file (most common)

Product manager exports from Figma Make. Developer tells their AI assistant:

```
Import the Figma app at C:/Downloads/my-dashboard.zip as "my-dashboard"
with title "My Dashboard" on port 4205
```

The `import_figma_app` MCP tool automatically:
1. Extracts the zip
2. Creates the NX React app with Vite
3. Copies all Figma source into `src/figma/`
4. Detects and wires `App.tsx` as root component
5. Detects Tailwind CSS and creates PostCSS config
6. Imports Figma CSS chain (`styles/index.css`, `tailwind.css`, `theme.css`)
7. Creates wrapper `app.tsx` with BrowserRouter basename + theme sync
8. Creates OpenFin view manifests (local + openshift)
9. Registers in manifest.fin.json + settings.json
10. Adds to Dock favorites
11. Installs missing npm dependencies from Figma's package.json
12. Updates package.json scripts

### From a folder

```
Import the Figma app at C:/figma-exports/risk-dashboard as "risk-dashboard"
with title "Risk Dashboard" on port 4206
```

### Result

```
apps/my-dashboard/
├── src/
│   ├── app/app.tsx         # Wrapper (BrowserRouter + theme + imports FigmaApp)
│   ├── figma/              # All Figma Make code — untouched
│   │   ├── app/App.tsx     # Figma root component
│   │   ├── app/components/ # All Figma components
│   │   └── styles/         # Tailwind, fonts, theme CSS
│   └── main.tsx            # Entry (macro-design CSS + Figma CSS)
├── vite.config.ts          # Base path + Tailwind + aliases
├── postcss.config.cjs      # Auto-created if Tailwind detected
└── index.html
```

### For your team

Works with **any MCP-compatible AI assistant**: Claude Code, VS Code GitHub Copilot, JetBrains AI.

**Requirements:**
- Build the MCP server once: `npx nx build macro-mcp`
- MCP config is in `.mcp.json` (auto-loaded by Claude Code / VS Code)

---

## Unified Transports (`@macro/transports`)

A single library providing a common `TransportClient` interface for AMPS, Solace, and NATS. All transport logic lives here -- the standalone `@macro/amps`, `@macro/solace`, `@macro/nats` packages are thin re-exports for backward compatibility.

### Framework-Agnostic

```typescript
import { NatsTransport, AmpsTransport, SolaceTransport } from '@macro/transports';
import type { TransportClient, TransportMessage } from '@macro/transports';

// NATS
const nats = new NatsTransport('my-app');
await nats.connect({ servers: 'ws://localhost:8224' });
nats.publish('orders.new', { symbol: 'AAPL', qty: 100 });
const { observable } = await nats.subscribeAsObservable('prices.>');
observable.subscribe(msg => console.log(msg.json()));
const reply = await nats.request('service.ping', { ts: Date.now() }); // NATS-only

// AMPS
const amps = new AmpsTransport('my-app');
await amps.connect({ url: 'ws://localhost:9100/amps/json' });
await amps.sow(msg => console.log(msg), 'orders', "/status='active'"); // AMPS-only

// Solace
const solace = new SolaceTransport();
await solace.connect({ hostUrl: 'ws://localhost:8008', vpnName: 'default', userName: 'user', password: 'pass' });
solace.onEvent(event => console.log(event)); // Solace-only
```

### Angular (Injectable Services)

```typescript
import { NatsTransportService, AmpsTransportService, SolaceTransportService } from '@macro/transports/angular';

@Component({ ... })
export class MyComponent {
  private transport = inject(NatsTransportService);

  async ngOnInit() {
    await this.transport.connect({ servers: 'ws://localhost:8224' });
    const { observable } = await this.transport.subscribeAsObservable('prices.>');
    observable.subscribe(msg => this.handleData(msg.json()));
  }
}
```

### React (Hooks)

```typescript
import { useNatsTransport, useTransportSubscription } from '@macro/transports/react';

function MyComponent() {
  const { client, connected, connect } = useNatsTransport('my-app');

  useEffect(() => { connect({ servers: 'ws://localhost:8224' }); }, []);

  const messages = useTransportSubscription(client, 'prices.>', connected);
  return <div>{messages.map(m => <p>{m.json().price}</p>)}</div>;
}
```

### Unified TransportClient Interface

All three transports implement:

```typescript
interface TransportClient {
  readonly transportName: string;
  connect(options): Promise<void>;
  disconnect(): Promise<void>;
  publish(topic, data): void;
  subscribe(handler, topic): Promise<string>;
  subscribeAsObservable(topic): Promise<{ observable, subscriptionId }>;
  subscribeAsSubject(topic): Promise<{ subject, subscriptionId }>;
  unsubscribe(subscriptionId): Promise<void>;
  readonly isConnected: boolean;
  onError(handler): void;
  onEvent?(handler): void;      // Solace only
  getSubscriptionIds(): string[];
}
```

### Transport-Specific Extras

| Transport | Extra Methods | Protocol |
|-----------|--------------|----------|
| **AMPS** | `sow()`, `getClient()`, `getSubject()`, `getClientName()`, `getCommand()` | WebSocket |
| **Solace** | `onEvent()`, `getSession()`, `getSolace()`, `getSubject()` | WebSocket |
| **NATS** | `request()`, `getConnection()` | WebSocket (`@nats-io/nats-core` v3) |

### Backward Compatibility

The standalone packages re-export from transports:

```typescript
// These still work -- they delegate to @macro/transports
import { AmpsClient } from '@macro/amps';
import { SolaceClient } from '@macro/solace';
import { NatsClient } from '@macro/nats';

// New code should use:
import { AmpsTransport, SolaceTransport, NatsTransport } from '@macro/transports';
```

---

## OpenFin Platform

### Registered Views

| App ID | Title | Type |
|--------|-------|------|
| macro-angular-fx-market-data | FX Market Data | view |
| macro-angular-treasury-microstructure | Treasury Microstructure | view |
| macro-react-treasury-market-data | Treasury Market Data | view |
| macro-react-commodities-dashboard | Commodities Dashboard | view |
| macro-angular-fdc3-instrument-viewer | FDC3 Instrument Viewer | view |
| macro-analytics-dashboard | Analytics Dashboard | view |
| macro-workspace-view1 / view2 | FDC3 Broadcaster / Listener | view |
| rates-desktop | Rates E-Trading Desktop | manifest |

### Platform Window

Compact 280x280 frameless window positioned top-right with:
- Runtime version + Workspace version display
- **Analytics** -- launch Analytics Dashboard
- **Processes** -- launch OpenFin Process Manager
- **Logs** -- upload current session logs (`launchLogUploader`)
- **Send** -- send app log to log server (`sendApplicationLog`)
- **Expand** -- theme presets + test notifications
- **Minimize** -- minimize to taskbar
- **Quit** -- with confirmation dialog ("This will close all workspace windows and views")

### Snap (Window Docking)

Powered by `@openfin/snap-sdk` 1.5.0. Drag windows near each other to snap; SHIFT to unstick.

### Browser Toolbar Buttons

ShowHideTabs, ColorLinking, PresetLayouts, LockUnlockPage, SaveMenu, Toggle Page Tabs, Toggle Theme, Upload Logs

### Manifest Organization

```
apps/macro-workspace/public/
├── local/              # localhost URLs -- used by npm run launch
│   ├── manifest.fin.json
│   ├── settings.json
│   └── *.fin.json      # View manifests
├── openshift/          # {{PLACEHOLDER}} URLs -- for deployment
│   ├── manifest.fin.json
│   ├── settings.json
│   └── *.fin.json
├── icons/              # Shared static assets
└── *.json              # Theme preset files
```

### Log Management

```json
// In platform manifest:
"enableAppLogging": true,
"appLogsTimezone": "utc",
"logManagement": { "enabled": true, "url": "http://MontuNobleNumbat2404:8000" }
```

Log username is set automatically from Windows `USERNAME` environment variable after platform initialization.

---

## Analytics

Real-time pipeline: **OpenFin events -> NATS -> Analytics Dashboard**.

### NATS Topic Topology

```
macro.analytics.<user>.<source>.<type>.<action>
```

```bash
nats subscribe "macro.analytics.>"             # All events
nats subscribe "macro.analytics.mruda.>"       # Single user
```

### Event Sources

Platform (Lifecycle, Workspace, Theme), Browser (internal analytics), Dock (App Launch), Home (Search, Launch), Store (Show, Launch)

### Analytics Dashboard

Angular view (`/analytics`) with real-time NATS subscription, user filtering, source breakdown, live event feed, pause/resume.

---

## AG Grid 35 Features

Both Angular and React grid wrappers include:
- **Formulas** -- `allowFormula: true` on numeric columns
- **Absolute Sorting** -- sort by magnitude on Change/Change% columns
- **Column Formatting** -- user-toggled Fx popover (Number, %, bps, $, K/M/B + decimals)
- **Integrated Charts** -- AG Charts Enterprise
- Grid state save/restore (including user column formats)

---

## Shared Libraries

| Alias | Purpose |
|-------|---------|
| `@macro/transports` | Unified AMPS/Solace/NATS transport (primary) |
| `@macro/transports/angular` | Angular DI services |
| `@macro/transports/react` | React hooks |
| `@macro/amps` | AMPS re-export (backward compat) |
| `@macro/solace` | Solace re-export (backward compat) |
| `@macro/nats` | NATS re-export (backward compat) |
| `@macro/openfin` | OpenFin services + Angular DI |
| `@macro/openfin/react` | React hooks (useViewState, useNotifications) |
| `@macro/logger` | Pino structured logging |
| `@macro/macro-design` | CSS variables, dark mode, AG Grid theme |
| `@macro/rxutils` | RxJS conflation (high-frequency data) |
| `@macro/macro-angular-grid` | AG Grid 35 Angular wrapper |
| `@macro/macro-react-grid` | AG Grid 35 React wrapper |

---

## FDC3 Interoperability

FDC3 2.0 with `currentContextGroup: "green"`. `ContextService` provides `currentChannel$` observable and `onContext<T>()`.

---

## Theming

`@macro/macro-design` is the single source of truth. OKLCH color space. Class-based `.dark` selector. Synced via `ThemeService.syncWithOpenFinTheme()`.

---

## MCP Servers

7 MCP servers configured in `.mcp.json`:

| Server | Purpose |
|--------|---------|
| **macro-mcp** | Scaffolding, Figma import, AMPS data explorer, library docs |
| **ag-mcp** | AG Grid documentation |
| **primeng** | PrimeNG components |
| **angular-cli** | Angular CLI + best practices |
| **tailwindcss** | Tailwind CSS utilities |
| **nx-mcp** | NX workspace commands |
| **figma-remote-mcp** | Figma design fetch (optional, needs API key) |

### macro-mcp Tools

| Tool | Description |
|------|-------------|
| `amps_explore` | Connect to AMPS, inspect topics, detect schema and composite keys |
| `amps_create_mfe` | Create Angular/React MFE from AMPS topic with auto-generated AG Grid |
| `import_figma_app` | Import Figma Make React project into the monorepo |
| `scaffold_react_app` | Generate a new React app with @macro/* integration |
| `scaffold_angular_app` | Generate a new Angular app |
| `scaffold_library` | Generate a new shared library |
| `register_openfin_app` | Register an app in OpenFin manifest |
| `get_library_api` | Get full API docs for any @macro/* library |
| `list_libraries` | List all available libraries |

### AMPS Data Explorer

Inspect a live AMPS instance, understand message structure, and auto-generate MFE apps.

**Step 1 — Explore the AMPS instance:**

```
Explore AMPS config at http://amps-server:8085/amps/instance/config.xml
```

Returns instance name, transports (with WebSocket port), SOW topics with composite keys. Auto-detects the WebSocket URL.

**Step 2 — Inspect a specific topic:**

```
Explore AMPS config at http://amps-server:8085/amps/instance/config.xml, topic "rates/marketData"
```

Connects to AMPS via the detected WebSocket transport, SOWs sample data, returns:
- Field names, types, decimal precision
- Composite keys (e.g., `/MarketId+/Id`)
- Sample JSON data

**Step 3 — Create an MFE from the topic:**

```
Create an Angular app called "rates-blotter" from AMPS topic "rates/marketData"
on port 4207, config at http://amps-server:8085/amps/instance/config.xml
```

The `amps_create_mfe` tool automatically:
1. Connects to AMPS and detects the message schema
2. Generates the NX app (Angular or React)
3. Auto-generates AG Grid ColDef[] with proper formatters and decimal precision
4. Wires `sowAndSubscribe()` for atomic initial snapshot + live updates
5. Adds `ConflationSubject` for high-frequency batching
6. Handles composite keys via `getRowId`
7. Creates OpenFin view manifests (local + openshift)
8. Registers in manifest.fin.json, settings.json, and dock
9. Updates package.json scripts

**Generated Angular architecture:**
```
apps/rates-blotter/
├── src/app/
│   ├── app.ts                          # Root component
│   ├── app.config.ts                   # provideZoneChangeDetection + router
│   ├── app.routes.ts                   # Lazy-loaded data component
│   └── rates-blotter/
│       ├── rates-blotter.component.ts  # Grid + AMPS transport + conflation
│       ├── rates-blotter.component.html
│       └── rates-blotter.component.css
├── src/main.ts                         # Bootstrap
└── src/styles.css                      # @macro/macro-design imports
```

**Generated code uses:**
- `AmpsTransportService` from `@macro/transports/angular` (Angular DI)
- `transport.sowAndSubscribe(topic)` — returns `{ observable, subscriptionId, sowComplete }`
- `sowComplete` promise — resolves when initial SOW batch finishes
- `ConflationSubject` from `@macro/rxutils` — batches high-frequency updates
- `MacroAngularGrid` from `@macro/macro-angular-grid` — AG Grid Enterprise wrapper
- Angular signals for reactive state (`connected`, `messageCount`, `error`)
- Transport handles `group_begin`/`group_end` internally — clean data only

**AMPS Transport key methods used:**

| Method | What it does |
|--------|-------------|
| `sowAndSubscribe(topic, filter?)` | Atomic SOW + subscribe. Returns observable + `sowComplete` promise. |
| `sow(topic, filter?)` | Returns `Promise<TransportMessage[]>` — clean array, no group messages. |
| `subscribe(handler, topic, filter?)` | Live updates only. Data messages only. |
| `deltaSubscribe(topic)` | Live deltas (changed fields only). |
| `sowAndDeltaSubscribe(topic)` | SOW snapshot then delta updates. |

### macro-mcp Resources

| Resource | Content |
|----------|---------|
| `macro://libraries` | All @macro/* library APIs |
| `macro://data-connectivity` | Transport usage with examples |
| `macro://openfin` | OpenFin integration guide |
| `macro://figma-workflow` | Figma Make import workflow |
| `macro://architecture` | Monorepo architecture |
| `macro://theming` | Theme system |

---

## Scripts

```bash
npm start                    # All apps concurrently
npm run launch               # Launch OpenFin
npm run build                # Build everything
npm run build:apps           # Build all apps
npm run build:libs           # Build all libs
npm run test                 # Test everything
npm run start:<app>          # Start individual app
npm run build:<app>          # Build individual app
```

---

## Key Dependencies

| Package | Version |
|---------|---------|
| Angular | 21 |
| React | 19 |
| AG Grid Enterprise | 35.1.0 |
| AG Charts Enterprise | 13.1.0 |
| PrimeNG | 21.1.3 |
| @openfin/workspace-platform | 23.0.20 |
| @openfin/snap-sdk | 1.5.0 |
| @nats-io/nats-core | 3.3.1 |
| Runtime | 43.142.101.2 |
| NX | 22.5 |
