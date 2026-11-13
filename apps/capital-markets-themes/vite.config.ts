import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import tailwindcss from '@tailwindcss/postcss';
import path from 'path';
import { nxReadySignal } from '@nx/vite/plugins/nx-ready-signal.plugin';

export default defineConfig(() => ({
  root: __dirname,
  base: '/capital-markets-themes/',
  server: { port: 4206, host: 'localhost' },
  preview: { port: 4206, host: 'localhost' },
  plugins: [react(), nxReadySignal()],
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },

  resolve: {
    tsconfigPaths: true,
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@macro/macro-design/react': path.resolve(
        __dirname,
        '../../libs/macro-design/src/lib/react/index.ts',
      ),
      '@macro/macro-design': path.resolve(
        __dirname,
        '../../libs/macro-design/src/index.ts',
      ),
    },
  },
  build: {
    outDir: '../../dist/apps/capital-markets-themes',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: { transformMixedEsModules: true },
  },
}));
