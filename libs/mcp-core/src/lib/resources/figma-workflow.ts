import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const FIGMA_WORKFLOW_DOC = `# Figma Make → OpenFin Workspace Integration

## Overview
This workflow takes a React app designed in Figma Make and integrates it into the Macro Desktop
monorepo as a fully registered OpenFin Workspace view — appearing in Home search, Storefront,
and Dock.

## Two Approaches

### Approach 1: Automated via MCP Tool (Recommended)
Use the \`import_figma_app\` tool from \`macro-mcp\`:

\`\`\`
Tool: import_figma_app
Parameters:
  appName: "risk-dashboard"           # kebab-case name
  sourcePath: "/path/to/figma.zip"    # zip file or extracted folder
  title: "Risk Dashboard"             # optional (auto-detected from package.json)
  description: ""                     # optional (auto-detected)
  port: 4205                          # optional (auto-detected: scans existing apps)
  dryRun: true                        # optional — preview the plan, write nothing
  preserveFigmaTheme: false           # optional — default false: adopt Macro tokens
  verifyBuild: false                  # optional — run nx build at the end
\`\`\`

The tool handles everything automatically:
- Validates the export is a React project (rejects Angular/Next/empty) before writing
- Extracts .zip files (handles nested root folders common in Figma Make exports)
- Auto-detects title/description from Figma's package.json and next available port
- Rewrites import specifiers Vite can't resolve: strips \`pkg@x.y.z\` version suffixes and
  rewrites the \`figma:asset/...\` scheme to local \`@/assets/\` paths
- Wires the app to the @macro/macro-design theme system (themeController + useTheme),
  adopting the Macro design tokens by default (the imported app looks like a Macro app)
- Detects Tailwind CSS, configures PostCSS, and emits an ESLint config that ignores src/figma
- Installs genuinely-new Figma deps (latest compatible; skips anything the monorepo already has)
- Creates a Vite 8 compatible config with \`import.meta.dirname\`
- \`dryRun:true\` previews the full plan (port, icon, root component, deps, token conflicts) without writing

### Approach 2: Figma MCP Server (Direct from Figma URL)
If you have the Figma MCP server configured, you can:

1. Use \`get_design_context\` to fetch the design from a Figma URL
2. Generate React code adapted to the monorepo's stack
3. Then use \`import_figma_app\` to scaffold the integration

\`\`\`
1. figma-remote-mcp → get_design_context(fileKey, nodeId)
2. Adapt generated code to use @macro/* libraries
3. macro-mcp → import_figma_app(appName, title, ...)
\`\`\`

## What Gets Created

| File | Purpose |
|------|---------|
| \`apps/<name>/\` | NX React app with Vite |
| \`apps/<name>/src/app/app.tsx\` | Root component with BrowserRouter basename, theme sync |
| \`apps/<name>/vite.config.mts\` | Vite 8 config with base path + @macro/* aliases |
| \`apps/macro-workspace/public/local/<name>.fin.json\` | OpenFin view manifest (local) |
| \`apps/macro-workspace/public/openshift/<name>.fin.json\` | OpenFin view manifest (openshift) |
| Entry in \`local/manifest.fin.json\` | App registration in platform manifest |
| Entry in \`local/settings.json\` | App registration + dock favorite |

## Key Integration Points

### Base Path
Every app gets a base path matching its name: \`/<app-name>/\`.
This ensures clean routing when hosted on the same domain or different ports.

\`\`\`typescript
// vite.config.ts
base: '/risk-dashboard/',

// app.tsx
<BrowserRouter basename="/risk-dashboard">
\`\`\`

### Theme Integration
The importer wires the app to the shared \`@macro/macro-design\` theme system. In
\`main.tsx\` it starts the controller and imports the 3-file CSS chain (relative paths,
imported AFTER the Figma styles so Macro tokens win the cascade):
\`\`\`tsx
import { themeController } from '@macro/macro-design/react';
import './figma/styles/index.css';                                  // figma styles first
import '../../../libs/macro-design/src/lib/css/fonts.css';          // then macro chain
import '../../../libs/macro-design/src/lib/css/macro-etrading.css';
import '../../../libs/macro-design/src/lib/css/macro-design.css';
themeController.start();
\`\`\`
The \`app.tsx\` wrapper calls \`useTheme()\`, which activates dark/light state plus OS and
OpenFin platform theme sync — no manual \`onOpenFinThemeChange\` wiring needed:
\`\`\`tsx
import { useTheme } from '@macro/macro-design/react';
useTheme(); // syncs system + OpenFin; toggle via { isDark, toggle } = useTheme()
\`\`\`

### Transport Integration
Connect to real-time data via \`@macro/transports\`:
\`\`\`typescript
import { useNatsTransport } from '@macro/transports/react';
const { client, connected, connect } = useNatsTransport('my-app');
\`\`\`

### Grid Integration
Use \`@macro/macro-react-grid\` for AG Grid:
\`\`\`typescript
import { MacroReactGrid } from '@macro/macro-react-grid';
<MacroReactGrid ref={gridRef} columns={columns} rowData={data} />
\`\`\`

## Port Allocation

| Range | Purpose |
|-------|---------|
| 4200 | macro-angular |
| 4201 | macro-react |
| 4202 | macro-workspace |
| 4203 | macro-angular-fdc3 |
| 4204+ | New apps (Figma Make imports, LOB apps) |

## Adapting Figma Make Code

Figma Make generates standard React + Tailwind code. The importer keeps the Figma
components intact under \`src/figma/\` and makes them adopt Macro styling automatically:

1. **Tailwind** — the Figma export's own Tailwind setup is preserved; the Macro CSS chain
   is layered on top so utilities like \`bg-primary\` resolve to Macro tokens
2. **Colors** — Macro's \`:root\`/\`.dark\` tokens win the cascade by default, so the Figma
   design renders in Macro cerulean. Pass \`preserveFigmaTheme:true\` to keep the original look
3. **Dark mode** — class-based \`.dark\` selector, toggled by \`themeController\` (system + OpenFin)
4. **Imports** — \`pkg@x.y.z\` version suffixes and \`figma:asset/...\` schemes are rewritten on import
5. **Optional polish** — swap Figma UI primitives for Shadcn/Radix (\`@/components/ui\`), and wire
   \`@macro/transports\` / \`@macro/macro-react-grid\` for real-time data and grids
`;

export function registerFigmaWorkflow(server: McpServer): void {
  server.resource('figma-workflow', 'macro://figma-workflow', { mimeType: 'text/markdown' }, async () => ({
    contents: [
      {
        uri: 'macro://figma-workflow',
        text: FIGMA_WORKFLOW_DOC,
        mimeType: 'text/markdown',
      },
    ],
  }));
}
