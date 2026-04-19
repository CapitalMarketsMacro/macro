#!/usr/bin/env node
/**
 * Downloads curated Material Symbols Outlined icons as SVGs for use in OpenFin manifests.
 * Icons are styled with currentColor fill for theme adaptability.
 *
 * Usage: node apps/macro-workspace/scripts/download-material-icons.mjs
 *
 * Source: Google Fonts Material Symbols (Apache 2.0 license)
 * https://fonts.google.com/icons
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'icons', 'material');
const BASE = 'https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined';
const SIZE = '48px';

// Curated icon set for capital markets desktop applications
const ICONS = [
  // Financial & Trading
  'candlestick_chart', 'show_chart', 'bar_chart', 'stacked_line_chart',
  'trending_up', 'trending_down', 'trending_flat',
  'account_balance', 'payments', 'currency_exchange', 'attach_money',
  'savings', 'credit_card', 'price_check', 'request_quote',
  'receipt_long', 'paid', 'point_of_sale', 'account_balance_wallet',

  // Analytics & Dashboards
  'dashboard', 'analytics', 'assessment', 'insights',
  'monitoring', 'pie_chart', 'query_stats', 'data_usage',
  'leaderboard', 'equalizer', 'ssid_chart', 'area_chart',

  // Data & Grids
  'table_chart', 'grid_view', 'view_list', 'view_module',
  'dataset', 'storage', 'database', 'cloud_sync',
  'table_rows', 'view_column', 'view_agenda', 'calendar_view_month',

  // Risk & Compliance
  'security', 'shield', 'verified_user', 'gpp_good',
  'policy', 'admin_panel_settings', 'lock', 'health_and_safety',

  // Execution & Orders
  'swap_horiz', 'swap_vert', 'sync_alt', 'compare_arrows',
  'send', 'call_made', 'call_received', 'transit_enterexit',
  'bolt', 'flash_on', 'speed', 'timer',

  // Communication & Notifications
  'notifications', 'mail', 'chat', 'forum',
  'campaign', 'announcement', 'flag', 'priority_high',

  // Navigation & Views
  'search', 'filter_list', 'sort', 'visibility',
  'fullscreen', 'open_in_new', 'launch', 'zoom_in',

  // Documents & Reports
  'article', 'description', 'assignment', 'summarize',
  'text_snippet', 'note', 'receipt', 'inventory',

  // Business & Organization
  'business', 'corporate_fare', 'domain', 'apartment',
  'groups', 'person', 'manage_accounts', 'badge',

  // General Purpose
  'settings', 'tune', 'build', 'engineering',
  'rocket_launch', 'star', 'bookmark', 'label',
  'home', 'apps', 'widgets', 'extension',
  'explore', 'travel_explore', 'public', 'language',
  'dark_mode', 'light_mode', 'palette', 'brush',
];

mkdirSync(outDir, { recursive: true });

let downloaded = 0;
let failed = 0;

for (const icon of ICONS) {
  const url = `${BASE}/${icon}/default/${SIZE}.svg`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`  SKIP ${icon} (HTTP ${res.status})`);
      failed++;
      continue;
    }
    let svg = await res.text();
    // Replace hardcoded fill with currentColor for theme adaptability
    svg = svg.replace(/<path /g, '<path fill="currentColor" ');
    writeFileSync(join(outDir, `${icon}.svg`), svg);
    downloaded++;
  } catch (err) {
    console.warn(`  FAIL ${icon}: ${err.message}`);
    failed++;
  }
}

console.log(`\nDownloaded ${downloaded} icons to ${outDir}`);
if (failed > 0) console.log(`Skipped ${failed} icons (not found on CDN)`);

// Generate index JSON for the import-figma tool to reference
const manifest = ICONS.filter(i => existsSync(join(outDir, `${i}.svg`)));
writeFileSync(
  join(outDir, 'index.json'),
  JSON.stringify({ icons: manifest, count: manifest.length }, null, 2) + '\n'
);
console.log(`Created index.json with ${manifest.length} entries`);
