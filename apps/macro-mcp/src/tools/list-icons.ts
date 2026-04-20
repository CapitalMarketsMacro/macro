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

/**
 * Capital Markets icon categories. Each icon name must exist in
 * apps/macro-workspace/public/icons/capital-markets/{dark,light}/.
 */
const CATEGORIES: Record<string, string[]> = {
  'Financial & Trading': [
    'candlestick_chart', 'show_chart', 'bar_chart', 'stacked_line_chart',
    'trending_up', 'trending_down', 'trending_flat',
    'account_balance', 'account_balance_wallet', 'payments',
    'currency_exchange', 'savings', 'price_change', 'request_quote',
    'receipt_long', 'handshake', 'real_estate_agent',
  ],
  'Analytics & Dashboards': [
    'dashboard', 'analytics', 'monitoring', 'monitor_heart',
    'pie_chart', 'donut_large', 'leaderboard', 'area_chart',
    'bubble_chart', 'scatter_plot', 'waterfall_chart', 'ssid_chart',
    'insert_chart', 'query_stats', 'auto_graph', 'timeline',
    'data_thresholding',
  ],
  'Data & Grids': [
    'grid_view', 'view_column', 'splitscreen', 'filter_list',
    'sort', 'manage_search', 'search', 'folder_open',
  ],
  'Risk & Compliance': [
    'shield', 'verified_user', 'policy', 'rule', 'gavel',
    'health_and_safety', 'gpp_maybe', 'privacy_tip',
    'assured_workload', 'balance', 'fact_check', 'approval',
    'block', 'warning', 'error', 'crisis_alert',
  ],
  'Execution & Orders': [
    'swap_horiz', 'swap_vert', 'swap_calls', 'compare_arrows',
    'bolt', 'speed', 'timer', 'schedule_send',
    'update', 'refresh', 'sync_alt', 'cloud_sync',
    'published_with_changes', 'pending_actions',
    'priority_high', 'low_priority', 'send',
  ],
  'Communication & Events': [
    'notifications', 'mail', 'mark_email_read', 'chat', 'comment',
    'rss_feed', 'stream', 'event_available', 'event_repeat',
  ],
  'Documents & Reports': [
    'description', 'assignment', 'assignment_late',
    'assignment_turned_in', 'assignment_return', 'summarize',
    'note_add', 'edit_note', 'grading', 'checklist', 'checklist_rtl',
    'playlist_add_check', 'report', 'difference', 'content_paste_search',
  ],
  'Business & Accounts': [
    'person', 'group', 'inventory', 'inventory_2', 'warehouse',
    'local_shipping', 'confirmation_number', 'storefront',
  ],
  'Network & Infrastructure': [
    'hub', 'lan', 'cable', 'wifi', 'wifi_off', 'cell_tower',
    'electrical_services', 'sensors', 'route', 'developer_board',
    'memory', 'thermostat', 'track_changes',
  ],
  'General & UI': [
    'settings', 'tune', 'calculate', 'functions', 'exposure',
    'auto_mode', 'smart_toy', 'history', 'bookmark', 'label',
    'tab', 'picture_in_picture', 'fullscreen', 'open_in_new',
    'download', 'upload', 'print', 'attach_file', 'help',
    'check_circle', 'cancel', 'task_alt', 'moving',
  ],
};

export function registerListIcons(server: McpServer): void {
  server.tool(
    'list_icons',
    'List available Capital Markets icons for OpenFin apps. Icons have dark + light variants and are used in Home search, Store catalog, and Dock. Filter by category or search by keyword.',
    {
      category: z.string().optional().describe('Filter by category: "financial", "analytics", "data", "risk", "execution", "communication", "documents", "business", "network", "general"'),
      search: z.string().optional().describe('Search icons by keyword (e.g., "chart", "trade", "dashboard")'),
    },
    async ({ category, search }) => {
      const root = findWorkspaceRoot();
      const indexPath = path.join(root, 'apps/macro-workspace/public/icons/capital-markets/index.json');
      let available: string[] = [];
      if (fs.existsSync(indexPath)) {
        try { available = JSON.parse(fs.readFileSync(indexPath, 'utf8')).icons ?? []; } catch { /* skip */ }
      }
      // Fallback: scan dark folder
      if (available.length === 0) {
        const darkDir = path.join(root, 'apps/macro-workspace/public/icons/capital-markets/dark');
        if (fs.existsSync(darkDir)) {
          available = fs.readdirSync(darkDir).filter(f => f.endsWith('.svg')).map(f => f.replace('.svg', '')).sort();
        }
      }

      let output = `# Capital Markets Icons (${available.length} available)\n\n`;
      output += `Use these icon names with the \`import_figma_app\` tool's \`icon\` parameter.\n`;
      output += `Each icon has dark + light variants served at:\n`;
      output += `  - http://localhost:4202/icons/capital-markets/dark/{name}.svg\n`;
      output += `  - http://localhost:4202/icons/capital-markets/light/{name}.svg\n\n`;

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
