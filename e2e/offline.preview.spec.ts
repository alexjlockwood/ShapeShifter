import { expect, test } from './fixtures';

test('works offline once the service worker is installed', async ({ page, context }) => {
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

test('loads projects from the URL offline', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByText('Ready to work offline')).toBeVisible();
  await context.setOffline(true);
  await page.goto('/?project=demos/visibilitystrike.shapeshifter');
  await expect(page.locator('.slt-layer').first()).toHaveText('visibilitystrike');
});

test('replaces the old Angular service worker with one that removes itself', async ({ page }) => {
  await page.goto('/');
  // Register it under its own scope so that it doesn't replace the app's service worker.
  await page.evaluate(async () => {
    await caches.open('ngsw:/:db:control');
    await navigator.serviceWorker.register('/ngsw-worker.js', { scope: '/old-app/' });
  });
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const registrations = await navigator.serviceWorker.getRegistrations();
        return registrations.map(r => new URL(r.scope).pathname);
      }),
    )
    .not.toContain('/old-app/');
  expect(await page.evaluate(() => caches.keys())).not.toContain('ngsw:/:db:control');
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
