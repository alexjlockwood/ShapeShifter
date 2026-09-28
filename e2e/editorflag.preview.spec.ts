import type { BrowserContext, Page } from '@playwright/test';

import { expect, test } from './fixtures';

// The canvas editor is off in production builds unless ?editor=1 turns it on, and its code is only
// downloaded when it's on (src/environments/features.ts).

/** Records the requests for the editor's code, from the page and from the service worker. */
function recordEditorRequests(context: BrowserContext) {
  const urls: string[] = [];
  context.on('request', request => {
    if (request.url().includes('/assets/editor/')) {
      urls.push(request.url());
    }
  });
  return urls;
}

async function loadDemo(page: Page, params = '') {
  await page.goto(`/?project=demos/playtopause.shapeshifter${params}`);
  await expect(page.locator('.slt-layer').first()).toHaveText('playtopause');
}

test("is off by default, and its code isn't downloaded", async ({ page, context }) => {
  const requests = recordEditorRequests(context);
  await loadDemo(page);
  // The service worker has finished precaching by the time it says so.
  await expect(page.getByText('Ready to work offline')).toBeVisible();
  await expect(page.locator('.app-canvas')).toHaveAttribute('data-canvas-editor', 'off');
  expect(requests).toEqual([]);
});

test('is turned on and off with ?editor', async ({ page, context }) => {
  const requests = recordEditorRequests(context);
  await loadDemo(page, '&editor=1');
  await expect(page.locator('.app-canvas')).toHaveAttribute('data-canvas-editor', 'ready');
  expect(requests).not.toEqual([]);

  // It stays on without the parameter.
  await loadDemo(page);
  await expect(page.locator('.app-canvas')).toHaveAttribute('data-canvas-editor', 'ready');

  await loadDemo(page, '&editor=0');
  await expect(page.locator('.app-canvas')).toHaveAttribute('data-canvas-editor', 'off');
  // And stays off.
  await loadDemo(page);
  await expect(page.locator('.app-canvas')).toHaveAttribute('data-canvas-editor', 'off');
});

test('is turned off from the menu once ?editor turned it on', async ({ page }) => {
  const menuItem = page.getByRole('menuitem', { name: 'Turn off the canvas editor preview' });
  await loadDemo(page);
  await page.getByRole('button', { name: 'More options' }).click();
  await expect(page.getByRole('menuitem', { name: 'Dark theme' })).toBeVisible();
  await expect(menuItem).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('.MuiModal-root')).toHaveCount(0);

  await loadDemo(page, '&editor=1');
  await expect(page.locator('.app-canvas')).toHaveAttribute('data-canvas-editor', 'ready');
  // The demo counts as unsaved work, so the page asks before it reloads.
  page.on('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'More options' }).click();
  await menuItem.click();

  // The page reloads with ?editor=default, which it then drops, keeping the project.
  await expect.poll(() => new URL(page.url()).searchParams.get('editor')).toBeNull();
  expect(new URL(page.url()).searchParams.get('project')).toBe('demos/playtopause.shapeshifter');
  await expect(page.locator('.slt-layer').first()).toHaveText('playtopause');
  await expect(page.locator('.app-canvas')).toHaveAttribute('data-canvas-editor', 'off');

  // And it stays off.
  await loadDemo(page);
  await expect(page.locator('.app-canvas')).toHaveAttribute('data-canvas-editor', 'off');
  await page.getByRole('button', { name: 'More options' }).click();
  await expect(page.getByRole('menuitem', { name: 'Dark theme' })).toBeVisible();
  await expect(menuItem).toHaveCount(0);
});
