import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const pkgJsonPath = path.join(repoRoot, 'package.json');
const lockPath = path.join(repoRoot, 'package-lock.json');
const outDir = path.join(repoRoot, 'reports');

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeText(p, text) {
  fs.writeFileSync(p, text, 'utf8');
}

function getDirectDeps(pkg) {
  const deps = pkg.dependencies ?? {};
  const devDeps = pkg.devDependencies ?? {};
  const optionalDeps = pkg.optionalDependencies ?? {};

  const entries = [
    ...Object.entries(deps).map(([name, spec]) => ({ name, spec, type: 'dependency' })),
    ...Object.entries(devDeps).map(([name, spec]) => ({ name, spec, type: 'devDependency' })),
    ...Object.entries(optionalDeps).map(([name, spec]) => ({ name, spec, type: 'optionalDependency' })),
  ];

  entries.sort((a, b) => a.name.localeCompare(b.name));
  return entries;
}

function getAllLockPackages(lock) {
  // lockfileVersion: 3
  // lock.packages keys look like:
  // - "" (root)
  // - "node_modules/lodash"
  // - "node_modules/@scope/name"
  // - "node_modules/a/node_modules/b"
  const pkgs = lock.packages ?? {};
  const result = new Map(); // name@version -> { name, version }

  for (const [pkgPath, meta] of Object.entries(pkgs)) {
    if (pkgPath === '') continue;
    if (!pkgPath.startsWith('node_modules/')) continue;
    if (!meta || typeof meta !== 'object') continue;

    const version = meta.version;
    if (!version || typeof version !== 'string') continue;

    // Extract package name from the last node_modules segment.
    const parts = pkgPath.split('node_modules/').filter(Boolean);
    const last = parts[parts.length - 1];
    if (!last) continue;

    // Scoped packages are stored as "@scope/name"
    const name = last;
    const key = `${name}@${version}`;
    result.set(key, { name, version });
  }

  return Array.from(result.values()).sort((a, b) => {
    const n = a.name.localeCompare(b.name);
    if (n !== 0) return n;
    return a.version.localeCompare(b.version);
  });
}

function main() {
  ensureDir(outDir);

  const pkg = readJson(pkgJsonPath);
  const lock = readJson(lockPath);

  const direct = getDirectDeps(pkg);
  const all = getAllLockPackages(lock);

  writeText(
    path.join(outDir, 'npm-packages-direct.csv'),
    'npm,version,type\n' + direct.map((d) => `${d.name},${d.spec},${d.type}`).join('\n') + '\n',
  );

  writeText(
    path.join(outDir, 'npm-packages-all.csv'),
    'npm,version\n' + all.map((p) => `${p.name},${p.version}`).join('\n') + '\n',
  );

  // Summary for quick checks / automation.
  const summary = {
    generatedAt: new Date().toISOString(),
    directCount: direct.length,
    allCount: all.length,
    direct: direct,
    all: all,
  };
  writeText(path.join(outDir, 'npm-packages-summary.json'), JSON.stringify(summary, null, 2) + '\n');

  // Console output for CI logs.
  console.log(`Wrote ${direct.length} direct deps to reports/npm-packages-direct.csv`);
  console.log(`Wrote ${all.length} total (direct+transitive) packages to reports/npm-packages-all.csv`);
  console.log(`Wrote summary JSON to reports/npm-packages-summary.json`);
}

main();

