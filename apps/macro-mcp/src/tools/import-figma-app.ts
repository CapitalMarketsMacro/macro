import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

/**
 * Fully automated Figma Make → OpenFin Workspace import tool.
 * Creates the NX app, copies source, wires routing/themes/OpenFin, registers everywhere.
 *
 * Works with any MCP client: Claude Code, VS Code Copilot, GitHub Copilot, etc.
 */

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
  throw new Error('Could not find monorepo root (package.json with name @macro/source)');
}

/**
 * Scan all apps' vite configs and project.json files to find used ports,
 * then return the next available port starting from 4204.
 */
function findNextAvailablePort(root: string): number {
  const usedPorts = new Set<number>();
  const appsDir = path.join(root, 'apps');
  if (!fs.existsSync(appsDir)) return 4204;

  for (const entry of fs.readdirSync(appsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const appPath = path.join(appsDir, entry.name);

    // Check vite.config files for server.port
    for (const cfg of ['vite.config.ts', 'vite.config.mts']) {
      const cfgPath = path.join(appPath, cfg);
      if (fs.existsSync(cfgPath)) {
        try {
          const content = fs.readFileSync(cfgPath, 'utf8');
          const portMatch = content.match(/port:\s*(\d+)/);
          if (portMatch) usedPorts.add(parseInt(portMatch[1], 10));
        } catch { /* skip */ }
      }
    }

    // Check project.json for port in serve target options
    const projPath = path.join(appPath, 'project.json');
    if (fs.existsSync(projPath)) {
      try {
        const proj = JSON.parse(fs.readFileSync(projPath, 'utf8'));
        const port = proj.targets?.serve?.options?.port;
        if (typeof port === 'number') usedPorts.add(port);
      } catch { /* skip */ }
    }
  }

  // Also check root package.json for well-known ports
  [4200, 4201, 4202, 4203, 3000].forEach(p => usedPorts.add(p));

  let port = 4204;
  while (usedPorts.has(port)) port++;
  return port;
}

/**
 * Keyword → Capital Markets Icon mapping for auto-suggesting icons based on app name/title.
 * All icon names must exist in apps/macro-workspace/public/icons/capital-markets/{dark,light}/.
 */
const ICON_KEYWORDS: Record<string, string[]> = {
  // Financial & Trading
  candlestick_chart: ['candlestick', 'ohlc', 'forex', 'fx'],
  show_chart: ['chart', 'line', 'timeseries', 'price'],
  bar_chart: ['bar', 'histogram'],
  trending_up: ['trending', 'growth', 'performance', 'pnl', 'profit', 'up'],
  trending_down: ['loss', 'decline', 'drawdown', 'down'],
  trending_flat: ['flat', 'unchanged', 'neutral'],
  account_balance: ['bank', 'institution', 'treasury', 'fixed-income', 'rates', 'bond'],
  account_balance_wallet: ['wallet', 'balance', 'account'],
  payments: ['payment', 'settlement', 'transfer', 'wire', 'pay'],
  currency_exchange: ['currency', 'exchange', 'swap', 'conversion', 'forex-rate'],
  savings: ['savings', 'deposit', 'yield', 'money', 'fund'],
  price_change: ['price', 'quote', 'valuation', 'mark', 'change'],
  request_quote: ['rfq', 'request', 'quote', 'ticket', 'order'],
  receipt_long: ['receipt', 'confirm', 'fill', 'execution', 'trade-confirm'],
  handshake: ['deal', 'agreement', 'counterparty', 'partnership'],
  real_estate_agent: ['broker', 'agent', 'dealer'],

  // Analytics & Dashboards
  dashboard: ['dashboard', 'overview', 'summary', 'home'],
  analytics: ['analytics', 'analysis', 'stats', 'statistics'],
  monitoring: ['monitor', 'surveillance', 'watch', 'observability'],
  monitor_heart: ['health', 'status', 'pulse', 'heartbeat', 'uptime'],
  pie_chart: ['pie', 'allocation', 'breakdown', 'composition'],
  donut_large: ['donut', 'ring', 'progress-ring'],
  leaderboard: ['leaderboard', 'ranking', 'top', 'best'],
  area_chart: ['area', 'cumulative', 'filled'],
  bubble_chart: ['bubble', 'scatter-bubble'],
  scatter_plot: ['scatter', 'correlation', 'distribution'],
  stacked_line_chart: ['stacked', 'multi-line', 'layers'],
  waterfall_chart: ['waterfall', 'cascade'],
  ssid_chart: ['ssid', 'signal-chart'],
  insert_chart: ['insert-chart', 'report-chart'],
  query_stats: ['query', 'search-stats', 'investigation'],
  auto_graph: ['auto-graph', 'smart-chart'],
  timeline: ['timeline', 'events', 'sequence'],
  data_thresholding: ['threshold', 'limits', 'bands'],

  // Data & Grids
  grid_view: ['grid', 'table', 'blotter', 'spreadsheet', 'data', 'tile'],
  view_column: ['column', 'columns', 'columnar'],
  splitscreen: ['split', 'compare-view', 'side-by-side'],
  filter_list: ['filter', 'refine', 'narrow'],
  sort: ['sort', 'order', 'arrange'],
  manage_search: ['search-manage', 'advanced-search'],
  search: ['search', 'find', 'lookup'],
  folder_open: ['folder', 'directory', 'catalog'],

  // Risk & Compliance
  shield: ['shield', 'guard', 'defense'],
  verified_user: ['verified', 'compliant', 'approved', 'certified'],
  policy: ['policy', 'compliance', 'regulation'],
  rule: ['rule', 'ruleset'],
  gavel: ['legal', 'gavel', 'ruling', 'court'],
  health_and_safety: ['risk', 'safety', 'var', 'exposure'],
  gpp_maybe: ['risk-maybe', 'possible-threat', 'warning-shield'],
  privacy_tip: ['privacy', 'tip', 'sensitive'],
  assured_workload: ['workload', 'assured', 'compliance-workload'],
  balance: ['balance', 'equilibrium', 'justice'],
  fact_check: ['verify', 'validate', 'check-fact'],
  approval: ['approve', 'approval', 'review'],
  block: ['block', 'deny', 'restrict'],
  warning: ['warning', 'caution', 'alert-sign'],
  error: ['error', 'failure', 'fault'],
  crisis_alert: ['crisis', 'urgent', 'emergency'],

  // Execution & Orders
  swap_horiz: ['swap', 'trade', 'bilateral'],
  swap_vert: ['swap-vertical', 'flip'],
  swap_calls: ['swap-calls', 'route-swap'],
  compare_arrows: ['compare', 'arrows-compare', 'vs'],
  bolt: ['bolt', 'fast', 'quick', 'instant', 'real-time', 'realtime'],
  speed: ['speed', 'latency', 'velocity', 'benchmark'],
  timer: ['timer', 'countdown', 'expiry', 'maturity'],
  schedule_send: ['schedule', 'send-later', 'scheduled'],
  update: ['update', 'refresh-update'],
  refresh: ['refresh', 'reload'],
  sync_alt: ['sync', 'synchronize'],
  cloud_sync: ['cloud-sync', 'cloud-replication'],
  published_with_changes: ['publish', 'republish', 'sync-published'],
  pending_actions: ['pending', 'awaiting', 'queued'],
  priority_high: ['priority', 'urgent', 'high'],
  low_priority: ['low-priority', 'deprioritize'],
  send: ['send', 'submit', 'dispatch'],

  // Communication & Events
  notifications: ['notification', 'alert', 'alarm'],
  mail: ['mail', 'email', 'message', 'inbox'],
  mark_email_read: ['read', 'seen', 'email-read'],
  chat: ['chat', 'conversation', 'discuss'],
  comment: ['comment', 'note', 'annotation'],
  rss_feed: ['feed', 'news', 'stream-feed'],
  stream: ['stream', 'live-feed'],
  event_available: ['event', 'available', 'scheduled'],
  event_repeat: ['recurring', 'repeat', 'schedule-repeat'],

  // Documents & Reports
  description: ['description', 'document', 'spec', 'detail'],
  assignment: ['assignment', 'task', 'action', 'workflow'],
  assignment_late: ['overdue', 'late', 'missed'],
  assignment_turned_in: ['completed', 'done', 'submitted'],
  assignment_return: ['returned', 'sent-back'],
  summarize: ['summarize', 'digest', 'brief', 'tldr'],
  note_add: ['note', 'add-note', 'new-doc'],
  edit_note: ['edit', 'modify-note'],
  grading: ['grading', 'score', 'rate'],
  checklist: ['checklist', 'todo', 'list-check'],
  checklist_rtl: ['checklist-rtl'],
  playlist_add_check: ['playlist-check', 'batch-check'],
  report: ['report', 'flag-report'],
  difference: ['difference', 'diff', 'delta'],
  content_paste_search: ['paste-search', 'analyze-content'],

  // Business & Accounts
  person: ['person', 'user', 'client', 'trader'],
  group: ['group', 'team', 'desk', 'people'],
  inventory: ['inventory', 'position', 'holding', 'portfolio'],
  inventory_2: ['storage', 'vault', 'repository'],
  warehouse: ['warehouse', 'data-warehouse', 'archive'],
  local_shipping: ['delivery', 'shipment', 'logistics'],
  confirmation_number: ['ticket', 'confirmation', 'number'],
  storefront: ['store', 'marketplace', 'shop', 'venue', 'exchange'],

  // Network & Infrastructure
  hub: ['hub', 'center', 'gateway'],
  lan: ['lan', 'network-lan'],
  cable: ['cable', 'wire', 'connection'],
  wifi: ['wifi', 'wireless'],
  wifi_off: ['offline', 'disconnected'],
  cell_tower: ['cell', 'tower', 'broadcast'],
  electrical_services: ['electrical', 'power', 'services'],
  sensors: ['sensors', 'telemetry'],
  route: ['route', 'path', 'routing'],
  developer_board: ['developer', 'board', 'hardware'],
  memory: ['memory', 'ram', 'cache'],
  thermostat: ['temperature', 'thermostat', 'heat'],
  track_changes: ['track', 'changes', 'audit'],

  // General & UI
  settings: ['settings', 'config', 'preference'],
  tune: ['tune', 'tuning', 'parameters'],
  calculate: ['calculate', 'calculation', 'math'],
  functions: ['functions', 'formulas', 'expressions'],
  exposure: ['exposure', 'brightness'],
  auto_mode: ['auto', 'automation', 'auto-mode'],
  smart_toy: ['ai', 'bot', 'assistant', 'smart'],
  history: ['history', 'past', 'archive'],
  bookmark: ['bookmark', 'favorite-mark', 'saved'],
  label: ['label', 'tag', 'categorize'],
  tab: ['tab', 'section'],
  picture_in_picture: ['pip', 'picture-in-picture'],
  fullscreen: ['fullscreen', 'expand', 'maximize'],
  open_in_new: ['external', 'new-window', 'open-new'],
  download: ['download', 'export', 'save-file'],
  upload: ['upload', 'import-file', 'publish-file'],
  print: ['print', 'printer'],
  attach_file: ['attach', 'attachment', 'file'],
  help: ['help', 'support', 'faq'],
  check_circle: ['check', 'success', 'complete'],
  cancel: ['cancel', 'close', 'dismiss'],
  task_alt: ['task-done', 'completed-task'],
  moving: ['moving', 'transfer', 'migration'],
};

/**
 * Auto-suggest an icon based on app name and title keywords.
 * Returns the Capital Markets icon name. Falls back to 'dashboard' (always in the set).
 */
function suggestIcon(appName: string, title: string): string {
  const text = `${appName} ${title}`.toLowerCase();
  let bestIcon = 'dashboard';
  let bestScore = 0;

  for (const [icon, keywords] of Object.entries(ICON_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.includes(kw) && kw.length > bestScore) {
        bestIcon = icon;
        bestScore = kw.length;
      }
    }
  }
  return bestIcon;
}

