/**
 * Capital Markets Icon Generator
 *
 * Generates SVG and PNG icons for each icon in the icon system,
 * for both dark and light themes.
 *
 * Specs: 56px size, 100% opacity, 8px padding, 8px corner radius
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Icon Data (from capital-markets-icon-system-all.html) ──
const DATA = [
  {
    fn: 'Pricing', color: '#00d4aa',
    icons: [
      { id: 'candlestick_chart', label: 'Yield/FX Curve' },
      { id: 'show_chart', label: 'Price Chart' },
      { id: 'trending_up', label: 'Price Up' },
      { id: 'trending_down', label: 'Price Down' },
      { id: 'trending_flat', label: 'Unchanged' },
      { id: 'ssid_chart', label: 'Spread Chart' },
      { id: 'timeline', label: 'Time Series' },
      { id: 'area_chart', label: 'Spot Curve' },
      { id: 'stacked_line_chart', label: 'Multi Curve' },
      { id: 'waterfall_chart', label: 'Waterfall' },
      { id: 'data_thresholding', label: 'Threshold' },
      { id: 'query_stats', label: 'Vol Surface' },
      { id: 'auto_graph', label: 'Forward Curve' },
      { id: 'bar_chart', label: 'Volume Bars' },
      { id: 'bubble_chart', label: 'Basis Map' },
      { id: 'scatter_plot', label: 'Scatter Analy' },
      { id: 'analytics', label: 'Analytics' },
      { id: 'calculate', label: 'Calculator' },
      { id: 'functions', label: 'Pricer' },
      { id: 'monitor_heart', label: 'Live Pricing' },
    ],
  },
  {
    fn: 'PnL', color: '#34d399',
    icons: [
      { id: 'account_balance_wallet', label: 'PnL Book' },
      { id: 'savings', label: 'Daily PnL' },
      { id: 'pie_chart', label: 'PnL Breakdown' },
      { id: 'donut_large', label: 'Attribution' },
      { id: 'leaderboard', label: 'Desk PnL' },
      { id: 'moving', label: 'MTD / YTD' },
      { id: 'difference', label: 'PnL Explain' },
      { id: 'monitoring', label: 'Real-time PnL' },
      { id: 'payments', label: 'Cash PnL' },
      { id: 'receipt_long', label: 'PnL Report' },
      { id: 'price_change', label: 'Delta PnL' },
      { id: 'insert_chart', label: 'PnL Trend' },
    ],
  },
  {
    fn: 'Risk', color: '#f59e0b',
    icons: [
      { id: 'shield', label: 'Risk Shield' },
      { id: 'warning', label: 'Risk Alert' },
      { id: 'gpp_maybe', label: 'Limit Breach' },
      { id: 'speed', label: 'VaR Meter' },
      { id: 'thermostat', label: 'Risk Gauge' },
      { id: 'report', label: 'Risk Exception' },
      { id: 'crisis_alert', label: 'Stress Test' },
      { id: 'balance', label: 'Greeks / DV01' },
      { id: 'exposure', label: 'Exposure' },
      { id: 'compare_arrows', label: 'Long/Short' },
      { id: 'track_changes', label: 'Sensitivity' },
      { id: 'health_and_safety', label: 'Compliance' },
      { id: 'privacy_tip', label: 'Restricted' },
      { id: 'verified_user', label: 'Approved' },
      { id: 'block', label: 'Blocked' },
      { id: 'policy', label: 'Policy' },
    ],
  },
  {
    fn: 'Trading', color: '#3b82f6',
    icons: [
      { id: 'swap_horiz', label: 'Buy/Sell' },
      { id: 'swap_vert', label: 'Bid/Ask' },
      { id: 'bolt', label: 'Quick Trade' },
      { id: 'storefront', label: 'Dealer Panel' },
      { id: 'assignment', label: 'Trade Blotter' },
      { id: 'fact_check', label: 'Confirm' },
      { id: 'pending_actions', label: 'Pending' },
      { id: 'playlist_add_check', label: 'Filled' },
      { id: 'checklist', label: 'Order Queue' },
      { id: 'published_with_changes', label: 'Amend' },
      { id: 'cancel', label: 'Cancel' },
      { id: 'inventory_2', label: 'Inventory' },
      { id: 'account_tree', label: 'Book Hierarchy' },
      { id: 'hub', label: 'Trading Hub' },
      { id: 'handshake', label: 'Counterparty' },
      { id: 'group', label: 'Desk' },
    ],
  },
  {
    fn: 'E-Trading', color: '#06b6d4',
    icons: [
      { id: 'send', label: 'Submit Order' },
      { id: 'schedule_send', label: 'Algo Schedule' },
      { id: 'timer', label: 'TWAP Timer' },
      { id: 'auto_mode', label: 'Auto-Quote' },
      { id: 'smart_toy', label: 'Algo Engine' },
      { id: 'memory', label: 'Smart Router' },
      { id: 'route', label: 'Order Route' },
      { id: 'cell_tower', label: 'Feed Status' },
      { id: 'sensors', label: 'AMPS Stream' },
      { id: 'rss_feed', label: 'Live Feed' },
      { id: 'stream', label: 'Stream' },
      { id: 'lan', label: 'Network' },
      { id: 'wifi', label: 'Connected' },
      { id: 'wifi_off', label: 'Disconnected' },
      { id: 'cable', label: 'Data Link' },
      { id: 'cloud_sync', label: 'Cloud Sync' },
      { id: 'electrical_services', label: 'API Gateway' },
      { id: 'developer_board', label: 'Platform' },
    ],
  },
  {
    fn: 'Middle Office', color: '#8b5cf6',
    icons: [
      { id: 'rule', label: 'Validation Rule' },
      { id: 'task_alt', label: 'Trade Match' },
      { id: 'sync_alt', label: 'Reconciliation' },
      { id: 'content_paste_search', label: 'Trade Review' },
      { id: 'checklist_rtl', label: 'Confirm Queue' },
      { id: 'approval', label: 'Approval' },
      { id: 'grading', label: 'Mark-to-Market' },
      { id: 'manage_search', label: 'Exception Mgmt' },
      { id: 'tune', label: 'Adjustments' },
      { id: 'event_repeat', label: 'Rollover' },
      { id: 'low_priority', label: 'Netting' },
      { id: 'swap_calls', label: 'Novation' },
      { id: 'description', label: 'Confirm Letter' },
    ],
  },
  {
    fn: 'Ticketing', color: '#ec4899',
    icons: [
      { id: 'confirmation_number', label: 'Ticket' },
      { id: 'note_add', label: 'New Ticket' },
      { id: 'edit_note', label: 'Edit Ticket' },
      { id: 'assignment_turned_in', label: 'Ticket Done' },
      { id: 'assignment_late', label: 'Ticket Overdue' },
      { id: 'assignment_return', label: 'Returned' },
      { id: 'mark_email_read', label: 'Acknowledged' },
      { id: 'priority_high', label: 'Priority' },
      { id: 'label', label: 'Tag/Label' },
      { id: 'comment', label: 'Comment' },
      { id: 'attach_file', label: 'Attachment' },
    ],
  },
  {
    fn: 'Back Office / Settlement', color: '#f97316',
    icons: [
      { id: 'currency_exchange', label: 'FX Settlement' },
      { id: 'account_balance', label: 'Clearing' },
      { id: 'local_shipping', label: 'Delivery' },
      { id: 'warehouse', label: 'Warehouse Rcpt' },
      { id: 'inventory', label: 'Physical Stock' },
      { id: 'real_estate_agent', label: 'Custody' },
      { id: 'request_quote', label: 'Settlement Msg' },
      { id: 'assured_workload', label: 'Regulatory Rpt' },
      { id: 'summarize', label: 'Reporting' },
      { id: 'folder_open', label: 'Document Mgmt' },
      { id: 'history', label: 'Audit Trail' },
      { id: 'gavel', label: 'Legal' },
      { id: 'event_available', label: 'Value Date' },
      { id: 'update', label: 'Status Update' },
      { id: 'check_circle', label: 'Settled' },
      { id: 'error', label: 'Failed' },
    ],
  },
  {
    fn: 'Workspace & Utilities', color: '#64748b',
    icons: [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'grid_view', label: 'Grid Layout' },
      { id: 'view_column', label: 'Columns' },
      { id: 'splitscreen', label: 'Split View' },
      { id: 'picture_in_picture', label: 'Tearout' },
      { id: 'open_in_new', label: 'Pop Out' },
      { id: 'fullscreen', label: 'Fullscreen' },
      { id: 'tab', label: 'Tabs' },
      { id: 'search', label: 'Search' },
      { id: 'filter_list', label: 'Filter' },
      { id: 'sort', label: 'Sort' },
      { id: 'download', label: 'Export' },
      { id: 'upload', label: 'Import' },
      { id: 'print', label: 'Print' },
      { id: 'refresh', label: 'Refresh' },
      { id: 'notifications', label: 'Alerts' },
      { id: 'person', label: 'Trader' },
      { id: 'mail', label: 'Messages' },
      { id: 'chat', label: 'Chat' },
      { id: 'help', label: 'Help' },
      { id: 'bookmark', label: 'Bookmark' },
      { id: 'settings', label: 'Settings' },
    ],
  },
];

// ── Theme configs ──
const THEMES = {
  dark: {
    bg: '#10141e',
    iconColorFn: (sectionColor) => sectionColor,
  },
  light: {
    bg: '#ffffff',
    // Light theme uses slightly deeper versions for contrast on white
    iconColorFn: (sectionColor) => sectionColor,
  },
};

// ── Icon specs ──
const ICON_SIZE = 56;       // total icon size
const PADDING = 8;           // padding inside the rounded rect
const CORNER_RADIUS = 8;
const GLYPH_SIZE = ICON_SIZE - PADDING * 2; // 40px for the actual icon glyph

/**
 * Generate SVG string for a Material Icons Sharp icon using font embedding.
 * The icon uses the Material Icons Sharp web font rendered as text in SVG.
 */
