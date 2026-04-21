# `@macro/macro-mcp` — MCP Server for the Macro Desktop Monorepo

A custom [Model Context Protocol](https://modelcontextprotocol.io) server that
lets AI coding agents (Claude Code, Cursor, VS Code Copilot, etc.) scaffold
apps, explore live AMPS data, import Figma Make exports, and query Macro
library APIs without you having to describe the monorepo's conventions by hand.

> **What it is.** A stdio-transport MCP server. The AI client spawns it, the
> server registers tools/resources/prompts, and the client calls them.
>
> **What it replaces.** A long `CLAUDE.md` of "here's how you add an app, here's
> which CSS to import, here's the path alias table." Instead the server *executes*
> those conventions as tools and *serves* them as reference resources.

---

## Quick start

### 1. Build

```bash
npx nx build macro-mcp
# → dist/apps/macro-mcp/main.js
```

### 2. Register with your MCP client

Already done in this repo's root `.mcp.json`:

```json
{
  "mcpServers": {
    "macro-mcp": {
      "command": "node",
      "args": ["E:/MacroDesktopMFE/macro/dist/apps/macro-mcp/main.js"]
    }
  }
}
```

Restart your MCP client after building.

### 3. Use it

In Claude Code (or any client that can call MCP tools):

```
Import this Figma zip as a React app: /Users/me/Downloads/my-ticket.zip
```

The client will invoke `import_figma_app` behind the scenes. Port,
dependencies, manifests, dock registration, and start script are all wired up.

---

## Capabilities at a glance

| Category | Count | Purpose |
|----------|-------|---------|
| **Tools** | 11 | Actionable — scaffold apps, register OpenFin views, explore AMPS, etc. |
| **Resources** | 12 | Read-only reference — architecture, tech stack, theming rules, library catalog |
| **Prompts** | 6 | Canned prompt templates — "create Angular app", "add grid", "add FDC3 context" |

---

## Tools

All tool names are snake-case. Parameters are Zod-validated — invalid input
comes back as a structured error instead of a hung request.

### Scaffolding & registration

| Tool | What it does |
|------|--------------|
| `scaffold_angular_app` | Generate an Angular 21 LOB app (standalone components, PrimeNG, AG Grid wiring, `@macro/*` imports). Returns the shell commands + file contents to apply. |
| `scaffold_react_app` | Same, for React 19 + Vite + Tailwind 4 + PrimeReact + Shadcn. |
| `scaffold_library` | Generate a new `@macro/<name>` shared library, including `tsconfig.base.json` path alias. |
| `register_openfin_app` | Add the `manifest.fin.json` / `settings.json` entries needed to surface an app in Home, Dock, and Store. |

### Figma Make import (fully automated)

| Tool | What it does |
|------|--------------|
| `import_figma_app` | End-to-end import of a Figma Make export (folder or `.zip`) as a React app. |

In one tool call this will:

1. Extract the zip (cross-platform: `unzip` → PowerShell `Expand-Archive` → `python3`).
2. Create `apps/<app-name>/` with `project.json`, `tsconfig.json`, `vite.config.mts`, `index.html`, `main.tsx`, and an `app.tsx` wrapper that wires `BrowserRouter`, dark/light theme sync, and OpenFin theme-toggle awareness.
3. Auto-detect Tailwind and generate `postcss.config.cjs`.
4. Install missing Figma dependencies (`npm install --legacy-peer-deps`).
5. Pick a free port (auto-scan, skipping workspace + well-known ports) and write it **consistently** into `package.json` script, `project.json` serve target, `vite.config.mts`, and the OpenFin view manifest.
6. Auto-select a Capital Markets icon based on the app name/title, with dark + light variants. Falls back to `dashboard`.
7. Register the app in both `local/` and `openshift/` variants of `manifest.fin.json` and `settings.json`, including a Dock favorite.
8. Add `start:<app>` and `build:<app>` scripts and extend `build:apps`.
9. On partial failure, clean up `apps/<name>/` and the generated `.fin.json` files so you can retry with the same name.

### AMPS integration

| Tool | What it does |
|------|--------------|
| `amps_explore` | Connect to a live AMPS instance, list topics, run SOW queries, analyze message schema (field names, types, sample values, detected composite keys). Accepts a raw `ampsUrl` or a `configUrl` pointing at an AMPS XML config (TLS self-signed certs auto-accepted). |
| `amps_create_mfe` | Full-stack generator: connect to AMPS → detect schema → generate Angular **or** React MFE with AG Grid, ColDefs with the right formatting, `sowAndSubscribe` + `ConflationSubject` wiring, dark mode by default, and OpenFin registration. |

### Reference & discovery

| Tool | What it does |
|------|--------------|
| `list_libraries` | List all `@macro/*` shared libs with short descriptions and key exports. |
| `get_library_api` | Full public API of a specific `@macro/*` lib — types, function signatures, usage examples. |
| `list_icons` | List the 144 Capital Markets icons available under `apps/macro-workspace/public/icons/capital-markets/` (dark + light variants). Filter by category or keyword. |
| `get_commands` | All `npm run *` scripts and useful `nx` commands, optionally filtered by category (start / build / test / e2e / lint). |

---

## Resources

Reference documentation served over the MCP resource protocol. AI clients can
pull these into their context *without* spending tokens re-deriving them from
code. Every URI uses the `macro://` scheme.

| URI | Content |
|-----|---------|
| `macro://architecture` | High-level monorepo architecture, app/lib layout, data flow |
| `macro://tech-stack` | Versions: NX 22, Angular 21, React 19, PrimeNG/PrimeReact, AG Grid 35, Vite 8, OpenFin Workspace 22.3.29 |
| `macro://libraries` | Catalog of `@macro/*` libraries with responsibilities |
| `macro://theming` | Single-source-of-truth theming rules (`@macro/macro-design`) |
| `macro://openfin` | OpenFin Workspace conventions, manifest structure, FDC3 setup |
| `macro://data-connectivity` | How to plug in AMPS / Solace / NATS via `@macro/transports` |
| `macro://market-data-server` | Local WebSocket mock server (ports, endpoints, payload shape) |
| `macro://templates/angular` | Boilerplate for a new Angular LOB |
| `macro://templates/react` | Boilerplate for a new React LOB |
| `macro://testing` | Jest 30 (Angular) + Vitest 4 (React) + Playwright E2E setup |
| `macro://lob-guide` | End-to-end checklist for onboarding a new LOB |
| `macro://figma-workflow` | Recommended flow for Figma Make → OpenFin view |

---

## Prompts

Slash-command-style prompt templates your MCP client can autocomplete. They
bundle the right resources + tools for a specific task so the agent doesn't
have to re-derive the plan.

| Prompt | Purpose |
|--------|---------|
| `create-angular-app` | Step-by-step instructions for a new Angular LOB |
| `create-react-app` | Same, for React |
| `add-grid-component` | Create an AG Grid with `ColDef[]`, `getRowId`, and `updateRows$` wiring |
| `add-fdc3-context` | Generate FDC3 broadcast + listen for cross-app context sharing |
| `add-theme-support` | Wire dark/light theme using `@macro/macro-design` utilities |
| `add-data-connectivity` | Plug in real-time data (AMPS / Solace / WebSocket) with conflation |

---

## How the pieces fit together

```
your AI client  (Claude Code, Cursor, VS Code Copilot, …)
    │
    │  JSON-RPC over stdio
    ▼
dist/apps/macro-mcp/main.js   ← bundled by @nx/esbuild
    │
    ├── tools/          → actions that read or mutate the monorepo
    ├── resources/      → read-only reference docs (macro://…)
    └── prompts/        → canned prompt templates
```

The server is a single bundled CJS file — no external runtime deps at invoke
time. It reads/writes the monorepo directly using `fs` and `execSync` (for
`npm install`, `unzip`, etc.), so there is no daemon, API, or extra port.

---

## Development

### Project layout

```
apps/macro-mcp/
├── src/
│   ├── main.ts          # stdio transport entry point
│   ├── tools/           # one file per MCP tool + index.ts registry
│   ├── resources/       # one file per macro:// resource + index.ts
│   └── prompts/         # one file per prompt + index.ts
├── project.json         # NX build (esbuild, CJS, bundle=true)
└── tsconfig.app.json
```

### Adding a new tool

1. Create `src/tools/my-tool.ts`:

   ```ts
   import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
   import { z } from 'zod';

   export function registerMyTool(server: McpServer): void {
     server.tool(
       'my_tool',
       'One-line description shown to the AI agent.',
       { arg: z.string().describe('What this arg is for') },
       async ({ arg }) => ({
         content: [{ type: 'text' as const, text: `got ${arg}` }],
       }),
     );
   }
   ```

2. Register it in `src/tools/index.ts`.

3. `npx nx build macro-mcp` and restart your MCP client.

### Adding a new resource

1. Create `src/resources/my-topic.ts`:

   ```ts
   import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

   export function registerMyTopic(server: McpServer): void {
     server.resource(
       'my-topic',
       'macro://my-topic',
       { mimeType: 'text/markdown' },
       async () => ({
         contents: [{
           uri: 'macro://my-topic',
           mimeType: 'text/markdown',
           text: `# My Topic\n\nReference content here.`,
         }],
       }),
     );
   }
   ```

2. Register it in `src/resources/index.ts`.

### Build output

Build targets `node` with `format=cjs` so the shipped `main.js` can be invoked
directly by `node` with no ESM/interop surprises. Sourcemaps are generated in
the `development` configuration.

```bash
# development build (keeps sourcemaps)
npx nx build macro-mcp --configuration=development

