import { expect, test } from './fixtures';

// The app itself should work offline in every browser, but Playwright's WebKit can't load any page
// while it's offline, even from a service worker. The next test checks the caches instead.
const OFFLINE_NAVIGATION_SKIP_REASON = "Playwright's WebKit can't navigate while offline";

test('caches the app and the demos', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Ready to work offline')).toBeVisible();
  const urls = ['/', '/index.html', '/manifest.json', '/demos/playtopause.shapeshifter'];
  const cachedUrls = await page.evaluate(async urls => {
    const matches = await Promise.all(urls.map(url => caches.match(url, { ignoreSearch: true })));
    return urls.filter((url, i) => matches[i]);
  }, urls);
  // The service worker serves index.html for navigations to '/'.
  expect(cachedUrls).toEqual(['/index.html', '/manifest.json', '/demos/playtopause.shapeshifter']);
});

test('works offline once the service worker is installed', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName === 'webkit', OFFLINE_NAVIGATION_SKIP_REASON);
  await page.goto('/');
  await expect(page.getByText('Ready to work offline')).toBeVisible();
  await context.setOffline(true);

  await page.reload();
  await expect(page.locator('.toolbar')).toContainText('Shape Shifter');
  // The fonts and icons are bundled, so they're available offline too.
  expect(await page.evaluate(() => document.fonts.check('16px Roboto'))).toBe(true);

  // So are the demos.
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'Demo' }).click();
  await page.getByLabel('Morphing animals').check();
  await page.getByRole('button', { name: 'OK' }).click();
  await expect(page.locator('.slt-layer').first()).toHaveText('morphinganimals');
});

test('loads projects from the URL offline', async ({ page, context, browserName }) => {
  test.skip(browserName === 'webkit', OFFLINE_NAVIGATION_SKIP_REASON);
  await page.goto('/');
  await expect(page.getByText('Ready to work offline')).toBeVisible();
  await context.setOffline(true);
  await page.goto('/?project=demos/visibilitystrike.shapeshifter');
  await expect(page.locator('.slt-layer').first()).toHaveText('visibilitystrike');
});

// The Angular version of the app registered /ngsw-worker.js for the whole site, and it served
// the app from its cache. This stands in for it.
const OLD_ANGULAR_WORKER = `
  self.addEventListener('install', event => {
    event.waitUntil((async () => {
      const cache = await caches.open('ngsw:/:1:assets:app:cache');
      const html = '<title>Shape Shifter</title><p>Old Angular app</p>';
      await cache.put('/index.html', new Response(html, { headers: { 'Content-Type': 'text/html' } }));
      await self.skipWaiting();
    })());
  });
  self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
  self.addEventListener('fetch', event => {
    if (event.request.mode === 'navigate') {
      event.respondWith(caches.match('/index.html'));
    }
  });
`;

test('replaces the old Angular app for returning users', async ({ page, context, browserName }) => {
  test.skip(
    browserName === 'firefox',
    "Playwright can't intercept Firefox's service worker scripts",
  );
  await context.route('**/ngsw-worker.js', route =>
    route.fulfill({ contentType: 'text/javascript', body: OLD_ANGULAR_WORKER }),
  );
  // Install it from a page that isn't the new app, which would register its own worker.
  await page.goto('/manifest.json');
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/ngsw-worker.js');
    await navigator.serviceWorker.ready;
  });
  await page.goto('/');
  await expect(page.getByText('Old Angular app')).toBeVisible();

  // Deploy the new app. The old worker still serves the old app, but the browser checks for a new
  // version of it, which removes the old worker and its caches.
  await context.unroute('**/ngsw-worker.js');
  await page.goto('/');
  await expect(page.getByText('Old Angular app')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(async () => ({
        caches: (await caches.keys()).filter(key => key.startsWith('ngsw:')),
        workers: (await navigator.serviceWorker.getRegistrations()).map(
          r => (r.active ?? r.waiting ?? r.installing)?.scriptURL,
        ),
      })),
    )
    .toEqual({ caches: [], workers: [] });

  // The next visit gets the new app, which installs its own worker.
  await page.reload();
  await expect(page.locator('.toolbar')).toContainText('Shape Shifter');
  await expect(page.getByText('Ready to work offline')).toBeVisible();
  expect(
    await page.evaluate(
      () => new URL(navigator.serviceWorker.controller?.scriptURL ?? '').pathname,
    ),
  ).toBe('/sw.js');
});

test('activates a new version without reloading open pages', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Ready to work offline')).toBeVisible();
  await page.evaluate(() => Object.assign(window, { isOriginalPage: true }));

  // Changing the script URL installs a new worker, like deploying a new version does.
  const newScriptUrl = page.evaluate(
    () =>
      new Promise<string>(resolve => {
        navigator.serviceWorker.addEventListener('controllerchange', () =>
          resolve(navigator.serviceWorker.controller?.scriptURL ?? ''),
        );
        void navigator.serviceWorker.register('/sw.js?v=2');
      }),
  );
  expect(await newScriptUrl).toMatch(/\/sw\.js\?v=2$/);
  expect(await page.evaluate(async () => !!(await navigator.serviceWorker.ready).waiting)).toBe(
    false,
  );
  expect(await page.evaluate(() => 'isOriginalPage' in window)).toBe(true);
});
