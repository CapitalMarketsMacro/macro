# @macro/openfin

A framework-agnostic TypeScript library for OpenFin workspace platform services and utilities. This library can be used in both Angular and React applications.

## Features

- **Framework-agnostic**: Plain TypeScript classes that work with any framework
- **Angular wrappers**: Pre-configured Angular services with dependency injection
- **OpenFin Workspace Platform**: Full support for workspace initialization and management
- **FDC3 Support**: Context broadcasting and channel management
- **Theme Management**: Synchronized theme support for dark/light modes
- **Notifications**: OpenFin notification platform integration

## Installation

The library is already included in the monorepo. Make sure OpenFin packages are installed:

```bash
npm install @openfin/core @openfin/workspace @openfin/workspace-platform @finos/fdc3
```

## Usage

### Angular Applications

Import the Angular wrapper services directly:

```typescript
import { 
  WorkspaceService, 
  ThemeService, 
  ContextService,
  ChannelService,
  NotificationsService 
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

### React Applications

Use the base services directly:

```typescript
import { 
  WorkspaceService,
  ThemeService,
  SettingsService,
  PlatformService,
  DockService,
  HomeService,
  StoreService,
  ContextService
} from '@macro/openfin';
import { HttpClient } from 'axios'; // or your HTTP client

// Create instances with dependencies
const httpClient = {
  get: <T>(url: string) => axios.get<T>(url).then(r => r.data)
};

const settingsService = new SettingsService(httpClient);
const workspaceOverrideService = new WorkspaceOverrideService();
const platformService = new PlatformService(workspaceOverrideService);
const dockService = new DockService();
const homeService = new HomeService(settingsService);
const storeService = new StoreService(settingsService);
const workspaceService = new WorkspaceService(
  platformService,
  dockService,
  homeService,
  storeService,
  settingsService
);

// Initialize
workspaceService.init().subscribe();
```

### Framework-Agnostic Base Services

All services are available as plain TypeScript classes:

- `SettingsService` - Platform settings and app management
- `ContextService` - FDC3 context broadcasting
- `ChannelService` - FDC3 channel management
- `StoreService` - OpenFin Storefront
- `DockService` - OpenFin Dock
- `HomeService` - OpenFin Home
- `NotificationsService` - OpenFin Notifications
- `WorkspaceOverrideService` - Workspace platform overrides
- `PlatformService` - Platform initialization
- `WorkspaceService` - Workspace management
- `ThemeService` - Theme synchronization

## Services

### WorkspaceService

Main service for initializing and managing the OpenFin workspace platform.

```typescript
workspaceService.init().subscribe((success) => {
  if (success) {
    console.log('Platform initialized');
  }
});
```

### ThemeService

Manages theme synchronization between OpenFin and your application.

```typescript
themeService.syncWithOpenFinTheme();
themeService.getTheme$().subscribe(theme => {
  console.log('Current theme:', theme);
});
```

### ContextService

FDC3 context broadcasting and listening.

```typescript
// Broadcast context
contextService.broadcast({
  type: 'fdc3.instrument',
  name: 'Microsoft Corporation',
  id: { ticker: 'MSFT' }
});

// Listen for contexts
contextService.registerContextListener('fdc3.instrument');
contextService.context$.subscribe(context => {
  console.log('Context received:', context);
});
```

## Types

All TypeScript types are exported:

```typescript
import type { 
  PlatformSettings, 
  CustomSettings,
  ThemePalette,
  ThemeConfig 
} from '@macro/openfin';
```

## Utilities

### launchApp

Utility function for launching OpenFin applications:

```typescript
import { launchApp } from '@macro/openfin';

await launchApp({
  appId: 'my-app',
  manifest: 'http://localhost:4200/manifest.fin.json',
  manifestType: 'view',
  title: 'My App'
});
```

## Migration from macro-workspace

If you're migrating from the old services in `apps/macro-workspace/src/app/services`, simply update your imports:

**Before:**
```typescript
import { WorkspaceService } from '../services/workspace.service';
```

**After:**
```typescript
import { WorkspaceService } from '@macro/openfin';
```

The Angular wrapper services maintain the same API, so no code changes are needed beyond the import path.

## License

MIT

