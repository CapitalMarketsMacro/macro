import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const TRANSPORTS = ['amps', 'solace', 'websocket'] as const;

export function registerAddDataConnectivityPrompt(server: McpServer): void {
  server.prompt(
    'add-data-connectivity',
    'Generate real-time data connectivity code (AMPS, Solace, or WebSocket) with conflation and grid wiring',
    {
      framework: z.enum(['angular', 'react']).describe('Target framework'),
      transport: z.enum(TRANSPORTS).describe('Message transport: amps, solace, or websocket'),
      topic: z.string().describe('Topic or endpoint (e.g., "/topic/fx-rates", "orders/fx/>", "ws://localhost:3000/marketData/fx")'),
      componentName: z.string().describe('Component name in PascalCase (e.g., "FxMarketData")'),
    },
    async ({ framework, transport, topic, componentName }) => {
      const kebab = toKebabCase(componentName);
      let text: string;

      if (framework === 'angular') {
        text = generateAngularDataConnectivity(componentName, kebab, transport, topic);
      } else {
        text = generateReactDataConnectivity(componentName, kebab, transport, topic);
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

function generateAngularDataConnectivity(
  componentName: string,
  kebab: string,
  transport: string,
  topic: string
): string {
  const transportSetup = getTransportSetup(transport, topic, 'angular');

  return `Add real-time data connectivity to Angular component ${componentName} using ${transport}.

## File: \`${kebab}.component.ts\`

\`\`\`typescript
import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { MacroAngularGrid } from '@macro/macro-angular-grid';
import { ColDef, GetRowIdParams } from 'ag-grid-community';
import { ConflationSubject } from '@macro/rxutils';
import { Logger } from '@macro/logger';
import { Subscription } from 'rxjs';
${transportSetup.imports}

@Component({
  selector: 'app-${kebab}',
  standalone: true,
  imports: [MacroAngularGrid],
  template: \\\`
    <lib-macro-angular-grid
      [columns]="columns"
      [rowData]="rowData"
      [getRowId]="getRowId"
    />
  \\\`,
  styles: [':host { display: block; height: 100%; }'],
})
export class ${componentName} implements OnInit, OnDestroy {
  @ViewChild(MacroAngularGrid) grid!: MacroAngularGrid;

  private readonly logger = Logger.getLogger('${componentName}');
  private readonly subscriptions = new Subscription();
  private readonly conflation = new ConflationSubject<string, Record<string, unknown>>(100); // 100ms

  columns: ColDef[] = [
    // TODO: Define your columns
    { field: 'id', headerName: 'ID' },
  ];

  rowData: unknown[] = [];

  getRowId = (params: GetRowIdParams) => String(params.data.id);

  ngOnInit(): void {
    this.connectDataSource();
    this.wireConflationToGrid();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.conflation.complete();
${transportSetup.cleanup}
  }

  private connectDataSource(): void {
${transportSetup.connection}
  }

  private wireConflationToGrid(): void {
    this.conflation.subscribeToConflated(({ value }) => {
      this.grid.updateRows$.next([value]);
    });
  }
}
\`\`\`

${transportSetup.notes}

## Data Flow

\`\`\`
${transport.toUpperCase()} Topic → Subscribe → ConflationSubject (100ms) → grid.updateRows$
\`\`\`

## Key Points:
1. **ConflationSubject** batches high-frequency updates (100ms default) — only latest value per key is emitted
2. \`updateRows$\` uses AG Grid's transaction API for efficient DOM updates
3. Clean up subscriptions and connections in \`ngOnDestroy\`
4. Adjust the conflation interval based on your data rate (lower = more updates, higher = better performance)`;
}

function generateReactDataConnectivity(
  componentName: string,
  kebab: string,
  transport: string,
  topic: string
): string {
  const transportSetup = getTransportSetup(transport, topic, 'react');

  return `Add real-time data connectivity to React component ${componentName} using ${transport}.

## File: \`${kebab}.tsx\`

\`\`\`tsx
import { useEffect, useRef } from 'react';
import { MacroReactGrid, MacroReactGridRef } from '@macro/macro-react-grid';
import { ColDef, GetRowIdParams } from 'ag-grid-community';
import { ConflationSubject } from '@macro/rxutils';
import { Logger } from '@macro/logger';
${transportSetup.imports}

const logger = Logger.getLogger('${componentName}');

const columns: ColDef[] = [
  // TODO: Define your columns
  { field: 'id', headerName: 'ID' },
];

export function ${componentName}() {
  const gridRef = useRef<MacroReactGridRef>(null);

  useEffect(() => {
    const conflation = new ConflationSubject<string, Record<string, unknown>>(100); // 100ms

    // Wire conflation output to grid
    conflation.subscribeToConflated(({ value }) => {
      gridRef.current?.updateRows$.next([value]);
    });

    // Connect data source
${transportSetup.connection}

    // Cleanup
    return () => {
${transportSetup.cleanup}
      conflation.complete();
    };
  }, []);

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <MacroReactGrid
        ref={gridRef}
        columns={columns}
        rowData={[]}
        getRowId={(params: GetRowIdParams) => String(params.data.id)}
      />
    </div>
  );
}

export default ${componentName};
\`\`\`

${transportSetup.notes}

## Data Flow

\`\`\`
${transport.toUpperCase()} Topic → Subscribe → ConflationSubject (100ms) → grid.updateRows$
\`\`\`

## Key Points:
1. **ConflationSubject** batches high-frequency updates (100ms default) — only latest value per key is emitted
2. \`updateRows$\` uses AG Grid's transaction API for efficient DOM updates
3. Clean up subscriptions and connections in the useEffect cleanup function
4. Adjust the conflation interval based on your data rate`;
}

interface TransportSetup {
  imports: string;
  connection: string;
  cleanup: string;
  notes: string;
}

function getTransportSetup(transport: string, topic: string, framework: string): TransportSetup {
  const indent = framework === 'angular' ? '    ' : '    ';
  const conflationRef = framework === 'angular' ? 'this.conflation' : 'conflation';
  const loggerRef = framework === 'angular' ? 'this.logger' : 'logger';
  const subRef = framework === 'angular' ? 'this.subscriptions.add(' : 'const sub = ';
  const subEnd = framework === 'angular' ? ')' : '';

  switch (transport) {
    case 'amps':
      return {
        imports: "import { AmpsClient } from '@macro/amps';",
        connection: `${indent}const client = new AmpsClient('${framework}-client');
${indent}client.connect('ws://localhost:9100/amps/json').then(() => {
${indent}  ${loggerRef}.info('Connected to AMPS');
${indent}  ${subRef}client.subscribeAsObservable('${topic}')
${indent}    .subscribe((msg) => {
${indent}      const data = msg.data as Record<string, unknown>;
${indent}      ${conflationRef}.next({ key: String(data.id), value: data });
${indent}    })${subEnd};
${indent}});
${framework === 'angular' ? `${indent}// Store client reference for cleanup` : ''}`,
        cleanup: framework === 'angular'
          ? '    // client.disconnect();'
          : '      sub?.unsubscribe();\n      // client.disconnect();',
        notes: `## AMPS Notes
- Default AMPS endpoint: \`ws://localhost:9100/amps/json\`
- Supports SOW (State of the World) queries: \`client.sow(callback, topic, filter)\`
- Supports filter expressions: \`client.subscribeAsObservable(topic, "/field='value'")\`
- See \`get_library_api\` tool with \`library: "amps"\` for full API reference`,
      };

    case 'solace':
      return {
        imports: "import { SolaceClient } from '@macro/solace';",
        connection: `${indent}const client = new SolaceClient('${framework}-client');
${indent}client.connect({
${indent}  hostUrl: 'ws://localhost:8008',
${indent}  vpnName: 'default',
${indent}  userName: 'default',
${indent}  password: 'default',
${indent}}).then(() => {
${indent}  ${loggerRef}.info('Connected to Solace');
${indent}  ${subRef}client.subscribeAsObservable('${topic}')
${indent}    .subscribe((msg) => {
${indent}      const data = msg.data as Record<string, unknown>;
${indent}      ${conflationRef}.next({ key: String(data.id), value: data });
${indent}    })${subEnd};
${indent}});`,
        cleanup: framework === 'angular'
          ? '    // client.disconnect();'
          : '      sub?.unsubscribe();\n      // client.disconnect();',
        notes: `## Solace Notes
- Supports wildcard topics: \`*\` (single level), \`>\` (any suffix)
- Example: \`orders/fx/*\` matches \`orders/fx/EURUSD\`, \`orders/fx/GBPUSD\`
- Example: \`orders/>\` matches all order topics at any depth
- Supports publish with properties: correlationId, replyTo, userProperties
- See \`get_library_api\` tool with \`library: "solace"\` for full API reference`,
      };

    case 'websocket':
    default:
      return {
        imports: '',
        connection: `${indent}const ws = new WebSocket('${topic}');
${indent}ws.onopen = () => {
${indent}  ws.send(JSON.stringify({ type: 'subscribe' }));
${indent}  ${loggerRef}.info('Connected to WebSocket');
${indent}};
${indent}ws.onmessage = (event) => {
${indent}  const msg = JSON.parse(event.data);
${indent}  if (msg.type === 'marketData') {
${indent}    const items = msg.data.pairs || msg.data.securities || [msg.data];
${indent}    for (const item of items) {
${indent}      ${conflationRef}.next({ key: String(item.id || item.symbol), value: item });
${indent}    }
${indent}  }
${indent}};`,
        cleanup: framework === 'angular'
          ? '    // ws.close();'
          : '      ws.close();',
        notes: `## WebSocket Notes
- Local market data server: \`ws://localhost:3000/marketData/fx\` (FX) or \`ws://localhost:3000/marketData/tsy\` (Treasury)
- Run the server: \`npx nx serve market-data-server\`
- Message types: \`connected\`, \`marketData\`, \`subscribe\`, \`subscribed\`
- See the \`market-data-server\` resource for full protocol documentation`,
      };
  }
}

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}
