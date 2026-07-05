#!/usr/bin/env node
/**
 * Cross-platform "npm run test" — runs every project's unit tests with
 * coverage and consolidates the results for CI:
 *
 *   coverage/lcov.info   merged LCOV coverage for all projects
 *                        (SF: paths rewritten to be repo-root-relative)
 *   junit.xml            merged JUnit report at the repo root
 *
 * Jest projects run with --configuration=ci (nx.json targetDefaults turns on
 * codeCoverage); Vitest projects run with --coverage. Per-project outputs land
 * in coverage/{apps|libs}/<name>/lcov.info and reports/<name>-junit.xml
 * (wired in jest.preset.js and each vite config); this script merges them.
 *
 * If any test batch fails the script still merges whatever reports were
 * produced (so the pipeline can publish them) and then exits non-zero.
 */
import { execSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const coverageDir = join(repoRoot, 'coverage');
const reportsDir = join(repoRoot, 'reports');
const junitOut = join(repoRoot, 'junit.xml');

process.env.CI = 'true';

const posix = (p) => p.split('\\').join('/');

function run(cmd) {
  console.log(`\n> ${cmd}\n`);
  try {
    execSync(cmd, { stdio: 'inherit', cwd: repoRoot, env: process.env });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- discovery
// Projects with a test target, split by runner: a jest.config.* in the
// project root means Jest; everything else (inferred @nx/vitest targets)
// is Vitest.
function discoverProjects() {
  const out = execSync('npx nx show projects --with-target=test --json', {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  // Nx prints the JSON array on its own line; ignore any surrounding banners.
  const jsonLine = out
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.startsWith('[') && l.endsWith(']'));
  if (!jsonLine) {
    throw new Error(`Could not find project list in nx output:\n${out}`);
  }
  const withTest = new Set(JSON.parse(jsonLine));

  const nameToRoot = new Map();
  for (const parent of ['apps', 'libs']) {
    for (const entry of readdirSync(join(repoRoot, parent), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const root = join(repoRoot, parent, entry.name);
      const projectJson = join(root, 'project.json');
      if (!existsSync(projectJson)) continue;
      const name = JSON.parse(readFileSync(projectJson, 'utf8')).name ?? entry.name;
      nameToRoot.set(name, root);
    }
  }

  const jest = [];
  const vitest = [];
  for (const name of withTest) {
    const root = nameToRoot.get(name);
    const hasJestConfig =
      root &&
      readdirSync(root).some((f) => /^jest\.config\.(c?[jt]s|mjs)$/.test(f));
    (hasJestConfig ? jest : vitest).push(name);
  }
  return { jest: jest.sort(), vitest: vitest.sort(), nameToRoot };
}

// ------------------------------------------------------------- lcov merging
function findLcovFiles(dir) {
  const found = [];
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...findLcovFiles(full));
    else if (entry.name === 'lcov.info') found.push(full);
  }
  return found;
}

function mergeLcov() {
  const files = findLcovFiles(coverageDir).filter(
    (f) => resolve(f) !== resolve(coverageDir, 'lcov.info')
  );
  if (files.length === 0) {
    console.warn('No per-project lcov.info files found — skipping lcov merge.');
    return 0;
  }
  const chunks = [];
  for (const file of files) {
    // coverage/<apps|libs>/<project>/lcov.info -> "<apps|libs>/<project>"
    const projectPrefix = posix(relative(coverageDir, dirname(file)));
    const rewritten = readFileSync(file, 'utf8').replace(
      /^SF:(.*)$/gm,
      (_, rawPath) => {
        let p = posix(rawPath.trim());
        if (isAbsolute(rawPath.trim())) {
          p = posix(relative(repoRoot, rawPath.trim()));
        } else if (!p.startsWith('apps/') && !p.startsWith('libs/')) {
          // Vitest paths are project-root-relative; anchor them to the repo.
          const joined = `${projectPrefix}/${p}`.split('/');
          const norm = [];
          for (const seg of joined) {
            if (seg === '..') norm.pop();
            else if (seg !== '.' && seg !== '') norm.push(seg);
          }
          p = norm.join('/');
        }
        return `SF:${p}`;
      }
    );
    chunks.push(rewritten.trimEnd());
  }
  writeFileSync(join(coverageDir, 'lcov.info'), chunks.join('\n') + '\n');
  return files.length;
}

// ------------------------------------------------------------ junit merging
// Suite/class/file attributes from the per-project reporters are project-root-
// relative (vitest, jest {filepath}), so identical spec paths in different
// projects collide in the merged file and CI publishers can annotate the
// wrong project. Anchor any attribute value that resolves to a real file
// under the project root to the repo root instead (like the lcov SF rewrite).
function anchorSuitePaths(xml, projectRootRel) {
  if (!projectRootRel) return xml;
  return xml.replace(/\b(name|classname|file)="([^"]*)"/g, (all, attr, val) => {
    const v = posix(val);
    if (!v.includes('/')) return all;
    if (isAbsolute(val)) {
      const rel = relative(repoRoot, val);
      return rel.startsWith('..') ? all : `${attr}="${posix(rel)}"`;
    }
    if (existsSync(join(repoRoot, projectRootRel, v))) {
      return `${attr}="${projectRootRel}/${v}"`;
    }
    return all;
  });
}

