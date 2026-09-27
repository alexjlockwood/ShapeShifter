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