/**
 * Get the list of available Capital Markets icons from the index.
 * Falls back to a directory scan (and auto-copies from CapitalMarketsIcons/
 * if the public folder is missing — keeps the tool robust).
 */
function getAvailableIcons(root: string): string[] {
  ensureCapitalMarketsIcons(root);
  const dir = path.join(root, 'apps/macro-workspace/public/icons/capital-markets/dark');
  const indexPath = path.join(root, 'apps/macro-workspace/public/icons/capital-markets/index.json');
  if (fs.existsSync(indexPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      if (Array.isArray(parsed.icons) && parsed.icons.length > 0) return parsed.icons;
    } catch { /* fall through to dir scan */ }
  }
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.svg'))
    .map(f => f.replace(/\.svg$/, ''))
    .sort();
}

/**
 * Ensure Capital Markets icons are present in the public folder.
 * Copies from CapitalMarketsIcons/ at repo root if the destination is missing/empty.
 * Idempotent — only copies when needed.
 */
function ensureCapitalMarketsIcons(root: string): void {
  const dstDark = path.join(root, 'apps/macro-workspace/public/icons/capital-markets/dark');
  const dstLight = path.join(root, 'apps/macro-workspace/public/icons/capital-markets/light');
  const srcDark = path.join(root, 'CapitalMarketsIcons/dark/svg');
  const srcLight = path.join(root, 'CapitalMarketsIcons/light/svg');

  const needsCopy = (dst: string): boolean => {
    if (!fs.existsSync(dst)) return true;
    try { return fs.readdirSync(dst).filter(f => f.endsWith('.svg')).length === 0; }
    catch { return true; }
  };

  if (fs.existsSync(srcDark) && needsCopy(dstDark)) {
    fs.mkdirSync(dstDark, { recursive: true });
    copyDirRecursive(srcDark, dstDark);
  }
  if (fs.existsSync(srcLight) && needsCopy(dstLight)) {
    fs.mkdirSync(dstLight, { recursive: true });
    copyDirRecursive(srcLight, dstLight);
  }

  // Regenerate index.json if missing
  const indexPath = path.join(root, 'apps/macro-workspace/public/icons/capital-markets/index.json');
  if (!fs.existsSync(indexPath) && fs.existsSync(dstDark)) {
    const icons = fs.readdirSync(dstDark)
      .filter(f => f.endsWith('.svg'))
      .map(f => f.replace(/\.svg$/, ''))
      .sort();
    fs.writeFileSync(indexPath, JSON.stringify({ icons, count: icons.length }, null, 2) + '\n');
  }
}

