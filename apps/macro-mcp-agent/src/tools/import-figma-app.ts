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

function importFigmaApp(
  appName: string,
  title: string,
  description: string,
  port: number,
  sourcePath: string,
): { success: boolean; summary: string; steps: string[] } {
  const root = findWorkspaceRoot();
  const appDir = path.join(root, 'apps', appName);
  const publicLocal = path.join(root, 'apps/macro-workspace/public/local');
  const publicOpenshift = path.join(root, 'apps/macro-workspace/public/openshift');
  const basePath = `/${appName}/`;
  const steps: string[] = [];

  try {
    // ── Check if app already exists ──
    if (fs.existsSync(appDir)) {
      return { success: false, summary: `App directory apps/${appName} already exists. Choose a different name.`, steps };
    }

    // ── Validate source path ──
    if (!fs.existsSync(sourcePath)) {
      return { success: false, summary: `Source path not found: ${sourcePath}`, steps };
    }

    // ── Handle zip files ──
    let actualSourcePath = sourcePath;
    if (sourcePath.endsWith('.zip')) {
      const extractDir = path.join(root, 'tmp', `figma-${appName}`);
      fs.mkdirSync(extractDir, { recursive: true });
      try {
        execSync(`tar -xf "${sourcePath}" -C "${extractDir}"`, { cwd: root, stdio: 'pipe' });
        actualSourcePath = extractDir;
        steps.push(`Extracted zip to ${extractDir}`);
      } catch {
        return { success: false, summary: `Failed to extract zip: ${sourcePath}`, steps };
      }
    }

    // ── Try NX generator, but don't depend on it ──
    try {
      execSync(
        `npx nx g @nx/react:app ${appName} --directory=apps/${appName} --style=css --bundler=vite --routing=false --e2eTestRunner=none --skipFormat`,
        { cwd: root, stdio: 'pipe', timeout: 120000 }
      );
      steps.push(`NX generator succeeded`);
    } catch {
      steps.push('NX generator failed — creating project files manually');
    }
    fs.mkdirSync(path.join(appDir, 'src/app'), { recursive: true });

    // Always write project.json + tsconfig (ensures NX recognizes the project)
    if (!fs.existsSync(path.join(appDir, 'project.json'))) {
      fs.writeFileSync(path.join(appDir, 'project.json'), JSON.stringify({
        name: appName,
        $schema: '../../node_modules/nx/schemas/project-schema.json',
        sourceRoot: `apps/${appName}/src`,
        projectType: 'application',
        targets: {
          build: { executor: '@nx/vite:build', outputs: ['{options.outputPath}'], options: { outputPath: `dist/apps/${appName}` } },
          serve: { executor: '@nx/vite:dev-server', options: { buildTarget: `${appName}:build`, port } },
        },
        tags: [],
      }, null, 2));
    }
    if (!fs.existsSync(path.join(appDir, 'tsconfig.json'))) {
      fs.writeFileSync(path.join(appDir, 'tsconfig.json'), JSON.stringify({
        extends: '../../tsconfig.base.json',
        compilerOptions: { jsx: 'react-jsx', strict: true, esModuleInterop: true, allowSyntheticDefaultImports: true },
        files: [], include: [], references: [{ path: './tsconfig.app.json' }],
      }, null, 2));
    }
    if (!fs.existsSync(path.join(appDir, 'tsconfig.app.json'))) {
      fs.writeFileSync(path.join(appDir, 'tsconfig.app.json'), JSON.stringify({
        extends: './tsconfig.json',
        compilerOptions: { outDir: '../../dist/out-tsc', types: ['node', 'vite/client'] },
        include: ['src/**/*.ts', 'src/**/*.tsx'], exclude: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
      }, null, 2));
    }
    steps.push('Project config verified');

    // ── Copy Figma Make source files ──
    // Figma Make exports a full React app: package.json, src/App.tsx, src/components/, tailwind, etc.
    // We copy the entire src/ tree into our NX app's src/figma/ and wire it up.
    const srcDir = path.join(appDir, 'src');
    const figmaDestDir = path.join(srcDir, 'figma');
    fs.mkdirSync(figmaDestDir, { recursive: true });
    fs.mkdirSync(path.join(srcDir, 'app'), { recursive: true });

    // Detect if this is a full React app (has package.json or src/App.tsx)
    const figmaSrc = fs.existsSync(path.join(actualSourcePath, 'src'))
      ? path.join(actualSourcePath, 'src')
      : actualSourcePath;
    const isFullApp = fs.existsSync(path.join(actualSourcePath, 'package.json'))
      || fs.existsSync(path.join(figmaSrc, 'App.tsx'))
      || fs.existsSync(path.join(figmaSrc, 'App.jsx'));

    // Copy the entire Figma src/ into src/figma/
    copyDirRecursive(figmaSrc, figmaDestDir);
    const copiedCount = countFiles(figmaDestDir);

    // Also copy any public assets
    const figmaPublic = path.join(actualSourcePath, 'public');
    if (fs.existsSync(figmaPublic)) {
      copyDirRecursive(figmaPublic, path.join(srcDir, 'assets'));
    }

    // Copy Tailwind/PostCSS config if present (for Figma Make apps that use Tailwind)
    let hasTailwind = false;
    for (const configFile of ['tailwind.config.js', 'tailwind.config.ts', 'postcss.config.js', 'postcss.config.cjs']) {
      const cfgPath = path.join(actualSourcePath, configFile);
      if (fs.existsSync(cfgPath)) {
        fs.copyFileSync(cfgPath, path.join(appDir, configFile));
        if (configFile.startsWith('tailwind')) hasTailwind = true;
      }
    }

    // Detect Tailwind from CSS files if no config was found
    if (!hasTailwind) {
      hasTailwind = findFileContaining(figmaDestDir, '.css', '@import \'tailwindcss\'')
        || findFileContaining(figmaDestDir, '.css', '@import "tailwindcss"')
        || findFileContaining(figmaDestDir, '.css', '@tailwind');
    }

    // Create PostCSS config for Tailwind if needed and not already present
    if (hasTailwind && !fs.existsSync(path.join(appDir, 'postcss.config.cjs')) && !fs.existsSync(path.join(appDir, 'postcss.config.js'))) {
      fs.writeFileSync(path.join(appDir, 'postcss.config.cjs'), `module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
`);
      steps.push('Created postcss.config.cjs for Tailwind CSS');
    }

    // Detect the Figma root component — check multiple common locations
    let figmaRootImport = '../figma/App';
    const rootCandidates = [
      'app/App.tsx', 'app/App.jsx',       // Figma Make nested pattern
      'App.tsx', 'App.jsx',                // Standard React root
      'app.tsx', 'app.jsx',                // Lowercase variant
      'pages/index.tsx', 'pages/index.jsx', // Next.js-style
    ];
    for (const candidate of rootCandidates) {
      if (fs.existsSync(path.join(figmaDestDir, candidate))) {
        const importPath = candidate.replace(/\.(tsx|jsx)$/, '');
        figmaRootImport = `../figma/${importPath}`;
        break;
      }
    }

    steps.push(`Copied ${copiedCount} files from Figma project into src/figma/ (${isFullApp ? 'full React app detected' : 'component files'})`);

    // ── Install Figma project dependencies that aren't in the monorepo ──
    const figmaPkgPath = path.join(actualSourcePath, 'package.json');
    if (fs.existsSync(figmaPkgPath)) {
      try {
        const figmaPkg = JSON.parse(fs.readFileSync(figmaPkgPath, 'utf8'));
        const figmaDeps = { ...figmaPkg.dependencies, ...figmaPkg.devDependencies };
        // Filter out react/react-dom (already in monorepo) and check what's missing
        const skip = new Set(['react', 'react-dom', 'react-router-dom', 'typescript', 'vite', '@vitejs/plugin-react', 'tailwindcss', '@tailwindcss/postcss', 'postcss']);
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
          } catch (installErr: any) {
            steps.push(`Warning: some Figma dependencies may need manual install: ${toInstall.join(', ')}`);
          }
        }
      } catch { /* skip if package.json is malformed */ }
    }

    // ── Create app.tsx that wraps the Figma component ──
    const srcApp = path.join(appDir, 'src/app');
    fs.writeFileSync(path.join(srcApp, 'app.tsx'), `import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { getInitialIsDark, applyDarkMode, onSystemThemeChange } from '@macro/macro-design';
import FigmaApp from '${figmaRootImport}';

export function App() {
  const [isDark, setIsDark] = useState(getInitialIsDark);
  useEffect(() => { applyDarkMode(isDark); }, [isDark]);
  useEffect(() => onSystemThemeChange((d) => setIsDark(d)), []);

  return (
    <BrowserRouter basename="${basePath}">
      <FigmaApp />
    </BrowserRouter>
  );
}

export default App;
`);
    steps.push('Created app.tsx with BrowserRouter + theme sync');

    // ── Create main.tsx ──
    // Find the main CSS entry point from the Figma export
    const figmaCssImports: string[] = [];
    const cssSearchPaths = [
      // Direct files in figma root
      { file: 'index.css', importPath: './figma/index.css' },
      { file: 'App.css', importPath: './figma/App.css' },
      { file: 'globals.css', importPath: './figma/globals.css' },
      // Files in styles/ subdirectory (common Figma Make pattern)
      { file: 'styles/index.css', importPath: './figma/styles/index.css' },
      { file: 'styles/globals.css', importPath: './figma/styles/globals.css' },
      { file: 'styles/tailwind.css', importPath: './figma/styles/tailwind.css' },
      // Files in css/ subdirectory
      { file: 'css/index.css', importPath: './figma/css/index.css' },
    ];
    for (const { file, importPath } of cssSearchPaths) {
      if (fs.existsSync(path.join(figmaDestDir, file))) {
        figmaCssImports.push(`import '${importPath}';`);
        // If we found styles/index.css which imports others, that's the entry — stop
        if (file.includes('index.css')) break;
      }
    }

    fs.writeFileSync(path.join(appDir, 'src/main.tsx'), `import * as ReactDOM from 'react-dom/client';
import App from './app/app';
import '../../../libs/macro-design/src/lib/css/fonts.css';
import '../../../libs/macro-design/src/lib/css/macro-design.css';
${figmaCssImports.join('\n')}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);
`);
    steps.push('Created main.tsx with @macro/macro-design CSS');

    // ── Create vite.config.ts ──
    const tailwindImport = hasTailwind ? `import tailwindcss from '@tailwindcss/postcss';\n` : '';
    const tailwindCssBlock = hasTailwind ? `  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },\n` : '';

    fs.writeFileSync(path.join(appDir, 'vite.config.ts'), `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
${tailwindImport}import path from 'path';

export default defineConfig(() => ({
  root: __dirname,
  base: '${basePath}',
  server: { port: ${port}, host: 'localhost' },
  preview: { port: ${port}, host: 'localhost' },
  plugins: [react(), nxViteTsPaths()],
${tailwindCssBlock}
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@macro/macro-design': path.resolve(__dirname, '../../libs/macro-design/src/index.ts'),
      // Add more @macro/* aliases as needed:
      // '@macro/logger': path.resolve(__dirname, '../../libs/logger/src/index.ts'),
      // '@macro/macro-react-grid': path.resolve(__dirname, '../../libs/macro-react-grid/src/index.ts'),
      // '@macro/transports': path.resolve(__dirname, '../../libs/transports/src/index.ts'),
    },
  },
  build: {
    outDir: '../../dist/apps/${appName}',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: { transformMixedEsModules: true },
  },
}));
`);
    steps.push('Created vite.config.ts with base path + @macro/* aliases');

    // ── Create index.html ──
    if (!fs.existsSync(path.join(appDir, 'index.html'))) {
      fs.writeFileSync(path.join(appDir, 'index.html'), `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><title>${title}</title><base href="${basePath}" /></head>
<body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>
`);
      steps.push('Created index.html');
    }

    // ── Create OpenFin view manifests ──
    const localView = { url: `http://localhost:${port}${basePath}`, fdc3InteropApi: '2.0', interop: { currentContextGroup: 'green' } };
    const envVar = `OPENSHIFT_${appName.replace(/-/g, '_').toUpperCase()}_HOST`;
    const osView = { url: `https://{{${envVar}}}${basePath}`, fdc3InteropApi: '2.0', interop: { currentContextGroup: 'green' } };

    fs.writeFileSync(path.join(publicLocal, `${appName}.fin.json`), JSON.stringify(localView, null, 2) + '\n');
    fs.writeFileSync(path.join(publicOpenshift, `${appName}.fin.json`), JSON.stringify(osView, null, 2) + '\n');
    steps.push('Created OpenFin view manifests (local + openshift)');

    // ── Register in manifests + settings ──
    const localAppEntry = {
      appId: appName, name: appName, title, description,
      manifest: `http://localhost:4202/local/${appName}.fin.json`,
      manifestType: 'view',
      icons: [{ src: 'http://localhost:4202/icons/platform.svg' }],
      contactEmail: 'contact@example.com', supportEmail: 'support@example.com',
      publisher: 'OpenFin', intents: [], images: [],
      tags: ['view', 'react', 'figma-make'],
    };
    const osAppEntry = {
      ...localAppEntry,
      manifest: `https://{{OPENSHIFT_WORKSPACE_HOST}}/openshift/${appName}.fin.json`,
      icons: [{ src: 'https://{{OPENSHIFT_WORKSPACE_HOST}}/icons/platform.svg' }],
    };

    addAppToJsonFile(path.join(publicLocal, 'manifest.fin.json'), localAppEntry);
    addAppToJsonFile(path.join(publicLocal, 'settings.json'), localAppEntry);
    addAppToJsonFile(path.join(publicOpenshift, 'manifest.fin.json'), osAppEntry);
    addAppToJsonFile(path.join(publicOpenshift, 'settings.json'), osAppEntry);
    steps.push('Registered in manifest.fin.json + settings.json (local + openshift)');

    // ── Add to Dock ──
    addDockFavorite(path.join(publicLocal, 'settings.json'), {
      type: 'item', id: `fav-${appName}`, label: title,
      icon: 'http://localhost:4202/icons/platform.svg', appId: appName,
    });
    steps.push('Added to Dock favorites');

    // ── Update package.json ──
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

    return {
      success: true,
      steps,
      summary: `Successfully imported "${title}" as apps/${appName}

  Port:      ${port}
  Base path: ${basePath}
  URL:       http://localhost:${port}${basePath}

To run:
  npm run start:${appName}    # Start the dev server
  npm run launch              # Launch OpenFin (app appears in Home, Store, Dock)

To customize:
  Edit apps/${appName}/src/app/app.tsx — import your Figma Make components there.`,
    };
  } catch (err: any) {
    return { success: false, summary: `Import failed: ${err.message}`, steps };
  }
}

