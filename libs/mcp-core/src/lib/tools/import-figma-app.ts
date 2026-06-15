import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import {
  findWorkspaceRoot,
  getWorkspacePort,
  registerWorkspaceApp,
} from './openfin-registration';

/**
 * Fully automated Figma Make → OpenFin Workspace import tool.
 * Creates the NX app, copies source, wires routing/themes/OpenFin, registers everywhere.
 * Workspace registration goes through the shared {@link registerWorkspaceApp} so it
 * stays in lockstep with the `register_openfin_app` tool.
 *
 * Works with any MCP client: Claude Code, VS Code Copilot, GitHub Copilot, etc.
 */

/**
 * Scan all apps' vite configs and project.json files to find used ports,
 * then return the next available port starting from 4204. Always skips the
 * workspace port so the app and workspace never collide.
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

  // Reserve well-known ports: Angular default (4200), React dev (4201),
  // workspace (4202), angular-fdc3 (4203), market-data-server (3000).
  [4200, 4201, 4202, 4203, 3000, getWorkspacePort(root)].forEach(p => usedPorts.add(p));

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

interface ImportOptions {
  /** Preview the plan (port, icon, root component, deps, token conflicts) without writing anything. */
  dryRun?: boolean;
  /** Keep the Figma export's own :root/.dark tokens winning the cascade (theme-showcase mode). Default: macro design system wins. */
  preserveFigmaTheme?: boolean;
  /** Run `nx build <app>` at the end and report pass/fail (slower). Default: false. */
  verifyBuild?: boolean;
}

