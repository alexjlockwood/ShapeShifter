import type { Page } from '@playwright/test';

import { artboardPoint, expect, test } from './fixtures';

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

test('previews an edit, and commits it as one undo step', async ({ page, modifier }) => {
  await page.goto('/?project=demos/playtopause.shapeshifter&editor=1');
  await expect(page.locator('.app-canvas')).toHaveAttribute('data-canvas-editor', 'ready');
  await expect.poll(() => countDrawnPixels(page)).toBeGreaterThan(0);
  const triangle = await countDrawnPixels(page);
  const layerId = await page.evaluate(() => {
    const { store } = (window as any).shapeshifter;
    const find = (layer: any): any =>
      layer.name === 'path' ? layer : layer.children.map(find).find(Boolean);
    return find(store.getState().present.layers.vectorLayer).id as string;
  });
  const getPathData = () =>
    page.evaluate(id => {
      const { store } = (window as any).shapeshifter;
      const layer = store.getState().present.layers.vectorLayer.findLayerById(id);
      return layer.pathData.getPathString() as string;
    }, layerId);
  const previewSquare = () =>
    page.evaluate(id => {
      // The canvas editor's hook for tests (components/canvaseditor/CanvasEditor.ts).
      const { canvasEditor } = (window as any).shapeshifter;
      canvasEditor.previewPath(id, 'M 0 0 L 24 0 L 24 24 L 0 24 Z');
    }, layerId);
  const original = await getPathData();

  // The canvas shows the edit, but the document doesn't change until it's committed.
  await previewSquare();
  await expect.poll(() => countDrawnPixels(page)).toBeGreaterThan(triangle);
  expect(await getPathData()).toBe(original);
  await page.evaluate(() => (window as any).shapeshifter.canvasEditor.commit());
  expect(await getPathData()).toBe('M 0 0 L 24 0 L 24 24 L 0 24 Z');
  await page.keyboard.press(`${modifier}+z`);
  await expect.poll(getPathData).toBe(original);
  await expect.poll(() => countDrawnPixels(page)).toBe(triangle);

  // Anything that changes the document cancels an edit in progress, like redo.
  await previewSquare();
  await page.keyboard.press(`${modifier}+Shift+z`);
  await expect.poll(getPathData).toBe('M 0 0 L 24 0 L 24 24 L 0 24 Z');
  expect(await page.evaluate(() => (window as any).shapeshifter.canvasEditor.isEditing())).toBe(
    false,
  );
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
