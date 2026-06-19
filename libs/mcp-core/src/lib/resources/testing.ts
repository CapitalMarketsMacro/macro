import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const TESTING_DOC = `# Testing Infrastructure

## Unit Tests

| Framework | Used By | Runner |
|-----------|---------|--------|
| **Jest 30** | Angular apps, all \`@macro/*\` libs | \`npx nx test <name>\` |
| **Vitest 4** | React app (\`macro-react\`) | \`npx nx test macro-react\` |

### Unit Test Commands

\`\`\`bash
# Individual library tests
npx nx test macro-design             # Design library (jsdom)
npx nx test logger                   # Logger library
npx nx test macro-angular-grid       # Angular grid wrapper
npx nx test macro-react-grid         # React grid wrapper
npx nx test transports               # Unified AMPS/Solace/NATS transports

# Run all tests
npx nx run-many --target=test --all

# Test only affected projects (based on git changes)
npx nx affected --target=test
\`\`\`

## Test Conventions

- Unit tests live alongside source files (\`*.spec.ts\`)
- Angular tests use **Jasmine** matchers via Jest
- React tests use **Vitest** with jsdom environment
- Mock WebSocket / AMPS / Solace connections in unit tests
`;

export function registerTesting(server: McpServer): void {
  server.resource('testing', 'macro://testing', { mimeType: 'text/markdown' }, async () => ({
    contents: [
      {
        uri: 'macro://testing',
        text: TESTING_DOC,
        mimeType: 'text/markdown',
      },
    ],
  }));
}