/**
 * Extract a .zip file across platforms.
 * Tries (in order): unzip (Linux/macOS), PowerShell Expand-Archive (Windows), python3 zipfile (universal).
 * Handles nested root folders (common in Figma Make exports).
 * Returns the path to the actual source root inside the extraction.
 */
function extractZip(zipPath: string, extractDir: string): string {
  fs.mkdirSync(extractDir, { recursive: true });

  const attempts: Array<{ cmd: string; name: string }> = [
    { name: 'unzip', cmd: `unzip -o -q "${zipPath}" -d "${extractDir}"` },
    { name: 'PowerShell Expand-Archive',
      cmd: `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${extractDir.replace(/'/g, "''")}' -Force"` },
    { name: 'python3 zipfile',
      cmd: `python3 -c "import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])" "${zipPath}" "${extractDir}"` },
    { name: 'python zipfile',
      cmd: `python -c "import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])" "${zipPath}" "${extractDir}"` },
  ];

  let lastErr: unknown = null;
  for (const a of attempts) {
    try {
      execSync(a.cmd, { stdio: 'pipe', timeout: 120000 });
      lastErr = null;
      break;
    } catch (e) {
      lastErr = e;
    }
  }
  if (lastErr) {
    throw new Error(`Failed to extract zip: ${zipPath}. Tried unzip, PowerShell, and python — all failed. Last error: ${(lastErr as Error).message}`);
  }

  // Handle nested root folder: if extraction produced a single directory, descend into it
  const entries = fs.readdirSync(extractDir, { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== '__MACOSX');
  if (dirs.length === 1 && entries.filter(e => e.isFile()).length === 0) {
    return path.join(extractDir, dirs[0].name);
  }
  return extractDir;
}

function importFigmaApp(
  appName: string,
  title: string,
  description: string,
  port: number | undefined,
  sourcePath: string,
  icon?: string,
): { success: boolean; summary: string; steps: string[] } {
  const root = findWorkspaceRoot();
  const appDir = path.join(root, 'apps', appName);
  const publicLocal = path.join(root, 'apps/macro-workspace/public/local');
  const publicOpenshift = path.join(root, 'apps/macro-workspace/public/openshift');
  const basePath = `/${appName}/`;
  const steps: string[] = [];
  let tmpDir: string | null = null;

  try {
    // ── Validate app name ──
    if (!/^[a-z][a-z0-9-]*$/.test(appName)) {
      return { success: false, summary: `Invalid app name "${appName}". Use kebab-case (lowercase letters, numbers, hyphens, starting with a letter).`, steps };
    }

    // ── Check if app already exists ──
    if (fs.existsSync(appDir)) {
      return { success: false, summary: `App directory apps/${appName} already exists. Choose a different name.`, steps };
    }

    // ── Validate source path ──
    if (!fs.existsSync(sourcePath)) {
      return { success: false, summary: `Source path not found: ${sourcePath}`, steps };
    }

    // ── Auto-detect port if not provided ──
    const resolvedPort = port ?? findNextAvailablePort(root);
    steps.push(`Using port ${resolvedPort}${port ? '' : ' (auto-detected)'}`);

    // ── Handle zip files ──
    let actualSourcePath = sourcePath;
    if (sourcePath.toLowerCase().endsWith('.zip')) {
      tmpDir = path.join(root, 'tmp', `figma-${appName}-${Date.now()}`);
      actualSourcePath = extractZip(sourcePath, tmpDir);
      steps.push(`Extracted zip to temporary directory`);
    }

    // ── Auto-detect title and description from Figma package.json ──
    const figmaPkgPath = path.join(actualSourcePath, 'package.json');
    let autoTitle = title;
    let autoDescription = description;
    if (fs.existsSync(figmaPkgPath)) {
      try {
        const figmaPkg = JSON.parse(fs.readFileSync(figmaPkgPath, 'utf8'));
        if (!title && figmaPkg.name) autoTitle = figmaPkg.name.replace(/[-_]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
        if (!description && figmaPkg.description) autoDescription = figmaPkg.description;
      } catch { /* skip */ }
    }
    if (!autoTitle) autoTitle = appName.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
    if (!autoDescription) autoDescription = `${autoTitle} imported from Figma Make`;

    // ── Resolve icon (Capital Markets icons with dark/light variants) ──
    const availableIcons = getAvailableIcons(root);
    let resolvedIcon: string;
    if (icon && availableIcons.includes(icon)) {
      resolvedIcon = icon;
      steps.push(`Using icon: ${resolvedIcon}`);
    } else if (icon) {
      steps.push(`Warning: icon "${icon}" not in Capital Markets icon set (${availableIcons.length} available) — using as-is`);
      resolvedIcon = icon;
    } else {
      resolvedIcon = suggestIcon(appName, autoTitle);
      // Fall back to 'apps' → 'dashboard' → first icon available if the suggested one is missing
      if (!availableIcons.includes(resolvedIcon)) {
        resolvedIcon = availableIcons.includes('dashboard') ? 'dashboard' : (availableIcons[0] ?? 'dashboard');
      }
      steps.push(`Auto-selected icon: ${resolvedIcon} (based on app name/title)`);
    }
    // Dark variant is used as the primary icon URL (our default theme is dark)
    const iconDarkUrl = `http://localhost:4202/icons/capital-markets/dark/${resolvedIcon}.svg`;
    const iconLightUrl = `http://localhost:4202/icons/capital-markets/light/${resolvedIcon}.svg`;
    const iconUrl = iconDarkUrl; // single-URL fallback for app.icons[].src
    const osIconDarkUrl = `https://{{OPENSHIFT_WORKSPACE_HOST}}/icons/capital-markets/dark/${resolvedIcon}.svg`;
    const osIconLightUrl = `https://{{OPENSHIFT_WORKSPACE_HOST}}/icons/capital-markets/light/${resolvedIcon}.svg`;
    const osIconUrl = osIconDarkUrl;

    // ── Create project structure (skip NX generator — manual is more reliable) ──
    fs.mkdirSync(path.join(appDir, 'src/app'), { recursive: true });

    // project.json — empty targets so NX Vite plugin auto-infers from vite.config
    fs.writeFileSync(path.join(appDir, 'project.json'), JSON.stringify({
      name: appName,
      $schema: '../../node_modules/nx/schemas/project-schema.json',
      sourceRoot: `apps/${appName}/src`,
      projectType: 'application',
      tags: [],
      targets: {},
    }, null, 2) + '\n');

    fs.writeFileSync(path.join(appDir, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        jsx: 'react-jsx',
        allowJs: false,
        esModuleInterop: false,
        allowSyntheticDefaultImports: true,
        strict: true,
        types: ['vite/client'],
      },
      references: [{ path: './tsconfig.app.json' }],
      extends: '../../tsconfig.base.json',
    }, null, 2) + '\n');

    fs.writeFileSync(path.join(appDir, 'tsconfig.app.json'), JSON.stringify({
      extends: './tsconfig.json',
      compilerOptions: { outDir: '../../dist/out-tsc', types: ['node', 'vite/client'] },
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.test.ts', 'src/**/*.spec.tsx', 'src/**/*.test.tsx'],
    }, null, 2) + '\n');

    steps.push('Created project configuration (project.json, tsconfig)');

    // ── Copy Figma Make source files ──
    const srcDir = path.join(appDir, 'src');
    const figmaDestDir = path.join(srcDir, 'figma');
    fs.mkdirSync(figmaDestDir, { recursive: true });

    // Detect Figma source layout: has src/ or is flat
    const figmaSrc = fs.existsSync(path.join(actualSourcePath, 'src'))
      ? path.join(actualSourcePath, 'src')
      : actualSourcePath;

    // Copy the Figma src/ into our src/figma/
    copyDirRecursive(figmaSrc, figmaDestDir);

    // Remove Figma's own main.tsx/index.tsx if present (we create our own)
    for (const skipFile of ['main.tsx', 'main.jsx', 'index.tsx', 'index.jsx']) {
      const skipPath = path.join(figmaDestDir, skipFile);
      if (fs.existsSync(skipPath)) {
        // Keep it for reference but rename so it doesn't interfere
        fs.renameSync(skipPath, skipPath + '.figma-original');
      }
    }

    // Copy public assets
    const figmaPublic = path.join(actualSourcePath, 'public');
    if (fs.existsSync(figmaPublic)) {
      copyDirRecursive(figmaPublic, path.join(srcDir, 'assets'));
    }

    const copiedCount = countFiles(figmaDestDir);
    steps.push(`Copied ${copiedCount} files from Figma project into src/figma/`);

    // ── Tailwind Detection & Configuration ──
    let hasTailwind = false;

    // Check for config files in Figma export root
    for (const configFile of ['tailwind.config.js', 'tailwind.config.ts', 'postcss.config.js', 'postcss.config.cjs']) {
      const cfgPath = path.join(actualSourcePath, configFile);
      if (fs.existsSync(cfgPath)) {
        fs.copyFileSync(cfgPath, path.join(appDir, configFile));
        if (configFile.startsWith('tailwind')) hasTailwind = true;
      }
    }

    // Detect Tailwind from CSS imports if no config was found
    if (!hasTailwind) {
      hasTailwind = findFileContaining(figmaDestDir, '.css', "@import 'tailwindcss'")
        || findFileContaining(figmaDestDir, '.css', '@import "tailwindcss"')
        || findFileContaining(figmaDestDir, '.css', '@tailwind');
    }

    // Create PostCSS config for Tailwind if needed
    if (hasTailwind && !fs.existsSync(path.join(appDir, 'postcss.config.cjs')) && !fs.existsSync(path.join(appDir, 'postcss.config.js'))) {
      fs.writeFileSync(path.join(appDir, 'postcss.config.cjs'), `module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
`);
      steps.push('Created postcss.config.cjs for Tailwind CSS');
    }

    // ── Detect Figma root component ──
    let figmaRootImport = '../figma/App';
    const rootCandidates = [
      'app/App.tsx', 'app/App.jsx',        // Figma Make nested pattern (most common)
      'App.tsx', 'App.jsx',                 // Standard React root
      'app.tsx', 'app.jsx',                 // Lowercase variant
      'pages/index.tsx', 'pages/index.jsx', // Next.js-style
      'components/App.tsx',                 // Components-only export
    ];
    for (const candidate of rootCandidates) {
      if (fs.existsSync(path.join(figmaDestDir, candidate))) {
        const importPath = candidate.replace(/\.(tsx|jsx)$/, '');
        figmaRootImport = `../figma/${importPath}`;
        break;
      }
    }

    // ── Install Figma dependencies not already in monorepo ──
    if (fs.existsSync(figmaPkgPath)) {
      try {
        const figmaPkg = JSON.parse(fs.readFileSync(figmaPkgPath, 'utf8'));
        const figmaDeps = { ...figmaPkg.dependencies, ...figmaPkg.devDependencies };
        const skip = new Set([
          'react', 'react-dom', 'react-router-dom', 'typescript', 'vite',
          '@vitejs/plugin-react', 'tailwindcss', '@tailwindcss/postcss',
          '@tailwindcss/vite', 'postcss', 'autoprefixer', '@types/react',
          '@types/react-dom', '@types/node', 'eslint',
        ]);
        const toInstall: string[] = [];
        for (const [dep, version] of Object.entries(figmaDeps)) {
          if (skip.has(dep)) continue;
          if (!fs.existsSync(path.join(root, 'node_modules', dep))) {
            toInstall.push(`${dep}@${version}`);
          }
        }
        if (toInstall.length > 0) {
          try {
            execSync(`npm install ${toInstall.join(' ')} --legacy-peer-deps`, { cwd: root, stdio: 'pipe', timeout: 120000 });
            steps.push(`Installed ${toInstall.length} Figma dependencies: ${toInstall.map(d => d.split('@')[0]).join(', ')}`);
          } catch {
            steps.push(`Warning: some Figma dependencies may need manual install: ${toInstall.join(', ')}`);
          }
        } else {
          steps.push('All Figma dependencies already available in monorepo');
        }
      } catch { /* skip if package.json is malformed */ }
    }

    // ── Create app.tsx wrapper with OpenFin theme sync ──
    fs.writeFileSync(path.join(appDir, 'src/app/app.tsx'), `import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { getInitialIsDark, applyDarkMode, onSystemThemeChange } from '@macro/macro-design';
import FigmaApp from '${figmaRootImport}';

// OpenFin theme sync — responds to workspace theme toggle in real time.
// Gracefully no-ops when running outside OpenFin (standalone browser).
let onOpenFinThemeChange: ((cb: (isDark: boolean) => void) => (() => void)) | undefined;
try {
  // Dynamic import so the app works standalone without @macro/openfin
  const themeSync = require('@macro/openfin/theme-sync');
  onOpenFinThemeChange = themeSync.onOpenFinThemeChange;
} catch { /* not in OpenFin or lib not available */ }

export function App() {
  const [isDark, setIsDark] = useState(getInitialIsDark);

  useEffect(() => { applyDarkMode(isDark); }, [isDark]);
  useEffect(() => onSystemThemeChange((d) => setIsDark(d)), []);

  // Sync with OpenFin workspace theme changes (dark/light toggle from platform toolbar)
  useEffect(() => {
    if (onOpenFinThemeChange) {
      return onOpenFinThemeChange((d) => setIsDark(d));
    }
  }, []);

  return (
    <BrowserRouter basename="${basePath}">
      <FigmaApp />
    </BrowserRouter>
  );
}

export default App;
`);
    steps.push('Created app.tsx with BrowserRouter + OpenFin theme sync');

    // ── Create main.tsx ──
    const figmaCssImports: string[] = [];
    const cssSearchPaths = [
      // Styles subdirectory (most common Figma Make pattern — index.css imports others)
      { file: 'styles/index.css', importPath: './figma/styles/index.css' },
      // Direct files in figma root
      { file: 'index.css', importPath: './figma/index.css' },
      { file: 'App.css', importPath: './figma/App.css' },
      { file: 'globals.css', importPath: './figma/globals.css' },
      // Other subdirectories
      { file: 'styles/globals.css', importPath: './figma/styles/globals.css' },
      { file: 'styles/tailwind.css', importPath: './figma/styles/tailwind.css' },
      { file: 'css/index.css', importPath: './figma/css/index.css' },
    ];
    for (const { file, importPath } of cssSearchPaths) {
      if (fs.existsSync(path.join(figmaDestDir, file))) {
        figmaCssImports.push(`import '${importPath}';`);
        // styles/index.css typically imports all other CSS — stop here
        if (file.includes('index.css')) break;
      }
    }

    fs.writeFileSync(path.join(appDir, 'src/main.tsx'), `import * as ReactDOM from 'react-dom/client';
import App from './app/app';
import '../../../libs/macro-design/src/lib/css/fonts.css';
import '../../../libs/macro-design/src/lib/css/macro-etrading.css';
import '../../../libs/macro-design/src/lib/css/macro-design.css';
${figmaCssImports.join('\n')}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);
`);
    steps.push('Created main.tsx with @macro/macro-design CSS + Figma styles');

    // ── Create vite.config.mts (Vite 8 compatible ESM config) ──
    const tailwindImport = hasTailwind ? `import tailwindcss from '@tailwindcss/postcss';\n` : '';
    const tailwindCssBlock = hasTailwind ? `  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },
` : '';

    fs.writeFileSync(path.join(appDir, 'vite.config.mts'), `/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
${tailwindImport}import path from 'path';

export default defineConfig({
  root: import.meta.dirname,
  base: '${basePath}',

  server: { port: ${resolvedPort}, host: 'localhost' },
  preview: { port: ${resolvedPort}, host: 'localhost' },

  plugins: [react(), nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],

${tailwindCssBlock}  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@macro/macro-design': path.resolve(import.meta.dirname, '../../libs/macro-design/src/index.ts'),
      '@macro/openfin/theme-sync': path.resolve(import.meta.dirname, '../../libs/openfin/src/lib/theme-sync.ts'),
    },
  },

  build: {
    outDir: '../../dist/apps/${appName}',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: { transformMixedEsModules: true },
  },

  test: {
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: { reportsDirectory: '../../coverage/apps/${appName}', provider: 'v8' },
  },
});
`);
    steps.push('Created vite.config.mts (Vite 8 compatible)');

    // ── Create index.html ──
    fs.writeFileSync(path.join(appDir, 'index.html'), `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${autoTitle}</title>
    <base href="/" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/x-icon" href="/favicon.ico" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`);
    steps.push('Created index.html');

    // ── Create OpenFin view manifests ──
    const localView = { url: `http://localhost:${resolvedPort}${basePath}`, fdc3InteropApi: '2.0', interop: { currentContextGroup: 'green' } };
    const envVar = `OPENSHIFT_${appName.replace(/-/g, '_').toUpperCase()}_HOST`;
    const osView = { url: `https://{{${envVar}}}${basePath}`, fdc3InteropApi: '2.0', interop: { currentContextGroup: 'green' } };

    fs.writeFileSync(path.join(publicLocal, `${appName}.fin.json`), JSON.stringify(localView, null, 2) + '\n');
    fs.writeFileSync(path.join(publicOpenshift, `${appName}.fin.json`), JSON.stringify(osView, null, 2) + '\n');
    steps.push('Created OpenFin view manifests (local + openshift)');

    // ── Register in manifests + settings ──
    const localAppEntry = {
      appId: appName, name: appName, title: autoTitle, description: autoDescription,
      manifest: `http://localhost:4202/local/${appName}.fin.json`,
      manifestType: 'view',
      icons: [{ src: iconUrl }],
      contactEmail: 'contact@example.com', supportEmail: 'support@example.com',
      publisher: 'OpenFin', intents: [], images: [],
      tags: ['view', 'react', 'figma-make'],
    };
    const osAppEntry = {
      ...localAppEntry,
      manifest: `https://{{OPENSHIFT_WORKSPACE_HOST}}/openshift/${appName}.fin.json`,
      icons: [{ src: osIconUrl }],
    };

    addAppToJsonFile(path.join(publicLocal, 'manifest.fin.json'), localAppEntry);
    addAppToJsonFile(path.join(publicLocal, 'settings.json'), localAppEntry);
    addAppToJsonFile(path.join(publicOpenshift, 'manifest.fin.json'), osAppEntry);
    addAppToJsonFile(path.join(publicOpenshift, 'settings.json'), osAppEntry);
    steps.push('Registered in manifest.fin.json + settings.json (local + openshift)');

    // ── Add to Dock favorites (with dark/light icon variants) ──
    addDockFavorite(path.join(publicLocal, 'settings.json'), {
      type: 'item', id: `fav-${appName}`, label: autoTitle,
      icon: { dark: iconDarkUrl, light: iconLightUrl },
      appId: appName,
    });
    addDockFavorite(path.join(publicOpenshift, 'settings.json'), {
      type: 'item', id: `fav-${appName}`, label: autoTitle,
      icon: { dark: osIconDarkUrl, light: osIconLightUrl },
      appId: appName,
    });
    steps.push('Added to Dock favorites (dark/light icon variants)');

    // ── Update root package.json ──
    const pkgPath = path.join(root, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkg.scripts[`start:${appName}`] = `nx serve ${appName}`;
    pkg.scripts[`build:${appName}`] = `nx build ${appName}`;
    if (pkg.scripts['build:apps'] && !pkg.scripts['build:apps'].includes(appName)) {
      pkg.scripts['build:apps'] = pkg.scripts['build:apps'].replace(
        /--projects=([^\s]+)/, `--projects=$1,${appName}`
      );
    }
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    steps.push('Updated package.json (start, build, build:apps scripts)');

    // ── Clean up temporary extraction directory ──
    if (tmpDir) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        steps.push('Cleaned up temporary extraction directory');
      } catch { /* non-fatal */ }
    }

    return {
      success: true,
      steps,
      summary: `Successfully imported "${autoTitle}" as apps/${appName}

  Port:      ${resolvedPort}
  Base path: ${basePath}
  URL:       http://localhost:${resolvedPort}${basePath}

To run:
  npm run start:${appName}    # Start the dev server
  npm run launch              # Launch OpenFin (app appears in Home, Store, Dock)

To customize:
  Edit apps/${appName}/src/app/app.tsx to modify the wrapper.
  Figma source is in apps/${appName}/src/figma/ — edit components there.`,
    };
  } catch (err: any) {
    // Clean up tmp on failure too
    if (tmpDir) {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
    // Remove partially-created appDir so re-runs can use the same name
    if (fs.existsSync(appDir)) {
      try {
        fs.rmSync(appDir, { recursive: true, force: true });
        steps.push(`Cleaned up partial app directory apps/${appName}`);
      } catch { /* ignore */ }
    }
    // Remove partial manifest files
    for (const p of [
      path.join(publicLocal, `${appName}.fin.json`),
      path.join(publicOpenshift, `${appName}.fin.json`),
    ]) {
      if (fs.existsSync(p)) { try { fs.unlinkSync(p); } catch { /* ignore */ } }
    }
    return { success: false, summary: `Import failed: ${err?.message ?? err}`, steps };
  }
}

