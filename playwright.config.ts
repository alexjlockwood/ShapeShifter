import { defineConfig, devices } from '@playwright/test';

const DEV_PORT = 4280;
const PREVIEW_PORT = 4281;

const BROWSERS = [
  { name: 'chromium', device: 'Desktop Chrome' },
  { name: 'firefox', device: 'Desktop Firefox' },
  { name: 'webkit', device: 'Desktop Safari' },
];

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    trace: 'retain-on-failure',
  },
  projects: BROWSERS.flatMap(({ name, device }) => [
    {
      name,
      testIgnore: '*.preview.spec.ts',
      use: { ...devices[device], baseURL: `http://localhost:${DEV_PORT}` },
    },
    {
      // Tests that need a production build (e.g. the service worker).
      name: `${name}-preview`,
      testMatch: '*.preview.spec.ts',
      use: { ...devices[device], baseURL: `http://localhost:${PREVIEW_PORT}` },
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
