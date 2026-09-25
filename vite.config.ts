import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

import pkg from './package.json' with { type: 'json' };

// Non-relative imports such as 'app/...' resolve against src/, matching the tsconfig paths.
const srcAlias = (name: string) => ({
  find: new RegExp(`^${name}/`),
  replacement: fileURLToPath(new URL(`./src/${name}/`, import.meta.url)),
});

export default defineConfig({
  plugins: [
    react(),
    // Makes the app work offline. The service worker is only registered in production builds.
    VitePWA({
      // The web manifest is already in public/.
      manifest: false,
      injectRegister: false,
      workbox: {
        globPatterns: ['**/*.{css,html,ico,js,json,png,shapeshifter,svg,woff2}'],
        globIgnores: [
          // Only used by the paper.js beta editor.
          'assets/paper/**',
          'assets/tools/**',
          // Replaces the old Angular service worker (see public/ngsw-worker.js).
          'ngsw-worker.js',
        ],
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: [srcAlias('app'), srcAlias('environments'), srcAlias('test')],
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: ['src/**/*.spec.ts'],
          exclude: ['src/**/*.browser.spec.ts'],
        },
      },
      {
        // Specs that rely on SVG DOM APIs jsdom doesn't implement (e.g. transform.baseVal).
        extends: true,
        test: {
          name: 'browser',
          include: ['src/**/*.browser.spec.ts'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
