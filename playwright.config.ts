import { defineConfig, devices } from '@playwright/test';

const DEV_PORT = 4280;
const PREVIEW_PORT = 4281;

const BROWSERS = [
  { name: 'chromium', use: devices['Desktop Chrome'] },
  { name: 'firefox', use: devices['Desktop Firefox'] },
  // Desktop Safari renders at 2x, which WebKit paints in software on CI's Linux runners. That made
  // it about three times slower than at 1x, enough for the longer tests to hit the 30s timeout.
  { name: 'webkit', use: { ...devices['Desktop Safari'], deviceScaleFactor: 1 } },
];

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Lets CI's shards split the long spec files, not just divide the files between them.
  fullyParallel: true,
  // The default is half the CPUs, which is only 2 on CI's 4-core runners.
  workers: process.env.CI ? 4 : undefined,
  use: {
    trace: 'retain-on-failure',
  },
  projects: BROWSERS.flatMap(({ name, use }) => [
    {
      name,
      testIgnore: '*.preview.spec.ts',
      use: { ...use, baseURL: `http://localhost:${DEV_PORT}` },
    },
    {
      // Tests that need a production build (e.g. the service worker).
      name: `${name}-preview`,
      testMatch: '*.preview.spec.ts',
      use: { ...use, baseURL: `http://localhost:${PREVIEW_PORT}` },
    },
  ]),
  // Never reuse a running server: it could be serving another worktree's code, or a stale build.
  webServer: [
    {
      command: `npx vite --port ${DEV_PORT} --strictPort`,
      url: `http://localhost:${DEV_PORT}`,
      reuseExistingServer: false,
      // Test what users get. Unfinished features are on by default in development
      // (.env.development), so tests of them turn them on with a URL parameter, like ?editor=1.
      env: { VITE_CANVAS_EDITOR: 'false' },
    },
    {
      command: `npx vite build && npx vite preview --port ${PREVIEW_PORT} --strictPort`,
      url: `http://localhost:${PREVIEW_PORT}`,
      reuseExistingServer: false,
    },
  ],
});
