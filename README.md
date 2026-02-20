# Macro Desktop MFE

A production-grade NX monorepo for building **Capital Markets desktop applications** using Angular, React, and OpenFin Workspace. This repository provides real-time market data visualization, enterprise messaging transports (AMPS, Solace), AG Grid wrappers, a structured logging framework, and a complete OpenFin Workspace platform with FDC3 interoperability -- all ready for LOB teams to fork and build upon.

<a alt="Nx logo" href="https://nx.dev" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="45"></a>

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Applications](#applications)
  - [macro-workspace (OpenFin Platform)](#1-macro-workspace---openfin-workspace-platform)
  - [macro-angular (Angular App)](#2-macro-angular---angular-market-data-application)
  - [macro-react (React App)](#3-macro-react---react-market-data-application)
  - [market-data-server (Node.js)](#4-market-data-server---websocket-market-data-service)
- [Shared Libraries](#shared-libraries)
  - [@macro/macro-design](#macromacro-design---shared-design-library)
  - [@macro/logger](#macrologger---structured-logging)
  - [@macro/amps](#macroamps---amps-message-transport)
  - [@macro/solace](#macrosolace---solace-message-transport)
  - [@macro/openfin](#macroopenfin---openfin-workspace-services)
  - [@macro/rxutils](#macrorxutils---reactive-utilities)
  - [@macro/macro-angular-grid](#macromacro-angular-grid---angular-ag-grid-wrapper)
  - [@macro/macro-react-grid](#macromacro-react-grid---react-ag-grid-wrapper)
- [OpenFin Workspace Platform](#openfin-workspace-platform)
- [View State Persistence](#view-state-persistence)
- [Icon System](#icon-system)
- [Theming](#theming)
- [Ports & URLs](#ports--urls)
- [LOB Implementation Guide](#lob-implementation-guide)
- [Technology Stack](#technology-stack)
- [Testing](#testing)
- [Available Commands](#available-commands)
- [Useful Links](#useful-links)
- [Contributing](#contributing)

---

## Architecture Overview

```
+---------------------------------------------------------------+
|                    OpenFin Workspace Platform                  |
|                    (macro-workspace :4202)                     |
|   +-------------------+  +-------------------+                |
|   |  Home / Search    |  |  Dock / Taskbar   |                |
|   +-------------------+  +-------------------+                |
|   +-------------------+  +-------------------+                |
|   |  Store / Catalog  |  |  Notifications    |                |
|   +-------------------+  +-------------------+                |
|                                                               |
|   +-------------------------+  +-------------------------+    |
|   | macro-angular :4200     |  | macro-react :4201       |    |
|   | - FX Market Data        |  | - Treasury Market Data  |    |
|   | - Treasury Microstructure  | - Commodities Dashboard |    |
|   | - PrimeNG + AG Grid     |  | - PrimeReact + Shadcn  |    |
|   |                         |  |   + Tailwind + AG Grid |    |
|   +-------------------------+  +-------------------------+    |
|                                                               |
|   FDC3 Context Sharing / InterApplicationBus / Channels       |
+---------------------------------------------------------------+
        |                   |                   |
   +----------+      +----------+      +--------------+
   | @macro/  |      | @macro/  |      | @macro/      |
   | logger   |      | openfin  |      | rxutils      |
   +----------+      +----------+      +--------------+
        |                   |
   +----------+      +----------+
   | @macro/  |      | @macro/  |
   | amps     |      | solace   |
   +----------+      +----------+

   +---------------------------------------------------+
   | @macro/macro-design  (design tokens, dark mode,   |
   |   AG Grid theme, CSS variables — used by ALL apps)|
   +---------------------------------------------------+

   +---------------------+      +---------------------+
   | @macro/             |      | @macro/             |
   | macro-angular-grid  |      | macro-react-grid    |
   +---------------------+      +---------------------+

   +-----------------------------------------------+
   |  market-data-server :3000 (WebSocket)          |
   |  ws://localhost:3000/marketData/fx              |
   |  ws://localhost:3000/marketData/tsy             |
   +-----------------------------------------------+
```

**Key Design Principles:**

| Principle | Implementation |
|-----------|---------------|
| **Framework-agnostic libraries** | Base TypeScript classes in `@macro/openfin`, Angular/React wrappers on top |
| **Reactive-first** | RxJS Observables/Subjects throughout -- BehaviorSubject for state, Subject for events |
| **High-frequency data** | `@macro/rxutils` conflation for 10K+ msg/sec reduction to UI-friendly rates |
| **FDC3 interop** | Standard FINOS FDC3 2.0 context sharing between all views |
| **Dark/Light theming** | `@macro/macro-design` provides single-source CSS variables, dark mode utils, and AG Grid theming for all apps |

---

## Quick Start

### Prerequisites

- **Node.js** v18+ (v20 recommended)
- **npm** (included with Node.js)
- **OpenFin** runtime (auto-installed on first launch, Windows/Mac)

### Installation

```bash
git clone <repository-url>
cd macro
npm install
```

### Running Everything

```bash
# Start all three apps concurrently (workspace + angular + react)
npm start

# Or start individually:
npm run start:workspace    # OpenFin Platform  -> http://localhost:4202
npm run start:angular      # Angular App       -> http://localhost:4200
npm run start:react        # React App         -> http://localhost:4201
```

### Launch OpenFin Desktop

Once the workspace is serving on port 4202:

```bash
npm run launch
# Equivalent to: node apps/macro-workspace/launch.mjs http://localhost:4202/manifest.fin.json
```

This launches the OpenFin runtime, which loads the workspace platform and registers all apps (Angular views, React views, workspace views) into the Home search, Dock, and Store.

---

## Project Structure

```
macro/
├── apps/
│   ├── macro-workspace/              # OpenFin Workspace Platform (Angular, :4202)
│   │   ├── src/app/
│   │   │   ├── provider/             # Platform initialization component
│   │   │   ├── view1/                # FDC3 context broadcaster demo
│   │   │   └── view2/                # FDC3 context listener demo
│   │   ├── public/
│   │   │   ├── manifest.fin.json     # OpenFin platform manifest (app registry)
│   │   │   ├── settings.json         # Platform settings
│   │   │   ├── view1.fin.json        # View manifest for View 1
│   │   │   ├── view2.fin.json        # View manifest for View 2
│   │   │   └── macro-*.fin.json      # View manifests for Angular/React apps
│   │   └── launch.mjs               # OpenFin launch script (Windows/Mac)
│   │
│   ├── macro-angular/                # Angular Market Data App (:4200)
│   │   └── src/app/
│   │       ├── fx-market-data/       # G10 FX currency pairs (AG Grid)
│   │       ├── treasury-microstructure/  # 4-chart microstructure analysis (AG Charts)
│   │       ├── app.routes.ts         # Route definitions
│   │       └── app.ts               # Root component (PrimeNG MenuBar, theme toggle)
│   │
│   ├── macro-react/                  # React Market Data App (:4201)
│   │   └── src/
│   │       ├── app/
│   │       │   ├── treasury-market-data/     # Treasury 32nd pricing (AG Grid)
│   │       │   ├── commodities-dashboard/    # 7 commodities + order book (Recharts)
│   │       │   └── app.tsx                   # Root component (Shadcn Menubar)
│   │       └── components/ui/                # Shadcn UI components
│   │
│   ├── market-data-server/           # Node.js WebSocket Server (:3000)
│   │   └── src/
│   │       ├── main.ts               # WebSocket server with path routing
│   │       ├── fx-market-data.service.ts    # 15 FX pairs data generator
│   │       └── tsy-market-data.service.ts   # 11 Treasury securities generator
│   │
│   ├── macro-angular-e2e/            # Playwright E2E for Angular
│   ├── macro-react-e2e/              # Playwright E2E for React
│   └── macro-workspace-e2e/          # Playwright E2E for OpenFin (CDP)
│
├── libs/
│   ├── macro-design/                 # @macro/macro-design - Shared design tokens & theming
│   │   └── src/lib/
│   │       ├── css/fonts.css         # Google Font imports (Noto Sans, Roboto, Ubuntu)
│   │       ├── css/macro-design.css  # Unified CSS variables (:root + .dark) — blue primary
│   │       ├── theme.config.ts       # ThemePalette + ThemeConfig + themeConfig (OpenFin)
│   │       ├── ag-grid-theme.ts      # buildAgGridTheme(isDark) — AG Grid theme builder
│   │       └── dark-mode.ts          # getInitialIsDark(), applyDarkMode(), onSystemThemeChange()
│   ├── logger/                       # @macro/logger - Pino-based logging
│   ├── amps/                         # @macro/amps - AMPS message transport
│   ├── solace/                       # @macro/solace - Solace PubSub+ transport
│   ├── openfin/                      # @macro/openfin - Workspace services + Angular DI
│   ├── rxutils/                      # @macro/rxutils - RxJS conflation utilities
│   ├── macro-angular-grid/           # @macro/macro-angular-grid - AG Grid Angular
│   └── macro-react-grid/             # @macro/macro-react-grid - AG Grid React
│
├── capital-markets-icon-system-all.html   # Full icon system (160+ icons, 10 categories)
├── rates-etrading-icon-showcase.html      # Rates-focused icons (110+ icons, 8 categories)
├── nx.json                           # NX workspace configuration
├── tsconfig.base.json                # TypeScript path aliases (@macro/*)
└── package.json                      # Scripts and dependencies
```

### TypeScript Path Aliases

All shared libraries are available via `@macro/*` imports (configured in `tsconfig.base.json`):

```typescript
import { Logger, LogLevel } from '@macro/logger';
import { AmpsClient } from '@macro/amps';
import { SolaceClient } from '@macro/solace';
import { WorkspaceService, ThemeService, launchApp } from '@macro/openfin';
import { conflateByKey, ConflationSubject } from '@macro/rxutils';
import { MacroAngularGrid } from '@macro/macro-angular-grid';
import { MacroReactGrid } from '@macro/macro-react-grid';
import { themeConfig, buildAgGridTheme, getInitialIsDark, applyDarkMode, onSystemThemeChange } from '@macro/macro-design';
```

---

## Applications

### 1. macro-workspace - OpenFin Workspace Platform

The workspace is the **shell** that hosts all other apps. It provides the Home search bar, Dock taskbar, Store catalog, Notifications, workspace persistence, and theme management.

**Technology:** Angular 21 (zoneless), OpenFin Workspace 22.3.25, FDC3 2.0

**Port:** 4202

**Routes:**

| Route | Component | Purpose |
|-------|-----------|---------|
| `/provider` | ProviderComponent | Initializes platform, displays status |
| `/view1` | View1Component | Demo: broadcasts FDC3 contexts & notifications |
| `/view2` | View2Component | Demo: listens for FDC3 contexts, IAB provider |

**OpenFin Manifest** (`public/manifest.fin.json`):

The manifest registers **9 applications** in the workspace:

| App ID | Framework | Description |
|--------|-----------|-------------|
| `macro-workspace-view1` | Angular | FDC3 context broadcaster demo |
| `macro-workspace-view2` | Angular | FDC3 context listener demo |
| `macro-angular-view` | Angular | Main Angular app |
| `macro-angular-fx-market-data` | Angular | FX Market Data (G10 pairs) |
| `macro-angular-treasury-microstructure` | Angular | Treasury microstructure charts |
| `macro-react-view` | React | Main React app |
| `macro-react-treasury-market-data` | React | Treasury securities data |
| `macro-react-commodities-dashboard` | React | Commodities trading dashboard |

All apps are configured with FDC3 2.0 interop and context group `"green"`.

**Platform Initialization Sequence:**

```
1. isOpenFin() check
2. Load settings (fetch /settings.json -> app registry)
3. Initialize WorkspacePlatform (toolbar, theme, custom actions)
4. Await platform ready
5. Register components (Dock + Home + Store in parallel)
6. Show Home and Dock
7. Restore last saved workspace from localStorage
```

**Launch Script** (`launch.mjs`):
- Windows: Uses `@openfin/node-adapter` to start OpenFin runtime
- Mac: Converts HTTP manifest URL to `fin://` protocol link
- Handles graceful shutdown (SIGINT/SIGTERM)

---

### 2. macro-angular - Angular Market Data Application

**Technology:** Angular 21.1, PrimeNG 21, AG Grid 35, AG Charts 13, Zoneful (with event coalescing)

**Port:** 4200

**Features:**
- PrimeNG Menubar navigation
- Light/Dark theme toggle (system preference -> localStorage -> toggle)
- PrimeNG Aura theme with `.dark` CSS class selector

**Routes:**

| Route | Component | Description |
|-------|-----------|-------------|
| `/fx-market-data` | FxMarketDataComponent | G10 FX currency pairs grid |
| `/treasury-microstructure` | TreasuryMicrostructureComponent | 4 real-time charts |

#### FX Market Data Component

Displays **15 G10 currency pairs** with 1-second simulated updates:

- **Majors:** EURUSD, GBPUSD, USDJPY, AUDUSD, USDCAD, USDCHF, NZDUSD
- **Exotics:** USDSEK, USDNOK
- **Crosses:** EURGBP, EURJPY, GBPJPY, AUDJPY, EURCHF, GBPCHF

Each pair shows: Symbol, Base, Quote, Bid, Ask, Mid, Spread, Change, Change%. Prices use 5 decimal places (2 for JPY pairs). Changes are color-coded green/red.

Uses `@macro/macro-angular-grid` with `updateRows$` Subject for real-time row updates.

#### Treasury Microstructure Component

Displays **4 AG Charts** in a 2x2 grid with 1-second data updates:

1. **Trade Frequency** (Bar Chart) - Trades per interval
2. **Order-to-Trade Ratio** (Line Chart) - Orders per trade
3. **Quote Update Frequency** (Line Chart) - Quotes/second
4. **Time Between Trades** (Line Chart) - Milliseconds

Maintains a rolling window of 50 data points. Uses `clone` library for immutable chart option updates. Theme-aware via MutationObserver on document root class.

---

### 3. macro-react - React Market Data Application

**Technology:** React 19, Vite 7, PrimeReact 11 (Aura theme), Tailwind CSS 4, Shadcn UI, AG Grid 35, Recharts 3

**Port:** 4201

**Features:**
- Shadcn UI Menubar navigation (Radix UI primitives)
- PrimeReact Aura theme with `.dark` CSS class selector (matches Angular's PrimeNG config)
- Light/Dark theme toggle with Tailwind `dark` class
- CSS variable-based theming throughout

**Routes:**

| Route | Component | Description |
|-------|-----------|-------------|
| `/treasury-market-data` | TreasuryMarketDataComponent | Treasury securities with 32nd pricing |
| `/commodities-dashboard` | CommoditiesDashboardComponent | Multi-commodity trading dashboard |

#### Treasury Market Data Component

Displays **11 US Treasury securities** with 1-second updates:

- **T-Bills (3):** 3-month, 6-month, 1-year (zero coupon)
- **T-Notes (6):** 2, 3, 5, 7, 10-year maturities
- **T-Bonds (2):** 20-year, 30-year

Prices displayed in **Treasury 32nd notation** (e.g., `99-16` = 99 + 16/32, `99-16+` = 99 + 16.5/32). Columns include: CUSIP, Type, Maturity, YTM, Coupon, Price, Yield, Bid, Ask, Spread, Change, Volume, Duration, Convexity.

Uses `@macro/macro-react-grid` with `forwardRef` for imperative grid API access.

#### Commodities Dashboard Component

A full **trading dashboard** for 7 commodities across 3 categories:

| Category | Commodities | Symbols |
|----------|-------------|---------|
| Energy | Crude Oil, Natural Gas | CL, NG |
| Metals | Gold, Silver, Copper | GC, SI, HG |
| Agriculture | Corn, Soybeans | ZC, ZS |

**UI Features:**
- Live/Paused toggle with pulsing indicator
- Playback speed control (0.5x - 4x)
- Market Summary panel (price, bid, ask, spread, volume, open interest, curve type)
- **Order Book** (20 levels: 10 bid / 10 ask, color-coded green/red)
- **Price Chart** (Recharts AreaChart, 100-point rolling window)
- **5 Live Statistics** (Total Volume, Avg Spread, Volatility, 24h High/Low)
- Futures curve detection (contango / backwardation)

---

### 4. market-data-server - WebSocket Market Data Service

**Technology:** Node.js, WebSocket (ws library), esbuild

**Port:** 3000

A standalone WebSocket server that publishes simulated market data at 1-second intervals. Supports path-based routing for different data streams.

**Endpoints:**

| Endpoint | Data |
|----------|------|
| `ws://localhost:3000/marketData/fx` | 15 G10 FX currency pairs |
| `ws://localhost:3000/marketData/tsy` | 11 Treasury securities + benchmark rates |

**Message Protocol:**

```jsonc
// Connection welcome
{ "type": "connected", "message": "...", "currencies": [...], "timestamp": "..." }

// Market data tick (every 1 second)
{ "type": "marketData", "data": { "pairs": [...] }, "timestamp": "..." }

// Client subscription
{ "type": "subscribe" }
{ "type": "subscribed", "message": "...", "timestamp": "..." }
```

**Treasury data includes benchmark rates:**
```json
{ "benchmarkRates": { "2Y": 4.30, "5Y": 4.45, "10Y": 4.55, "30Y": 4.65 } }
```

**Run:**
```bash
npx nx serve market-data-server
```

---

## Shared Libraries

### @macro/macro-design - Shared Design Library

The **single source of truth** for design tokens, CSS variables, dark mode utilities, and AG Grid theming across all Angular and React applications. Created to eliminate duplicated theming logic as new LOB apps are added.

**What it provides:**

| Export | Purpose |
|--------|---------|
| `fonts.css` | Google Font `@import` statements (Noto Sans, Roboto, Ubuntu) |
| `macro-design.css` | Unified `:root` + `.dark` CSS variables — blue primary (`oklch(0.488 0.243 264.376)`) matching OpenFin's `#0A76D3`, plus chart-*, sidebar-* variables |
| `themeConfig` | `ThemeConfig` object with dark/light `ThemePalette` (brand, background, text, input, status colors) — used by `@macro/openfin` |
| `buildAgGridTheme(isDark)` | Returns a fully configured AG Grid `Theme` (Alpine + fonts + color scheme) |
| `AG_GRID_FONTS` | Font family constants for AG Grid (`Noto Sans`, `Roboto`, `Ubuntu`) |
| `getInitialIsDark()` | Reads dark mode from localStorage or system preference (SSR-safe) |
| `applyDarkMode(isDark)` | Toggles `.dark` class on `<html>` and persists to localStorage |
| `onSystemThemeChange(cb)` | Listens for OS color-scheme changes; returns cleanup function |

**CSS Usage (in app `styles.css`):**

```css
/* Import shared design tokens — BEFORE any framework CSS */
@import '../../../libs/macro-design/src/lib/css/fonts.css';
@import '../../../libs/macro-design/src/lib/css/macro-design.css';
```

Both Angular and React apps import these files. Angular apps no longer need their own `:root`/`.dark` variable blocks.

**Dark Mode Usage (Angular):**

```typescript
import { getInitialIsDark, applyDarkMode, onSystemThemeChange } from '@macro/macro-design';

export class App implements OnInit, OnDestroy {
  isDark = false;
  private cleanupSystemListener?: () => void;

  constructor() {
    this.isDark = getInitialIsDark();
    this.cleanupSystemListener = onSystemThemeChange((isDark) => {
      this.isDark = isDark;
      applyDarkMode(this.isDark);
    });
  }

  ngOnInit() { applyDarkMode(this.isDark); }
  ngOnDestroy() { this.cleanupSystemListener?.(); }
  toggleTheme() { this.isDark = !this.isDark; applyDarkMode(this.isDark); }
}
```

**Dark Mode Usage (React):**

```tsx
import { getInitialIsDark, applyDarkMode, onSystemThemeChange } from '@macro/macro-design';

function AppContent() {
  const [isDark, setIsDark] = useState(getInitialIsDark);

  useEffect(() => { applyDarkMode(isDark); }, [isDark]);
  useEffect(() => onSystemThemeChange((dark) => setIsDark(dark)), []);

  const toggleTheme = () => setIsDark((prev) => !prev);
  // ...
}
```

**AG Grid Theme Usage (both frameworks):**

```typescript
import { buildAgGridTheme } from '@macro/macro-design';

// In your grid component's theme update logic:
const theme = buildAgGridTheme(isDark);  // Returns Theme with Alpine + fonts + color scheme
```

**Dependency graph:**
```
@macro/macro-design  ← used by all apps + grid libs + @macro/openfin
  ├── apps/macro-angular (CSS imports + dark mode utils)
  ├── apps/macro-react (CSS imports + dark mode utils)
  ├── libs/macro-angular-grid (buildAgGridTheme)
  ├── libs/macro-react-grid (buildAgGridTheme)
  └── libs/openfin (themeConfig + ThemePalette re-exported)
```

---

### @macro/logger - Structured Logging

A centralized logging library built on [Pino](https://github.com/pinojs/pino) that provides context-aware, level-filtered logging for both browser and Node.js environments.

**API:**

```typescript
import { Logger, LogLevel } from '@macro/logger';

// Create named logger (cached singleton per context)
const logger = Logger.getLogger('MyComponent');

// Log at different levels
logger.debug('Detailed debug info', { key: 'value' });
logger.info('Application started', { userId: 123 });
logger.warn('Rate limit approaching', { current: 95, max: 100 });
logger.error('Connection failed', { endpoint: '/api/data', statusCode: 500 });

// Global level control
Logger.setGlobalLevel(LogLevel.DEBUG);   // TRACE=10, DEBUG=20, INFO=30, WARN=40, ERROR=50, FATAL=60
Logger.getGlobalLevel();

// Per-logger level override
logger.setLevel(LogLevel.WARN);
```

**Output Format:**
```
[2026-02-15 10:30:45.123] [INFO] [MyComponent] - Application started
  {
    "userId": 123
  }
```

**Environment Routing:**
- Browser: Routes to `console.debug/info/warn/error`
- Node.js: INFO/DEBUG to stdout, WARN/ERROR/FATAL to stderr

**Build & Publish:**
```bash
npm run build:logger            # Build to dist/libs/logger
npm run publish:logger           # Publish to npm registry
npm run publish:logger:dry-run   # Dry run
```

---

### @macro/amps - AMPS Message Transport

A TypeScript wrapper for the [60East AMPS](https://www.crankuptheamps.com/) high-performance message broker, providing RxJS-integrated subscriptions, SOW (State of the World) queries, and publish operations.

**API:**

```typescript
import { AmpsClient, type AmpsMessage } from '@macro/amps';

// Create and connect
const client = new AmpsClient('my-client');
await client.connect('ws://amps-server:9007/amps/json');

// Set error handler
client.onError((error) => console.error('AMPS error:', error));

// Subscribe with callback
const subId = client.subscribe(
  (msg: AmpsMessage) => console.log(msg.data),
  '/topic/fx-rates',
  "/symbol='EURUSD'"   // Optional AMPS filter expression
);

// Subscribe as RxJS Observable
const rates$ = client.subscribeAsObservable('/topic/fx-rates', "/symbol='EURUSD'");
rates$.subscribe((msg) => updateGrid(msg.data));

// Subscribe as Subject (allows external message injection)
const { subject, observable } = client.subscribeAsSubject('/topic/fx-rates');

// SOW query (State of the World - query existing state)
client.sow(
  (msg) => console.log('SOW result:', msg.data),
  '/topic/positions',
  "/desk='FX'"
);

// Publish
client.publish('/topic/orders', { symbol: 'EURUSD', side: 'BUY', qty: 1000000 });

// Disconnect (completes all subjects, clears subscriptions)
client.disconnect();
```

**AmpsMessage Interface:**
```typescript
interface AmpsMessage {
  data: string | Record<string, unknown>;
  header?: { command(): string; [key: string]: unknown };
  topic?: string;
  subId?: string;
  sequence?: number;
}
```

---

### @macro/solace - Solace Message Transport

A TypeScript wrapper for [Solace PubSub+](https://solace.com/) enterprise message broker with wildcard topic matching, session management, and RxJS integration.

**API:**

```typescript
import { SolaceClient, type SolaceConnectionProperties } from '@macro/solace';

// Create and connect
const client = new SolaceClient('my-client');
await client.connect({
  hostUrl: 'ws://solace-server:8008',
  vpnName: 'default',
  userName: 'user',
  password: 'pass',
});

// Set handlers
client.onError((error) => console.error('Solace error:', error));
client.onEvent((event, details) => console.log('Event:', event));

// Subscribe (supports wildcards: * = single level, > = any suffix)
client.subscribe(
  (msg) => console.log(msg.data),
  'orders/stock/*'      // Matches orders/stock/AAPL, orders/stock/MSFT, etc.
);

// Subscribe as Observable
const orders$ = client.subscribeAsObservable('orders/>');  // All order topics

// Publish with optional properties
client.publish('orders/stock/AAPL', { side: 'BUY', qty: 100 }, {
  correlationId: 'order-123',
  replyTo: 'replies/my-client',
  userProperties: { desk: 'equity', trader: 'jdoe' },
});

// Disconnect
client.disconnect();
```

**SolaceMessage Interface:**
```typescript
interface SolaceMessage {
  data: string | Record<string, unknown>;
  topic?: string;
  correlationId?: string;
}
```

---

### @macro/openfin - OpenFin Workspace Services

A comprehensive library providing **framework-agnostic base classes** and **Angular DI wrappers** for the entire OpenFin Workspace platform.

**Exports:**

| Export | Type | Purpose |
|--------|------|---------|
| `WorkspaceService` | Angular Injectable | **Orchestrator** -- initializes entire platform |
| `ThemeService` | Angular Injectable | Dark/light theme management + CSS variable injection |
| `PlatformService` | Angular Injectable | Platform init, toolbar buttons, custom actions |
| `SettingsService` | Angular Injectable | Loads app registry from `/settings.json` |
| `HomeService` | Angular Injectable | Quick-search app launcher |
| `DockService` | Angular Injectable | Taskbar with app dropdown |
| `StoreService` | Angular Injectable | App catalog / storefront |
| `ContextService` | Angular Injectable | FDC3 context broadcasting |
| `ChannelService` | Angular Injectable | FDC3 named + user channels |
| `NotificationsService` | Angular Injectable | Desktop toast notifications |
| `WorkspaceOverrideService` | Angular Injectable | Workspace persistence (localStorage) |
| `launchApp()` | Function | Launch apps by manifest type (view/snapshot/external) |
| `themeConfig` | Object | Dark/Light theme palettes (re-exported from `@macro/macro-design`) |
| `Base*Service` | Classes | Framework-agnostic base classes for non-Angular usage |

**Angular Usage (Workspace Init):**

```typescript
import { WorkspaceService, ThemeService } from '@macro/openfin';

@Component({...})
export class ProviderComponent implements OnInit, OnDestroy {
  private readonly workspaceService = inject(WorkspaceService);
  private readonly themeService = inject(ThemeService);
  private readonly destroy$ = new Subject<void>();

  ngOnInit() {
    this.themeService.syncWithOpenFinTheme();
    this.workspaceService.init()
      .pipe(takeUntil(this.destroy$))
      .subscribe();
  }

  ngOnDestroy() {
    this.themeService.stopSyncing();
    this.workspaceService.quit();
    this.destroy$.next();
  }
}
```

**FDC3 Context Sharing:**

```typescript
import { ContextService, ChannelService } from '@macro/openfin';

// Broadcast to all listeners
contextService.broadcast({
  type: 'fdc3.instrument',
  name: 'Microsoft Corporation',
  id: { ticker: 'MSFT' }
});

// Listen for contexts
contextService.registerContextListener('fdc3.instrument');
contextService.context$.subscribe((ctx) => console.log('Received:', ctx));

// Named app channels
channelService.broadcast('MY-CHANNEL', { type: 'fdc3.instrument', ... });
channelService.registerChannelListener('MY-CHANNEL', 'fdc3.instrument');
channelService.channel$.subscribe((ctx) => console.log('Channel:', ctx));
```

**React / Non-Angular Usage (Base classes):**

```typescript
import {
  BaseSettingsService,
  BaseThemeService,
  BaseContextService,
} from '@macro/openfin';

// Provide your own HTTP client
const settingsService = new BaseSettingsService({
  get: <T>(url: string) => fetch(url).then(r => r.json()) as Promise<T>
});

const themeService = new BaseThemeService(document, (theme, palette) => {
  console.log('Theme changed:', theme);
});
```

---

### @macro/rxutils - Reactive Utilities

Provides high-frequency data **conflation** using a double-buffering algorithm. Essential for real-time market data where raw feed rates (10,000+ msg/sec) far exceed UI refresh capabilities (~60 Hz).

**How Conflation Works:**

```
Input:  AAPL=150.25  MSFT=310.00  AAPL=150.30  AAPL=150.28  MSFT=310.05
        |___________ 100ms interval ___________|
                                                |
Output: AAPL=150.28 (latest)  MSFT=310.05 (latest)
```

Only the **latest value per key** is emitted each interval. Two buffers alternate (write to one, emit from the other) for zero-lock performance.

**API:**

```typescript
import { conflateByKey, ConflationSubject } from '@macro/rxutils';

// Option 1: Function-based
const conflated$ = conflateByKey(sourceObservable$, 100);  // 100ms interval
conflated$.subscribe(({ key, value }) => updateUI(key, value));

// Option 2: Subject-based (more flexible)
const subject = new ConflationSubject<string, number>(100);

subject.subscribeToConflated(({ key, value }) => {
  // Receives conflated updates every 100ms
});

// Emit high-frequency data
subject.next({ key: 'AAPL', value: 150.25 });
subject.next({ key: 'AAPL', value: 150.30 });  // Overwrites previous
subject.next({ key: 'MSFT', value: 310.00 });

// Option 3: Pipe to another Subject
const updateSubject = new Subject();
subject.pipeToSubject(updateSubject);

// Cleanup
subject.complete();
```

**Performance:** With 100 unique symbols at 10,000 updates/sec and a 100ms interval, output is ~100 updates/sec (99% reduction, 100% data accuracy).

---

### @macro/macro-angular-grid - Angular AG Grid Wrapper

A ready-to-use AG Grid Enterprise wrapper for Angular with JSON column config, RxJS reactive row operations, and automatic dark/light theme switching.

**Usage:**

```typescript
import { MacroAngularGrid } from '@macro/macro-angular-grid';

@Component({
  imports: [MacroAngularGrid],
  template: `
    <div style="height: 600px; width: 100%;">
      <lib-macro-angular-grid
        #gridComponent
        [columns]="columns"
        [rowData]="rowData"
        [getRowId]="getRowId">
      </lib-macro-angular-grid>
    </div>
  `
})
export class MyComponent {
  @ViewChild('gridComponent') gridComponent!: MacroAngularGrid;

  // Columns as JSON string or ColDef[]
  columns = JSON.stringify([
    { field: 'symbol', headerName: 'Symbol', width: 120, pinned: 'left' },
    { field: 'price', headerName: 'Price', width: 120, cellStyle: { textAlign: 'right' } },
  ]);

  rowData = [...];
  getRowId = (params: GetRowIdParams) => params.data.symbol;

  // Reactive row operations
  addRows() { this.gridComponent.addRows$.next([{ symbol: 'AAPL', price: 150 }]); }
  updateRows() { this.gridComponent.updateRows$.next([{ symbol: 'AAPL', price: 151 }]); }
  deleteRows() { this.gridComponent.deleteRows$.next([{ symbol: 'AAPL' }]); }

  // Transaction API
  applyBatch() {
    this.gridComponent.applyTransaction({ add: [...], update: [...], remove: [...] });
  }

  // Direct API access
  getApi() { return this.gridComponent.getGridApi(); }
}
```

**Default Grid Options:** Pagination (10/25/50/100), sortable, filterable, resizable, multiple row selection, range selection, animated rows.

**Enterprise Modules:** AllCommunityModule + AllEnterpriseModule + IntegratedChartsModule (AG Charts).

**Theme:** Uses `buildAgGridTheme(isDark)` from `@macro/macro-design` (Alpine base, `colorSchemeDarkBlue`/`colorSchemeLight`, Noto Sans/Roboto/Ubuntu fonts), auto-switches via MutationObserver on document root class.

---

### @macro/macro-react-grid - React AG Grid Wrapper

The React equivalent with `forwardRef` for imperative API access and the same feature set. Uses `buildAgGridTheme()` from `@macro/macro-design` for consistent theming.

**Usage:**

```tsx
import { MacroReactGrid, MacroReactGridRef } from '@macro/macro-react-grid';

function MyComponent() {
  const gridRef = useRef<MacroReactGridRef>(null);

  const columns = useMemo(() => JSON.stringify([
    { field: 'symbol', headerName: 'Symbol', width: 120 },
    { field: 'price', headerName: 'Price', width: 120 },
  ]), []);

  // Reactive updates via ref
  const addRow = () => gridRef.current?.addRows$.next([{ symbol: 'AAPL', price: 150 }]);
  const updateRow = () => gridRef.current?.updateRows$.next([{ symbol: 'AAPL', price: 151 }]);

  return (
    <div style={{ height: '600px', width: '100%' }}>
      <MacroReactGrid
        ref={gridRef}
        columns={columns}
        rowData={rowData}
        getRowId={(params) => params.data.symbol}
      />
    </div>
  );
}
```

---

## OpenFin Workspace Platform

### Custom Actions

The platform registers two custom actions available from Dock, Home, and Store:

| Action ID | Trigger | Behavior |
|-----------|---------|----------|
| `launch-app` | Dock dropdown, Home result, Store click | Launches app by manifest type |
| `toggle-theme` | Toolbar button | Switches dark/light theme |

### Workspace Persistence

Workspaces are saved to **localStorage**:
- `workspace-platform-workspaces` -- Array of saved workspaces
- `workspace-platform-last-saved` -- Last active workspace ID

On startup, the platform automatically restores the last saved workspace.

### Toolbar Buttons

The browser window toolbar includes:
1. Show/Hide Tabs
2. Color Linking (FDC3)
3. Preset Layouts
4. Lock/Unlock Page
5. Save Menu
6. **Theme Toggle** (custom sun/moon SVG icons)

---

## View State Persistence

When a user saves an OpenFin workspace, only the window/page/view layout is captured by default. Individual view state -- AG Grid column order, filters, sort, custom preferences -- is lost. The `ViewStateService` solves this by piggybacking on OpenFin's `customData` mechanism, which is automatically included in workspace snapshots.

### How It Works

```
Save path:
  View calls viewState.saveState('agGrid', gridState)
    -> fin.me.updateOptions({ customData: { viewState: { agGrid: {...} } } })
      -> User saves workspace -> snapshot includes customData automatically

Restore path:
  Workspace restored -> OpenFin recreates view with saved options
    -> View calls viewState.restoreState()
      -> fin.me.getOptions() -> reads customData.viewState
        -> View applies state (e.g., grid.applyGridState())
```

No changes to `WorkspaceOverrideService` or `WorkspaceService` are needed. State flows through the existing snapshot pipeline.

### Imports

```typescript
// Angular -- Injectable service (providedIn: 'root')
import { ViewStateService } from '@macro/openfin';

// React -- hook for automatic lifecycle management
import { useViewState } from '@macro/openfin/react';

// Types (if needed)
import type { ViewStateData } from '@macro/openfin';
```

### Angular Integration

```typescript
import { Component, ViewChild, AfterViewInit, OnDestroy, inject } from '@angular/core';
import { ViewStateService } from '@macro/openfin';
import { MacroAngularGrid } from '@macro/macro-angular-grid';
import { GridState } from 'ag-grid-community';

@Component({...})
export class MyViewComponent implements AfterViewInit, OnDestroy {
  private viewState = inject(ViewStateService);
  @ViewChild(MacroAngularGrid) grid!: MacroAngularGrid;

  async ngAfterViewInit() {
    // 1. Restore any previously saved state
    const saved = await this.viewState.restoreState();
    if (saved['agGrid']) {
      this.grid.applyGridState(saved['agGrid'] as GridState);
    }

    // 2. Enable auto-save (collects state every 5 seconds by default)
    this.viewState.enableAutoSave(() => ({
      agGrid: this.grid.getGridState(),
      // Add any other namespaced state:
      prefs: { selectedTab: this.activeTab },
    }));
  }

  ngOnDestroy() {
    this.viewState.destroy(); // stops auto-save timer
  }
}
```

### React Integration

```tsx
import { useRef, useEffect } from 'react';
import { useViewState } from '@macro/openfin/react';
import { MacroReactGrid, MacroReactGridRef } from '@macro/macro-react-grid';
import { GridState } from 'ag-grid-community';

function MyView() {
  const gridRef = useRef<MacroReactGridRef>(null);
  const [viewState, savedState, isRestored] = useViewState();
  // viewState   = ViewStateService instance (stable ref)
  // savedState  = restored ViewStateData object
  // isRestored  = true once restoreState() has completed

  // 1. Apply restored state when ready
  useEffect(() => {
    if (isRestored && savedState['agGrid']) {
      gridRef.current?.applyGridState(savedState['agGrid'] as GridState);
    }
  }, [isRestored]);

  // 2. Enable auto-save
  useEffect(() => {
    viewState.enableAutoSave(() => ({
      agGrid: gridRef.current?.getGridState(),
    }));
    return () => viewState.disableAutoSave();
  }, [viewState]);

  return <MacroReactGrid ref={gridRef} columns={columns} rowData={rowData} />;
}
```

### ViewStateService API

| Method | Description |
|--------|-------------|
| `restoreState(): Promise<ViewStateData>` | Reads `customData.viewState` from `fin.me.getOptions()`. Call once on view init. |
| `saveState(namespace, data): Promise<void>` | Writes a single namespace to `fin.me.updateOptions()`. Merges with existing namespaces. |
| `getState(namespace): unknown` | In-memory read of a previously restored namespace. |
| `enableAutoSave(collectFn, intervalMs?)` | Periodically (default 5s) collects state via `collectFn` and persists it. |
| `disableAutoSave(): void` | Stops the auto-save timer. |
| `destroy(): void` | Full cleanup -- call on component destroy. |

### Grid State Methods

Both `MacroAngularGrid` and `MacroReactGrid` (via `MacroReactGridRef`) expose:

| Method | Description |
|--------|-------------|
| `getGridState(): GridState \| undefined` | Returns the full AG Grid state (column order, sizing, visibility, pinning, sort, filter, pagination, row group, pivot, side bar, scroll position). |
| `applyGridState(state: GridState): void` | Restores a previously saved grid state. |

These use AG Grid v35's unified `getState()`/`setState()` API. The `GridState` object is fully JSON-serializable (typically 2-5 KB per grid).

### Persisting Non-Grid State

State is namespace-based, so you can persist anything JSON-serializable alongside grid state:

```typescript
// Save multiple namespaces
this.viewState.enableAutoSave(() => ({
  agGrid: this.grid.getGridState(),
  prefs: {
    selectedTab: this.activeTab,
    sortDirection: this.currentSort,
  },
  filters: {
    dateRange: this.dateRange,
    selectedDesks: this.selectedDesks,
  },
}));

// Restore individual namespaces
const saved = await this.viewState.restoreState();
if (saved['prefs']) {
  this.activeTab = (saved['prefs'] as any).selectedTab;
}
```

### Browser Development

When running outside OpenFin (e.g., `http://localhost:4200` in a browser), the service is a graceful no-op: `restoreState()` returns an empty object, `saveState()` does nothing, and auto-save silently skips persistence. No conditional checks needed in your component code.

---

## Icon System

The repository includes two comprehensive, interactive HTML icon showcases for Capital Markets applications. Open them directly in a browser -- no build step required.

### capital-markets-icon-system-all.html

**160+ icons** across **10 functional categories** covering FX, Rates, and Commodities:

| Category | Count | Color | Examples |
|----------|-------|-------|----------|
| Pricing | 20 | #00d4aa | Candlestick, Vol Surface, Forward Curves |
| PnL | 12 | #34d399 | Daily PnL, Attribution, Delta |
| Risk | 16 | #f59e0b | VaR Meter, Risk Shield, Stress Test |
| Trading | 16 | #3b82f6 | Buy/Sell, Blotter, Confirmations |
| E-Trading | 18 | #06b6d4 | Algo Engine, TWAP, Smart Router, AMPS |
| Middle Office | 14 | #8b5cf6 | Matching, Reconciliation, MTM |
| Ticketing | 12 | #ec4899 | Ticket Create, Status, Priority |
| Back Office | 16 | #f97316 | Settlement, Clearing, Custody |
| Workspace | 22 | #64748b | Dashboard, Tearout, Notifications |

**Interactive Features:**
- Business area filtering (All / FX / Rates / Commodities)
- Real-time search across icon names and labels
- Color picker with 16 presets + custom hex input
- Size, opacity, padding, corner radius sliders
- 4 style variants: Default, Outlined, Filled, Soft
- 6 background options
- **6 theme presets:** Bloomberg Dark, ICE Terminal, Tradeweb Blue, Refinitiv Amber, Murex Grey, Light Mode
- CSS code generation with copy-to-clipboard
- Icon export as tab-separated list

Built on **Google Material Icons Sharp** (filled variant). Icons are tagged with business areas (fx, rates, commod) for filtering.

### rates-etrading-icon-showcase.html

A domain-specific subset for **Rates E-Trading** with **110+ icons** across 8 categories, tailored for US Treasury front-office workflows.

---

## Theming

### Architecture

All theming flows from `@macro/macro-design`, which provides the single source of truth for colors, dark mode, and AG Grid theming. The system operates in three tiers:

```
Tier 1: OpenFin Platform Theme (when running inside OpenFin)
  └─ ThemeService polls every 500ms for scheme changes
      └─ Uses themeConfig from @macro/macro-design for palette

Tier 2: @macro/macro-design — CSS Variables + Dark Mode Utilities
  ├─ macro-design.css: ~30 CSS variables (:root + .dark) — blue primary
  ├─ fonts.css: Google Font imports (Noto Sans, Roboto, Ubuntu)
  ├─ applyDarkMode(isDark): toggles .dark class on <html> + localStorage
  ├─ getInitialIsDark(): reads localStorage → system preference → false
  ├─ onSystemThemeChange(cb): listens for OS-level color-scheme changes
  └─ buildAgGridTheme(isDark): returns configured AG Grid Theme

Tier 3: Framework-specific integration
  ├─ Angular: PrimeNG responds to darkModeSelector: '.dark'
  ├─ React: PrimeReact responds to darkModeSelector: '.dark'
  ├─ React: Tailwind responds to @custom-variant dark (&:is(.dark *))
  ├─ AG Grid: Both grid wrappers use buildAgGridTheme() from macro-design
  └─ AG Charts: theme prop updated on class change via MutationObserver
```

### Theme Palette

Both dark and light palettes share a consistent blue primary (`#0A76D3` / `oklch(0.488 0.243 264.376)`) with:
- 6 background layers for depth hierarchy
- Brand primary + secondary colors (8 variants each)
- Text colors (default, help, inactive)
- Input colors (background, text, placeholder, disabled, focused, border)
- Status colors (success, warning, critical, active)
- Chart colors (5 chart-* variables for data visualization)
- Sidebar colors (sidebar, sidebar-primary, sidebar-accent, sidebar-border, sidebar-ring)

The `themeConfig` object (in `theme.config.ts`) provides hex-based palettes for OpenFin Workspace platform integration, while `macro-design.css` provides oklch-based CSS variables for web apps.

### Adding Theme Support to New Components

Use the shared utilities from `@macro/macro-design` instead of writing manual localStorage/classList logic:

```typescript
import { getInitialIsDark, applyDarkMode, onSystemThemeChange } from '@macro/macro-design';

// Angular
constructor() {
  this.isDark = getInitialIsDark();
  this.cleanup = onSystemThemeChange((isDark) => {
    this.isDark = isDark;
    applyDarkMode(this.isDark);
  });
}

// React
const [isDark, setIsDark] = useState(getInitialIsDark);
useEffect(() => { applyDarkMode(isDark); }, [isDark]);
useEffect(() => onSystemThemeChange((dark) => setIsDark(dark)), []);
```

For AG Grid components, use the shared theme builder:

```typescript
import { buildAgGridTheme } from '@macro/macro-design';
const theme = buildAgGridTheme(isDark);  // Alpine + fonts + dark/light color scheme
```

---

## Ports & URLs

| Service | Port | URL |
|---------|------|-----|
| Angular App | 4200 | http://localhost:4200 |
| React App | 4201 | http://localhost:4201 |
| OpenFin Workspace | 4202 | http://localhost:4202 |
| Market Data Server | 3000 | ws://localhost:3000 |
| OpenFin DevTools | 9090 | http://localhost:9090 |

**Angular App Routes:**
- http://localhost:4200/fx-market-data
- http://localhost:4200/treasury-microstructure

**React App Routes:**
- http://localhost:4201/treasury-market-data
- http://localhost:4201/commodities-dashboard

**Workspace Routes:**
- http://localhost:4202/provider (platform init window)
- http://localhost:4202/view1 (FDC3 broadcaster)
- http://localhost:4202/view2 (FDC3 listener)

**WebSocket Endpoints:**
- ws://localhost:3000/marketData/fx (FX data)
- ws://localhost:3000/marketData/tsy (Treasury data)

---

## LOB Implementation Guide

This section guides other Lines of Business (LOB) teams on how to use this repository as a foundation for their own trading applications.

### Step 1: Create Your Application

```bash
# Generate a new Angular app
npx nx generate @nx/angular:application my-lob-angular --directory=apps/my-lob-angular --standalone

# Generate a new React app
npx nx generate @nx/react:application my-lob-react --directory=apps/my-lob-react --bundler=vite
```

### Step 2: Use Shared Libraries

All `@macro/*` libraries are available immediately via the TypeScript path aliases.

```typescript
// Logging
import { Logger } from '@macro/logger';
const logger = Logger.getLogger('MyLobApp');

// AG Grid
import { MacroAngularGrid } from '@macro/macro-angular-grid';  // or MacroReactGrid

// Messaging (pick your transport)
import { AmpsClient } from '@macro/amps';
import { SolaceClient } from '@macro/solace';

// Conflation for high-frequency data
import { ConflationSubject } from '@macro/rxutils';

// OpenFin services (if running in OpenFin)
import { ContextService, ChannelService, ThemeService } from '@macro/openfin';
```

### Step 3: Register in OpenFin Workspace

Add your app to `apps/macro-workspace/public/manifest.fin.json` under `customSettings.apps`:

```json
{
  "appId": "my-lob-app",
  "name": "my-lob-app",
  "title": "My LOB Application",
  "description": "Description for Home search and Store",
  "manifest": "http://localhost:4202/my-lob-app.fin.json",
  "manifestType": "view",
  "icons": [{ "src": "http://localhost:YOUR_PORT/favicon.ico" }],
  "contactEmail": "team@example.com",
  "supportEmail": "support@example.com",
  "publisher": "My LOB Team",
  "intents": [],
  "images": [],
  "tags": ["view", "my-lob"]
}
```

Create the view manifest file `apps/macro-workspace/public/my-lob-app.fin.json`:

```json
{
  "url": "http://localhost:YOUR_PORT",
  "fdc3InteropApi": "2.0",
  "interop": {
    "currentContextGroup": "green"
  }
}
```

### Step 4: Connect Real-Time Data

Replace client-side simulation with AMPS or Solace:

```typescript
// Example: Connect to AMPS for real-time FX data
const amps = new AmpsClient('my-lob-fx');
await amps.connect('ws://amps-server:9007/amps/json');

// Subscribe with conflation for grid updates
const conflation = new ConflationSubject<string, FxRate>(100);  // 100ms

amps.subscribeAsObservable('/topic/fx-rates')
  .subscribe((msg) => {
    const rate = msg.data as FxRate;
    conflation.next({ key: rate.symbol, value: rate });
  });

conflation.subscribeToConflated(({ key, value }) => {
  gridComponent.updateRows$.next([value]);
});
```

### Step 5: Add FDC3 Context Sharing

Enable your app to participate in cross-app communication:

```typescript
// Broadcast when user clicks a row
onRowClicked(row: FxRate) {
  contextService.broadcast({
    type: 'fdc3.instrument',
    name: row.symbol,
    id: { ticker: row.symbol }
  });
}

// Listen for context from other apps
contextService.registerContextListener('fdc3.instrument');
contextService.context$.subscribe((ctx) => {
  const ticker = ctx.id?.ticker;
  highlightRow(ticker);
});
```

### Step 6: Theme Integration

**Step 6a: Import shared CSS** in your app's global `styles.css`:

```css
/* Must come before any framework-specific CSS */
@import '../../../libs/macro-design/src/lib/css/fonts.css';
@import '../../../libs/macro-design/src/lib/css/macro-design.css';
```

This gives you all CSS variables (`:root` + `.dark`) — no need to define your own.

**Step 6b: Use dark mode utilities** in your root component:

```typescript
import { getInitialIsDark, applyDarkMode, onSystemThemeChange } from '@macro/macro-design';
```

See the [`@macro/macro-design` section](#macromacro-design---shared-design-library) for full Angular and React examples.

**Step 6c: Configure PrimeNG/PrimeReact** to respond to the `.dark` class:

For PrimeNG (Angular):
```typescript
providePrimeNG({
  theme: {
    preset: Aura,
    options: { darkModeSelector: '.dark' }
  }
})
```

For PrimeReact (React):
```tsx
// main.tsx
import { PrimeReactProvider } from '@primereact/core/config';
import Aura from '@primeuix/themes/aura';

root.render(
  <PrimeReactProvider theme={{ preset: Aura, options: { darkModeSelector: '.dark' } }}>
    <App />
  </PrimeReactProvider>
);
```

For Tailwind (React): Use `@custom-variant dark (&:is(.dark *))` and reference CSS variables for colors.

### Step 7: Add View State Persistence (Recommended)

Persist AG Grid state and custom preferences across workspace save/restore cycles so users don't lose their column layout, filters, and sort when workspaces are restored.

**Angular:**
```typescript
import { ViewStateService } from '@macro/openfin';
import { GridState } from 'ag-grid-community';

export class MyView implements AfterViewInit, OnDestroy {
  private viewState = inject(ViewStateService);
  @ViewChild(MacroAngularGrid) grid!: MacroAngularGrid;

  async ngAfterViewInit() {
    const saved = await this.viewState.restoreState();
    if (saved['agGrid']) this.grid.applyGridState(saved['agGrid'] as GridState);
    this.viewState.enableAutoSave(() => ({ agGrid: this.grid.getGridState() }));
  }

  ngOnDestroy() { this.viewState.destroy(); }
}
```

**React:**
```tsx
import { useViewState } from '@macro/openfin/react';

function MyView() {
  const gridRef = useRef<MacroReactGridRef>(null);
  const [viewState, saved, isReady] = useViewState();

  useEffect(() => {
    if (isReady && saved['agGrid']) gridRef.current?.applyGridState(saved['agGrid']);
  }, [isReady]);

  useEffect(() => {
    viewState.enableAutoSave(() => ({ agGrid: gridRef.current?.getGridState() }));
    return () => viewState.disableAutoSave();
  }, [viewState]);
}
```

See the [View State Persistence](#view-state-persistence) section for the full API reference and non-grid state examples.

### Step 8: Create a Shared Library (Optional)

If you have reusable logic:

```bash
# TypeScript library (framework-agnostic)
npx nx generate @nx/js:library my-lob-utils --directory=libs/my-lob-utils --bundler=tsc

# Angular library
npx nx generate @nx/angular:library my-lob-ng --directory=libs/my-lob-ng

# React library
npx nx generate @nx/react:library my-lob-react --directory=libs/my-lob-react
```

Add the path alias to `tsconfig.base.json`:
```json
"@macro/my-lob-utils": ["libs/my-lob-utils/src/index.ts"]
```

---

## Technology Stack

### Core Versions

| Technology | Version | Purpose |
|-----------|---------|---------|
| **NX** | 22.5.1 | Monorepo build system |
| **Angular** | 21.1.0 | Frontend framework (macro-angular, macro-workspace) |
| **React** | 19.0.0 | Frontend framework (macro-react) |
| **TypeScript** | 5.9.2 | Type safety |
| **Node.js** | 18+ | Runtime |

### UI & Visualization

| Technology | Version | Purpose |
|-----------|---------|---------|
| **AG Grid Enterprise** | 35.0.0 | Data grids (both Angular and React) |
| **AG Charts Enterprise** | 13.0.0 | Charts (Angular microstructure component) |
| **Recharts** | 3.4.1 | Charts (React commodities dashboard) |
| **PrimeNG** | 21.0.4 | Angular UI components (Menubar, theme) |
| **PrimeReact** | 11.0.0-alpha | React UI components (Aura theme) |
| **PrimeIcons** | 7.0.0 | Icon set for PrimeNG / PrimeReact |
| **Shadcn UI / Radix** | latest | React UI components (Menubar, Switch, Label) |
| **Tailwind CSS** | 4.1.17 | Utility-first CSS (React) |
| **Lucide React** | 0.553.0 | React icon library |

### Desktop & Messaging

| Technology | Version | Purpose |
|-----------|---------|---------|
| **OpenFin Core** | 42.102.4 | Desktop application container |
| **OpenFin Workspace** | 22.3.25 | Home, Dock, Store, Notifications |
| **FDC3** | 2.0.3 | Financial Desktop Connectivity standard |
| **AMPS** | 5.3.4 | High-performance message broker client |
| **Solace (solclientjs)** | 10.18.2 | Enterprise PubSub+ message broker client |

### Infrastructure

| Technology | Version | Purpose |
|-----------|---------|---------|
| **RxJS** | 7.8.0 | Reactive programming |
| **Pino** | 10.1.0 | Structured logging |
| **Vite** | 7.0.0 | React build tool |
| **esbuild** | 0.19.2 | Node.js build tool |
| **Jest** | 30.0.0 | Unit testing (Angular, libs) |
| **Vitest** | 4.0.16 | Unit testing (React) |
| **Playwright** | 1.36.0 | E2E testing |
| **ESLint** | 9.8.0 | Linting |
| **Prettier** | 2.6.2 | Code formatting |

---

## Testing

### Unit Tests

```bash
npx nx test macro-design             # Test design library (jsdom)
npx nx test logger                   # Test logger library
npx nx test macro-angular-grid       # Test Angular grid
npx nx test macro-react-grid         # Test React grid
npx nx test amps                     # Test AMPS transport
npx nx test solace                   # Test Solace transport
npx nx run-many --target=test --all  # Test everything
```

### E2E Tests (Playwright)

```bash
# Angular E2E (port 4200)
npm run e2e:angular
npm run e2e:angular:headed           # With browser UI
npm run e2e:angular:ui               # Playwright UI mode
npm run e2e:angular:debug            # Debug mode

# React E2E (port 4201)
npm run e2e:react
npm run e2e:react:headed

# OpenFin Workspace E2E (port 4202, uses CDP on port 9090)
npm run e2e:workspace
npm run e2e:workspace:openfin        # OpenFin-specific project
```

---

## Available Commands

### Development

```bash
npm start                            # Start workspace + angular + react concurrently
npm run start:workspace              # OpenFin Workspace (:4202)
npm run start:angular                # Angular App (:4200)
npm run start:react                  # React App (:4201)
npm run launch                       # Launch OpenFin runtime
```

### Building

```bash
npm run build:workspace              # Build workspace
npm run build:angular                # Build Angular app
npm run build:react                  # Build React app
npm run build:logger                 # Build logger lib (for publishing)
npx nx run-many --target=build --all # Build everything
```

### Publishing

```bash
npm run publish:logger               # Publish @macro/logger to npm
npm run publish:logger:dry-run       # Dry-run publish
```

### NX Utilities

```bash
npx nx graph                         # Visualize dependency graph
npx nx show project <name> --web     # View project details in browser
npx nx affected --target=test        # Test only affected projects
npx nx affected --target=build       # Build only affected projects
```

---

## Useful Links

- [NX Documentation](https://nx.dev)
- [Angular Documentation](https://angular.dev)
- [React Documentation](https://react.dev)
- [AG Grid Documentation](https://www.ag-grid.com)
- [AG Charts Documentation](https://www.ag-grid.com/charts)
- [PrimeNG Documentation](https://primeng.org)
- [PrimeReact Documentation](https://primereact.org)
- [Shadcn UI Documentation](https://ui.shadcn.com)
- [Tailwind CSS Documentation](https://tailwindcss.com)
- [OpenFin Developer Docs](https://developers.openfin.co)
- [FDC3 Standard](https://fdc3.finos.org)
- [AMPS Documentation](https://www.crankuptheamps.com/documentation)
- [Solace PubSub+ Docs](https://docs.solace.com)
- [Pino Logger](https://github.com/pinojs/pino)
- [Recharts](https://recharts.org)
- [RxJS Documentation](https://rxjs.dev)

---

## Contributing

1. Create a feature branch from `master`
2. Make your changes
3. Run linting: `npx nx run-many --target=lint --all`
4. Run tests: `npx nx run-many --target=test --all`
5. Submit a pull request

---

## License

MIT
