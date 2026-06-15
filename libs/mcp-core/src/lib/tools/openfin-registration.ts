import * as fs from 'fs';
import * as path from 'path';

/**
 * Shared OpenFin Workspace registration helpers.
 *
 * The Macro workspace serves TWO manifest environments from
 * `apps/macro-workspace/public/`:
 *   - `local/`     → dev (http://localhost:<workspacePort>/local/...)
 *   - `openshift/` → deployed (https://{{OPENSHIFT_*_HOST}}/openshift/...)
 *
 * Registering an app means writing, for BOTH environments:
 *   1. a view manifest `<env>/<appId>.fin.json`
 *   2. an entry in `<env>/manifest.fin.json` → customSettings.apps
 *   3. an entry in `<env>/settings.json`     → customSettings.apps
 *   4. a Dock favorite in `<env>/settings.json` → customSettings.dock3.favorites
 *
 * `import_figma_app` and `register_openfin_app` both go through
 * {@link registerWorkspaceApp} so the registration shape never drifts.
 */

/** Walk up from this file to the monorepo root (package.json name === '@macro/source'). */
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
  throw new Error('Could not find monorepo root (package.json with name @macro/source)');
}

/** The workspace app's serve port (serves static view manifests, icons, settings). */
export function getWorkspacePort(root: string): number {
  const projPath = path.join(root, 'apps/macro-workspace/project.json');
  if (fs.existsSync(projPath)) {
    try {
      const proj = JSON.parse(fs.readFileSync(projPath, 'utf8'));
      const port = proj.targets?.serve?.options?.port ?? proj.targets?.['serve-static']?.options?.port;
      if (typeof port === 'number') return port;
    } catch { /* fall through */ }
  }
  return 4202;
}

/** Read the Capital Markets icon names from index.json (falls back to a dir scan). */
export function listAvailableIcons(root: string): string[] {
  const indexPath = path.join(root, 'apps/macro-workspace/public/icons/capital-markets/index.json');
  if (fs.existsSync(indexPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      if (Array.isArray(parsed.icons) && parsed.icons.length > 0) return parsed.icons;
    } catch { /* fall through */ }
  }
  const dir = path.join(root, 'apps/macro-workspace/public/icons/capital-markets/dark');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.svg')).map(f => f.replace(/\.svg$/, '')).sort();
}

/** Append an app entry to a manifest/settings file's customSettings.apps (idempotent). */
export function addAppToJsonFile(filePath: string, appEntry: { appId: string; [k: string]: unknown }): boolean {
  if (!fs.existsSync(filePath)) return false;
  const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const apps = json.customSettings?.apps;
  if (Array.isArray(apps) && !apps.find((a: any) => a.appId === appEntry.appId)) {
    apps.push(appEntry);
    fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n');
    return true;
  }
  return false;
}

/** Append a Dock favorite to a settings file's customSettings.dock3.favorites (idempotent). */
export function addDockFavorite(filePath: string, favorite: { appId: string; [k: string]: unknown }): boolean {
  if (!fs.existsSync(filePath)) return false;
  const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const favs = json.customSettings?.dock3?.favorites;
  if (Array.isArray(favs) && !favs.find((f: any) => f.appId === favorite.appId)) {
    favs.push(favorite);
    fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n');
    return true;
  }
  return false;
}

export interface RegisterWorkspaceAppOptions {
  appId: string;
  title: string;
  description: string;
  /** Path appended after the host, e.g. `/risk-dashboard/` (Figma base) or `/fx-blotter` (route) or ''. */
  urlPath: string;
  /** The app's own dev-server port. */
  appPort: number;
  /** The workspace static-server port (serves manifests + icons). */
  workspacePort: number;
  /** Resolved Capital Markets icon name (dark/light variants must exist). */
  iconName: string;
  /** App tags, e.g. ['view', 'react']. */
  tags: string[];
}

