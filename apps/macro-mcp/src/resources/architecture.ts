import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const ARCHITECTURE_DOC = `# Macro Monorepo Architecture

## Overview
The Macro monorepo is an NX-managed workspace for building financial desktop applications.
Apps run standalone in the browser during development and inside the OpenFin workspace in production.

## Project Structure
\`\`\`
apps/
  macro-angular/      # Angular LOB app (port 4200) — PrimeNG + AG Grid
  macro-react/        # React LOB app (port 4201) — Shadcn/Tailwind + AG Grid
  macro-workspace/    # OpenFin workspace platform (port 4202) — registers all views
  market-data-server/ # Node.js WebSocket server — mock FX + Treasury data
  macro-mcp/          # This MCP server

libs/
  logger/             # @macro/logger — Pino-based logging (browser + Node)
  amps/               # @macro/amps — AMPS pub/sub client wrapper
  solace/             # @macro/solace — Solace PubSub+ client wrapper
  rxutils/            # @macro/rxutils — RxJS conflation utilities
  openfin/            # @macro/openfin — OpenFin platform services
  macro-design/       # @macro/macro-design — CSS variables, dark mode, AG Grid theme
  macro-angular-grid/ # @macro/macro-angular-grid — AG Grid Angular wrapper
  macro-react-grid/   # @macro/macro-react-grid — AG Grid React wrapper
\`\`\`

## Tech Stack
| Layer           | Angular Apps          | React Apps                |
|-----------------|----------------------|---------------------------|
| Framework       | Angular (standalone)  | React 19 + Vite           |
| UI Components   | PrimeNG (Aura theme) | Shadcn UI + PrimeReact    |
| CSS             | PrimeNG styles        | Tailwind CSS v4           |
| Grid            | AG Grid Enterprise    | AG Grid Enterprise        |
| Charting        | AG Charts Enterprise  | AG Charts Enterprise      |
| State/Reactivity| RxJS Subjects         | RxJS Subjects + React hooks|
| Routing         | @angular/router       | react-router-dom          |
| Build           | @angular/build        | Vite via @nx/vite         |
| Dark Mode       | @macro/macro-design   | @macro/macro-design       |

## Design Principles
1. **Shared design tokens** — All apps import \`@macro/macro-design\` CSS variables
2. **Wrapper-based grids** — Use \`MacroAngularGrid\` or \`MacroReactGrid\` (not raw AG Grid)
3. **RxJS for streaming** — AMPS/Solace → ConflationSubject → grid.updateRows$
4. **OpenFin-ready** — Each app route registers as an OpenFin view via .fin.json
5. **Framework-agnostic libs** — Shared libs work with both Angular and React

## Dev Server Ports
| App              | Port |
|------------------|------|
| macro-angular    | 4200 |
| macro-react      | 4201 |
| macro-workspace  | 4202 |
| market-data-server | 3000 |

## NX Commands
\`\`\`bash
npx nx serve <app-name>              # Start dev server
npx nx build <app-name>              # Production build
npx nx serve macro-workspace          # Start OpenFin platform
npx nx graph                          # Visualize dependency graph
npx nx g @nx/angular:app <name>       # Generate Angular app
npx nx g @nx/react:app <name>         # Generate React app
\`\`\`

## tsconfig Path Aliases (tsconfig.base.json)
\`\`\`json
{
  "@macro/logger":             ["libs/logger/src/index.ts"],
  "@macro/amps":               ["libs/amps/src/index.ts"],
  "@macro/solace":             ["libs/solace/src/index.ts"],
  "@macro/rxutils":            ["libs/rxutils/src/index.ts"],
  "@macro/openfin":            ["libs/openfin/src/index.ts"],
  "@macro/macro-design":       ["libs/macro-design/src/index.ts"],
  "@macro/macro-angular-grid": ["libs/macro-angular-grid/src/index.ts"],
  "@macro/macro-react-grid":   ["libs/macro-react-grid/src/index.ts"]
}
\`\`\`
`;

export function registerArchitecture(server: McpServer): void {
  server.resource('architecture', 'macro://architecture', { mimeType: 'text/markdown' }, async () => ({
    contents: [
      {
        uri: 'macro://architecture',
        text: ARCHITECTURE_DOC,
        mimeType: 'text/markdown',
      },
    ],
  }));
}
