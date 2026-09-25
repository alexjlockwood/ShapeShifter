import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';

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

  await page.getByRole('button', { name: 'Play (Spacebar)' }).click();
  await expect.poll(() => getCurrentTime(page)).toBeGreaterThan(0);
  // The play button turns into a pause button while the animation plays.
  await page.getByRole('button', { name: 'Pause (Spacebar)' }).waitFor();
  await page.screenshot({ path: 'test-results/canvas-playing.png' });
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

  // Clicking inside of the triangle in the start canvas selects it.
  await page.mouse.click(230, 330);
  const selections = await page.evaluate(() => {
    const { store } = (window as any).shapeshifter;
    return store.getState().present.actionmode.selections;
  });
  // SelectionType.SubPath, ActionSource.From
  expect(selections).toEqual([{ type: 1, source: 1, subIdx: 0 }]);

  // Escape clears the selection, and then exits action mode.
  await page.keyboard.press('Escape');
  await expect(page.locator('.app-canvas')).toHaveCount(3);
  await page.keyboard.press('Escape');
  await expect(page.locator('.app-canvas')).toHaveCount(1);
});
