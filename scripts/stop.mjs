#!/usr/bin/env node
/**
 * Cross-platform "npm run stop" — stops the dev servers started by `npm start`,
 * `npm run start:*`, `npm run serve:*`, and `npm run launch`.
 *
 * Two complementary strategies, because port-scanning alone is not enough:
 *
 *   1. Port kill — find and kill whatever is LISTENING on the ports the apps
 *      serve on (discovered from apps/<app>/project.json and vite.config[.mts]).
 *      Catches plain listeners (e.g. market-data-server) and any tool we don't
 *      recognise.
 *
 *   2. Process-tree sweep — find this repo's `nx serve` / `concurrently` /
 *      `vite` / `run-executor` node processes by command line and kill their
 *      whole process trees. This is the important one on Windows: those
 *      processes (and their esbuild/worker children) often DON'T hold the
 *      listening socket themselves and/or drift to another port when theirs is
 *      taken (Vite: "Port 4201 is in use, trying another one..."), so a
 *      port-only scan leaves dozens of orphaned node processes behind after a
 *      Ctrl+C that didn't tear down the tree.
 *
 * Scoped to THIS repo and excludes MCP servers (macro-mcp, angular/nx mcp) so
 * it never kills the editor/agent tooling. No extra dependencies — Node stdlib
 * + netstat/taskkill (Windows) or lsof/ps/kill (POSIX).
 */

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const root = dirname(dirname(__filename));
const isWindows = process.platform === 'win32';

