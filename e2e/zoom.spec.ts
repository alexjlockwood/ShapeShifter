import type { Page } from '@playwright/test';

import { artboardPoint, boundingBox, expect, getState, openApp, test } from './fixtures';

async function loadDemo(page: Page, { editor = true } = {}) {
  await openApp(page, `/?project=demos/playtopause.shapeshifter${editor ? '' : '&editor=0'}`);
  await expect
    .poll(() => getState(page, s => s.layers.vectorLayer.children.length))
    .toBeGreaterThan(0);
}

const artboard = (page: Page) => boundingBox(page.locator('.canvas-artboard').first());

/** Returns the viewport point under the page point, from the artboard's position. */
async function toViewport(page: Page, x: number, y: number) {
  const box = await artboard(page);
  return { x: ((x - box.x) / box.width) * 24, y: ((y - box.y) / box.height) * 24 };
}

test('zooms around the pointer when scrolling with Ctrl held', async ({ page }) => {
  await loadDemo(page);
  const before = await artboard(page);
  const pointer = { x: before.x + before.width / 4, y: before.y + before.height / 3 };
  const under = await toViewport(page, pointer.x, pointer.y);

  await page.mouse.move(pointer.x, pointer.y);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -200);
  await page.keyboard.up('Control');

  await expect.poll(async () => (await artboard(page)).width).toBeGreaterThan(before.width);
  const after = await toViewport(page, pointer.x, pointer.y);
  expect(after.x).toBeCloseTo(under.x, 1);
  expect(after.y).toBeCloseTo(under.y, 1);
  await page.screenshot({ path: test.info().outputPath('zoomed.png') });
});

test('pans by scrolling, and by dragging with the space bar held', async ({ page }) => {
  await loadDemo(page);
  await page.locator('.slt-layer', { hasText: 'path' }).click();
  const start = await artboard(page);
  await page.mouse.move(start.x + 20, start.y + 20);
  await page.mouse.wheel(0, 100);
  await expect.poll(async () => (await artboard(page)).y).toBeCloseTo(start.y - 100, 0);

  // Start on the panel around the artboard, where a click would clear the selection.
  const scrolled = await artboard(page);
  const panel = await boundingBox(page.locator('.app-canvas'));
  const press = { x: panel.x + 10, y: panel.y + panel.height - 40 };
  await page.keyboard.down('Space');
  await expect(page.locator('.app-canvas.is-space-held')).toHaveCount(1);
  await page.mouse.move(press.x, press.y);
  await page.mouse.down();
  // Back down, since the scroll above moved the artboard up, and panning can't take the middle
  // of the panel off of the artboard.
  await page.mouse.move(press.x + 50, press.y + 30, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up('Space');
  const dragged = await artboard(page);
  expect(dragged.x).toBeCloseTo(scrolled.x + 50, 0);
  expect(dragged.y).toBeCloseTo(scrolled.y + 30, 0);

  // Releasing the space bar after panning doesn't play the animation, and the click at the end
  // of the drag doesn't clear the selection.
  expect(await getState(page, s => s.playback.isPlaying)).toBe(false);
  expect(await getState(page, s => s.layers.selectedLayerIds.size)).toBe(1);
  // Tapping it does. The demo is only 300ms long, so it repeats, or it could end before the check.
  // With the canvas editor on, R picks the rectangle tool, so this uses the button.
  await page.getByRole('button', { name: 'Repeat', exact: true }).click();
  await expect.poll(() => getState(page, s => s.playback.isRepeating)).toBe(true);
  await page.keyboard.press('Space');
  await expect.poll(() => getState(page, s => s.playback.isPlaying)).toBe(true);
});

test('zooms with the keyboard, and keeps the browser from zooming the page', async ({
  page,
  modifier,
}) => {
  await loadDemo(page);
  // Records the key presses, to check once they're handled whether the default was prevented.
  await page.evaluate(() => {
    (window as any).keyEvents = [];
    window.addEventListener('keydown', event => (window as any).keyEvents.push(event), true);
  });
  const fit = await artboard(page);

  await page.keyboard.press(`${modifier}+Equal`);
  // Zoom steps are powers of two.
  await expect.poll(async () => (await artboard(page)).width).toBeGreaterThan(fit.width);
  const zoomedIn = await artboard(page);
  expect(Math.log2(zoomedIn.width / 24) % 1).toBeCloseTo(0, 5);

  await page.keyboard.press(`${modifier}+Minus`);
  await expect.poll(async () => (await artboard(page)).width).toBeCloseTo(zoomedIn.width / 2, 0);
  await page.keyboard.press('Shift+Digit0');
  await expect.poll(async () => (await artboard(page)).width).toBeCloseTo(24, 0);
  await page.keyboard.press('Shift+Digit1');
  await expect.poll(async () => (await artboard(page)).width).toBeCloseTo(fit.width, 0);

  const prevented = await page.evaluate(() =>
    (window as any).keyEvents
      .filter((event: KeyboardEvent) => !['Meta', 'Control', 'Shift'].includes(event.key))
      .map((event: KeyboardEvent) => event.defaultPrevented),
  );
  expect(prevented).toEqual([true, true, true, true]);
});

test('clicks the right subpath in action mode after zooming', async ({ page, modifier }) => {
  await loadDemo(page);
  await page.evaluate(() => {
    const { services } = (window as any).shapeshifter;
    const block = services.layerTimelineService
      .getAnimation()
      .blocks.find((b: { propertyName: string }) => b.propertyName === 'pathData');
    services.layerTimelineService.selectBlock(block.id, true);
    // ActionMode.Selection
    services.actionModeService.setActionMode(2);
  });
  await expect(page.locator('.app-canvas')).toHaveCount(3);
  const fit = await boundingBox(page.locator('.app-canvas.start .canvas-artboard'));
  await page.keyboard.press(`${modifier}+Equal`);
  await expect
    .poll(async () => (await boundingBox(page.locator('.app-canvas.start .canvas-artboard'))).width)
    .toBeGreaterThan(fit.width);
  // The three canvases share the zoom.
  const widths = await page
    .locator('.canvas-artboard')
    .evaluateAll(elements => elements.map(e => Math.round(e.getBoundingClientRect().width)));
  expect(new Set(widths).size).toBe(1);

  // The top half of the triangle, whose points are at (8, 5), (8, 12), and (19, 12). Without the
  // zoom, the click would land to the right of it.
  const point = await artboardPoint(page.locator('.app-canvas.start'), 15, 10);
  await page.mouse.click(point.x, point.y);
  const selections = await getState(page, s => s.actionmode.selections);
  // SelectionType.SubPath, ActionSource.From
  expect(selections).toEqual([{ type: 1, source: 1, subIdx: 0 }]);
  await page.screenshot({ path: test.info().outputPath('action-mode-zoomed.png') });
});

test("doesn't zoom or pan without the canvas editor", async ({ page }) => {
  await loadDemo(page, { editor: false });
  const before = await artboard(page);
  await page.mouse.move(before.x + 20, before.y + 20);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -200);
  await page.keyboard.up('Control');
  await page.mouse.wheel(0, 100);
  await page.keyboard.press('Shift+Digit0');
  // The canvas still fits. (Firefox zooms the page for Ctrl and the wheel when nothing else does,
  // which moves the artboard on the screen.)
  const view = await page.evaluate(() =>
    (window as any).shapeshifter.services.canvasViewportService.getView(),
  );
  expect(view).toEqual({ type: 'fit' });
});

