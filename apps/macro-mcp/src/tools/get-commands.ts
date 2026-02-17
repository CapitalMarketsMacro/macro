import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const CATEGORIES = ['dev', 'build', 'test', 'publish', 'nx'] as const;

interface Command {
  command: string;
  description: string;
}

const COMMANDS: Record<string, Command[]> = {
  dev: [
    { command: 'npm start', description: 'Start workspace + angular + react concurrently' },
    { command: 'npm run start:workspace', description: 'OpenFin Workspace (:4202)' },
    { command: 'npm run start:angular', description: 'Angular App (:4200)' },
    { command: 'npm run start:react', description: 'React App (:4201)' },
    { command: 'npm run launch', description: 'Launch OpenFin runtime' },
    { command: 'npx nx serve market-data-server', description: 'WebSocket market data server (:3000)' },
  ],
  build: [
    { command: 'npm run build:workspace', description: 'Build workspace' },
    { command: 'npm run build:angular', description: 'Build Angular app' },
    { command: 'npm run build:react', description: 'Build React app' },
    { command: 'npm run build:logger', description: 'Build logger lib (for publishing)' },
    { command: 'npm run build:mcp', description: 'Build macro-mcp server' },
    { command: 'npx nx run-many --target=build --all', description: 'Build everything' },
  ],
  test: [
    { command: 'npx nx test macro-design', description: 'Test design library (jsdom)' },
    { command: 'npx nx test logger', description: 'Test logger library' },
    { command: 'npx nx test macro-angular-grid', description: 'Test Angular grid wrapper' },
    { command: 'npx nx test macro-react-grid', description: 'Test React grid wrapper' },
    { command: 'npx nx test amps', description: 'Test AMPS transport' },
    { command: 'npx nx test solace', description: 'Test Solace transport' },
    { command: 'npx nx run-many --target=test --all', description: 'Test everything' },
    { command: 'npm run e2e:angular', description: 'Angular E2E (headless)' },
    { command: 'npm run e2e:angular:headed', description: 'Angular E2E (with browser UI)' },
    { command: 'npm run e2e:angular:ui', description: 'Angular E2E (Playwright UI mode)' },
    { command: 'npm run e2e:angular:debug', description: 'Angular E2E (debug mode)' },
    { command: 'npm run e2e:react', description: 'React E2E (headless)' },
    { command: 'npm run e2e:react:headed', description: 'React E2E (with browser UI)' },
    { command: 'npm run e2e:workspace', description: 'Workspace E2E (Playwright)' },
    { command: 'npm run e2e:workspace:openfin', description: 'Workspace E2E (OpenFin CDP port 9090)' },
  ],
  publish: [
    { command: 'npm run publish:logger', description: 'Publish @macro/logger to npm' },
    { command: 'npm run publish:logger:dry-run', description: 'Dry-run publish' },
  ],
  nx: [
    { command: 'npx nx graph', description: 'Visualize dependency graph' },
    { command: 'npx nx show project <name> --web', description: 'View project details in browser' },
    { command: 'npx nx affected --target=test', description: 'Test only affected projects' },
    { command: 'npx nx affected --target=build', description: 'Build only affected projects' },
    { command: 'npx nx run-many --target=lint --all', description: 'Lint everything' },
    { command: 'npx nx g @nx/angular:app <name>', description: 'Generate Angular app' },
    { command: 'npx nx g @nx/react:app <name>', description: 'Generate React app' },
    { command: 'npx nx g @nx/js:library <name>', description: 'Generate TypeScript library' },
  ],
};

function formatCommands(category?: string): string {
  if (category && COMMANDS[category]) {
    const cmds = COMMANDS[category];
    let output = `# ${category.charAt(0).toUpperCase() + category.slice(1)} Commands\n\n`;
    output += '| Command | Description |\n|---------|-------------|\n';
    for (const cmd of cmds) {
      output += `| \`${cmd.command}\` | ${cmd.description} |\n`;
    }
    return output;
  }

  let output = '# All Available Commands\n\n';
  for (const [cat, cmds] of Object.entries(COMMANDS)) {
    output += `## ${cat.charAt(0).toUpperCase() + cat.slice(1)}\n\n`;
    output += '| Command | Description |\n|---------|-------------|\n';
    for (const cmd of cmds) {
      output += `| \`${cmd.command}\` | ${cmd.description} |\n`;
    }
    output += '\n';
  }
  return output;
}

export function registerGetCommands(server: McpServer): void {
  server.tool(
    'get_commands',
    'Get all available npm scripts and NX utility commands, optionally filtered by category',
    {
      category: z
        .enum(CATEGORIES)
        .optional()
        .describe('Filter by category: dev, build, test, publish, nx'),
    },
    async ({ category }) => ({
      content: [
        {
          type: 'text' as const,
          text: formatCommands(category),
        },
      ],
    })
  );
}
