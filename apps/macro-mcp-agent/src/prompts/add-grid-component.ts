import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerAddGridComponentPrompt(server: McpServer): void {
  server.prompt(
    'add-grid-component',
    'Instructions to create an AG Grid component with ColDefs, getRowId, and updateRows$ wiring',
    {
      framework: z.enum(['angular', 'react']).describe('Target framework'),
      componentName: z.string().describe('Component name in PascalCase (e.g., "OrdersGrid")'),
      dataFields: z.string().describe('Comma-separated field names (e.g., "id,symbol,price,quantity,status")'),
    },
    async ({ framework, componentName, dataFields }) => {
      const fields = dataFields.split(',').map((f) => f.trim()).filter(Boolean);
      const firstField = fields[0] || 'id';

      const colDefs = fields
        .map((f) => `  { field: '${f}', headerName: '${f.charAt(0).toUpperCase() + f.slice(1)}' },`)
        .join('\n');

      let text: string;

      if (framework === 'angular') {
        text = `Create an Angular AG Grid component called ${componentName}.

## File: \`${toKebabCase(componentName)}.component.ts\`

\`\`\`typescript
import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { MacroAngularGrid } from '@macro/macro-angular-grid';
import { ColDef, GetRowIdParams } from 'ag-grid-community';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-${toKebabCase(componentName)}',
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

  columns: ColDef[] = [
${colDefs}
  ];

  rowData: unknown[] = [];

  getRowId = (params: GetRowIdParams) => String(params.data.${firstField});

  private subscriptions = new Subscription();

  ngOnInit(): void {
    // TODO: Connect to your data source and wire to grid
    // Example with AMPS:
    //   const { observable } = await ampsClient.subscribeAsObservable('your-topic');
    //   this.subscriptions.add(
    //     observable.subscribe(msg => this.grid.updateRows$.next([msg.data]))
    //   );
    //
    // Example with ConflationSubject:
    //   const conflated = new ConflationSubject<string, YourType>(100);
    //   conflated.subscribeToConflated(({ value }) => {
    //     this.grid.updateRows$.next([value]);
    //   });
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
\`\`\`

## Key Points:
1. \`getRowId\` uses the \`${firstField}\` field — AG Grid needs this for efficient transaction updates
2. Use \`this.grid.updateRows$.next([...rows])\` to push streaming updates
3. Use \`this.grid.addRows$.next([...rows])\` to add new rows
4. Use \`this.grid.deleteRows$.next([...rows])\` to remove rows (only need the id field)
5. The grid auto-handles dark/light theming via \`@macro/macro-design\`
6. Don't forget to add this component to your route in \`app.routes.ts\``;
      } else {
        text = `Create a React AG Grid component called ${componentName}.

## File: \`${toKebabCase(componentName)}.tsx\`

\`\`\`tsx
import { useRef, useEffect } from 'react';
import { MacroReactGrid, MacroReactGridRef } from '@macro/macro-react-grid';
import { ColDef, GetRowIdParams } from 'ag-grid-community';

const columns: ColDef[] = [
${colDefs}
];

export function ${componentName}() {
  const gridRef = useRef<MacroReactGridRef>(null);

  useEffect(() => {
    // TODO: Connect to your data source and wire to grid
    // Example with AMPS:
    //   const client = new AmpsClient('my-app');
    //   await client.connect('ws://localhost:9100/amps/json');
    //   const { observable } = await client.subscribeAsObservable('your-topic');
    //   const sub = observable.subscribe(msg => {
    //     gridRef.current?.updateRows$.next([msg.data]);
    //   });
    //   return () => { sub.unsubscribe(); client.disconnect(); };
    //
    // Example with ConflationSubject:
    //   const conflated = new ConflationSubject<string, YourType>(100);
    //   const sub = conflated.subscribeToConflated(({ value }) => {
    //     gridRef.current?.updateRows$.next([value]);
    //   });
    //   return () => sub.unsubscribe();
  }, []);

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <MacroReactGrid
        ref={gridRef}
        columns={columns}
        rowData={[]}
        getRowId={(params: GetRowIdParams) => String(params.data.${firstField})}
      />
    </div>
  );
}

export default ${componentName};
\`\`\`

## Key Points:
1. \`getRowId\` uses the \`${firstField}\` field — AG Grid needs this for efficient transaction updates
2. Use \`gridRef.current?.updateRows$.next([...rows])\` to push streaming updates
3. Use \`gridRef.current?.addRows$.next([...rows])\` to add new rows
4. Use \`gridRef.current?.deleteRows$.next([...rows])\` to remove rows
5. The grid auto-handles dark/light theming via \`@macro/macro-design\`
6. Don't forget to add this component to your route in \`app.tsx\``;
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
