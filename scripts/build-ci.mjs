#!/usr/bin/env node
/**
 * Cross-platform "npm run build" — builds every application individually
 * (no `nx run-many`) with the CI environment forced on.
 *
 * Why a script instead of an inline npm command: there is no portable way to set
 * an env var inline across cmd.exe and POSIX shells without an extra dependency
 * (e.g. cross-env). This sets CI=true in-process so Nx and the underlying
 * builders (Angular, Vite) behave as they would on a CI agent, regardless of OS.
 *
 * The per-app production build chain lives in the `build:apps:ci` npm script
 * (single source of truth for the app list/order); we just run it with CI=true.
 * Exits non-zero if any application build fails, so it fails the pipeline.
 */
import { execSync } from 'node:child_process';

process.env.CI = 'true';

try {
  execSync('npm run build:apps:ci', { stdio: 'inherit', env: process.env });
} catch {
  process.exit(1);
}