// ── Helpers ──

function copyDirRecursive(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    // Skip macOS metadata, node_modules, and git directories
    if (entry.name === '__MACOSX' || entry.name === 'node_modules' || entry.name === '.git') continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirRecursive(s, d);
    else fs.copyFileSync(s, d);
  }
}

function countFiles(dir: string): number {
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) count += countFiles(path.join(dir, entry.name));
    else count++;
  }
  return count;
}

function findFileContaining(dir: string, ext: string, searchText: string): boolean {
  if (!fs.existsSync(dir)) return false;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (findFileContaining(fullPath, ext, searchText)) return true;
    } else if (entry.name.endsWith(ext)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes(searchText)) return true;
      } catch { /* skip unreadable files */ }
    }
  }
  return false;
}

function addAppToJsonFile(filePath: string, appEntry: any): void {
  if (!fs.existsSync(filePath)) return;
  const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const apps = json.customSettings?.apps;
  if (Array.isArray(apps) && !apps.find((a: any) => a.appId === appEntry.appId)) {
    apps.push(appEntry);
  }
  fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n');
}

function addDockFavorite(filePath: string, favorite: any): void {
  if (!fs.existsSync(filePath)) return;
  const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const favs = json.customSettings?.dock3?.favorites;
  if (Array.isArray(favs) && !favs.find((f: any) => f.appId === favorite.appId)) {
    favs.push(favorite);
  }
  fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n');
}

