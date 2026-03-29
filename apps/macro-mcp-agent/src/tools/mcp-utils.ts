/**
 * Shared utilities for MCP tools that create files and modify configs.
 */
import * as fs from 'fs';
import * as path from 'path';

/**
 * Find the monorepo root by walking up directories looking for package.json with name @macro/source.
 */
export function findWorkspaceRoot(): string {
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
 * Add an app entry to the customSettings.apps array in a manifest or settings JSON file.
 * Skips duplicates by appId.
 */
export function addAppToJsonFile(filePath: string, appEntry: any): void {
  if (!fs.existsSync(filePath)) return;
  const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const apps = json.customSettings?.apps;
  if (Array.isArray(apps) && !apps.find((a: any) => a.appId === appEntry.appId)) {
    apps.push(appEntry);
  }
  fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n');
}

/**
 * Add a favorite entry to the dock3.favorites array in a settings JSON file.
 * Skips duplicates by appId.
 */
export function addDockFavorite(filePath: string, favorite: any): void {
  if (!fs.existsSync(filePath)) return;
  const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const favs = json.customSettings?.dock3?.favorites;
  if (Array.isArray(favs) && !favs.find((f: any) => f.appId === favorite.appId)) {
    favs.push(favorite);
  }
  fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n');
}

/**
 * Recursively copy a directory.
 */
export function copyDirRecursive(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirRecursive(s, d);
    else fs.copyFileSync(s, d);
  }
}

/**
 * Count files in a directory recursively.
 */
export function countFiles(dir: string): number {
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) count += countFiles(path.join(dir, entry.name));
    else count++;
  }
  return count;
}

/**
 * Convert camelCase field name to a human-readable header name.
 * e.g., "changePercent" → "Change Percent", "cusip" → "CUSIP"
 */
export function toHeaderName(field: string): string {
  const acronyms = new Set(['id', 'cusip', 'isin', 'url', 'uuid', 'pnl', 'fx', 'ir', 'dv01', 'cds', 'etf']);
  if (acronyms.has(field.toLowerCase())) return field.toUpperCase();
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/^\s/, '')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}
