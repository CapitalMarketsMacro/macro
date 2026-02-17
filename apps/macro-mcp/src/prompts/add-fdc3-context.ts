import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerAddFdc3ContextPrompt(server: McpServer): void {
  server.prompt(
    'add-fdc3-context',
    'Generate FDC3 context broadcasting and listening code for cross-app communication',
    {
      framework: z.enum(['angular', 'react']).describe('Target framework'),
      contextType: z.string().describe('FDC3 context type (e.g., "fdc3.instrument", "fdc3.position", "fdc3.order")'),
      componentName: z.string().describe('Component name in PascalCase (e.g., "FxBlotter")'),
    },
    async ({ framework, contextType, componentName }) => {
      const kebab = toKebabCase(componentName);
      let text: string;

      if (framework === 'angular') {
        text = `Add FDC3 context sharing to the Angular component ${componentName}.

## Prerequisites

Your app must be registered in OpenFin with FDC3 2.0 interop enabled.
The view manifest (\`.fin.json\`) must include:
\`\`\`json
{
  "fdc3InteropApi": "2.0",
  "interop": { "currentContextGroup": "green" }
}
\`\`\`

## File: \`${kebab}.component.ts\`

\`\`\`typescript
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { ContextService, ChannelService } from '@macro/openfin';
import { Logger } from '@macro/logger';

@Component({
  selector: 'app-${kebab}',
  standalone: true,
  template: \\\`<!-- your template -->\\\`,
})
export class ${componentName} implements OnInit, OnDestroy {
  private readonly contextService = inject(ContextService);
  private readonly channelService = inject(ChannelService);
  private readonly logger = Logger.getLogger('${componentName}');
  private readonly destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.setupContextListener();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Broadcast a context to all listening apps on the same context group.
   * Call this when the user selects a row, clicks an instrument, etc.
   */
  broadcastContext(data: { name: string; ticker: string }): void {
    this.contextService.broadcast({
      type: '${contextType}',
      name: data.name,
      id: { ticker: data.ticker },
    });
    this.logger.info('Broadcast context', { type: '${contextType}', ticker: data.ticker });
  }

  /**
   * Listen for contexts broadcast by other apps.
   */
  private setupContextListener(): void {
    this.contextService.registerContextListener('${contextType}');
    this.contextService.context$
      .pipe(takeUntil(this.destroy$))
      .subscribe((ctx) => {
        this.logger.info('Received context', ctx);
        const ticker = ctx.id?.ticker;
        if (ticker) {
          this.handleIncomingContext(ticker);
        }
      });
  }

  /**
   * Handle incoming FDC3 context — e.g., highlight a row, filter data.
   */
  private handleIncomingContext(ticker: string): void {
    // TODO: Implement your context handling logic
    // Example: highlight the row matching this ticker in your grid
    this.logger.debug('Handling incoming ticker', { ticker });
  }
}
\`\`\`

## Optional: Named App Channels

For private communication between specific apps (instead of the shared context group):

\`\`\`typescript
// Broadcast on a named channel
this.channelService.broadcast('MY-PRIVATE-CHANNEL', {
  type: '${contextType}',
  name: 'EURUSD',
  id: { ticker: 'EURUSD' },
});

// Listen on a named channel
this.channelService.registerChannelListener('MY-PRIVATE-CHANNEL', '${contextType}');
this.channelService.channel$
  .pipe(takeUntil(this.destroy$))
  .subscribe((ctx) => {
    console.log('Channel context:', ctx);
  });
\`\`\`

## Key Points:
1. \`ContextService\` uses the **shared FDC3 context group** (green by default)
2. \`ChannelService\` uses **named app channels** for private communication
3. Both are Angular injectables from \`@macro/openfin\`
4. Always unsubscribe via \`takeUntil(this.destroy$)\`
5. Common FDC3 context types: \`fdc3.instrument\`, \`fdc3.position\`, \`fdc3.order\`, \`fdc3.contact\``;
      } else {
        text = `Add FDC3 context sharing to the React component ${componentName}.

## Prerequisites

Your app must be registered in OpenFin with FDC3 2.0 interop enabled.
The view manifest (\`.fin.json\`) must include:
\`\`\`json
{
  "fdc3InteropApi": "2.0",
  "interop": { "currentContextGroup": "green" }
}
\`\`\`

## File: \`${kebab}.tsx\`

\`\`\`tsx
import { useEffect, useRef, useCallback } from 'react';
import { BaseContextService, BaseChannelService } from '@macro/openfin';
import { Logger } from '@macro/logger';

const logger = Logger.getLogger('${componentName}');

export function ${componentName}() {
  const contextServiceRef = useRef<BaseContextService | null>(null);

  useEffect(() => {
    const contextService = new BaseContextService();
    contextServiceRef.current = contextService;

    // Listen for contexts broadcast by other apps
    contextService.registerContextListener('${contextType}');
    const sub = contextService.context$.subscribe((ctx) => {
      logger.info('Received context', ctx);
      const ticker = ctx.id?.ticker;
      if (ticker) {
        handleIncomingContext(ticker);
      }
    });

    return () => {
      sub.unsubscribe();
    };
  }, []);

  /**
   * Broadcast a context to all listening apps on the same context group.
   */
  const broadcastContext = useCallback((data: { name: string; ticker: string }) => {
    contextServiceRef.current?.broadcast({
      type: '${contextType}',
      name: data.name,
      id: { ticker: data.ticker },
    });
    logger.info('Broadcast context', { type: '${contextType}', ticker: data.ticker });
  }, []);

  /**
   * Handle incoming FDC3 context — e.g., highlight a row, filter data.
   */
  function handleIncomingContext(ticker: string) {
    // TODO: Implement your context handling logic
    logger.debug('Handling incoming ticker', { ticker });
  }

  return (
    <div>
      {/* Your component JSX */}
      {/* Call broadcastContext({ name: '...', ticker: '...' }) on user interaction */}
    </div>
  );
}

export default ${componentName};
\`\`\`

## Optional: Named App Channels

\`\`\`typescript
const channelService = new BaseChannelService();

// Broadcast on a named channel
channelService.broadcast('MY-PRIVATE-CHANNEL', {
  type: '${contextType}',
  name: 'EURUSD',
  id: { ticker: 'EURUSD' },
});

// Listen on a named channel
channelService.registerChannelListener('MY-PRIVATE-CHANNEL', '${contextType}');
channelService.channel$.subscribe((ctx) => {
  console.log('Channel context:', ctx);
});
\`\`\`

## Key Points:
1. React uses \`BaseContextService\` / \`BaseChannelService\` (framework-agnostic base classes from \`@macro/openfin\`)
2. Angular uses \`ContextService\` / \`ChannelService\` (Angular injectable wrappers)
3. Clean up subscriptions in the useEffect cleanup function
4. Common FDC3 context types: \`fdc3.instrument\`, \`fdc3.position\`, \`fdc3.order\`, \`fdc3.contact\``;
      }

      return {
        messages: [
          {
            role: 'user' as const,
            content: { type: 'text' as const, text },
          },
        ],
      };
    }
  );
}

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}
