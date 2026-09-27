import type { Page } from '@playwright/test';

import {
  artboardPoint,
  boundingBox,
  dispatchClipboardEvent,
  expect,
  getState,
  test,
} from './fixtures';

// Three filled squares, named by their ids: a and b along the top, and c below a.
const SQUARES_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path id="a" d="M 2 2 H 6 V 6 H 2 Z"/>
  <path id="b" d="M 10 2 H 14 V 6 H 10 Z"/>
  <path id="c" d="M 2 10 H 6 V 14 H 2 Z"/>
</svg>`;

/** Opens an empty project with the canvas editor on, and pastes the squares into it. */
async function openSquares(page: Page) {
  await page.goto('/?editor=1');
  await expect(page.locator('.app-canvas')).toHaveAttribute('data-canvas-editor', 'ready');
  await dispatchClipboardEvent(page, 'paste', SQUARES_SVG);
  await expect.poll(() => getState(page, s => s.layers.vectorLayer.children.length)).toBe(3);
}

function getSelectedNames(page: Page) {
  return getState(page, s =>
    [...s.layers.selectedLayerIds]
      .map((id: string) => s.layers.vectorLayer.findLayerById(id).name as string)
      .sort(),
  );
}

async function click(page: Page, x: number, y: number, { shift = false } = {}) {
  const point = await artboardPoint(page.locator('.app-canvas'), x, y);
  if (shift) {
    await page.keyboard.down('Shift');
  }
  await page.mouse.click(point.x, point.y);
  if (shift) {
    await page.keyboard.up('Shift');
  }
}

test('selects layers by clicking them', async ({ page }) => {
  await openSquares(page);
  await click(page, 4, 4);
  await expect.poll(() => getSelectedNames(page)).toEqual(['a']);
  await click(page, 12, 4, { shift: true });
  await expect.poll(() => getSelectedNames(page)).toEqual(['a', 'b']);
  await click(page, 4, 4, { shift: true });
  await expect.poll(() => getSelectedNames(page)).toEqual(['b']);
  // Clicking nothing, on the artboard or off of it, clears the selection.
  await click(page, 20, 20);
  await expect.poll(() => getSelectedNames(page)).toEqual([]);
  await click(page, 4, 12);
  const panel = await boundingBox(page.locator('.app-canvas'));
  await page.mouse.click(panel.x + 10, panel.y + 10);
  await expect.poll(() => getSelectedNames(page)).toEqual([]);
});

test('selects layers with a marquee, starting off of the artboard', async ({ page }) => {
  await openSquares(page);
  const artboard = await boundingBox(page.locator('.canvas-artboard'));
  const end = await artboardPoint(page.locator('.app-canvas'), 12, 4);
  await page.mouse.move(artboard.x - 20, artboard.y - 20);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 10 });
  await page.mouse.up();
  // The click at the end of the drag doesn't clear the selection.
  await expect.poll(() => getSelectedNames(page)).toEqual(['a', 'b']);
});