function importFigmaApp(
  appName: string,
  title: string,
  description: string,
  port: number | undefined,
  sourcePath: string,
  icon?: string,
  opts: ImportOptions = {},
): { success: boolean; summary: string; steps: string[] } {
  const root = findWorkspaceRoot();
  const appDir = path.join(root, 'apps', appName);
  const publicLocal = path.join(root, 'apps/macro-workspace/public/local');
  const publicOpenshift = path.join(root, 'apps/macro-workspace/public/openshift');
  const basePath = `/${appName}/`;
  const adoptMacroTheme = !opts.preserveFigmaTheme;
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

    // ── Auto-detect ports ──
    // workspacePort: serves static view manifests + icons + settings.json (e.g. 4202).
    // resolvedPort: the app's own dev server port (e.g. 4204+), distinct from workspace.
    const workspacePort = getWorkspacePort(root);
    const resolvedPort = port ?? findNextAvailablePort(root);
    if (resolvedPort === workspacePort) {
      return { success: false, summary: `Requested port ${resolvedPort} conflicts with the workspace port. Choose a different port.`, steps };
    }
    steps.push(`Workspace port ${workspacePort} (serves view manifests + icons), app port ${resolvedPort}${port ? '' : ' (auto-detected)'}`);

    // Fail cleanly, removing any temp extraction dir first.
    const fail = (summary: string) => {
      if (tmpDir) { try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ } }
      return { success: false, summary, steps };
    };

    // ── Handle zip files ──
    let actualSourcePath = sourcePath;
    if (sourcePath.toLowerCase().endsWith('.zip')) {
      tmpDir = path.join(root, 'tmp', `figma-${appName}-${Date.now()}`);
      actualSourcePath = extractZip(sourcePath, tmpDir);
      steps.push(`Extracted zip to temporary directory`);
    }

    // ── Determine the Figma source root + validate it's an importable React export ──
    // Figma Make emits a Vite + React project. Reject Angular/Next/empty exports up
    // front so we never scaffold a broken app that points at a missing component.
    const figmaSrc = fs.existsSync(path.join(actualSourcePath, 'src'))
      ? path.join(actualSourcePath, 'src')
      : actualSourcePath;

    if (fs.existsSync(path.join(actualSourcePath, 'angular.json'))) {
      return fail('This looks like an Angular project (angular.json found), not a Figma Make React export. Use scaffold_angular_app for Angular apps.');
    }
    for (const nextCfg of ['next.config.js', 'next.config.mjs', 'next.config.ts']) {
      if (fs.existsSync(path.join(actualSourcePath, nextCfg))) {
        return fail(`This looks like a Next.js project (${nextCfg} found), not a plain Figma Make React export. Eject to a Vite React export first.`);
      }
    }
    const reactFileCount = countFilesMatching(figmaSrc, /\.(tsx|jsx)$/);
    if (reactFileCount === 0) {
      return fail(`No React component files (.tsx/.jsx) found under ${figmaSrc}. This does not look like a Figma Make React export.`);
    }
    steps.push(`Validated Figma source: ${reactFileCount} React component file(s)`);

    // ── Auto-detect title and description ──
    // Prefer the user-supplied title, then the figma package.json name,
    // but only if it doesn't look like a generic Figma-scoped placeholder
    // (e.g. "@Figma/My Make File", "figma-make-export-abc"). Fall back to
    // the app name, which is always meaningful (user-chosen kebab-case).
    const figmaPkgPath = path.join(actualSourcePath, 'package.json');
    let autoTitle = title;
    let autoDescription = description;
    if (fs.existsSync(figmaPkgPath) && (!autoTitle || !autoDescription)) {
      try {
        const figmaPkg = JSON.parse(fs.readFileSync(figmaPkgPath, 'utf8'));
        if (!autoTitle && figmaPkg.name && !isGenericFigmaName(figmaPkg.name)) {
          autoTitle = humanize(stripScope(figmaPkg.name));
        }
        if (!autoDescription && figmaPkg.description && !isGenericFigmaName(figmaPkg.description)) {
          autoDescription = figmaPkg.description;
        }
      } catch { /* skip */ }
    }
    if (!autoTitle) autoTitle = humanize(appName);
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
    const iconDarkUrl = `http://localhost:${workspacePort}/icons/capital-markets/dark/${resolvedIcon}.svg`;
    const iconLightUrl = `http://localhost:${workspacePort}/icons/capital-markets/light/${resolvedIcon}.svg`;
    const iconUrl = iconDarkUrl; // single-URL fallback for app.icons[].src
    const osIconDarkUrl = `https://{{OPENSHIFT_WORKSPACE_HOST}}/icons/capital-markets/dark/${resolvedIcon}.svg`;
    const osIconLightUrl = `https://{{OPENSHIFT_WORKSPACE_HOST}}/icons/capital-markets/light/${resolvedIcon}.svg`;
    const osIconUrl = osIconDarkUrl;

    // ── Analyze the Figma source (detection only — no writes yet) ──
    const figmaRootImport = detectRootComponent(figmaSrc);
    if (!figmaRootImport) {
      return fail(`Could not find a root component in the Figma export (looked for ${ROOT_CANDIDATES.join(', ')} under ${figmaSrc}). Ensure it has an App.tsx (or app/App.tsx).`);
    }
    const figmaCssImports = detectCssImports(figmaSrc);
    const hasTailwind = detectTailwind(actualSourcePath, figmaSrc);
    const depsToInstall = computeDepsToInstall(figmaPkgPath, root);
    const tokenConflicts = detectTokenConflicts(figmaSrc);

    // ── Dry run: report the plan and stop before any writes ──
    if (opts.dryRun) {
      if (tmpDir) { try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ } }
      const planLines = [
        `DRY RUN — no files written. Plan for apps/${appName}:`,
        ``,
        `  Title:           ${autoTitle}`,
        `  Description:     ${autoDescription}`,
        `  App port:        ${resolvedPort}`,
        `  Workspace port:  ${workspacePort}`,
        `  Base path:       ${basePath}`,
        `  Icon:            ${resolvedIcon}`,
        `  Root component:  ${figmaRootImport}`,
        `  CSS imports:     ${figmaCssImports.length ? figmaCssImports.map(s => s.replace(/^import '|';$/g, '')).join(', ') : '(none detected)'}`,
        `  Tailwind:        ${hasTailwind ? 'yes' : 'no'}`,
        `  Theme strategy:  ${adoptMacroTheme ? 'adopt macro design tokens (macro CSS wins the cascade)' : 'preserve figma tokens'}`,
        `  New deps:        ${depsToInstall.length ? depsToInstall.join(', ') : '(none — all already in monorepo)'}`,
        `  Token conflicts: ${tokenConflicts.length ? `${tokenConflicts.join(', ')} → macro-design ${adoptMacroTheme ? 'overrides these' : 'is overridden by figma'}` : '(none)'}`,
        ``,
        `Re-run with dryRun:false to apply.`,
      ];
      return { success: true, summary: planLines.join('\n'), steps };
    }

    // ── Create project structure (skip NX generator — manual is more reliable) ──
    fs.mkdirSync(path.join(appDir, 'src/app'), { recursive: true });

    // project.json — explicit serve/build targets with the resolved port
    // so the port is consistent across NX, Vite, package.json, and manifests.
    fs.writeFileSync(path.join(appDir, 'project.json'), JSON.stringify({
      name: appName,
      $schema: '../../node_modules/nx/schemas/project-schema.json',
      sourceRoot: `apps/${appName}/src`,
      projectType: 'application',
      tags: [],
      targets: {
        build: {
          executor: '@nx/vite:build',
          outputs: ['{options.outputPath}'],
          defaultConfiguration: 'production',
          options: { outputPath: `dist/apps/${appName}` },
          configurations: {
            development: { mode: 'development' },
            production: { mode: 'production' },
          },
        },
        serve: {
          executor: '@nx/vite:dev-server',
          defaultConfiguration: 'development',
          options: { buildTarget: `${appName}:build`, port: resolvedPort, host: 'localhost' },
          configurations: {
            development: { buildTarget: `${appName}:build:development`, hmr: true },
            production: { buildTarget: `${appName}:build:production`, hmr: false },
          },
        },
        preview: {
          executor: '@nx/vite:preview-server',
          defaultConfiguration: 'development',
          options: { buildTarget: `${appName}:build`, port: resolvedPort },
          configurations: {
            development: { buildTarget: `${appName}:build:development` },
            production: { buildTarget: `${appName}:build:production` },
          },
        },
      },
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

    // ── Copy Figma Make source files (figmaSrc resolved + validated above) ──
    const srcDir = path.join(appDir, 'src');
    const figmaDestDir = path.join(srcDir, 'figma');
    fs.mkdirSync(figmaDestDir, { recursive: true });

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

    // Copy public assets (Figma sometimes references these via figma:asset/...)
    const figmaPublic = path.join(actualSourcePath, 'public');
    if (fs.existsSync(figmaPublic)) {
      copyDirRecursive(figmaPublic, path.join(srcDir, 'assets'));
    }

    const copiedCount = countFiles(figmaDestDir);
    steps.push(`Copied ${copiedCount} files from Figma project into src/figma/`);

    // ── Rewrite Figma-specific import specifiers Vite can't resolve ──
    // (versioned specifiers like 'lucide-react@0.487.0' and the 'figma:asset/' scheme)
    const transformed = transformFigmaSources(figmaDestDir);
    if (transformed.versioned > 0) {
      steps.push(`Stripped version suffixes from ${transformed.versioned} import specifier(s)`);
    }
    if (transformed.assets > 0) {
      steps.push(`Rewrote ${transformed.assets} figma:asset import(s) to @/assets/ — verify those files exist under src/assets/`);
    }
    if (tokenConflicts.length > 0) {
      steps.push(`Token conflicts (${tokenConflicts.length}): ${adoptMacroTheme ? `macro-design overrides ${tokenConflicts.join(', ')}` : `figma keeps ${tokenConflicts.join(', ')}`}`);
    }

    // ── Tailwind configuration (hasTailwind already detected) ──
    // Copy any Tailwind/PostCSS config from the Figma export root.
    for (const configFile of ['tailwind.config.js', 'tailwind.config.ts', 'postcss.config.js', 'postcss.config.cjs']) {
      const cfgPath = path.join(actualSourcePath, configFile);
      if (fs.existsSync(cfgPath)) {
        fs.copyFileSync(cfgPath, path.join(appDir, configFile));
      }
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

    // ── Generate an ESLint flat config (extends repo base, ignores generated figma/) ──
    fs.writeFileSync(path.join(appDir, 'eslint.config.mjs'), `import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  // The src/figma/** tree is generated from a Figma Make export — don't lint it.
  { ignores: ['src/figma/**', 'dist/**', 'vite.config.*.timestamp*'] },
];
`);
    steps.push('Created eslint.config.mjs (ignores generated src/figma/)');

    // ── Install Figma dependencies not already provided by the monorepo ──
    // depsToInstall holds bare names (no Figma version pins) computed above.
    if (depsToInstall.length === 0) {
      steps.push('All Figma dependencies already available in the monorepo');
    } else {
      try {
        execSync(`npm install ${depsToInstall.join(' ')} --legacy-peer-deps`, { cwd: root, stdio: 'pipe', timeout: 180000 });
        steps.push(`Installed ${depsToInstall.length} new Figma dependencies (latest compatible): ${depsToInstall.join(', ')}`);
      } catch {
        steps.push(`Warning: install these Figma deps manually: ${depsToInstall.join(', ')}`);
      }
    }

    // ── Create app.tsx wrapper (matches the capital-markets-themes golden ref) ──
    // The shared macro theme controller handles dark/light state, localStorage
    // persistence, and BOTH system (prefers-color-scheme) and OpenFin platform
    // theme sync. Calling useTheme() activates it (it is also started in main.tsx).
    fs.writeFileSync(path.join(appDir, 'src/app/app.tsx'), `import { BrowserRouter } from 'react-router-dom';
import { useTheme } from '@macro/macro-design/react';
import FigmaApp from '${figmaRootImport}';

export function App() {
  // Activate the macro theme controller (default 'macro' + dark/light + system/OpenFin sync).
  useTheme();

  return (
    <BrowserRouter basename="${basePath}">
      <FigmaApp />
    </BrowserRouter>
  );
}

export default App;
`);
    steps.push('Created app.tsx (BrowserRouter + macro useTheme — system + OpenFin sync)');

    // ── Create main.tsx (figmaCssImports detected above) ──
    const macroCssImports = [
      "import '../../../libs/macro-design/src/lib/css/fonts.css';",
      "import '../../../libs/macro-design/src/lib/css/macro-etrading.css';",
      "import '../../../libs/macro-design/src/lib/css/macro-design.css';",
    ];
    // When adopting the Macro design system (default), import the macro CSS AFTER
    // the Figma styles so macro's :root/.dark tokens win the cascade — the imported
    // app looks like a Macro app, not generic Shadcn. Figma-only tokens (that macro
    // doesn't redefine) still apply. In preserve-figma mode, macro CSS goes first.
    const cssBlock = adoptMacroTheme
      ? [...figmaCssImports, ...macroCssImports]
      : [...macroCssImports, ...figmaCssImports];

    fs.writeFileSync(path.join(appDir, 'src/main.tsx'), `import * as ReactDOM from 'react-dom/client';
import { themeController } from '@macro/macro-design/react';
import App from './app/app';
${cssBlock.join('\n')}

// Apply the macro theme (default 'macro') + dark/light class before first paint.
themeController.start();

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);
`);
    steps.push(`Created main.tsx (themeController.start; ${adoptMacroTheme ? 'macro design tokens win' : 'figma tokens preserved'})`);

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
      // Longer subpath keys MUST come before their parents so Vite matches them first.
      '@': path.resolve(import.meta.dirname, './src'),
      '@macro/logger': path.resolve(import.meta.dirname, '../../libs/logger/src/index.ts'),
      '@macro/macro-react-grid': path.resolve(import.meta.dirname, '../../libs/macro-react-grid/src/index.ts'),
      '@macro/macro-design/react': path.resolve(import.meta.dirname, '../../libs/macro-design/src/lib/react/index.ts'),
      '@macro/macro-design': path.resolve(import.meta.dirname, '../../libs/macro-design/src/index.ts'),
      '@macro/openfin/theme-sync': path.resolve(import.meta.dirname, '../../libs/openfin/src/lib/theme-sync.ts'),
      '@macro/openfin/react': path.resolve(import.meta.dirname, '../../libs/openfin/src/lib/react.ts'),
      '@macro/openfin': path.resolve(import.meta.dirname, '../../libs/openfin/src/index.ts'),
      '@macro/transports/react': path.resolve(import.meta.dirname, '../../libs/transports/src/lib/react/index.ts'),
      '@macro/transports': path.resolve(import.meta.dirname, '../../libs/transports/src/index.ts'),
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

    // ── Register the app in the OpenFin workspace (shared with register_openfin_app) ──
    // Writes view manifests + manifest.fin.json + settings.json + Dock favorites for
    // both the local and openshift environments.
    const regSteps = registerWorkspaceApp(root, {
      appId: appName, title: autoTitle, description: autoDescription,
      urlPath: basePath, appPort: resolvedPort, workspacePort,
      iconName: resolvedIcon,
      tags: ['view', 'react', 'figma-make'],
    });
    steps.push(...regSteps);

    // ── Update root package.json ──
    // Script explicitly passes --port so the port shown in package.json matches
    // the one in project.json, vite.config.mts, and the .fin.json view manifest.
    const pkgPath = path.join(root, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkg.scripts[`start:${appName}`] = `nx serve ${appName} --port=${resolvedPort}`;
    pkg.scripts[`build:${appName}`] = `nx build ${appName}`;
    if (pkg.scripts['build:apps'] && !pkg.scripts['build:apps'].includes(appName)) {
      pkg.scripts['build:apps'] = pkg.scripts['build:apps'].replace(
        /--projects=([^\s]+)/, `--projects=$1,${appName}`
      );
    }
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    steps.push(`Updated package.json (start:${appName} --port=${resolvedPort}, build:${appName}, build:apps)`);

    // ── Clean up temporary extraction directory ──
    if (tmpDir) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        steps.push('Cleaned up temporary extraction directory');
      } catch { /* non-fatal */ }
    }

    // ── Optional: verify the generated app actually builds ──
    if (opts.verifyBuild) {
      try {
        execSync(`npx nx build ${appName} --skip-nx-cache`, { cwd: root, stdio: 'pipe', timeout: 300000 });
        steps.push('Verified: nx build succeeded');
      } catch (e: any) {
        const out = (e?.stdout?.toString?.() ?? '') + (e?.stderr?.toString?.() ?? '');
        steps.push(`Build verification FAILED — review src/figma for unresolved imports/assets. Tail:\n${out.split('\n').slice(-20).join('\n')}`);
      }
    }

    return {
      success: true,
      steps,
      summary: `Successfully imported "${autoTitle}" as apps/${appName}

  App port:       ${resolvedPort}       (dev server serving the app)
  Workspace port: ${workspacePort}       (serves view manifest + icons + settings)
  Base path:      ${basePath}
  App URL:        http://localhost:${resolvedPort}${basePath}
  Manifest URL:   http://localhost:${workspacePort}/local/${appName}.fin.json

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

/** Detect placeholder names generated by Figma Make (e.g. "@Figma/My Make File"). */
function isGenericFigmaName(name: string): boolean {
  const n = name.trim().toLowerCase();
  return (
    n.startsWith('@figma/') ||
    n === 'my make file' ||
    n === 'figma make export' ||
    n === 'untitled' ||
    /^figma[-_\s]?make[-_\s]?\w*$/.test(n) ||
    /^make[-_\s]file/.test(n)
  );
}

/** Drop a leading npm scope like "@acme/" so "@foo/bar" becomes "bar". */
function stripScope(name: string): string {
  const m = /^@[^/]+\/(.+)$/.exec(name);
  return m ? m[1] : name;
}

/** Turn "fx-market-data" or "my_project" into "Fx Market Data" / "My Project". */
function humanize(s: string): string {
  return s
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (c: string) => c.toUpperCase());
}

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

const SKIP_DIRS = new Set(['node_modules', '.git', '__MACOSX']);

/** Count files whose name matches `re`, recursively, skipping vendor dirs. */
function countFilesMatching(dir: string, re: RegExp): number {
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) n += countFilesMatching(p, re);
    else if (re.test(e.name)) n++;
  }
  return n;
}

/** Figma Make root-component candidates, in priority order. */
const ROOT_CANDIDATES = [
  'app/App.tsx', 'app/App.jsx',         // Figma Make nested pattern (most common)
  'App.tsx', 'App.jsx',                 // Standard React root
  'app.tsx', 'app.jsx',                 // Lowercase variant
  'pages/index.tsx', 'pages/index.jsx', // Next.js-style
  'components/App.tsx',                 // Components-only export
];

/** Resolve the import specifier (relative to src/app/) for the Figma root component. */
function detectRootComponent(figmaSrc: string): string | null {
  for (const candidate of ROOT_CANDIDATES) {
    if (fs.existsSync(path.join(figmaSrc, candidate))) {
      return `../figma/${candidate.replace(/\.(tsx|jsx)$/, '')}`;
    }
  }
  return null;
}

/** Figma CSS entrypoint candidates (relative to src/figma/), in priority order. */
const CSS_SEARCH = [
  { file: 'styles/index.css', importPath: './figma/styles/index.css' },
  { file: 'index.css', importPath: './figma/index.css' },
  { file: 'App.css', importPath: './figma/App.css' },
  { file: 'globals.css', importPath: './figma/globals.css' },
  { file: 'styles/globals.css', importPath: './figma/styles/globals.css' },
  { file: 'styles/tailwind.css', importPath: './figma/styles/tailwind.css' },
  { file: 'css/index.css', importPath: './figma/css/index.css' },
];

/** Build the list of Figma CSS import statements (stops at an index.css aggregator). */
function detectCssImports(figmaSrc: string): string[] {
  const out: string[] = [];
  for (const { file, importPath } of CSS_SEARCH) {
    if (fs.existsSync(path.join(figmaSrc, file))) {
      out.push(`import '${importPath}';`);
      if (file.includes('index.css')) break;
    }
  }
  return out;
}

/** Detect whether the Figma export uses Tailwind (config file or CSS directive). */
function detectTailwind(actualSourcePath: string, figmaSrc: string): boolean {
  for (const cfg of ['tailwind.config.js', 'tailwind.config.ts']) {
    if (fs.existsSync(path.join(actualSourcePath, cfg))) return true;
  }
  return findFileContaining(figmaSrc, '.css', "@import 'tailwindcss'")
    || findFileContaining(figmaSrc, '.css', '@import "tailwindcss"')
    || findFileContaining(figmaSrc, '.css', '@tailwind');
}

/** The Figma toolchain packages the monorepo already owns — never reinstall these. */
const FIGMA_TOOLCHAIN = new Set([
  'react', 'react-dom', 'react-router-dom', 'typescript', 'vite',
  '@vitejs/plugin-react', 'tailwindcss', '@tailwindcss/postcss',
  '@tailwindcss/vite', 'postcss', 'autoprefixer', '@types/react',
  '@types/react-dom', '@types/node', 'eslint',
]);

/**
 * Compute the Figma deps NOT already provided by the monorepo. Skips anything
 * declared in the root package.json (deps OR devDeps) regardless of the
 * Figma-pinned version, plus the toolchain. Returns bare names (no version) so
 * npm picks a version compatible with the monorepo's existing peer set.
 */
function computeDepsToInstall(figmaPkgPath: string, root: string): string[] {
  if (!fs.existsSync(figmaPkgPath)) return [];
  let figmaDeps: Record<string, string> = {};
  try {
    const figmaPkg = JSON.parse(fs.readFileSync(figmaPkgPath, 'utf8'));
    figmaDeps = { ...figmaPkg.dependencies, ...figmaPkg.devDependencies };
  } catch { return []; }
  let rootPkg: any = {};
  try { rootPkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')); } catch { /* ignore */ }
  const declared = new Set([
    ...Object.keys(rootPkg.dependencies ?? {}),
    ...Object.keys(rootPkg.devDependencies ?? {}),
  ]);
  const out: string[] = [];
  for (const dep of Object.keys(figmaDeps)) {
    if (FIGMA_TOOLCHAIN.has(dep) || declared.has(dep)) continue;
    if (fs.existsSync(path.join(root, 'node_modules', dep))) continue;
    out.push(dep);
  }
  return out;
}

/** Shadcn/Tailwind bridge tokens that macro-design.css defines — collisions matter for theming. */
const MACRO_BRIDGE_TOKENS = [
  '--background', '--foreground', '--card', '--card-foreground', '--popover', '--popover-foreground',
  '--primary', '--primary-foreground', '--secondary', '--secondary-foreground', '--muted', '--muted-foreground',
  '--accent', '--accent-foreground', '--destructive', '--destructive-foreground', '--border', '--input', '--ring',
  '--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5', '--radius',
  '--sidebar', '--sidebar-foreground', '--sidebar-primary', '--sidebar-primary-foreground',
  '--sidebar-accent', '--sidebar-accent-foreground', '--sidebar-border', '--sidebar-ring',
];

/** Scan the Figma CSS for design tokens that collide with the macro-design bridge. */
function detectTokenConflicts(figmaSrc: string): string[] {
  const found = new Set<string>();
  const scan = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { scan(p); continue; }
      if (!e.name.endsWith('.css')) continue;
      try {
        const txt = fs.readFileSync(p, 'utf8');
        for (const t of MACRO_BRIDGE_TOKENS) {
          if (txt.includes(`${t}:`) || txt.includes(`${t} :`)) found.add(t);
        }
      } catch { /* skip */ }
    }
  };
  scan(figmaSrc);
  return [...found].sort();
}

/**
 * Rewrite Figma-specific import specifiers that Vite cannot resolve:
 *  - strip version suffixes:  'lucide-react@0.487.0' → 'lucide-react'
 *  - rewrite asset scheme:     'figma:asset/abc.png'  → '@/assets/abc.png'
 * Mutates files in place under `figmaDir`. Returns counts for reporting.
 */
function transformFigmaSources(figmaDir: string): { versioned: number; assets: number } {
  let versioned = 0;
  let assets = 0;
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!/\.(tsx|ts|jsx|js|mts|cts)$/.test(e.name)) continue;
      let txt: string;
      try { txt = fs.readFileSync(p, 'utf8'); } catch { continue; }
      let changed = false;
      // Strip a trailing @x.y.z (optionally -tag) from import/require/dynamic-import specifiers.
      txt = txt.replace(
        /(from\s+['"]|import\s*\(\s*['"]|require\(\s*['"])(@?[\w./-]+?)@\d+\.\d+\.\d+(?:[-+][\w.]+)?(['"])/g,
        (_m, pre: string, spec: string, post: string) => { versioned++; changed = true; return `${pre}${spec}${post}`; },
      );
      // Rewrite Figma's asset scheme to a resolvable local path under src/assets/.
      txt = txt.replace(
        /(from\s+['"]|import\s*\(\s*['"])figma:asset\/([^'"]+)(['"])/g,
        (_m, pre: string, asset: string, post: string) => { assets++; changed = true; return `${pre}@/assets/${asset}${post}`; },
      );
      if (changed) { try { fs.writeFileSync(p, txt); } catch { /* skip */ } }
    }
  };
  walk(figmaDir);
  return { versioned, assets };
}

// ── MCP Registration ──

export function registerImportFigmaApp(server: McpServer): void {
  server.tool(
    'import_figma_app',
    `Import a Figma Make React project into the Macro monorepo as a fully registered OpenFin workspace view.

Fully automated pipeline:
1. Validates the export is a React project (rejects Angular/Next/empty) and extracts the zip
2. Creates an NX project with Vite 8 config, TypeScript, and the full @macro/* path aliases
3. Copies Figma source into src/figma/ and rewrites import specifiers Vite can't resolve
   (strips 'pkg@x.y.z' version suffixes, rewrites 'figma:asset/...' to local assets)
4. Wires the app to the @macro/macro-design theme system (themeController + useTheme),
   adopting the Macro design tokens by default so the app looks like a Macro app
5. Auto-detects Tailwind CSS and configures PostCSS; emits an ESLint config that ignores src/figma
6. Installs genuinely-new Figma deps (latest compatible, skipping anything the monorepo already has)
7. Creates OpenFin view manifests with FDC3 2.0 interop (local + openshift)
8. Registers in Home, Store, Dock, and both workspace manifests + settings
9. Updates package.json with start/build scripts

Use dryRun:true first to preview the plan (port, icon, root component, deps, token conflicts)
without writing anything. Works with Claude Code, VS Code Copilot, GitHub Copilot, or any MCP client.`,
    {
      appName: z.string().describe('App name in kebab-case (e.g., "risk-dashboard"). Becomes folder name, route path, and OpenFin app ID.'),
      title: z.string().default('').describe('Display title for OpenFin (auto-detected from Figma package.json if empty)'),
      description: z.string().default('').describe('Short description (auto-detected from Figma package.json if empty)'),
      port: z.number().optional().describe('Dev server port (auto-detected if omitted — scans existing apps to find next available port starting from 4204)'),
      sourcePath: z.string().describe('Path to Figma Make export folder or .zip file'),
      icon: z.string().optional().describe('Capital Markets icon name for OpenFin Home/Store/Dock (e.g., "dashboard", "candlestick_chart", "grid_view"). Auto-suggested from app name if omitted. Icons live in apps/macro-workspace/public/icons/capital-markets/{dark,light}/ — see index.json for the full list.'),
      dryRun: z.boolean().default(false).describe('Preview the plan (port, icon, root component, deps, token conflicts) without writing any files.'),
      preserveFigmaTheme: z.boolean().default(false).describe('Keep the Figma export\'s own :root/.dark tokens winning the cascade (theme-showcase mode). Default false: the Macro design system wins so the app adopts Macro styling.'),
      verifyBuild: z.boolean().default(false).describe('Run `nx build <app>` at the end and report pass/fail (slower, but catches unresolved imports/assets).'),
    },
    async ({ appName, title, description, port, sourcePath, icon, dryRun, preserveFigmaTheme, verifyBuild }) => {
      const result = importFigmaApp(appName, title, description, port, sourcePath, icon, { dryRun, preserveFigmaTheme, verifyBuild });
      const text = result.success
        ? `${result.summary}\n\nCompleted steps:\n${result.steps.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}`
        : `ERROR: ${result.summary}\n\nCompleted before failure:\n${result.steps.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}`;
      return { content: [{ type: 'text' as const, text }] };
    }
  );
}
