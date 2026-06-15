import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  findWorkspaceRoot,
  getWorkspacePort,
  listAvailableIcons,
  listRegisteredApps,
  registerWorkspaceApp,
} from './openfin-registration';

function fdc3Snippet(framework: string): string {
  return framework === 'angular'
    ? `\`\`\`typescript
import { ContextService } from '@macro/openfin';

private contextService = inject(ContextService);

// Broadcast
this.contextService.broadcast({ type: 'fdc3.instrument', name: 'EURUSD', id: { ticker: 'EURUSD' } });

// Listen
this.contextService.registerContextListener('fdc3.instrument');
this.contextService.context$.subscribe((ctx) => console.log('Received context:', ctx));
\`\`\``
    : `\`\`\`typescript
import { BaseContextService } from '@macro/openfin';

const contextService = new BaseContextService();

// Broadcast
contextService.broadcast({ type: 'fdc3.instrument', name: 'EURUSD', id: { ticker: 'EURUSD' } });

// Listen
contextService.registerContextListener('fdc3.instrument');
contextService.context$.subscribe((ctx) => console.log('Received context:', ctx));
\`\`\``;
}

function doRegister(
  appId: string,
  title: string,
  description: string,
  port: number,
  route: string,
  framework: string,
  icon: string | undefined,
  tags: string[],
): { success: boolean; text: string } {
  let root: string;
  try {
    root = findWorkspaceRoot();
  } catch (e: any) {
    return { success: false, text: `ERROR: ${e?.message ?? e}` };
  }

  if (!/^[a-z][a-z0-9-]*$/.test(appId)) {
    return { success: false, text: `ERROR: Invalid appId "${appId}". Use kebab-case (lowercase letters, numbers, hyphens, starting with a letter).` };
  }

  // Resolve the icon against the Capital Markets set (dark/light variants required).
  const availableIcons = listAvailableIcons(root);
  let iconName = icon ?? 'dashboard';
  let iconNote = '';
  if (icon && !availableIcons.includes(icon)) {
    iconNote = ` (warning: "${icon}" not in the ${availableIcons.length}-icon Capital Markets set — using as-is)`;
  } else if (!icon) {
    iconName = availableIcons.includes('dashboard') ? 'dashboard' : (availableIcons[0] ?? 'dashboard');
    iconNote = ` (default — pass an icon name from icons/capital-markets/index.json to override)`;
  }

  const workspacePort = getWorkspacePort(root);
  const urlPath = route ? `/${route.replace(/^\/+/, '')}` : '';

  let steps: string[];
  try {
    steps = registerWorkspaceApp(root, {
      appId, title, description,
      urlPath, appPort: port, workspacePort,
      iconName,
      tags: ['view', framework, ...tags],
    });
  } catch (e: any) {
    return { success: false, text: `ERROR: ${e?.message ?? e}` };
  }

  const registered = listRegisteredApps(root);
  const appUrl = `http://localhost:${port}${urlPath}`;
  const text = `Registered "${title}" (appId: ${appId}) in the Macro OpenFin workspace.

  App URL:       ${appUrl}
  Manifest URL:  http://localhost:${workspacePort}/local/${appId}.fin.json
  Icon:          ${iconName}${iconNote}
  FDC3:          2.0, context group "green"

Completed steps:
${steps.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}

The workspace now registers ${registered.length} app(s). Restart it (\`npm run start:workspace\`)
then \`npm run launch\` — the app appears in Home search, Store, and the Dock.

## Adding FDC3 to your ${framework === 'angular' ? 'Angular' : 'React'} component

${fdc3Snippet(framework)}`;

  return { success: true, text };
}

export function registerRegisterOpenfinApp(server: McpServer): void {
  server.tool(
    'register_openfin_app',
    'Register an existing app in the Macro OpenFin workspace. Writes the local + openshift view manifests, adds the app to both manifest.fin.json files and settings.json, and adds a Dock favorite — so it appears in Home, Store, and Dock. Idempotent.',
    {
      appId: z.string().describe('Unique app ID in kebab-case (e.g., "fx-blotter"). Used as the view-manifest filename and OpenFin app ID.'),
      title: z.string().describe('Display title for the app (e.g., "FX Blotter")'),
      description: z.string().describe('Description shown in Home search and Store'),
      port: z.number().describe('Dev server port of the app (e.g., 4200, 4201, 4204)'),
      route: z.string().optional().describe('Path appended to the app URL without leading slash (e.g., "fx-blotter"). Omit for the app root.'),
      framework: z.enum(['angular', 'react']).describe('Framework of the app'),
      icon: z.string().optional().describe('Capital Markets icon name (e.g., "dashboard", "grid_view", "candlestick_chart"). Defaults to "dashboard". See apps/macro-workspace/public/icons/capital-markets/index.json.'),
      tags: z.array(z.string()).optional().describe('Additional tags for categorization (e.g., ["fx", "trading"])'),
    },
    async ({ appId, title, description, port, route, framework, icon, tags }) => {
      const result = doRegister(appId, title, description, port, route ?? '', framework, icon, tags ?? []);
      return { content: [{ type: 'text' as const, text: result.text }] };
    }
  );
}
