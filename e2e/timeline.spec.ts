import type { Page } from '@playwright/test';

import { boundingBox, dispatchClipboardEvent, expect, getState, test } from './fixtures';

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

test('converts a path to a clip path when another layer has a non-path animation', async ({
  page,
}) => {
  await loadDemo(page);
  // The path only animates its pathData, but the group animates its rotation.
  const pathLayer = page.locator('.slt-layer', { hasText: 'path' });
  await pathLayer.hover();
  await pathLayer.locator('.slt-layer-more-actions').click();
  await page.getByRole('menuitem', { name: 'Convert to clip path' }).click();
  await expect(pathLayer).toHaveClass(/slt-layer-type-mask/);
  await expect(page.locator('.slt-timeline-block')).toHaveCount(2);
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

test('stops highlighting the splitter after clicking it', async ({ page }) => {
  await page.goto('/');
  const splitter = page.locator('.studio-layer-timeline > .app-splitter');
  const box = await boundingBox(splitter);
  await page.mouse.move(box.x + box.width / 2, box.y + 1);
  await expect(splitter).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await page.mouse.down();
  await page.mouse.up();
  await page.mouse.move(box.x + box.width / 2, box.y + 100);
  await expect(splitter).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
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

test('limits the size of the timeline canvases when zoomed in', async ({ page, modifier }) => {
  await loadDemo(page);
  await page.locator('.slt-timeline-animation-meta').click();
  const duration = page.locator('.spi-property input[name="duration"]');
  await duration.fill('60000');
  await duration.press('Enter');
  await expect.poll(() => getState(page, s => s.timeline.animation.duration)).toBe(60000);
  await duration.blur();

  // Zoom all the way in.
  const timeline = await boundingBox(page.locator('.slt-timeline'));
  await page.mouse.move(timeline.x + 100, timeline.y + 100);
  await page.keyboard.down(modifier);
  for (let i = 0; i < 40; i++) {
    await page.mouse.wheel(0, -500);
  }
  await page.keyboard.up(modifier);
  const canvases = page.locator('.slt-timeline canvas');
  await expect
    .poll(async () => (await boundingBox(canvases.first())).width)
    .toBeGreaterThan(100000);
  const sizes = await canvases.evaluateAll(elements =>
    elements.map(e => Math.max((e as HTMLCanvasElement).width, (e as HTMLCanvasElement).height)),
  );
  expect(Math.max(...sizes)).toBeLessThanOrEqual(16384);
});

test('groups, flattens, and converts layers', async ({ page, modifier }) => {
  await page.goto('/');
  await dispatchClipboardEvent(
    page,
    'paste',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path id="line" d="M2 6h8" fill="none" stroke="#000" stroke-width="1"/></svg>',
  );
  const layers = page.locator('.slt-layer');
  await expect(layers).toHaveText(['vector', 'line']);
  const getLine = () =>
    getState(page, s => {
      const line = s.layers.vectorLayer.findLayerByName('line');
      return { pathData: line.pathData.getPathString(), strokeWidth: line.strokeWidth };
    });
  const openLayerMenu = async (name: string) => {
    const layer = layers.filter({ hasText: name });
    await layer.hover();
    await layer.locator('.slt-layer-more-actions').click();
  };

  // Group the line, and then ungroup it.
  await layers.filter({ hasText: 'line' }).click();
  await page.keyboard.press(`${modifier}+g`);
  await expect(layers).toHaveText(['vector', 'group', 'line']);
  await page.keyboard.press(`${modifier}+Shift+g`);
  await expect(layers).toHaveText(['vector', 'line']);

  // Scale a group up, and then flatten it. The line and its stroke get twice as big.
  await page.keyboard.press(`${modifier}+g`);
  await layers.filter({ hasText: 'group' }).click();
  for (const name of ['scaleX', 'scaleY']) {
    const input = page.locator(`.spi-property input[name="${name}"]`);
    await input.fill('2');
    await input.blur();
  }
  await openLayerMenu('group');
  await page.getByRole('menuitem', { name: 'Flatten group' }).click();
  await expect(layers).toHaveText(['vector', 'line']);
  expect(await getLine()).toEqual({ pathData: 'M 4 12 L 20 12', strokeWidth: 2 });

  // Convert the line to a clip path and back.
  await openLayerMenu('line');
  await page.getByRole('menuitem', { name: 'Convert to clip path' }).click();
  await expect(layers.filter({ hasText: 'line' })).toHaveClass(/slt-layer-type-mask/);
  await openLayerMenu('line');
  await page.getByRole('menuitem', { name: 'Convert to path' }).click();
  await expect(layers.filter({ hasText: 'line' })).toHaveClass(/slt-layer-type-path/);
  expect((await getLine()).pathData).toBe('M 4 12 L 20 12');
});
