import type { BrowserContext, Page } from '@playwright/test';

import { expect, test } from './fixtures';

// The canvas editor is on in production builds unless ?editor=0 turns it off
// (src/environments/features.ts).

/** Records the requests for PathKit, from the page and from the service worker. */
function recordPathKitRequests(context: BrowserContext) {
  const urls: string[] = [];
  context.on('request', request => {
    if (request.url().includes('/assets/pathkit/')) {
      urls.push(request.url());
    }
  });
  return urls;
}

async function loadDemo(page: Page, params = '') {
  await page.goto(`/?project=demos/playtopause.shapeshifter${params}`);
  await expect(page.locator('.slt-layer').first()).toHaveText('playtopause');
}

test("is on by default and precached, and PathKit isn't downloaded until it's used", async ({
  page,
  context,
}) => {
  const pathKitRequests = recordPathKitRequests(context);
  await loadDemo(page);
  // The service worker has finished precaching by the time it says so.
  await expect(page.getByText('Ready to work offline')).toBeVisible();
  await expect(page.locator('.app-canvas')).toHaveAttribute('data-canvas-editor', 'ready');
  const cachedEditorUrls = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      const keys = await (await caches.open(name)).keys();
      urls.push(...keys.map(key => key.url).filter(url => url.includes('CanvasEditor')));
    }
    return urls;
  });
  expect(cachedEditorUrls).not.toEqual([]);
  expect(pathKitRequests).toEqual([]);
});

test('is turned off and on with ?editor', async ({ page }) => {
  await loadDemo(page, '&editor=0');
  await expect(page.locator('.app-canvas')).toHaveAttribute('data-canvas-editor', 'off');
  // It stays off without the parameter.
  await loadDemo(page);
  await expect(page.locator('.app-canvas')).toHaveAttribute('data-canvas-editor', 'off');

  // Asking for the default forgets the override, rather than remembering one of its own, so the
  // browser would follow the default if it changed.
  await loadDemo(page, '&editor=1');
  await expect(page.locator('.app-canvas')).toHaveAttribute('data-canvas-editor', 'ready');
  expect(await page.evaluate(() => localStorage.getItem('storage_key_canvas_editor'))).toBeNull();
});

test('is turned back on from the menu once ?editor=0 turned it off', async ({ page }) => {
  const menuItem = page.getByRole('menuitem', { name: 'Turn the canvas editor back on' });
  await loadDemo(page);
  await page.getByRole('button', { name: 'More options' }).click();
  await expect(page.getByRole('menuitem', { name: 'Dark theme' })).toBeVisible();
  await expect(menuItem).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('.MuiModal-root')).toHaveCount(0);

  await loadDemo(page, '&editor=0');
  await expect(page.locator('.app-canvas')).toHaveAttribute('data-canvas-editor', 'off');
  // The demo counts as unsaved work, so the page asks before it reloads.
  page.on('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'More options' }).click();
  await menuItem.click();

  // The page reloads with ?editor=default, which it then drops, keeping the project.
  await expect.poll(() => new URL(page.url()).searchParams.get('editor')).toBeNull();
  expect(new URL(page.url()).searchParams.get('project')).toBe('demos/playtopause.shapeshifter');
  await expect(page.locator('.slt-layer').first()).toHaveText('playtopause');
  await expect(page.locator('.app-canvas')).toHaveAttribute('data-canvas-editor', 'ready');

  // And it stays on.
  await loadDemo(page);
  await expect(page.locator('.app-canvas')).toHaveAttribute('data-canvas-editor', 'ready');
  await page.getByRole('button', { name: 'More options' }).click();
  await expect(page.getByRole('menuitem', { name: 'Dark theme' })).toBeVisible();
  await expect(menuItem).toHaveCount(0);
});