test('zooms with two fingers on a touch screen, after the first one starts a gesture', async ({
  page,
  browserName,
}) => {
  // Real touches, which the canvas captures, come from Chromium's DevTools protocol.
  test.skip(browserName !== 'chromium', 'Needs the Chrome DevTools Protocol');
  await loadDemo(page);
  const layers = () => getState(page, s => JSON.stringify(s.layers.vectorLayer.toJSON()));
  const beforeLayers = await layers();
  const before = await artboard(page);
  const middle = { x: before.x + before.width / 2, y: before.y + before.height / 2 };
  const cdp = await page.context().newCDPSession(page);
  type TouchType = 'touchStart' | 'touchMove' | 'touchEnd';
  const touch = (type: TouchType, spread: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints:
        type === 'touchEnd'
          ? []
          : [
              { x: middle.x - spread, y: middle.y, id: 1 },
              { x: middle.x + spread, y: middle.y, id: 2 },
            ],
    });
  // The first finger lands a moment before the second, and starts a gesture on the artboard,
  // which captures it once it moves.
  for (const type of ['touchStart', 'touchMove'] as const) {
    await cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: [{ x: middle.x - 20, y: middle.y + (type === 'touchMove' ? 1 : 0), id: 1 }],
    });
  }
  await touch('touchStart', 20);
  for (let spread = 25; spread <= 40; spread += 5) {
    await touch('touchMove', spread);
  }
  await touch('touchEnd', 40);
  // Twice as far apart zooms in twice as much, and the first finger didn't move anything.
  const after = await artboard(page);
  expect(after.width / before.width).toBeCloseTo(2, 1);
  expect(await layers()).toBe(beforeLayers);
});