/** Scan all apps to discover ports they serve on. */
function discoverPorts() {
  const ports = new Set();
  const appsDir = join(root, 'apps');
  if (!existsSync(appsDir)) return ports;

  for (const entry of readdirSync(appsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const appPath = join(appsDir, entry.name);

    // project.json targets.serve.options.port
    const projPath = join(appPath, 'project.json');
    if (existsSync(projPath)) {
      try {
        const proj = JSON.parse(readFileSync(projPath, 'utf8'));
        for (const targetName of ['serve', 'serve-static', 'preview', 'dev']) {
          const p = proj.targets?.[targetName]?.options?.port;
          if (typeof p === 'number') ports.add(p);
        }
      } catch { /* skip bad JSON */ }
    }

    // vite.config[.mts] server.port. (Vite can drift to another port when this
    // one is busy, but the process-tree sweep below catches those by command
    // line, so the exact configured port is enough as a backstop here.)
    for (const cfg of ['vite.config.ts', 'vite.config.mts']) {
      const cfgPath = join(appPath, cfg);
      if (existsSync(cfgPath)) {
        try {
          const content = readFileSync(cfgPath, 'utf8');
          const m = content.match(/port:\s*(\d+)/);
          if (m) ports.add(parseInt(m[1], 10));
        } catch { /* skip */ }
      }
    }

    // Fallback: scan src/main.ts/.js for literal port usage so Node services
    // like market-data-server (hardcoded port 3000) are picked up even when
    // they're not in project.json or a vite config.
    for (const main of ['src/main.ts', 'src/main.js', 'src/index.ts']) {
      const mainPath = join(appPath, main);
      if (existsSync(mainPath)) {
        try {
          const content = readFileSync(mainPath, 'utf8');
          const patterns = [
            /:\s*(\d{4,5})\b/g,
            /\.listen\s*\(\s*(\d{4,5})\b/g,
            /PORT\s*=\s*(\d{4,5})\b/g,
            /\|\|\s*(\d{4,5})\b/g,
          ];
          for (const re of patterns) {
            let m;
            while ((m = re.exec(content)) !== null) {
              const p = parseInt(m[1], 10);
              if (p >= 3000 && p <= 9999) ports.add(p);
            }
          }
        } catch { /* skip */ }
      }
    }
  }
  return ports;
}

/** Find PIDs listening on the given port, cross-platform. */
function findPidsOnPort(port) {
  try {
    if (isWindows) {
      const out = execSync(`netstat -ano -p tcp`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      const pids = new Set();
      for (const line of out.split(/\r?\n/)) {
        const parts = line.trim().split(/\s+/);
        // Proto  LocalAddr  ForeignAddr  State  PID
        if (parts.length >= 5 && parts[3] === 'LISTENING') {
          const local = parts[1];
          if (local && local.endsWith(`:${port}`)) {
            const pid = parseInt(parts[4], 10);
            if (!Number.isNaN(pid) && pid > 0) pids.add(pid);
          }
        }
      }
      return [...pids];
    } else {
      const out = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      return out.split(/\s+/).filter(Boolean).map(Number).filter((n) => !Number.isNaN(n));
    }
  } catch {
    return [];
  }
}

/**
 * Enumerate node processes (pid + command line) so we can match this repo's
 * dev servers regardless of which port they actually bound to.
 */
function listNodeProcesses() {
  const procs = [];
  try {
    if (isWindows) {
      // Single-quoted filter only → no nested double quotes to escape through cmd.
      const ps =
        "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' } | " +
        'Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress';
      const out = execSync(`powershell -NoProfile -NonInteractive -Command "${ps}"`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true,
        maxBuffer: 16 * 1024 * 1024,
      });
      let parsed = JSON.parse(out.trim() || '[]');
      if (!Array.isArray(parsed)) parsed = [parsed];
      for (const p of parsed) {
        if (p && p.ProcessId) procs.push({ pid: Number(p.ProcessId), cmd: p.CommandLine || '' });
      }
    } else {
      const out = execSync('ps -eo pid=,command=', { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
      for (const line of out.split('\n')) {
        const m = line.trim().match(/^(\d+)\s+(.*)$/);
        if (!m) continue;
        const cmd = m[2];
        if (/\bnode\b/.test(cmd)) procs.push({ pid: parseInt(m[1], 10), cmd });
      }
    }
  } catch { /* enumeration unavailable — port kill still runs */ }
  return procs;
}

/** True for THIS repo's dev-server processes; never matches MCP/editor tooling. */
function isRepoDevServer(cmd) {
  if (!cmd) return false;
  const lc = cmd.toLowerCase();
  const r = root.toLowerCase();
  const inRepo = lc.includes(r) || lc.includes(r.replace(/\\/g, '/'));
  if (!inRepo) return false;
  // Never touch MCP servers, this script, or test runners.
  if (/macro-mcp|[\\/ ]mcp\b|\bmcp\.|vitest|stop\.mjs/i.test(cmd)) return false;
  // Dev-server command shapes started by npm start / start:* / serve:*.
  return /\bnx(\.js)?\b[^\n]*\bserve\b|run-executor|\bconcurrently\b|[\\/]vite[\\/]|\bvite\.js\b|\bvite\b/i.test(cmd);
}

/** Kill a single PID (and on Windows its whole tree). Returns true on success. */
function killTree(pid) {
  if (isWindows) {
    const r = spawnSync('taskkill', ['/F', '/T', '/PID', String(pid)], { encoding: 'utf8', windowsHide: true });
    // exit 0 = killed; 128 = not found (already gone) — treat as success.
    return r.status === 0 || r.status === 128;
  }
  // POSIX: kill the process group if we can, else the pid.
  try { process.kill(-pid, 'SIGKILL'); return true; } catch { /* not a group leader */ }
  const r = spawnSync('kill', ['-9', String(pid)], { encoding: 'utf8' });
  return r.status === 0;
}

/** Kill all processes matching an image name (used for OpenFin). */
function killByName(name) {
  try {
    if (isWindows) {
      spawnSync('taskkill', ['/F', '/IM', name], { stdio: 'ignore', windowsHide: true });
    } else {
      spawnSync('pkill', ['-9', '-f', name], { stdio: 'ignore' });
    }
  } catch { /* ignore */ }
}

// ── main ──
let killed = 0;
const alreadyKilled = new Set();

// 1) Kill anything LISTENING on a known app port (backstop for plain servers).
const ports = [...discoverPorts()].sort((a, b) => a - b);
console.log(`Scanning ${ports.length} ports: ${ports.join(', ')}`);
for (const port of ports) {
  for (const pid of findPidsOnPort(port)) {
    if (alreadyKilled.has(pid) || pid === process.pid) continue;
    console.log(`  port ${port}: killing pid ${pid}`);
    if (killTree(pid)) { killed++; alreadyKilled.add(pid); }
    else console.warn(`  port ${port}: FAILED to kill pid ${pid}`);
  }
}

// 2) Sweep this repo's dev-server process trees, regardless of bound port.
const devServers = listNodeProcesses().filter((p) => p.pid !== process.pid && isRepoDevServer(p.cmd));
if (devServers.length) {
  console.log(`Found ${devServers.length} dev-server process(es) (nx serve / concurrently / vite):`);
  for (const { pid, cmd } of devServers) {
    if (alreadyKilled.has(pid)) continue;
    const label = cmd.replace(/\s+/g, ' ').slice(0, 80);
    console.log(`  killing pid ${pid}  ${label}`);
    if (killTree(pid)) { killed++; alreadyKilled.add(pid); }
    else console.warn(`  FAILED to kill pid ${pid}`);
  }
}

// 3) Also clean up OpenFin runtime processes started by `npm run launch`.
if (process.argv.includes('--with-openfin') || process.argv.includes('--all')) {
  console.log('Killing OpenFin runtime processes...');
  if (isWindows) {
    killByName('OpenFinRVM.exe');
    killByName('openfin.exe');
  } else {
    killByName('OpenFinRVM');
    killByName('openfin');
  }
}

console.log(killed === 0 ? 'Nothing was running.' : `Done. Killed ${killed} process(es).`);
