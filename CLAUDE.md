# CLAUDE.md - Macro Desktop MFE

## Project Overview

NX 22.6 monorepo for **Capital Markets desktop applications**. Combines Angular 21, React 19, and OpenFin Workspace into a unified platform with shared libraries for real-time market data, enterprise messaging, and FDC3 interoperability.

## Quick Reference

| App                | Port | Framework             | Command                           |
| ------------------ | ---- | --------------------- | --------------------------------- |
| macro-angular      | 4200 | Angular 21 (zoneful)  | `npm run start:angular`           |
| macro-react        | 4201 | React 19 + Vite 8     | `npm run start:react`             |
| macro-workspace    | 4202 | Angular 21 (zoneless) | `npm run start:workspace`         |
| market-data-server | 3000 | Node.js WebSocket     | `npx nx serve market-data-server` |
| All three apps     | -    | -                     | `npm start`                       |

Launch OpenFin: `npm run launch` (after workspace is serving on 4202)

## Repository Structure

```
macro/
├── apps/
│   ├── macro-angular/          # Angular market data app (PrimeNG, AG Grid, AG Charts)
│   ├── macro-react/            # React market data app (Shadcn/Radix, Tailwind, AG Grid, Recharts)
│   ├── macro-workspace/        # OpenFin Workspace platform shell (Angular, zoneless)
│   ├── market-data-server/     # WebSocket server (simulated FX + Treasury data)
│   ├── macro-mcp/              # Custom MCP server for scaffolding
│   ├── macro-angular-e2e/      # Playwright E2E tests (Angular)
│   ├── macro-react-e2e/        # Playwright E2E tests (React)
│   └── macro-workspace-e2e/    # Playwright E2E tests (OpenFin)
├── libs/
│   ├── macro-design/           # Shared design tokens, CSS variables, dark mode, AG Grid theme
│   ├── logger/                 # Pino-based structured logging (@macro/logger)
│   ├── transports/             # Unified messaging: AMPS, Solace, NATS (@macro/transports)
│   ├── amps/                   # AMPS message broker client (@macro/amps) — standalone
│   ├── solace/                 # Solace PubSub+ client (@macro/solace) — standalone
│   ├── nats/                   # NATS.js v3 WebSocket client (@macro/nats) — standalone
│   ├── openfin/                # OpenFin Workspace services + Angular DI + Snap + Analytics (@macro/openfin)
│   ├── rxutils/                # RxJS conflation utilities (@macro/rxutils)
│   ├── macro-angular-grid/     # AG Grid 35 Enterprise Angular wrapper + column formatting
│   └── macro-react-grid/       # AG Grid 35 Enterprise React wrapper + column formatting
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
import { NatsTransportService } from '@macro/transports/angular';
import { useNatsTransport } from '@macro/transports/react';
import { AmpsClient } from '@macro/amps';
import { SolaceClient } from '@macro/solace';
import { NatsClient } from '@macro/nats';
import { WorkspaceService, ThemeService, ContextService, NotificationsService } from '@macro/openfin';
import { useViewState } from '@macro/openfin/react';
import { ConflationSubject } from '@macro/rxutils';
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
- macro-angular uses `provideZoneChangeDetection({ eventCoalescing: true })` (zoneful)
- macro-workspace uses `provideZonelessChangeDetection()` (zoneless)
- PrimeNG 21 with Aura theme preset
- Component files: `.ts` (class), `.html` (template), `.css` (styles)
- Root component selector: `app-root`
- Use `inject()` function, not constructor injection
- App config in `app.config.ts`, routes in `app.routes.ts`

**React (macro-react):**

- React 19 + Vite 8
- React Router DOM 6.x for routing
- Shadcn UI (Radix primitives) for navigation components
- PrimeReact 11 with Aura theme preset
- Tailwind CSS 4 for utility styling
- Path alias `@/` maps to `src/` for component imports
- Components use function syntax with hooks
- AG Grid uses `forwardRef` pattern via `MacroReactGridRef`

**OpenFin (macro-workspace):**

- Platform manifest: `apps/macro-workspace/public/manifest.fin.json`
- App registry in `customSettings.apps` array within manifest
- View manifests: `apps/macro-workspace/public/*.fin.json`
- Settings: `apps/macro-workspace/public/settings.json`
- FDC3 2.0 with `currentContextGroup: "green"` on all views
- Workspace persistence via localStorage
- View state persistence via `ViewStateService` / `useViewState()` hook

### Real-Time Data Patterns

- Market data flows via WebSocket from `market-data-server` (port 3000)
- FX endpoint: `ws://localhost:3000/marketData/fx` (15 G10 pairs, 1-sec ticks)
- Treasury endpoint: `ws://localhost:3000/marketData/tsy` (11 securities, 1-sec ticks)
- For high-frequency data, use `ConflationSubject` from `@macro/rxutils` (double-buffer algorithm)
- Angular grid updates via `updateRows$` Subject on `MacroAngularGrid`
- React grid updates via `ref.current?.updateRows$` Subject on `MacroReactGridRef`

## Code Style & Formatting

- **Prettier**: single quotes (`"singleQuote": true`), default everything else
- **EditorConfig**: UTF-8, 2-space indentation, LF newlines, final newline
- **ESLint**: NX flat config with `@nx/enforce-module-boundaries` enabled
- **TypeScript**: 5.9.3, strict-ish (skipLibCheck, experimentalDecorators)

## Testing

**Unit tests:**

- Angular apps + libs: **Jest 30** (`@nx/jest`, `jest-preset-angular`)
- React app + libs: **Vitest 4** (`@nx/vite`)
- `@macro/macro-design`: Jest with jsdom environment
- Run all: `npx nx run-many --target=test --all`
- Run one: `npx nx test <project-name>` (e.g., `npx nx test logger`)

**E2E tests:**

- **Playwright** for all three app E2E projects
- Angular: `npm run e2e:angular` (also `:headed`, `:ui`, `:debug` variants)
- React: `npm run e2e:react`
- Workspace: `npm run e2e:workspace`

## Building

```bash
npm run build:angular          # Build Angular app
npm run build:react            # Build React app
npm run build:workspace        # Build OpenFin workspace
npm run build:logger           # Build logger lib (for npm publish)
npx nx run-many --target=build --all  # Build everything
```

Output goes to `dist/` directory.

## NX Commands

```bash
npx nx graph                          # Dependency visualization
npx nx affected --target=test         # Test only affected projects
npx nx affected --target=build        # Build only affected projects
npx nx show project <name> --web      # Project details
```

Default base branch is `master`.

## MCP Servers Available

This repo has 6 MCP servers configured in `.mcp.json`:

- **ag-mcp**: AG Grid documentation search
- **primeng**: PrimeNG component documentation
- **nx-mcp**: NX workspace commands
- **angular-cli**: Angular CLI tools, best practices, documentation
- **tailwindcss**: Tailwind CSS utilities and docs
- **macro-mcp**: Custom scaffolding for new apps/libs in this monorepo

## Adding a New Application

1. Generate with NX: `npx nx generate @nx/angular:application <name> --directory=apps/<name>`
2. Import shared CSS from `@macro/macro-design` in the app's `styles.css`
3. Use `@macro/*` libraries for grids, logging, messaging, theming
4. Register in OpenFin manifest (`apps/macro-workspace/public/manifest.fin.json`)
5. Create a view manifest (`apps/macro-workspace/public/<name>.fin.json`)
6. Add path alias to `tsconfig.base.json` if creating a new lib

## Adding a New Shared Library

1. Generate: `npx nx generate @nx/js:library <name> --directory=libs/<name> --bundler=tsc`
2. Add path alias to `tsconfig.base.json`: `"@macro/<name>": ["libs/<name>/src/index.ts"]`
3. Export public API from `libs/<name>/src/index.ts`

## Key Files to Know

| File                                             | Purpose                                      |
| ------------------------------------------------ | -------------------------------------------- |
| `tsconfig.base.json`                             | All `@macro/*` path aliases                  |
| `nx.json`                                        | Build targets, caching, plugins, generators  |
| `apps/macro-workspace/public/manifest.fin.json`  | OpenFin app registry (11 registered apps)    |
| `apps/macro-workspace/public/settings.json`      | Apps, dock, snap provider config             |
| `libs/macro-design/src/lib/css/macro-design.css` | All CSS variables (`:root` + `.dark`)        |
| `libs/macro-design/src/lib/ag-grid-theme.ts`     | AG Grid theme builder                        |
| `libs/macro-design/src/lib/dark-mode.ts`         | Dark mode utilities                          |
| `libs/macro-design/src/lib/theme.config.ts`      | Theme palettes for OpenFin                   |
| `libs/openfin/src/index.ts`                      | All OpenFin service exports                  |
| `apps/macro-angular/src/app/app.config.ts`       | Angular app providers (PrimeNG, zone config) |
| `apps/macro-react/src/main.tsx`                  | React entry (PrimeReact provider config)     |
| `apps/macro-workspace/src/app/app.config.ts`     | Workspace app config (zoneless)              |

## Common Pitfalls

- Do NOT add `:root` or `.dark` CSS variable blocks in individual apps -- use `@macro/macro-design`
- macro-workspace is **zoneless** (`provideZonelessChangeDetection`); macro-angular is **zoneful** (`provideZoneChangeDetection`) -- do not mix these up
- AG Grid Enterprise requires the license; both grid wrappers register `AllEnterpriseModule`
- The React app uses `@/` path alias (mapped to `src/`) for Shadcn component imports
- OpenFin APIs (`fin.*`) are only available when running inside the OpenFin runtime; services gracefully no-op in browsers
- PrimeReact is on alpha (`11.0.0-alpha.10`) -- check for breaking changes
- The `clone` library is used in AG Charts for immutable option updates

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
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
