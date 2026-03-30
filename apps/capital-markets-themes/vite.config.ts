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
      '@macro/macro-design': path.resolve(__dirname, '../../libs/macro-design/src/index.ts'),
    },
  },
  build: {
    outDir: '../../dist/apps/capital-markets-themes',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: { transformMixedEsModules: true },
  },
}));
