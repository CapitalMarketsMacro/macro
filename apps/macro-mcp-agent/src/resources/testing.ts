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
npx nx test amps                     # AMPS transport
npx nx test solace                   # Solace transport

# Run all tests
npx nx run-many --target=test --all

# Test only affected projects (based on git changes)
npx nx affected --target=test
\`\`\`

## E2E Tests (Playwright)

All E2E tests use **Playwright 1.36**.

### Angular E2E (port 4200)

\`\`\`bash
npm run e2e:angular                  # Headless
npm run e2e:angular:headed           # With browser UI
npm run e2e:angular:ui               # Playwright UI mode (interactive)
npm run e2e:angular:debug            # Debug mode (step-through)
\`\`\`

### React E2E (port 4201)

\`\`\`bash
npm run e2e:react                    # Headless
npm run e2e:react:headed             # With browser UI
\`\`\`

### OpenFin Workspace E2E (port 4202)

Uses **Chrome DevTools Protocol (CDP)** on port 9090 to connect to the OpenFin runtime.

\`\`\`bash
npm run e2e:workspace                # Standard Playwright E2E
npm run e2e:workspace:openfin        # OpenFin-specific project (CDP port 9090)
\`\`\`

## E2E Test Projects

| Project | Directory | Target App |
|---------|-----------|------------|
| \`macro-angular-e2e\` | \`apps/macro-angular-e2e/\` | Angular app on :4200 |
| \`macro-react-e2e\` | \`apps/macro-react-e2e/\` | React app on :4201 |
| \`macro-workspace-e2e\` | \`apps/macro-workspace-e2e/\` | OpenFin workspace on :4202 |

## Browser-Specific E2E

Playwright supports running tests against specific browsers:

\`\`\`bash
# Run in specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
\`\`\`

## Test Conventions

- Unit tests live alongside source files (\`*.spec.ts\`)
- E2E tests live in dedicated \`*-e2e\` app directories
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