function generateSVG(iconId, iconColor, bgColor) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 ${ICON_SIZE} ${ICON_SIZE}">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/icon?family=Material+Icons+Sharp');
    </style>
  </defs>
  <rect width="${ICON_SIZE}" height="${ICON_SIZE}" rx="${CORNER_RADIUS}" ry="${CORNER_RADIUS}" fill="${bgColor}"/>
  <text x="${ICON_SIZE / 2}" y="${ICON_SIZE / 2}" text-anchor="middle" dominant-baseline="central"
        font-family="Material Icons Sharp" font-size="${GLYPH_SIZE}px" fill="${iconColor}">${iconId}</text>
</svg>`;
}

/**
 * Generate an HTML page that renders all icons and provides download-as-PNG capability.
 */
function generatePNGConverterHTML(theme, themeConfig) {
  const allIcons = [];
  DATA.forEach((section) => {
    section.icons.forEach((icon) => {
      // Deduplicate (some icons like published_with_changes appear in multiple sections)
      if (!allIcons.find((i) => i.id === icon.id && i.sectionColor === section.color)) {
        allIcons.push({
          id: icon.id,
          label: icon.label,
          fn: section.fn,
          sectionColor: section.color,
          iconColor: themeConfig.iconColorFn(section.color),
        });
      }
    });
  });

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>PNG Generator - ${theme}</title>
<link href="https://fonts.googleapis.com/icon?family=Material+Icons+Sharp" rel="stylesheet">
<style>
  body { background: #1a1a2e; color: #fff; font-family: sans-serif; padding: 20px; }
  .status { margin: 20px 0; font-size: 18px; }
  canvas { display: none; }
  .preview { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 20px; }
  .preview img { border: 1px solid #333; }
</style>
</head>
<body>
<h1>Capital Markets Icons - ${theme} theme PNG Generator</h1>
<p>Generating ${allIcons.length} icons...</p>
<div class="status" id="status">Loading fonts...</div>
<div class="preview" id="preview"></div>
<canvas id="canvas" width="${ICON_SIZE}" height="${ICON_SIZE}"></canvas>

<script>
const ICONS = ${JSON.stringify(allIcons)};
const BG_COLOR = '${themeConfig.bg}';
const ICON_SIZE = ${ICON_SIZE};
const PADDING = ${PADDING};
const CORNER_RADIUS = ${CORNER_RADIUS};
const GLYPH_SIZE = ${GLYPH_SIZE};
const THEME = '${theme}';

// Wait for Material Icons font to load
document.fonts.ready.then(() => {
  // Extra delay to ensure font is fully available
  setTimeout(generateAll, 500);
});

async function generateAll() {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const status = document.getElementById('status');
  const preview = document.getElementById('preview');
  const results = [];

  for (let i = 0; i < ICONS.length; i++) {
    const icon = ICONS[i];
    status.textContent = 'Generating ' + (i + 1) + ' / ' + ICONS.length + ': ' + icon.id;

    // Clear canvas
    ctx.clearRect(0, 0, ICON_SIZE, ICON_SIZE);

    // Draw rounded rect background
    ctx.beginPath();
    ctx.roundRect(0, 0, ICON_SIZE, ICON_SIZE, CORNER_RADIUS);
    ctx.fillStyle = BG_COLOR;
    ctx.fill();

    // Draw icon glyph
    ctx.font = GLYPH_SIZE + 'px "Material Icons Sharp"';
    ctx.fillStyle = icon.iconColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon.id, ICON_SIZE / 2, ICON_SIZE / 2);

    // Convert to PNG blob
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const url = URL.createObjectURL(blob);

    // Show preview
    const img = document.createElement('img');
    img.src = url;
    img.title = icon.id + ' (' + icon.fn + ')';
    img.width = ICON_SIZE;
    preview.appendChild(img);

    // Store for download
    results.push({ id: icon.id, fn: icon.fn, blob, url });
  }

  status.textContent = 'Done! Generated ' + results.length + ' PNG icons. Click below to download all.';

  // Create download-all button
  const btn = document.createElement('button');
  btn.textContent = 'Download All PNGs';
  btn.style.cssText = 'padding:12px 24px;font-size:16px;background:#00d4aa;color:#000;border:none;border-radius:8px;cursor:pointer;margin:20px 0;';
  btn.onclick = async () => {
    for (const r of results) {
      const a = document.createElement('a');
      a.href = r.url;
      a.download = r.id + '.png';
      a.click();
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };
  status.parentNode.insertBefore(btn, status.nextSibling);
}
</script>
</body>
</html>`;
}