// ── Helpers ──

function copyDirRecursive(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
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
    'Import a Figma Make React project into the Macro monorepo as a fully registered OpenFin workspace view. Automatically creates the NX app, copies source files, wires routing/themes, registers in OpenFin Home/Store/Dock. Accepts folder path or zip file. Works with Claude Code, VS Code Copilot, GitHub Copilot.',
    {
      appName: z.string().describe('App name in kebab-case (e.g., "risk-dashboard"). Becomes folder name, route path, and OpenFin app ID.'),
      title: z.string().describe('Display title for OpenFin Home, Store, Dock (e.g., "Risk Dashboard")'),
      description: z.string().describe('Short description shown in Home search and Store catalog'),
      port: z.number().describe('Dev server port. Use 4204+ (4200-4203 are taken). Each app needs unique port.'),
      sourcePath: z.string().describe('Path to Figma Make export folder or zip file (e.g., "C:/exports/risk-dashboard" or "C:/exports/risk.zip")'),
    },
    async ({ appName, title, description, port, sourcePath }) => {
      const result = importFigmaApp(appName, title, description, port, sourcePath);
      const text = result.success
        ? `${result.summary}\n\nCompleted steps:\n${result.steps.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}`
        : `ERROR: ${result.summary}\n\nCompleted before failure:\n${result.steps.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}`;
      return { content: [{ type: 'text' as const, text }] };
    }
  );
}
