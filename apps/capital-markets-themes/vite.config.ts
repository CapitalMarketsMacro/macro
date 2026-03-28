import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import tailwindcss from '@tailwindcss/postcss';
import path from 'path';

export default defineConfig(() => ({
  root: __dirname,
  base: '/capital-markets-themes/',
  server: { port: 4206, host: 'localhost' },
  preview: { port: 4206, host: 'localhost' },
  plugins: [react(), nxViteTsPaths()],
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@macro/logger': path.resolve(__dirname, '../../libs/logger/src/index.ts'),
      '@macro/macro-design': path.resolve(__dirname, '../../libs/macro-design/src/index.ts'),
      '@macro/macro-react-grid': path.resolve(__dirname, '../../libs/macro-react-grid/src/index.ts'),
      '@macro/openfin/theme-sync': path.resolve(__dirname, '../../libs/openfin/src/lib/theme-sync.ts'),
      '@macro/openfin/react': path.resolve(__dirname, '../../libs/openfin/src/lib/react.ts'),
      '@macro/openfin': path.resolve(__dirname, '../../libs/openfin/src/index.ts'),
      '@macro/transports': path.resolve(__dirname, '../../libs/transports/src/index.ts'),
      '@macro/transports/react': path.resolve(__dirname, '../../libs/transports/src/lib/react/index.ts'),
    },
  },
  build: {
    outDir: '../../dist/apps/capital-markets-themes',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: { transformMixedEsModules: true },
  },
}));
