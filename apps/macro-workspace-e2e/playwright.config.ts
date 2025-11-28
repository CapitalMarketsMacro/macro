import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

// For CI, you may want to set BASE_URL to the deployed application.
const baseURL = process.env['BASE_URL'] || 'http://localhost:4202';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 * 
 * Note: OpenFin connection is handled in the test setup via Chrome DevTools Protocol (CDP).
 * OpenFin exposes CDP on port 9090 (configured in manifest.fin.json devtools_port).
 * The tests will connect to OpenFin after it's launched via the launch script.
 */
export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  /* Run tests sequentially, one at a time */
  workers: 1,
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npx nx run macro-workspace:serve',
    url: 'http://localhost:4202',
    reuseExistingServer: true,
    cwd: workspaceRoot,
  },
  /* Configure OpenFin project - connection handled in test setup */
  projects: [
    {
      name: 'openfin',
      use: {
        ...devices['Desktop Chrome'],
        // Note: Browser connection to OpenFin is handled in test setup via CDP
      },
    },
  ],
});
