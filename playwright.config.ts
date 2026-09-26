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
  webServer: [
    {
      command: `npx vite --port ${DEV_PORT} --strictPort`,
      url: `http://localhost:${DEV_PORT}`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `npx vite build && npx vite preview --port ${PREVIEW_PORT} --strictPort`,
      url: `http://localhost:${PREVIEW_PORT}`,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
