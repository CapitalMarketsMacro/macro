/**
 * Capital Markets Icon Generator - Standalone SVGs + PNGs
 *
 * Downloads Material Symbols Sharp SVG paths from Google Fonts CDN
 * and generates self-contained SVG icons (no font dependency).
 * Also generates PNG using sharp if available, otherwise via HTML.
 *
 * Specs: 56px, 100% opacity, 8px padding, 8px corner radius
 */
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Icon Data ──
const DATA = [
  { fn: 'Pricing', color: '#00d4aa', icons: [
    'candlestick_chart','show_chart','trending_up','trending_down','trending_flat',
    'ssid_chart','timeline','area_chart','stacked_line_chart','waterfall_chart',
    'data_thresholding','query_stats','auto_graph','bar_chart','bubble_chart',
    'scatter_plot','analytics','calculate','functions','monitor_heart',
  ]},
  { fn: 'PnL', color: '#34d399', icons: [
    'account_balance_wallet','savings','pie_chart','donut_large','leaderboard',
    'moving','difference','monitoring','payments','receipt_long','price_change','insert_chart',
  ]},
  { fn: 'Risk', color: '#f59e0b', icons: [
    'shield','warning','gpp_maybe','speed','thermostat','report','crisis_alert',
    'balance','exposure','compare_arrows','track_changes','health_and_safety',
    'privacy_tip','verified_user','block','policy',
  ]},
  { fn: 'Trading', color: '#3b82f6', icons: [
    'swap_horiz','swap_vert','bolt','storefront','assignment','fact_check',
    'pending_actions','playlist_add_check','checklist','published_with_changes',
    'cancel','inventory_2','account_tree','hub','handshake','group',
  ]},
  { fn: 'E-Trading', color: '#06b6d4', icons: [
    'send','schedule_send','timer','auto_mode','smart_toy','memory','route',
    'cell_tower','sensors','rss_feed','stream','lan','wifi','wifi_off',
    'cable','cloud_sync','electrical_services','developer_board',
  ]},
  { fn: 'Middle Office', color: '#8b5cf6', icons: [
    'rule','task_alt','sync_alt','content_paste_search','checklist_rtl',
    'approval','grading','manage_search','tune','event_repeat','low_priority',
    'swap_calls','description',
  ]},
  { fn: 'Ticketing', color: '#ec4899', icons: [
    'confirmation_number','note_add','edit_note','assignment_turned_in',
    'assignment_late','assignment_return','mark_email_read','priority_high',
    'label','comment','attach_file',
  ]},
  { fn: 'Back Office', color: '#f97316', icons: [
    'currency_exchange','account_balance','local_shipping','warehouse','inventory',
    'real_estate_agent','request_quote','assured_workload','summarize','folder_open',
    'history','gavel','event_available','update','check_circle','error',
  ]},
  { fn: 'Workspace', color: '#64748b', icons: [
    'dashboard','grid_view','view_column','splitscreen','picture_in_picture',
    'open_in_new','fullscreen','tab','search','filter_list','sort','download',
    'upload','print','refresh','notifications','person','mail','chat','help',
    'bookmark','settings',
  ]},
];

const ICON_SIZE = 56;
const PADDING = 8;
const CORNER_RADIUS = 8;
const GLYPH_SIZE = ICON_SIZE - PADDING * 2; // 40px

const THEMES = {
  dark:  { bg: '#10141e' },
  light: { bg: '#ffffff' },
};

