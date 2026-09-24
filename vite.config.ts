import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

import pkg from './package.json' with { type: 'json' };

// Non-relative imports such as 'app/...' resolve against src/, matching the tsconfig paths.
const srcAlias = (name: string) => ({
  find: new RegExp(`^${name}/`),
  replacement: fileURLToPath(new URL(`./src/${name}/`, import.meta.url)),
});

export default defineConfig({
  plugins: [react()],
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