# production (no sourcemaps)
npx nx build macro-mcp
```

### Run under nodemon-style watch

```bash
npx nx serve macro-mcp          # rebuilds + restarts
```

> MCP clients typically spawn the server themselves, so during development
> you'll want to point the client at the built `main.js` and rebuild with
> `nx build` rather than running `serve` manually.

---

## Remote-friendly variant

There is a companion `macro-mcp-agent` (under `apps/macro-mcp-agent/`) that
exposes a subset of the same tools over HTTP + SSE / Streamable HTTP. Use it
when the MCP client can't spawn a local process (cloud IDEs, JetBrains, etc.).
It intentionally **excludes** file-creation tools (`scaffold_*`, `import_figma_app`)
because they mutate a local checkout.

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---------|-------------------|
| Client can't find `macro-mcp` | Run `npx nx build macro-mcp` and restart the client |
| `Cannot find module @modelcontextprotocol/sdk` | Stale `dist/`; clean and rebuild |
| `import_figma_app` times out on zip | Missing `unzip`/`python3` on PATH — install one, or extract the zip manually first and pass the folder path |
| `amps_explore` fails with TLS error | The tool already sets `NODE_TLS_REJECT_UNAUTHORIZED=0` for `wss://` URLs. If it still fails, check the AMPS server's cert and firewall. |
| Port collision when importing | Tool auto-picks the next free port ≥ 4204, skipping the workspace port. Pass `port` explicitly to override. |
| New app's icon is "dashboard" even though I expected X | `ICON_KEYWORDS` in `import-figma-app.ts` didn't match — pass `icon: "<name>"` explicitly, or use `list_icons` to browse. |

---

## Related

- Root [`CLAUDE.md`](../../CLAUDE.md) — repo-level conventions for AI agents
- [`.mcp.json`](../../.mcp.json) — MCP server registration
- [`scripts/stop.mjs`](../../scripts/stop.mjs) — `npm run stop` port-killer
- [Model Context Protocol spec](https://modelcontextprotocol.io)