// ── Fetch SVG from Google Fonts CDN ──
function fetchSVG(iconName) {
  return new Promise((resolve, reject) => {
    const url = `https://fonts.gstatic.com/s/i/short-term/release/materialsymbolssharp/${iconName}/default/24px.svg`;
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        https.get(res.headers.location, (res2) => {
          let data = '';
          res2.on('data', (chunk) => data += chunk);
          res2.on('end', () => resolve(data));
          res2.on('error', reject);
        }).on('error', reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${iconName}`));
        return;
      }
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// Extract the <path d="..."> from the downloaded SVG
function extractPath(svgContent) {
  const match = svgContent.match(/<path\s+d="([^"]+)"/);
  return match ? match[1] : null;
}

// Generate a standalone SVG with embedded path
// Source SVGs use viewBox="0 -960 960 960" — use nested <svg> to let the renderer handle mapping
function generateStandaloneSVG(pathData, iconColor, bgColor) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 ${ICON_SIZE} ${ICON_SIZE}">
  <rect width="${ICON_SIZE}" height="${ICON_SIZE}" rx="${CORNER_RADIUS}" ry="${CORNER_RADIUS}" fill="${bgColor}"/>
  <svg x="${PADDING}" y="${PADDING}" width="${GLYPH_SIZE}" height="${GLYPH_SIZE}" viewBox="0 -960 960 960">
    <path d="${pathData}" fill="${iconColor}"/>
  </svg>
</svg>`;
}

// ── Main ──
async function main() {
  console.log('Capital Markets Standalone Icon Generator');
  console.log('=========================================');
  console.log(`Size: ${ICON_SIZE}px | Padding: ${PADDING}px | Radius: ${CORNER_RADIUS}px | Opacity: 100%\n`);

  // Collect unique icons with their section colors
  const uniqueIcons = new Map(); // id -> color
  for (const section of DATA) {
    for (const iconId of section.icons) {
      if (!uniqueIcons.has(iconId)) {
        uniqueIcons.set(iconId, section.color);
      }
    }
  }

  console.log(`Unique icons to generate: ${uniqueIcons.size}`);
  console.log('Downloading SVG paths from Google Fonts CDN...\n');

  // Download all SVG paths
  const pathCache = new Map();
  let downloaded = 0;
  let failed = 0;
  const failedIcons = [];

  for (const [iconId] of uniqueIcons) {
    try {
      const svgContent = await fetchSVG(iconId);
      const pathData = extractPath(svgContent);
      if (pathData) {
        pathCache.set(iconId, pathData);
        downloaded++;
      } else {
        console.warn(`  Warning: No path found in SVG for ${iconId}`);
        failed++;
        failedIcons.push(iconId);
      }
    } catch (err) {
      console.warn(`  Warning: Failed to download ${iconId}: ${err.message}`);
      failed++;
      failedIcons.push(iconId);
    }
    // Progress
    if ((downloaded + failed) % 20 === 0) {
      console.log(`  Progress: ${downloaded + failed}/${uniqueIcons.size} (${downloaded} ok, ${failed} failed)`);
    }
  }

  console.log(`\nDownloaded: ${downloaded} | Failed: ${failed}`);
  if (failedIcons.length > 0) {
    console.log(`Failed icons: ${failedIcons.join(', ')}`);
  }

  // Ensure directories exist
  for (const theme of Object.keys(THEMES)) {
    fs.mkdirSync(path.join(__dirname, theme, 'svg'), { recursive: true });
    fs.mkdirSync(path.join(__dirname, theme, 'png'), { recursive: true });
  }

  // Generate SVGs for each theme
  let totalGenerated = 0;

  for (const [theme, config] of Object.entries(THEMES)) {
    console.log(`\n── ${theme.toUpperCase()} THEME ──`);
    let count = 0;

    for (const section of DATA) {
      const iconColor = section.color;

      for (const iconId of section.icons) {
        const pathData = pathCache.get(iconId);
        if (!pathData) continue;

        const svgPath = path.join(__dirname, theme, 'svg', `${iconId}.svg`);
        // Only write if not already written (dedup across sections)
        if (!fs.existsSync(svgPath)) {
          const svg = generateStandaloneSVG(pathData, iconColor, config.bg);
          fs.writeFileSync(svgPath, svg);
          count++;
          totalGenerated++;
        }
      }
    }

    console.log(`  SVGs generated: ${count}`);
  }

  // Generate PNG converter HTML pages for browser-based PNG generation
  for (const [theme, config] of Object.entries(THEMES)) {
    const icons = [];
    const seen = new Set();
    for (const section of DATA) {
      for (const iconId of section.icons) {
        if (seen.has(iconId)) continue;
        seen.add(iconId);
        const pathData = pathCache.get(iconId);
        if (!pathData) continue;
        icons.push({ id: iconId, color: section.color, path: pathData });
      }
    }

    const html = generatePNGPage(theme, config, icons);
    fs.writeFileSync(path.join(__dirname, theme, 'generate-png.html'), html);
    console.log(`\n  ${theme}/generate-png.html created (open in browser to batch-download PNGs)`);
  }

  console.log(`\nTotal standalone SVGs generated: ${totalGenerated}`);
  console.log('\nSVGs are fully self-contained (no font dependency).');
  console.log('For PNGs, open the generate-png.html files in a browser.');
}

function generatePNGPage(theme, config, icons) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>PNG Generator - ${theme} theme</title>
<style>
  body { background: #1a1a2e; color: #fff; font-family: system-ui; padding: 20px; }
  .status { margin: 20px 0; font-size: 16px; }
  .preview { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 20px; }
  .preview canvas { border: 1px solid #333; border-radius: 4px; }
  button { padding: 12px 24px; font-size: 16px; background: #00d4aa; color: #000; border: none; border-radius: 8px; cursor: pointer; margin: 10px 5px; font-weight: 600; }
  button:hover { opacity: 0.9; }
  .label { font-size: 10px; color: #888; text-align: center; max-width: 56px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
</head>
<body>
<h1>Capital Markets Icons - ${theme} theme</h1>
<p>${icons.length} icons | 56px | 8px padding | 8px radius</p>
<div class="status" id="status">Rendering...</div>
<div id="buttons"></div>
<div class="preview" id="preview"></div>

<script>
const ICONS = ${JSON.stringify(icons)};
const BG = '${config.bg}';
const SIZE = ${ICON_SIZE};
const PAD = ${PADDING};
const RAD = ${CORNER_RADIUS};
const GLYPH = ${GLYPH_SIZE};
const SRC_SIZE = 960;
const SCALE = GLYPH / SRC_SIZE;

function drawRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

const canvases = [];

for (const icon of ICONS) {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');

  // Background
  drawRoundRect(ctx, 0, 0, SIZE, SIZE, RAD);
  ctx.fillStyle = BG;
  ctx.fill();

  // Icon path — source viewBox is "0 -960 960 960"
  // Map: x[0,960]→[PAD, PAD+GLYPH], y[-960,0]→[PAD, PAD+GLYPH]
  ctx.save();
  ctx.translate(PAD, PAD + GLYPH);  // move origin to bottom-left of glyph area
  ctx.scale(SCALE, -SCALE);          // flip Y and scale down
  ctx.translate(0, SRC_SIZE);        // shift so y=-960 maps to top
  const p = new Path2D(icon.path);
  ctx.fillStyle = icon.color;
  ctx.fill(p);
  ctx.restore();

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:inline-flex;flex-direction:column;align-items:center;gap:2px;';
  wrapper.appendChild(canvas);
  const lbl = document.createElement('div');
  lbl.className = 'label';
  lbl.textContent = icon.id;
  wrapper.appendChild(lbl);
  document.getElementById('preview').appendChild(wrapper);
  canvases.push({ id: icon.id, canvas });
}

document.getElementById('status').textContent = 'Done! ' + ICONS.length + ' icons rendered.';

// Download individual
function downloadOne(id, canvas) {
  canvas.toBlob(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = id + '.png';
    a.click();
  });
}

// Download all
async function downloadAll() {
  document.getElementById('status').textContent = 'Downloading...';
  for (const { id, canvas } of canvases) {
    await new Promise(resolve => {
      canvas.toBlob(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = id + '.png';
        a.click();
        setTimeout(resolve, 80);
      });
    });
  }
  document.getElementById('status').textContent = 'All ' + canvases.length + ' PNGs downloaded!';
}

const btnDiv = document.getElementById('buttons');
const btn = document.createElement('button');
btn.textContent = 'Download All PNGs';
btn.onclick = downloadAll;
btnDiv.appendChild(btn);
</script>
</body>
</html>`;
}

main().catch(console.error);
