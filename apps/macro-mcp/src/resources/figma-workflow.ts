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
\`\`\`

The tool handles everything automatically:
- Extracts .zip files (handles nested root folders common in Figma Make exports)
- Auto-detects title/description from Figma's package.json
- Auto-detects next available port by scanning existing apps
- Detects Tailwind CSS and configures PostCSS
- Wires OpenFin theme sync (responds to workspace dark/light toggle)
- Installs missing Figma dependencies into the monorepo
- Creates Vite 8 compatible config with \`import.meta.dirname\`

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
Import \`@macro/macro-design\` CSS for dark/light theme support:
\`\`\`typescript
import '@macro/macro-design/css/fonts.css';
import '@macro/macro-design/css/macro-design.css';
\`\`\`

Use theme sync for OpenFin:
\`\`\`typescript
import { onOpenFinThemeChange } from '@macro/openfin/theme-sync';
useEffect(() => onOpenFinThemeChange((dark) => setIsDark(dark)), []);
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

Figma Make generates standard React + Tailwind code. To adapt for this monorepo:

1. **Tailwind** — already configured via \`@macro/macro-design\`, just import the CSS
2. **Component library** — replace any Figma-generated UI primitives with Shadcn/Radix from \`@/components/ui\`
3. **Colors** — use CSS variables from \`macro-design.css\` (\`var(--primary)\`, \`var(--background)\`, etc.)
4. **Dark mode** — use class-based \`.dark\` selector (already configured)
5. **Data** — wire up \`@macro/transports\` for real-time data or \`@macro/macro-react-grid\` for grid views
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
