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

test('lists the layers and their animations', async ({ page }) => {
  await loadDemo(page);
  const layers = page.locator('.slt-layer');
  await expect(layers).toHaveText(['playtopause', 'group', 'path']);
  await expect(page.locator('.slt-property-name')).toHaveText(['rotation', 'pathData']);
  await expect(page.locator('.slt-timeline-block')).toHaveCount(2);
  await page.screenshot({ path: 'test-results/timeline.png' });
});

test('selects and hides layers', async ({ page }) => {
  await loadDemo(page);
  const pathLayer = page.locator('.slt-layer', { hasText: 'path' });
  await pathLayer.click();
  await expect(page.locator('.spi-selection-description')).toHaveText('path');
  await expect(pathLayer).toHaveClass(/is-selected/);

  await pathLayer.hover();
  await pathLayer.getByRole('button', { name: 'Hide layer' }).click();
  await expect.poll(() => getState(page, s => s.layers.hiddenLayerIds.size)).toBe(1);
  // Hiding the layer doesn't change the selection.
  await expect(pathLayer).toHaveClass(/is-selected/);
});

test('adds layers from the add layer menu', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('To get started, drag + drop an SVG file here')).toBeVisible();
  await page.getByRole('button', { name: 'Add layer' }).click();
  await page.getByRole('menuitem', { name: 'New group layer' }).click();
  await expect(page.locator('.slt-layer')).toHaveText(['vector', 'group']);
});

test('loads a demo from the file menu', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'Demo' }).click();
  await page.getByLabel('Search-to-close').check();
  await page.getByRole('button', { name: 'OK' }).click();
  await expect(page.locator('.slt-layer').first()).toHaveText('searchtoclose');
});

test('selects and moves animation blocks', async ({ page }) => {
  await loadDemo(page, 'searchtoclose');
  const block = page.locator('.slt-timeline-block').first();
  await block.click();
  await expect(block).toHaveClass(/is-selected/);
  const getSelectedBlockTimes = () =>
    getState(page, s => {
      const [id] = Array.from(s.timeline.selectedBlockIds as Set<string>);
      const b = s.timeline.animation.blocks.find((b: { id: string }) => b.id === id);
      return { startTime: b.startTime as number, endTime: b.endTime as number };
    });
  const initial = await getSelectedBlockTimes();

  // Drag the block to the right, holding shift to disable snapping.
  const box = await boundingBox(block);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.keyboard.down('Shift');
  await page.mouse.move(x + 20, y, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  const moved = await getSelectedBlockTimes();
  expect(moved.startTime).toBeGreaterThan(initial.startTime);
  expect(moved.endTime - moved.startTime).toBe(initial.endTime - initial.startTime);
});

test('scrubs through the animation from the timeline header', async ({ page }) => {
  await loadDemo(page);
  const header = page.locator('canvas.slt-timeline-header-grid');
  const box = await boundingBox(header);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const time = await getState(page, s => s.playback.currentTime);
  const duration = await getState(page, s => s.timeline.animation.duration);
  expect(time).toBeGreaterThan(0);
  expect(time).toBeLessThan(duration);
});

test('exports and imports files', async ({ page }) => {
  await loadDemo(page);
  for (const [item, fileName] of [
    // With animation blocks, the SVG export is a zip of each frame.
    ['SVG', /^frames_.*\.zip$/],
    ['Vector Drawable', /^vd_.*\.xml$/],
    ['Animated Vector Drawable', /^avd_.*\.xml$/],
  ] as const) {
    await page.getByRole('button', { name: 'Export' }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: item, exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(fileName);
  }

  const numLayers = await page.locator('.slt-layer').count();
  await page.getByRole('button', { name: 'Import' }).click();
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'SVG' }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: 'square.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path id="square" d="M 4 4 H 20 V 20 H 4 Z"/></svg>',
    ),
  });
  await expect(page.locator('.slt-layer')).toHaveCount(numLayers + 1);
  await expect(page.getByText('Imported 1 layer')).toBeVisible();
});

test('remembers the size of the layer timeline', async ({ page }) => {
  await page.goto('/');
  const timeline = page.locator('.studio-layer-timeline');
  const splitter = timeline.locator('> .app-splitter');
  const { height } = await boundingBox(timeline);
  const box = await boundingBox(splitter);
  await page.mouse.move(box.x + box.width / 2, box.y + 1);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y - 50, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => (await boundingBox(timeline)).height).toBe(height + 51);
  await page.reload();
  await expect
    .poll(async () => (await boundingBox(page.locator('.studio-layer-timeline'))).height)
    .toBe(height + 51);
});

test('lines up the layer list with the timeline rows', async ({ page }) => {
  await loadDemo(page, 'searchtoclose');
  await expect(page.locator('.slt-timeline-block')).toHaveCount(6);
  const getRowCenters = (selector: string) =>
    page.locator(selector).evaluateAll(elements =>
      elements.map(e => {
        const { top, height } = e.getBoundingClientRect();
        return Math.round(top + height / 2);
      }),
    );
  expect(await getRowCenters('.slt-timeline-animation-rows .slt-property')).toEqual(
    await getRowCenters('.slt-layers-list .slt-property'),
  );
});
