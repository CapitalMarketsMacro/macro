import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

function findWorkspaceRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.name === '@macro/source') return dir;
      } catch { /* skip */ }
    }
    dir = path.dirname(dir);
  }
  throw new Error('Could not find monorepo root');
}

const CATEGORIES: Record<string, string[]> = {
  'Financial & Trading': [
    'candlestick_chart', 'show_chart', 'bar_chart', 'stacked_line_chart',
    'trending_up', 'trending_down', 'trending_flat',
    'account_balance', 'payments', 'currency_exchange', 'attach_money',
    'savings', 'credit_card', 'price_check', 'request_quote',
    'receipt_long', 'paid', 'point_of_sale', 'account_balance_wallet',
  ],
  'Analytics & Dashboards': [
    'dashboard', 'analytics', 'assessment', 'insights',
    'monitoring', 'pie_chart', 'query_stats', 'data_usage',
    'leaderboard', 'equalizer', 'ssid_chart', 'area_chart',
  ],
  'Data & Grids': [
    'table_chart', 'grid_view', 'view_list', 'view_module',
    'dataset', 'storage', 'database', 'cloud_sync',
    'table_rows', 'view_column', 'view_agenda', 'calendar_view_month',
  ],
  'Risk & Compliance': [
    'security', 'shield', 'verified_user', 'gpp_good',
    'policy', 'admin_panel_settings', 'lock', 'health_and_safety',
  ],
  'Execution & Orders': [
    'swap_horiz', 'swap_vert', 'sync_alt', 'compare_arrows',
    'send', 'call_made', 'call_received', 'transit_enterexit',
    'bolt', 'flash_on', 'speed', 'timer',
  ],
  'Communication': [
    'notifications', 'mail', 'chat', 'forum',
    'campaign', 'announcement', 'flag', 'priority_high',
  ],
  'Documents & Reports': [
    'article', 'description', 'assignment', 'summarize',
    'text_snippet', 'note', 'receipt', 'inventory',
  ],
  'Business': [
    'business', 'corporate_fare', 'domain', 'apartment',
    'groups', 'person', 'manage_accounts', 'badge',
  ],
  'General': [
    'settings', 'tune', 'build', 'engineering',
    'rocket_launch', 'star', 'bookmark', 'label',
    'home', 'apps', 'widgets', 'extension',
    'explore', 'travel_explore', 'public', 'language',
    'dark_mode', 'light_mode', 'palette', 'brush',
  ],
};

export function registerListIcons(server: McpServer): void {
  server.tool(
    'list_icons',
    'List available Material Design icons for OpenFin apps. Icons are used in Home search, Store catalog, and Dock. Filter by category or search by keyword.',
    {
      category: z.string().optional().describe('Filter by category: "financial", "analytics", "data", "risk", "execution", "communication", "documents", "business", "general"'),
      search: z.string().optional().describe('Search icons by keyword (e.g., "chart", "trade", "dashboard")'),
    },
    async ({ category, search }) => {
      const root = findWorkspaceRoot();
      const indexPath = path.join(root, 'apps/macro-workspace/public/icons/material/index.json');
      let available: string[] = [];
      if (fs.existsSync(indexPath)) {
        try { available = JSON.parse(fs.readFileSync(indexPath, 'utf8')).icons ?? []; } catch { /* skip */ }
      }

      let output = `# Material Icons (${available.length} available)\n\n`;
      output += `Use these icon names with the \`import_figma_app\` tool's \`icon\` parameter.\n`;
      output += `Icons are served at: http://localhost:4202/icons/material/{name}.svg\n\n`;

      const lowerSearch = search?.toLowerCase();
      const lowerCategory = category?.toLowerCase();

      for (const [cat, icons] of Object.entries(CATEGORIES)) {
        if (lowerCategory && !cat.toLowerCase().includes(lowerCategory)) continue;

        let filtered = icons.filter(i => available.includes(i));
        if (lowerSearch) {
          filtered = filtered.filter(i => i.includes(lowerSearch));
        }
        if (filtered.length === 0) continue;

        output += `## ${cat}\n`;
        output += filtered.map(i => `  - ${i}`).join('\n');
        output += '\n\n';
      }

      return { content: [{ type: 'text' as const, text: output }] };
    }
  );
}