// ── MCP Registration ──

export function registerImportFigmaApp(server: McpServer): void {
  server.tool(
    'import_figma_app',
    `Import a Figma Make React project into the Macro monorepo as a fully registered OpenFin workspace view.

Fully automated pipeline:
1. Extracts zip (handles nested root folders) or reads source folder
2. Creates NX project with Vite 8 config, TypeScript, and path aliases
3. Copies Figma source into src/figma/, detects root component automatically
4. Wires BrowserRouter with base path, dark/light theme sync (system + OpenFin)
5. Auto-detects Tailwind CSS and configures PostCSS
6. Installs any missing Figma dependencies into the monorepo
7. Creates OpenFin view manifests with FDC3 2.0 interop (local + openshift)
8. Registers in Home, Store, Dock, and workspace manifests
9. Updates package.json with start/build scripts

Works with Claude Code, VS Code Copilot, GitHub Copilot, or any MCP client.`,
    {
      appName: z.string().describe('App name in kebab-case (e.g., "risk-dashboard"). Becomes folder name, route path, and OpenFin app ID.'),
      title: z.string().default('').describe('Display title for OpenFin (auto-detected from Figma package.json if empty)'),
      description: z.string().default('').describe('Short description (auto-detected from Figma package.json if empty)'),
      port: z.number().optional().describe('Dev server port (auto-detected if omitted — scans existing apps to find next available port starting from 4204)'),
      sourcePath: z.string().describe('Path to Figma Make export folder or .zip file'),
      icon: z.string().optional().describe('Material icon name for OpenFin Home/Store/Dock (e.g., "dashboard", "candlestick_chart", "table_chart"). Auto-suggested from app name if omitted. See all 115 icons at apps/macro-workspace/public/icons/material/'),
    },
    async ({ appName, title, description, port, sourcePath, icon }) => {
      const result = importFigmaApp(appName, title, description, port, sourcePath, icon);
      const text = result.success
        ? `${result.summary}\n\nCompleted steps:\n${result.steps.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}`
        : `ERROR: ${result.summary}\n\nCompleted before failure:\n${result.steps.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}`;
      return { content: [{ type: 'text' as const, text }] };
    }
  );
}
