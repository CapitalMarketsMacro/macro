import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

function generateOpenFinRegistration(
  appId: string,
  title: string,
  description: string,
  port: number,
  route: string,
  framework: string,
  tags: string[]
): string {
  const manifestUrl = `http://localhost:4202/${appId}.fin.json`;
  const appUrl = route ? `http://localhost:${port}/${route}` : `http://localhost:${port}`;
  const allTags = ['view', framework, ...tags];

  const viewManifest = JSON.stringify(
    {
      url: appUrl,
      fdc3InteropApi: '2.0',
      interop: {
        currentContextGroup: 'green',
      },
    },
    null,
    2
  );

  const appEntry = JSON.stringify(
    {
      appId,
      name: appId,
      title,
      description,
      manifest: manifestUrl,
      manifestType: 'view',
      icons: [{ src: `http://localhost:${port}/favicon.ico` }],
      contactEmail: 'team@example.com',
      supportEmail: 'support@example.com',
      publisher: 'Macro Desktop',
      intents: [],
      images: [],
      tags: allTags,
    },
    null,
    2
  );

  return `# Register OpenFin App: ${title}

## Step 1: Create view manifest

Create file \`apps/macro-workspace/public/${appId}.fin.json\`:

\`\`\`json
${viewManifest}
\`\`\`

## Step 2: Register in platform manifest

Add this entry to the \`customSettings.apps\` array in \`apps/macro-workspace/public/manifest.fin.json\`:

\`\`\`json
${appEntry}
\`\`\`

## Step 3: Verify registration

1. Restart the workspace: \`npm run start:workspace\`
2. Open Home search (Ctrl+Space) and search for "${title}"
3. The app should appear in Home, Dock dropdown, and Store

## FDC3 Interop

The view manifest enables FDC3 2.0 interop with context group "green" by default.
Your app can now:
- **Broadcast** FDC3 contexts to other apps
- **Listen** for FDC3 contexts from other apps
- **Join** color-coded context groups

### Adding FDC3 to your ${framework === 'angular' ? 'Angular' : 'React'} component:

${
  framework === 'angular'
    ? `\`\`\`typescript
import { ContextService } from '@macro/openfin';

// Inject in your component
private contextService = inject(ContextService);

// Broadcast
this.contextService.broadcast({
  type: 'fdc3.instrument',
  name: 'EURUSD',
  id: { ticker: 'EURUSD' }
});

// Listen
this.contextService.registerContextListener('fdc3.instrument');
this.contextService.context$.subscribe((ctx) => {
  console.log('Received context:', ctx);
});
\`\`\``
    : `\`\`\`typescript
import { BaseContextService } from '@macro/openfin';

const contextService = new BaseContextService();

// Broadcast
contextService.broadcast({
  type: 'fdc3.instrument',
  name: 'EURUSD',
  id: { ticker: 'EURUSD' }
});

// Listen
contextService.registerContextListener('fdc3.instrument');
contextService.context$.subscribe((ctx) => {
  console.log('Received context:', ctx);
});
\`\`\``
}

## Existing Registered Apps

The workspace currently registers 8 apps:

| App ID | Framework | Port |
|--------|-----------|------|
| macro-workspace-view1 | Angular | 4202 |
| macro-workspace-view2 | Angular | 4202 |
| macro-angular-view | Angular | 4200 |
| macro-angular-fx-market-data | Angular | 4200 |
| macro-angular-treasury-microstructure | Angular | 4200 |
| macro-react-view | React | 4201 |
| macro-react-treasury-market-data | React | 4201 |
| macro-react-commodities-dashboard | React | 4201 |
`;
}

export function registerRegisterOpenfinApp(server: McpServer): void {
  server.tool(
    'register_openfin_app',
    'Generate OpenFin manifest entries to register an app in the Macro workspace (Home, Dock, Store)',
    {
      appId: z.string().describe('Unique app ID in kebab-case (e.g., "my-lob-fx-blotter")'),
      title: z.string().describe('Display title for the app (e.g., "FX Blotter")'),
      description: z.string().describe('Description shown in Home search and Store'),
      port: z.number().describe('Dev server port of the app (e.g., 4200, 4201, 4203)'),
      route: z.string().optional().describe('App route path without leading slash (e.g., "fx-blotter"). Empty for root URL'),
      framework: z.enum(['angular', 'react']).describe('Framework of the app'),
      tags: z
        .array(z.string())
        .optional()
        .describe('Additional tags for categorization (e.g., ["fx", "trading"])'),
    },
    async ({ appId, title, description, port, route, framework, tags }) => ({
      content: [
        {
          type: 'text' as const,
          text: generateOpenFinRegistration(appId, title, description, port, route ?? '', framework, tags ?? []),
        },
      ],
    })
  );
}
