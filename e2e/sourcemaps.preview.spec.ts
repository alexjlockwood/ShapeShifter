import { expect, test } from './fixtures';

// Bugsnag uses the deployed source maps to show the original code in stack traces.
test('serves a source map for the app bundle', async ({ page, request }) => {
  await page.goto('/');
  const bundleUrl = new URL(
    (await page.locator('script[type="module"][src]').getAttribute('src')) ?? '',
    page.url(),
  );
  const bundle = await (await request.get(bundleUrl.href)).text();
  const mapPath = /\/\/# sourceMappingURL=(\S+)\s*$/.exec(bundle)?.[1];
  expect(mapPath).toBeDefined();

  const map = await (await request.get(new URL(mapPath ?? '', bundleUrl).href)).json();
  expect(map.sources).toContain('../../src/main.tsx');
  expect(map.sourcesContent).toHaveLength(map.sources.length);
});
