import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => ({
  resolve: {
    tsconfigPaths: true,
  },
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/macro-react-grid',
  plugins: [react()],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },
  test: {
    name: 'macro-react-grid',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: [
      'default',
      ['junit', { outputFile: '../../reports/macro-react-grid-junit.xml' }],
    ],
    coverage: {
      reportsDirectory: '../../coverage/libs/macro-react-grid',
      provider: 'v8' as const,
      reporter: ['text-summary', 'lcov'],
    },
  },
}));
