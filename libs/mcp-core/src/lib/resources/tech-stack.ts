import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const TECH_STACK_DOC = `# Technology Stack

## Core

| Technology | Version | Purpose |
|-----------|---------|---------|
| **NX** | 22.7.5 | Monorepo build system |
| **Angular** | 21.2.0 | Frontend framework (macro-angular, macro-workspace) |
| **React** | 19.2.7 | Frontend framework (macro-react) |
| **TypeScript** | 6.0.3 | Type safety |
| **Node.js** | 18+ (v20 recommended) | Runtime |

## UI & Visualization

| Technology | Version | Purpose |
|-----------|---------|---------|
| **AG Grid Enterprise** | 35.3.0 | Data grids (both Angular and React) |
| **AG Charts Enterprise** | 13.3.0 | Charts (Angular microstructure component) |
| **Recharts** | 3.4.1 | Charts (React commodities dashboard) |
| **PrimeNG** | 21.1.8 | Angular UI components (Menubar, theme) |
| **PrimeReact** | 11.0.0-alpha.10 | React UI components (Aura theme) |
| **PrimeIcons** | 7.0.0 | Icon set for PrimeNG / PrimeReact |
| **Shadcn UI / Radix** | latest | React UI components (Menubar, Switch, Label) |
| **Tailwind CSS** | 4.3.0 | Utility-first CSS (React) |
| **Lucide React** | 0.553.0 | React icon library |

## Desktop & Messaging

| Technology | Version | Purpose |
|-----------|---------|---------|
| **OpenFin Core** | 43.104.1 | Desktop application container |
| **OpenFin Workspace** | 23.2.23 | Home, Dock, Store, Notifications |
| **FDC3** | 2.2.3 | Financial Desktop Connectivity standard |
| **AMPS** | 5.3.4 | High-performance message broker client |
| **Solace (solclientjs)** | 10.18.2 | Enterprise PubSub+ message broker client |

## Infrastructure

| Technology | Version | Purpose |
|-----------|---------|---------|
| **RxJS** | 7.8.2 | Reactive programming |
| **Pino** | 10.1.0 | Structured logging |
| **Vite** | 8.0.14 | React build tool |
| **esbuild** | 0.19.2 | Node.js build tool |
| **Jest** | 30.3.0 | Unit testing (Angular, libs) |
| **Vitest** | 4.1.7 | Unit testing (React) |
| **Playwright** | 1.59.1 | E2E testing |
| **ESLint** | 10.0.0 | Linting |
| **Prettier** | 3.6.2 | Code formatting |

## Framework Comparison (Angular vs React in this Monorepo)

| Layer | Angular Apps | React Apps |
|-------|-------------|------------|
| Framework | Angular 21 (standalone) | React 19 + Vite |
| UI Components | PrimeNG (Aura theme) | Shadcn UI + PrimeReact |
| CSS | PrimeNG styles | Tailwind CSS v4 |
| Grid | AG Grid Enterprise | AG Grid Enterprise |
| Charting | AG Charts Enterprise | Recharts |
| State/Reactivity | RxJS Subjects | RxJS Subjects + React hooks |
| Routing | @angular/router | react-router-dom |
| Build | @angular/build | Vite via @nx/vite |
| Dark Mode | @macro/macro-design | @macro/macro-design |
`;

export function registerTechStack(server: McpServer): void {
  server.resource('tech-stack', 'macro://tech-stack', { mimeType: 'text/markdown' }, async () => ({
    contents: [
      {
        uri: 'macro://tech-stack',
        text: TECH_STACK_DOC,
        mimeType: 'text/markdown',
      },
    ],
  }));
}
