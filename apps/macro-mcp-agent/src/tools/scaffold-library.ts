import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const LIB_TYPES = ['ts', 'angular', 'react'] as const;

function generateLibraryScaffold(libName: string, description: string, type: string): string {
  const importPath = `@macro/${libName}`;
  const libDir = `libs/${libName}`;

  let nxCommand: string;
  switch (type) {
    case 'angular':
      nxCommand = `npx nx generate @nx/angular:library ${libName} --directory=${libDir}`;
      break;
    case 'react':
      nxCommand = `npx nx generate @nx/react:library ${libName} --directory=${libDir}`;
      break;
    default:
      nxCommand = `npx nx generate @nx/js:library ${libName} --directory=${libDir} --bundler=tsc`;
      break;
  }

  let output = `# Scaffold Shared Library: ${libName}

## Description
${description}

## Step 1: Generate the library

\`\`\`bash
${nxCommand}
\`\`\`

## Step 2: Add path alias to \`tsconfig.base.json\`

Add this entry to the \`compilerOptions.paths\` object:

\`\`\`json
"${importPath}": ["${libDir}/src/index.ts"]
\`\`\`

## Step 3: Create \`${libDir}/src/index.ts\`

\`\`\`typescript
// ${description}
// Public API — export everything consumers need
export {};
\`\`\`

## Step 4: Import in your app

\`\`\`typescript
import { /* your exports */ } from '${importPath}';
\`\`\`
`;

  if (type === 'angular') {
    output += `
## Angular-Specific Notes

- The library will be generated as a standalone Angular library
- Export components, directives, pipes, and services from \`index.ts\`
- Use \`inject()\` function instead of constructor injection
- Follow the same patterns as \`@macro/macro-angular-grid\`

\`\`\`typescript
// Example Angular service export
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class MyService {
  // ...
}
\`\`\`
`;
  }

  if (type === 'react') {
    output += `
## React-Specific Notes

- The library will use Vite for building
- Export React components and hooks from \`index.ts\`
- Use \`forwardRef\` for components that need imperative API access
- Follow the same patterns as \`@macro/macro-react-grid\`

\`\`\`tsx
// Example React component export
import { forwardRef, useImperativeHandle } from 'react';

export interface MyComponentRef {
  doSomething(): void;
}

export const MyComponent = forwardRef<MyComponentRef, Props>((props, ref) => {
  useImperativeHandle(ref, () => ({
    doSomething() { /* ... */ },
  }));
  return <div>{/* ... */}</div>;
});
\`\`\`
`;
  }

  if (type === 'ts') {
    output += `
## TypeScript Library Notes

- Framework-agnostic: works with both Angular and React
- Uses \`tsc\` bundler (simple and reliable)
- Follow the same patterns as \`@macro/logger\`, \`@macro/amps\`, \`@macro/solace\`
- Keep dependencies minimal — shared libs should be lightweight

\`\`\`typescript
// Example class export
export class MyClient {
  constructor(private name: string) {}
  // ...
}
\`\`\`
`;
  }

  return output;
}

export function registerScaffoldLibrary(server: McpServer): void {
  server.tool(
    'scaffold_library',
    'Generate boilerplate code and NX commands for a new shared @macro/* library in the monorepo',
    {
      libName: z.string().describe('Library name in kebab-case (e.g., "my-lob-utils")'),
      description: z.string().describe('Short description of the library'),
      type: z
        .enum(LIB_TYPES)
        .optional()
        .describe('Library type: ts (framework-agnostic, default), angular, or react'),
    },
    async ({ libName, description, type }) => ({
      content: [
        {
          type: 'text' as const,
          text: generateLibraryScaffold(libName, description, type ?? 'ts'),
        },
      ],
    })
  );
}
