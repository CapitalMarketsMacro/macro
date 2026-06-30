/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import path from 'path';

export default defineConfig(() => ({
  root: import.meta.dirname,
  base: '/prism-react/',
  cacheDir: '../../node_modules/.vite/apps/prism-react',
  server: { port: 4205, host: 'localhost' },
  preview: { port: 4205, host: 'localhost' },
  plugins: [react(), nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@macro/logger': path.resolve(import.meta.dirname, '../../libs/logger/src/index.ts'),
      '@macro/prism-core': path.resolve(import.meta.dirname, '../../libs/prism-core/src/index.ts'),
      '@macro/macro-react-grid': path.resolve(import.meta.dirname, '../../libs/macro-react-grid/src/index.ts'),
      '@macro/macro-grid-format/react': path.resolve(import.meta.dirname, '../../libs/macro-grid-format/src/lib/react/index.ts'),
      '@macro/macro-grid-format': path.resolve(import.meta.dirname, '../../libs/macro-grid-format/src/index.ts'),
      '@macro/macro-design/react': path.resolve(import.meta.dirname, '../../libs/macro-design/src/lib/react/index.ts'),
      '@macro/macro-design': path.resolve(import.meta.dirname, '../../libs/macro-design/src/index.ts'),
      '@macro/transports': path.resolve(import.meta.dirname, '../../libs/transports/src/index.ts'),
      '@macro/utils': path.resolve(import.meta.dirname, '../../libs/utils/src/index.ts'),
    },
  },
  build: {
    outDir: '../../dist/apps/prism-react',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: { transformMixedEsModules: true },
  },
  test: {
    name: 'prism-react',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default', ['junit', { outputFile: '../../reports/prism-react-junit.xml' }]],
    coverage: {
      reportsDirectory: '../../coverage/apps/prism-react',
      provider: 'v8' as const,
      reporter: ['text-summary', 'lcov'],
    },
  },
}));
