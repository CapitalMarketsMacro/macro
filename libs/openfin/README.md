# @macro/openfin

A framework-agnostic TypeScript library for OpenFin Workspace platform services and utilities, used by every app in the monorepo. Plain TypeScript base classes with Angular DI wrappers and React hooks on top.

Targets **OpenFin Workspace 45.2.12** (HERE Core UI) / `@openfin/core` 45.102.10 / runtime 45.150.102.10 — the versions are pinned in lockstep at the repo root (see the root `CLAUDE.md`).

## Features

- **Framework-agnostic**: plain TypeScript classes (exported with a `Base` prefix) that work with any framework
- **Angular wrappers**: pre-configured injectable services (the default, unprefixed exports)
- **React hooks**: `useViewState`, `useNotifications` via `@macro/openfin/react`
- **Workspace platform**: initialization, Home, Store(front), Dock 3.0 (folders, LOB apps, bookmarks/pins), Favorites, entitlements
- **Unified Workspace Storage**: ALL user persistence (workspaces, pages, dock customization, favorites, preferences, theme preset, view titles) through one `WorkspaceStorageClient` — localStorage in `local` mode, a per-environment REST service (`dev`/`uat`/`prod`) otherwise
- **FDC3 2.0**: context broadcasting and channel management
- **Theme management**: dark/light sync with OpenFin, theme presets
- **Notifications**: level helpers (`info`/`success`/`warning`/`error`/`critical`) with per-toast `sticky` / `transient` / `none` modes (Notification Center 45.2.6)
- **Snap**: window docking via `@openfin/snap-sdk`
- **Analytics**: OpenFin platform/browser/dock/home/store events published to NATS
- **Graceful no-op in browsers**: `fin.*` APIs are only used inside the OpenFin runtime

## Usage

### Angular applications

The unprefixed exports are Angular injectables:

```typescript
import {
  WorkspaceService,
  ThemeService,
  ContextService,
  ChannelService,
  NotificationsService,
  ViewStateService,
} from '@macro/openfin';

@Component({...})
export class MyComponent {
  private readonly workspaceService = inject(WorkspaceService);
  private readonly themeService = inject(ThemeService);

  ngOnInit() {
    this.workspaceService.init().subscribe();
    this.themeService.syncWithOpenFinTheme();
  }
}
```

### React applications

Use the hooks from the `react` entry point:

```typescript
import { useViewState } from '@macro/openfin/react';

function MyComponent() {
  // Persist and restore per-view state (filters, layout, …)
  const [state, setState] = useViewState<MyState>('my-view-state', defaultState);
  ...
}
```

The framework-agnostic base classes are also available directly (they are the same classes the Angular wrappers extend):

```typescript
import { BaseThemeService, BaseNotificationsService, onOpenFinThemeChange } from '@macro/openfin';
```

### Framework-agnostic base services

Every service exists as a plain class with a `Base` prefix: `BaseSettingsService`, `BaseContextService`, `BaseChannelService`, `BaseStoreService`, `BaseFavoritesService`, `BaseDockService`, `BaseDock3Service`, `BaseHomeService`, `BaseNotificationsService`, `BaseWorkspaceStorageService`, `BaseWorkspaceOverrideService`, `BasePlatformService`, `BaseWorkspaceService`, `BaseThemeService`, `BaseViewStateService`, `BaseThemePresetService`, `BaseSnapService`, `BaseAuthService`, `BaseEntitlementsService`, `BaseLaunchService`, `BaseStorefrontConfigService`, `BaseAppsService`, `BaseDockConfigService`, `BaseSnapConfigService`.

## Key services

| Service | Purpose |
| --- | --- |
| `WorkspaceService` | Orchestrates platform init (Home, Store, Dock, Snap, analytics) |
| `PlatformService` | `WorkspacePlatform.init` incl. `browserSettings` (tab search, duplicate page titles, indicator suppression) |
| `SettingsService` / `AppsService` | `settings.json` + the `apps.json` registry (env-scoped, static-file fallback) |
| `Dock3Service` | Dock 3.0: favorites + content-menu folders, LOB dock apps from the storage API, ⭐ bookmarks and 📌 pins (unified "on the dock" state) |
| `StoreService` / `StorefrontConfigService` | Storefront nav (Capital Markets LOB categories), app-details cards, dock-pin buttons |
| `WorkspaceStorageService` + storage clients | Unified Workspace Storage (below) |
| `NotificationsService` | Level helpers with `toast: 'sticky' \| 'transient' \| 'none'` |
| `ThemeService` / `ThemePresetService` | OpenFin ⇄ app dark-mode sync, palette presets |
| `ContextService` / `ChannelService` | FDC3 2.0 broadcast/listen, context groups |
| `ViewStateService` | Per-view state persistence (Angular; React has `useViewState`) |
| `SnapService` | Window docking (`@openfin/snap-sdk`) |
| `EntitlementsService` / `AuthService` | Feature gating (bootstrap-tier `entitlements.json`) |

## Unified Workspace Storage

ALL user persistence routes through `WorkspaceStorageClient` (`src/lib/storage/`):

- **`local` mode** — this machine's localStorage (`LocalStorageWorkspaceStorageClient`, legacy keys preserved).
- **`dev` / `uat` / `prod`** — a per-environment REST service (`RestWorkspaceStorageClient`), base URL from `settings.json`'s `storage` block, user-scoped via `X-User-Id`.

Active environment precedence: `?storageEnv=` → saved picker choice → `defaultEnvironment` → `local`. Resolve and initialize with `resolveStorageEnvironment` / `initWorkspaceStorage` / `getWorkspaceStorage`.

Posture: **reads degrade** (log + empty result — an outage must never brick platform boot), **writes throw** (a failed save must never look successful). `settings.json` and `entitlements.json` are bootstrap-tier and always load from the static per-env folder, never through the storage API.

Contract: `docs/api/workspace-storage-api.openapi.yaml`. Phase-1 reference implementation: `market-data-server` at `http://localhost:3000/workspace/v1` (including the shared LOB registries `/dock-apps` and `/store-apps`).

## Types

```typescript
import type {
  PlatformSettings,
  CustomSettings,
  ThemePalette,
  ThemeConfig,
  WorkspaceStorageClient,
  StorageEnvironmentConfig,
  LobDockApp,
  LobStoreApp,
  NotificationToastMode,
  ViewStateData,
} from '@macro/openfin';
```

## Utilities

```typescript
import { launchApp, onOpenFinThemeChange, buildMacroGranularTheme, resolveEnvConfigPath } from '@macro/openfin';

await launchApp({
  appId: 'my-app',
  manifest: 'http://localhost:4202/local/my-app.fin.json',
  manifestType: 'view',
  title: 'My App',
});
```

## License

MIT
