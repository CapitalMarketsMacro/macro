#!/usr/bin/env node
/**
 * Cross-platform "npm run stop" — finds and kills any process listening on
 * ports used by the apps in this monorepo. Reads ports from every
 * apps/<app>/project.json (targets.serve.options.port) and vite.config[.mts],
 * so new apps added by the import_figma_app MCP tool get picked up for free.
 *
 * Also kills:
 *   - market-data-server (port 3000, read from its project.json)
 *   - OpenFin runtime processes spawned by `npm run launch`
 *
 * No additional dependencies — uses only Node stdlib + netstat/lsof.
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

    // vite.config[.mts] server.port
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
          // match any of: `: 3000`, `.listen(3000`, `PORT = 3000`, `|| 3000`
          // Covers fallback literals in common patterns.
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
              // Only accept reasonable dev server ports (3000–9999)
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
          // Accept 0.0.0.0:PORT, 127.0.0.1:PORT, [::]:PORT
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

/** Kill a single PID. */
function killPid(pid) {
  try {
    if (isWindows) {
      spawnSync('taskkill', ['/F', '/PID', String(pid)], { stdio: 'ignore' });
    } else {
      spawnSync('kill', ['-9', String(pid)], { stdio: 'ignore' });
    }
    return true;
  } catch {
    return false;
  }
}

/** Kill all processes matching an image name (used for OpenFin). */
function killByName(name) {
  try {
    if (isWindows) {
      spawnSync('taskkill', ['/F', '/IM', name], { stdio: 'ignore' });
    } else {
      spawnSync('pkill', ['-9', '-f', name], { stdio: 'ignore' });
    }
  } catch { /* ignore */ }
}

// ── main ──
const ports = [...discoverPorts()].sort((a, b) => a - b);
if (ports.length === 0) {
  console.log('No ports discovered from apps/ — nothing to stop.');
  process.exit(0);
}

console.log(`Scanning ${ports.length} ports: ${ports.join(', ')}`);
let killed = 0;
for (const port of ports) {
  const pids = findPidsOnPort(port);
  if (pids.length === 0) continue;
  console.log(`  port ${port}: killing pid(s) ${pids.join(', ')}`);
  for (const pid of pids) {
    if (killPid(pid)) killed++;
  }
}

// Also clean up OpenFin runtime processes started by `npm run launch`.
// These sometimes outlive the npm-start shell and keep sockets open.
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