/**
 * Write the full OpenFin registration for an app across BOTH environments:
 * 2 view manifests + 4 customSettings.apps entries + 2 Dock favorites.
 * Returns human-readable step messages. Throws if the workspace public dirs are missing.
 */
export function registerWorkspaceApp(root: string, opts: RegisterWorkspaceAppOptions): string[] {
  const { appId, title, description, urlPath, appPort, workspacePort, iconName, tags } = opts;
  const publicLocal = path.join(root, 'apps/macro-workspace/public/local');
  const publicOpenshift = path.join(root, 'apps/macro-workspace/public/openshift');
  const steps: string[] = [];

  if (!fs.existsSync(publicLocal)) {
    throw new Error(`Workspace local public dir not found: ${publicLocal}`);
  }

  const iconDarkUrl = `http://localhost:${workspacePort}/icons/capital-markets/dark/${iconName}.svg`;
  const osIconDarkUrl = `https://{{OPENSHIFT_WORKSPACE_HOST}}/icons/capital-markets/dark/${iconName}.svg`;
  const envVar = `OPENSHIFT_${appId.replace(/-/g, '_').toUpperCase()}_HOST`;

  // 1. View manifests (local + openshift)
  const localView = { url: `http://localhost:${appPort}${urlPath}`, fdc3InteropApi: '2.0', interop: { currentContextGroup: 'green' } };
  const osView = { url: `https://{{${envVar}}}${urlPath}`, fdc3InteropApi: '2.0', interop: { currentContextGroup: 'green' } };
  fs.writeFileSync(path.join(publicLocal, `${appId}.fin.json`), JSON.stringify(localView, null, 2) + '\n');
  if (fs.existsSync(publicOpenshift)) {
    fs.writeFileSync(path.join(publicOpenshift, `${appId}.fin.json`), JSON.stringify(osView, null, 2) + '\n');
  }
  steps.push('Wrote view manifests (local + openshift)');

  // 2-3. App entries in manifest.fin.json + settings.json (both environments)
  const localAppEntry = {
    appId, name: appId, title, description,
    manifest: `http://localhost:${workspacePort}/local/${appId}.fin.json`,
    manifestType: 'view',
    icons: [{ src: iconDarkUrl }],
    contactEmail: 'contact@example.com', supportEmail: 'support@example.com',
    publisher: 'OpenFin', intents: [], images: [],
    tags,
  };
  const osAppEntry = {
    ...localAppEntry,
    manifest: `https://{{OPENSHIFT_WORKSPACE_HOST}}/openshift/${appId}.fin.json`,
    icons: [{ src: osIconDarkUrl }],
  };
  addAppToJsonFile(path.join(publicLocal, 'manifest.fin.json'), localAppEntry);
  addAppToJsonFile(path.join(publicLocal, 'settings.json'), localAppEntry);
  addAppToJsonFile(path.join(publicOpenshift, 'manifest.fin.json'), osAppEntry);
  addAppToJsonFile(path.join(publicOpenshift, 'settings.json'), osAppEntry);
  steps.push('Registered in manifest.fin.json + settings.json (local + openshift)');

  // 4. Dock favorites (icon MUST be a plain string URL — the {dark,light} object hangs the dock).
  addDockFavorite(path.join(publicLocal, 'settings.json'), { type: 'item', id: `fav-${appId}`, label: title, icon: iconDarkUrl, appId });
  addDockFavorite(path.join(publicOpenshift, 'settings.json'), { type: 'item', id: `fav-${appId}`, label: title, icon: osIconDarkUrl, appId });
  steps.push('Added to Dock favorites (local + openshift)');

  return steps;
}

/** List the appIds already registered in local/manifest.fin.json (for reporting). */
export function listRegisteredApps(root: string): string[] {
  const file = path.join(root, 'apps/macro-workspace/public/local/manifest.fin.json');
  if (!fs.existsSync(file)) return [];
  try {
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    const apps = json.customSettings?.apps;
    return Array.isArray(apps) ? apps.map((a: any) => a.appId).filter(Boolean) : [];
  } catch { return []; }
}
