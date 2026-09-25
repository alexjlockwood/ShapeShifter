import type { Page } from '@playwright/test';

import { boundingBox, expect, test } from './fixtures';

function getState<T>(page: Page, fn: (state: any) => T) {
  return page.evaluate(
    `(${fn.toString()})(window.shapeshifter.store.getState().present)`,
  ) as Promise<T>;
}

async function loadDemo(page: Page, id = 'playtopause') {
  await page.goto(`/?project=demos/${id}.shapeshifter`);
  await expect
    .poll(() => getState(page, s => s.layers.vectorLayer.children.length))
    .toBeGreaterThan(0);
}

// The Desktop Chrome device reports a Windows user agent, so the app's shortcuts use Control.
const MODIFIER = 'Control';

const SQUARE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M 4 4 H 20 V 20 H 4 Z"/></svg>';

test('undoes and redoes changes', async ({ page }) => {
  await loadDemo(page);
  await page.locator('.slt-layer', { hasText: 'path' }).click();
  await page.locator('.spi-property input[name="name"]').fill('renamed');
  await expect(page.locator('.slt-layer', { hasText: 'renamed' })).toBeVisible();
  // Keyboard shortcuts are ignored while a text field has focus.
  await page.locator('.spi-property input[name="name"]').blur();
  await page.keyboard.press(`${MODIFIER}+z`);
  await expect(page.locator('.slt-layer', { hasText: 'renamed' })).toHaveCount(0);
  await page.keyboard.press(`${MODIFIER}+Shift+z`);
  await expect(page.locator('.slt-layer', { hasText: 'renamed' })).toBeVisible();
});

test('zooms the timeline', async ({ page }) => {
  await loadDemo(page);
  const animation = page.locator('.slt-timeline-animation');
  const { width } = await boundingBox(animation);
  const timeline = await boundingBox(page.locator('.slt-timeline'));
  await page.mouse.move(timeline.x + 100, timeline.y + 100);
  await page.keyboard.down(MODIFIER);
  await page.mouse.wheel(0, -100);
  await page.keyboard.up(MODIFIER);
  await expect.poll(async () => (await boundingBox(animation)).width).toBeGreaterThan(width);
  // The page itself shouldn't scroll or zoom.
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  await page.keyboard.press(`${MODIFIER}+o`);
  await expect.poll(async () => (await boundingBox(animation)).width).toBeCloseTo(width, 0);
});

test('reorders layers by dragging them', async ({ page }) => {
  await loadDemo(page, 'searchtoclose');
  const getLayerNames = () =>
    getState(page, s => s.layers.vectorLayer.children.map((l: { name: string }) => l.name));
  const [first, second] = await getLayerNames();
  const firstBox = await boundingBox(page.locator('.slt-layer', { hasText: first }).first());
  const secondBox = await boundingBox(page.locator('.slt-layer', { hasText: second }).first());
  // Drag the second layer above the first one.
  await page.mouse.move(secondBox.x + 60, secondBox.y + secondBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(firstBox.x + 60, firstBox.y + 2, { steps: 10 });
  await expect(page.locator('.slt-layers-list-drag-indicator')).toBeVisible();
  await page.mouse.up();
  await expect(page.locator('.slt-layers-list-drag-indicator')).toBeHidden();
  await expect.poll(async () => (await getLayerNames()).slice(0, 2)).toEqual([second, first]);
});

test('pastes an SVG', async ({ page }) => {
  await loadDemo(page);
  const numLayers = await page.locator('.slt-layer').count();
  await page.evaluate(svg => {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', svg);
    window.dispatchEvent(new ClipboardEvent('paste', { clipboardData }));
  }, SQUARE_SVG);
  await expect(page.locator('.slt-layer')).toHaveCount(numLayers + 1);
});

test('imports dropped files', async ({ page }) => {
  await loadDemo(page);
  const numLayers = await page.locator('.slt-layer').count();
  const dataTransfer = await page.evaluateHandle(svg => {
    const dt = new DataTransfer();
    dt.items.add(new File([svg], 'square.svg', { type: 'image/svg+xml' }));
    return dt;
  }, SQUARE_SVG);
  const workspace = page.locator('.app-container');
  await workspace.dispatchEvent('dragenter', { dataTransfer });
  await expect(workspace).toHaveClass(/is-dragging-over/);
  await workspace.dispatchEvent('drop', { dataTransfer });
  await expect(workspace).not.toHaveClass(/is-dragging-over/);
  await page.getByRole('button', { name: 'Add layers' }).click();
  await expect(page.locator('.slt-layer')).toHaveCount(numLayers + 1);
});