// ── Main generation ──
console.log('Capital Markets Icon Generator');
console.log('==============================');
console.log(`Size: ${ICON_SIZE}px | Padding: ${PADDING}px | Radius: ${CORNER_RADIUS}px | Opacity: 100%`);
console.log('');

let totalSvg = 0;
const seenIds = { dark: new Set(), light: new Set() };

for (const [theme, config] of Object.entries(THEMES)) {
  console.log(`\n── ${theme.toUpperCase()} THEME ──`);

  for (const section of DATA) {
    const iconColor = config.iconColorFn(section.color);

    for (const icon of section.icons) {
      // Skip duplicates within same theme
      if (seenIds[theme].has(icon.id)) continue;
      seenIds[theme].add(icon.id);

      const svg = generateSVG(icon.id, iconColor, config.bg);
      const svgPath = path.join(__dirname, theme, 'svg', `${icon.id}.svg`);
      fs.writeFileSync(svgPath, svg);
      totalSvg++;
    }
  }

  console.log(`  SVGs generated: ${seenIds[theme].size}`);

  // Generate PNG converter HTML
  const pngHtml = generatePNGConverterHTML(theme, config);
  const htmlPath = path.join(__dirname, theme, 'generate-png.html');
  fs.writeFileSync(htmlPath, pngHtml);
  console.log(`  PNG generator HTML: ${theme}/generate-png.html`);
}

console.log(`\nTotal SVGs: ${totalSvg}`);
console.log('\nTo generate PNGs:');
console.log('  1. Open CapitalMarketsIcons/dark/generate-png.html in a browser');
console.log('  2. Open CapitalMarketsIcons/light/generate-png.html in a browser');
console.log('  3. Click "Download All PNGs" to save the PNG files');
console.log('  (PNGs require a browser to render the Material Icons font to canvas)');
