import type { Page } from '@playwright/test';

import { artboardPoint, dispatchClipboardEvent, expect, test } from './fixtures';

function getCurrentTime(page: Page) {
  return page.evaluate(() => {
    const { store } = (window as any).shapeshifter;
    return store.getState().present.playback.currentTime as number;
  });
}

function countDrawnPixels(page: Page) {
  return page.locator('canvas.rendering-canvas').evaluate((canvas: HTMLCanvasElement) => {
    const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
    let count = 0;
    for (let i = 3; i < data.length; i += 4) {
      count += data[i] ? 1 : 0;
    }
    return count;
  });
}

test('draws and plays a demo', async ({ page }) => {
  await page.goto('/?project=demos/playtopause.shapeshifter');
  await expect.poll(() => countDrawnPixels(page)).toBeGreaterThan(0);

  // The demo is only 300ms long, so without repeating it can finish before the checks below.
  await page.getByRole('button', { name: 'Repeat (R)' }).click();
  await page.getByRole('button', { name: 'Play (Spacebar)' }).click();
  await expect.poll(() => getCurrentTime(page)).toBeGreaterThan(0);
  // The play button turns into a pause button while the animation plays.
  await page.getByRole('button', { name: 'Pause (Spacebar)' }).waitFor();
  await page.screenshot({ path: 'test-results/canvas-playing.png' });
});

test('loads the canvas editor with ?editor=1', async ({ page }) => {
  await page.goto('/?project=demos/playtopause.shapeshifter&editor=1');
  await expect(page.locator('.app-canvas')).toHaveAttribute('data-canvas-editor', 'ready');
  // It's off by default in tests (playwright.config.ts).
  await page.goto('/?project=demos/playtopause.shapeshifter&editor=default');
  await expect(page.locator('.app-canvas')).toHaveAttribute('data-canvas-editor', 'off');
});

// A small square in a layer that isn't animated.
const SQUARE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M 2 2 H 8 V 8 H 2 Z"/></svg>';
const BIG_SQUARE = 'M 0 0 L 24 0 L 24 24 L 0 24 Z';

test('previews an edit, and commits it as one undo step', async ({ page, modifier }) => {
  await page.goto('/?editor=1');
  await expect(page.locator('.app-canvas')).toHaveAttribute('data-canvas-editor', 'ready');
  await dispatchClipboardEvent(page, 'paste', SQUARE_SVG);
  await expect.poll(() => countDrawnPixels(page)).toBeGreaterThan(0);
  const small = await countDrawnPixels(page);
  const layerId = await page.evaluate(() => {
    const { store } = (window as any).shapeshifter;
    const find = (layer: any): any =>
      layer.pathData ? layer : layer.children.map(find).find(Boolean);
    return find(store.getState().present.layers.vectorLayer).id as string;
  });
  const getPathData = () =>
    page.evaluate(id => {
      const { store } = (window as any).shapeshifter;
      const layer = store.getState().present.layers.vectorLayer.findLayerById(id);
      return layer.pathData.getPathString() as string;
    }, layerId);
  const previewBigSquare = () =>
    page.evaluate(
      ([id, pathData]) => {
        // The canvas editor's hook for tests (components/canvaseditor/CanvasEditor.ts).
        const { canvasEditor } = (window as any).shapeshifter;
        canvasEditor.previewPath(id, pathData);
      },
      [layerId, BIG_SQUARE],
    );
  const original = await getPathData();

  // The canvas shows the edit, but the document doesn't change until it's committed.
  await previewBigSquare();
  await expect.poll(() => countDrawnPixels(page)).toBeGreaterThan(small);
  const big = await countDrawnPixels(page);
  expect(await getPathData()).toBe(original);

  // After the commit, the canvas still shows it.
  await page.evaluate(() => (window as any).shapeshifter.canvasEditor.commit());
  expect(await getPathData()).toBe(BIG_SQUARE);
  await expect.poll(() => countDrawnPixels(page)).toBe(big);
  await page.keyboard.press(`${modifier}+z`);
  await expect.poll(getPathData).toBe(original);
  await expect.poll(() => countDrawnPixels(page)).toBe(small);

  // Anything that changes the document cancels an edit in progress, like redo.
  await previewBigSquare();
  await page.keyboard.press(`${modifier}+Shift+z`);
  await expect.poll(getPathData).toBe(BIG_SQUARE);
  expect(await page.evaluate(() => (window as any).shapeshifter.canvasEditor.isEditing())).toBe(
    false,
  );
});

test('selects a layer by clicking its fill', async ({ page }) => {
  await page.goto('/?project=demos/playtopause.shapeshifter');
  await expect.poll(() => countDrawnPixels(page)).toBeGreaterThan(0);
  // Inside of the triangle's top half, away from its edges.
  const point = await artboardPoint(page.locator('.app-canvas'), 10, 10);
  await page.mouse.click(point.x, point.y);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const { store } = (window as any).shapeshifter;
        const { layers } = store.getState().present;
        return [...layers.selectedLayerIds].map(id => layers.vectorLayer.findLayerById(id).name);
      }),
    )
    .toEqual(['path']);
});

test('plays and rewinds with keyboard shortcuts', async ({ page }) => {
  await page.goto('/?project=demos/searchtoclose.shapeshifter');
  await expect.poll(() => countDrawnPixels(page)).toBeGreaterThan(0);
  await page.keyboard.press('Space');
  await expect.poll(() => getCurrentTime(page)).toBeGreaterThan(0);
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => getCurrentTime(page)).toBe(0);
});

test('shows the start and end of the morph in action mode', async ({ page }) => {
  await page.goto('/?project=demos/playtopause.shapeshifter');
  await expect.poll(() => countDrawnPixels(page)).toBeGreaterThan(0);
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
  // The start and end canvases label each of the path's points.
  const overlays = page.locator(
    '.app-canvas.start canvas.overlay-canvas, .app-canvas.end canvas.overlay-canvas',
  );
  for (const overlay of await overlays.all()) {
    await expect
      .poll(() =>
        overlay.evaluate((canvas: HTMLCanvasElement) => {
          const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
          return data.some((value, i) => i % 4 === 3 && value > 0);
        }),
      )
      .toBe(true);
  }
  await page.screenshot({ path: 'test-results/action-mode.png' });

  // Clicking inside of the triangle's top half in the start canvas selects it. The subpath's
  // points are at (8, 5), (8, 12), and (19, 12) in the 24x24 viewport.
  const getSelections = () =>
    page.evaluate(() => {
      const { store } = (window as any).shapeshifter;
      return store.getState().present.actionmode.selections;
    });
  const point = await artboardPoint(page.locator('.app-canvas.start'), 10, 9);
  // Right-clicks don't select anything.
  await page.mouse.click(point.x, point.y, { button: 'right' });
  expect(await getSelections()).toEqual([]);
  await page.mouse.click(point.x, point.y);
  const selections = await getSelections();
  // SelectionType.SubPath, ActionSource.From
  expect(selections).toEqual([{ type: 1, source: 1, subIdx: 0 }]);

  // Escape clears the selection, and then exits action mode.
  await page.keyboard.press('Escape');
  await expect(page.locator('.app-canvas')).toHaveCount(3);
  await page.keyboard.press('Escape');
  await expect(page.locator('.app-canvas')).toHaveCount(1);
});