function mergeJunit(nameToRoot) {
  if (!existsSync(reportsDir)) {
    console.warn('No reports directory found — skipping junit merge.');
    return 0;
  }
  const files = readdirSync(reportsDir)
    .filter((f) => f.endsWith('.xml'))
    .sort();
  if (files.length === 0) {
    console.warn('No junit XML files found — skipping junit merge.');
    return 0;
  }

  const totals = { tests: 0, failures: 0, errors: 0, time: 0 };
  const addTotals = (attrs) => {
    for (const key of Object.keys(totals)) {
      const m = attrs.match(new RegExp(`\\b${key}="([\\d.]+)"`));
      if (m) totals[key] += Number(m[1]);
    }
  };
  const suites = [];
  for (const file of files) {
    const projectName = file.replace(/-junit\.xml$/, '');
    const projectRoot = nameToRoot.get(projectName);
    const projectRootRel = projectRoot ? posix(relative(repoRoot, projectRoot)) : '';
    const xml = anchorSuitePaths(readFileSync(join(reportsDir, file), 'utf8'), projectRootRel);
    const root = xml.match(/<testsuites\b([^>]*)>([\s\S]*)<\/testsuites>/);
    if (root) {
      addTotals(root[1]);
      suites.push(root[2].trim());
    } else {
      // Tolerate a bare <testsuite> root.
      const single = xml.match(/<testsuite\b([^>]*)(?:\/>|>[\s\S]*<\/testsuite>)/);
      if (single) {
        addTotals(single[1]);
        suites.push(single[0].trim());
      }
    }
  }

  const merged =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    `<testsuites name="macro" tests="${totals.tests}" failures="${totals.failures}" ` +
    `errors="${totals.errors}" time="${totals.time.toFixed(3)}">\n` +
    suites.join('\n') +
    '\n</testsuites>\n';
  writeFileSync(junitOut, merged);
  return files.length;
}

// -------------------------------------------------------------------- main
for (const stale of [coverageDir, reportsDir, junitOut]) {
  rmSync(stale, { recursive: true, force: true });
}
mkdirSync(coverageDir, { recursive: true });

const { jest, vitest, nameToRoot } = discoverProjects();
console.log(`Jest projects:   ${jest.join(', ')}`);
console.log(`Vitest projects: ${vitest.join(', ')}`);

let ok = true;
if (jest.length > 0) {
  ok = run(`npx nx run-many --target=test --projects=${jest.join(',')} --configuration=ci`) && ok;
}
if (vitest.length > 0) {
  ok = run(`npx nx run-many --target=test --projects=${vitest.join(',')} --coverage`) && ok;
}

const lcovCount = mergeLcov();
const junitCount = mergeJunit(nameToRoot);
console.log(`\nMerged ${lcovCount} lcov file(s)  -> coverage/lcov.info`);
console.log(`Merged ${junitCount} junit file(s) -> junit.xml`);

if (!ok) {
  console.error('\nOne or more test runs failed.');
  process.exit(1);
}
