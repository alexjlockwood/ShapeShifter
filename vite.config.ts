import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import type { Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

import pkg from './package.json' with { type: 'json' };

// Non-relative imports such as 'app/...' resolve against src/, matching the tsconfig paths.
const srcAlias = (name: string) => ({
  find: new RegExp(`^${name}/`),
  replacement: fileURLToPath(new URL(`./src/${name}/`, import.meta.url)),
});

// The auto fix playground (src/playground/autofix/) also runs a copy of src/ from another commit,
// which scripts/playground-baseline.mjs puts in .playground-baseline/. The copy's non-relative
// imports have to stay inside the copy, rather than resolve against the working tree's src/, so
// rewrite them before the aliases above see them.
const playgroundBaseline = (): Plugin => {
  const baselineSrc = fileURLToPath(new URL('./.playground-baseline/src/', import.meta.url));
  return {
    name: 'playground-baseline',
    enforce: 'pre',
    apply: 'serve',
    transform(code, id) {
      if (!id.startsWith(baselineSrc)) {
        return undefined;
      }
      const rewritten = code.replace(
        /(from\s+|import\s+|import\s*\(\s*)(['"])(app|environments|test)\//g,
        '$1$2/.playground-baseline/src/$3/',
      );
      return { code: rewritten, map: null };
    },
  };
};

// Where the build puts the canvas editor's code (src/app/modules/editor/components/canvaseditor/).
const EDITOR_ASSETS_DIR = 'assets/editor';

export default defineConfig({
  plugins: [
    react(),
    playgroundBaseline(),
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
          // Cached when it's first used instead (see runtimeCaching).
          `${EDITOR_ASSETS_DIR}/**`,
        ],
        // The canvas editor is only downloaded when it's turned on (src/environments/features.ts),
        // so it's cached the first time instead of being precached for everyone. Its files have
        // content hashes in their names, so a cached file never goes stale.
        runtimeCaching: [
          {
            urlPattern: new RegExp(`/${EDITOR_ASSETS_DIR}/`),
            handler: 'CacheFirst',
            options: { cacheName: 'canvas-editor', expiration: { maxEntries: 20 } },
          },
        ],
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // Serve a new version as soon as it's installed, so that the next page load gets it
        // (like the old Angular service worker). Open pages aren't reloaded, so no work is lost.
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
  resolve: {
    alias: [srcAlias('app'), srcAlias('environments'), srcAlias('test')],
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    // Bugsnag uses the deployed source maps to show the original code in stack traces.
    sourcemap: true,
    rolldownOptions: {
      output: {
        // The canvas editor's lazily loaded code goes in its own directory, so that the service
        // worker can tell it apart.
        chunkFileNames: chunk =>
          chunk.facadeModuleId?.includes('/components/canvaseditor/')
            ? `${EDITOR_ASSETS_DIR}/[name]-[hash].js`
            : 'assets/[name]-[hash].js',
      },
    },
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
