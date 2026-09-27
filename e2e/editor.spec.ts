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
  await expect.poll(() => getSelectedNames(page)).toEqual(['c']);
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

function getPathData(page: Page, name: string) {
  return page.evaluate(layerName => {
    const { store } = (window as any).shapeshifter;
    const layer = store.getState().present.layers.vectorLayer.findLayerByName(layerName);
    return layer?.pathData.getPathString() as string | undefined;
  }, name);
}

async function drag(page: Page, from: [number, number], to: [number, number]) {
  const canvas = page.locator('.app-canvas');
  const start = await artboardPoint(canvas, ...from);
  const end = await artboardPoint(canvas, ...to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 10 });
  await page.mouse.up();
}

/** Rounds a path's numbers, since drags don't land on exact coordinates. */
function rounded(pathData: string | undefined) {
  return pathData?.replace(/-?\d*\.\d+/g, n => `${Math.round(Number(n))}`);
}

test('moves a layer by dragging it, as one undo step', async ({ page, modifier }) => {
  await openSquares(page);
  await drag(page, [4, 4], [8, 10]);
  await expect
    .poll(async () => rounded(await getPathData(page, 'a')))
    .toBe('M 6 8 L 10 8 L 10 12 L 6 12 Z');
  await page.keyboard.press(`${modifier}+z`);
  await expect.poll(() => getPathData(page, 'a')).toBe('M 2 2 L 6 2 L 6 6 L 2 6 Z');
});

test('duplicates layers by dragging them with Alt held, or with Cmd+D', async ({
  page,
  modifier,
}) => {
  await openSquares(page);
  await page.keyboard.down('Alt');
  await drag(page, [4, 4], [4, 18]);
  await page.keyboard.up('Alt');
  await expect.poll(() => getSelectedNames(page)).toEqual(['a_1']);
  expect(await getPathData(page, 'a')).toBe('M 2 2 L 6 2 L 6 6 L 2 6 Z');
  expect(rounded(await getPathData(page, 'a_1'))).toBe('M 2 16 L 6 16 L 6 20 L 2 20 Z');

  const duplicate = await page.evaluate(
    key => {
      const event = new KeyboardEvent('keydown', {
        key: 'd',
        bubbles: true,
        cancelable: true,
        ...key,
      });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    },
    modifier === 'Meta' ? { metaKey: true } : { ctrlKey: true },
  );
  // It keeps the browser from bookmarking the page too.
  expect(duplicate).toBe(true);
  await expect.poll(() => getSelectedNames(page)).toEqual(['a_2']);
  expect(await getPathData(page, 'a_2')).toBe(await getPathData(page, 'a_1'));
});

test('moves an animated layer with its animation', async ({ page }) => {
  await page.goto('/?project=demos/playtopause.shapeshifter&editor=1');
  await expect(page.locator('.app-canvas')).toHaveAttribute('data-canvas-editor', 'ready');
  await expect.poll(() => getState(page, s => s.layers.vectorLayer.children.length)).toBe(1);
  // The play icon, as its path block draws it at the start.
  await drag(page, [10, 12], [10, 16]);
  await expect
    .poll(async () => rounded(await getPathData(page, 'path')))
    .toBe('M 8 9 L 8 23 L 19 16 Z');
  const blockPaths = await getState<string[][]>(page, s =>
    s.timeline.animation.blocks
      .filter((b: any) => b.propertyName === 'pathData')
      .map((b: any) => [b.fromValue.getPathString(), b.toValue.getPathString()]),
  );
  expect(blockPaths.flat().map(p => rounded(p)?.split(' L ')[0])).toEqual(['M 8 9', 'M 5 10']);
});

test('nudges the selection with the arrow keys, one undo step per key press', async ({
  page,
  modifier,
}) => {
  await openSquares(page);
  // Without a selection, they rewind and fast forward.
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => getState(page, s => s.playback.currentTime)).toBeGreaterThan(0);
  await click(page, 4, 4);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Shift+ArrowDown');
  await expect.poll(() => getPathData(page, 'a')).toBe('M 3 12 L 7 12 L 7 16 L 3 16 Z');
  // Held down, so that the key repeats.
  for (let i = 0; i < 3; i++) {
    await page.keyboard.down('ArrowLeft');
  }
  await page.keyboard.up('ArrowLeft');
  await expect.poll(() => getPathData(page, 'a')).toBe('M 0 12 L 4 12 L 4 16 L 0 16 Z');
  await page.keyboard.press(`${modifier}+z`);
  await expect.poll(() => getPathData(page, 'a')).toBe('M 3 12 L 7 12 L 7 16 L 3 16 Z');
  await page.keyboard.press(`${modifier}+z`);
  await expect.poll(() => getPathData(page, 'a')).toBe('M 3 2 L 7 2 L 7 6 L 3 6 Z');
});

test('scales and rotates the selection with its handles', async ({ page, modifier }) => {
  await openSquares(page);
  await click(page, 4, 4);
  // From the bottom right corner, with the top left one staying put.
  await drag(page, [6, 6], [10, 8]);
  await expect
    .poll(async () => rounded(await getPathData(page, 'a')))
    .toBe('M 2 2 L 10 2 L 10 8 L 2 8 Z');
  await page.keyboard.press(`${modifier}+z`);
  await expect.poll(() => getPathData(page, 'a')).toBe('M 2 2 L 6 2 L 6 6 L 2 6 Z');

  // Just outside the top right corner, the cursor turns into a rotation cursor. A drag to just
  // outside the bottom right one with Shift held turns it a quarter turn around its middle.
  const outside = await artboardPoint(page.locator('.app-canvas'), 6.7, 1.3);
  await page.mouse.move(outside.x, outside.y);
  await expect(page.locator('.app-canvas')).toHaveAttribute('data-editor-cursor', 'rotate-ne');
  await page.keyboard.down('Shift');
  await drag(page, [6.7, 1.3], [6.7, 6.7]);
  await page.keyboard.up('Shift');
  await expect
    .poll(async () => rounded(await getPathData(page, 'a')))
    .toBe('M 6 2 L 6 6 L 2 6 L 2 2 Z');
});

test('snaps moves to other layers and the pixel grid', async ({ page }) => {
  await openSquares(page);
  // a's right edge ends up a fraction of a unit from b's left edge, and snaps to it.
  await drag(page, [4, 4], [7.7, 4.1]);
  await expect.poll(() => getPathData(page, 'a')).toBe('M 6 2 L 10 2 L 10 6 L 6 6 Z');
  // Away from everything, it snaps to whole units.
  await drag(page, [8, 4], [16.4, 16.3]);
  await expect.poll(() => getPathData(page, 'a')).toBe('M 14 14 L 18 14 L 18 18 L 14 18 Z');
});

function isEditingPath(page: Page) {
  return page.evaluate(() => (window as any).shapeshifter.canvasEditor.isEditingPath() as boolean);
}

test("edits a path's points after a double-click, until Escape", async ({ page, modifier }) => {
  await openSquares(page);
  const point = await artboardPoint(page.locator('.app-canvas'), 4, 4);
  await page.mouse.dblclick(point.x, point.y);
  await expect.poll(() => isEditingPath(page)).toBe(true);
  await expect.poll(() => getSelectedNames(page)).toEqual(['a']);
  // Drags the top right point up and to the right, where it snaps to whole units.
  await drag(page, [6, 2], [8.1, 0.9]);
  await expect.poll(() => getPathData(page, 'a')).toBe('M 2 2 L 8 1 L 6 6 L 2 6 Z');
  // Esc stops editing, and undo puts the point back in one step.
  await page.keyboard.press('Escape');
  await expect.poll(() => isEditingPath(page)).toBe(false);
  await expect.poll(() => getSelectedNames(page)).toEqual(['a']);
  await page.keyboard.press(`${modifier}+z`);
  await expect.poll(() => getPathData(page, 'a')).toBe('M 2 2 L 6 2 L 6 6 L 2 6 Z');
});

test('adds, deletes, and changes points, with Enter to start and stop', async ({ page }) => {
  await openSquares(page);
  await click(page, 4, 4);
  await page.keyboard.press('Enter');
  await expect.poll(() => isEditingPath(page)).toBe(true);
  // Clicking a segment with Shift held adds a point in its middle, and selects it.
  await click(page, 3, 2, { shift: true });
  await expect.poll(() => getPathData(page, 'a')).toBe('M 2 2 L 4 2 L 6 2 L 6 6 L 2 6 Z');
  // 2 makes it a mirrored point, with handles along the top.
  await page.keyboard.press('2');
  await expect
    .poll(async () => rounded(await getPathData(page, 'a')))
    .toBe('M 2 2 C 3 2 3 2 4 2 C 5 2 5 2 6 2 L 6 6 L 2 6 Z');
  // Backspace deletes it, and the segments on either side become one again.
  await page.keyboard.press('Backspace');
  await expect.poll(() => getPathData(page, 'a')).toBe('M 2 2 L 6 2 L 6 6 L 2 6 Z');
  // Tab selects the first point, and the arrow keys move it.
  await page.keyboard.press('Tab');
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => getPathData(page, 'a')).toBe('M 1 2 L 6 2 L 6 6 L 2 6 Z');
  await page.keyboard.press('Enter');
  await expect.poll(() => isEditingPath(page)).toBe(false);
  // Without points to edit, Backspace deletes the layer again.
  await page.keyboard.press('Backspace');
  await expect.poll(() => getState(page, s => s.layers.vectorLayer.children.length)).toBe(2);
});

test('stops editing points on a click on another layer, or on nothing', async ({ page }) => {
  await openSquares(page);
  const point = await artboardPoint(page.locator('.app-canvas'), 4, 4);
  await page.mouse.dblclick(point.x, point.y);
  await expect.poll(() => isEditingPath(page)).toBe(true);
  // A click on another layer stops editing, and selects it.
  await click(page, 12, 4);
  await expect.poll(() => isEditingPath(page)).toBe(false);
  await expect.poll(() => getSelectedNames(page)).toEqual(['b']);
  // With a point selected, a click on nothing only clears the point.
  const b = await artboardPoint(page.locator('.app-canvas'), 12, 4);
  await page.mouse.dblclick(b.x, b.y);
  await expect.poll(() => isEditingPath(page)).toBe(true);
  await click(page, 10, 2);
  await click(page, 20, 20);
  await expect.poll(() => getSelectedNames(page)).toEqual(['b']);
  expect(await isEditingPath(page)).toBe(true);
  // Without one, it stops editing and clears the selection.
  await click(page, 20, 20);
  await expect.poll(() => isEditingPath(page)).toBe(false);
  await expect.poll(() => getSelectedNames(page)).toEqual([]);
});

function getToolName(page: Page) {
  return page.evaluate(() => (window as any).shapeshifter.canvasEditor.getToolName() as string);
}

test('draws a rectangle with the R shortcut, and goes back to the select tool', async ({
  page,
  modifier,
}) => {
  await openSquares(page);
  const toolbar = page.getByRole('toolbar', { name: 'Tools' });
  await expect(toolbar.getByRole('button', { name: 'Move' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.keyboard.press('r');
  await expect(toolbar.getByRole('button', { name: 'Rectangle' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  // R doesn't toggle repeating while the canvas editor is on.
  expect(await getState(page, s => s.playback.isRepeating)).toBe(false);
  await drag(page, [16.1, 16.05], [21.95, 20.1]);
  await expect.poll(() => getPathData(page, 'rectangle')).toBe('M 16 16 L 22 16 L 22 20 L 16 20 Z');
  await expect.poll(() => getSelectedNames(page)).toEqual(['rectangle']);
  await expect.poll(() => getToolName(page)).toBe('select');
  await page.keyboard.press(`${modifier}+z`);
  await expect.poll(() => getPathData(page, 'rectangle')).toBeUndefined();
});

test('draws a path with the pen, one undo step per point', async ({ page, modifier }) => {
  await openSquares(page);
  await page
    .getByRole('toolbar', { name: 'Tools' })
    .getByRole('button', { name: 'Pen', exact: true })
    .click();
  await expect.poll(() => getToolName(page)).toBe('pen');
  await click(page, 16, 16);
  await click(page, 22, 16);
  await click(page, 22, 22);
  // Clicking the first point closes the path.
  await click(page, 16, 16);
  await expect.poll(() => getPathData(page, 'path')).toBe('M 16 16 L 22 16 L 22 22 Z');
  await expect.poll(() => getToolName(page)).toBe('select');
  await page.keyboard.press(`${modifier}+z`);
  await expect.poll(() => getPathData(page, 'path')).toBe('M 16 16 L 22 16 L 22 22');

  // Escape finishes a path without closing it.
  await page.keyboard.press('p');
  await click(page, 16, 2);
  await click(page, 20, 2);
  await page.keyboard.press('Escape');
  await expect.poll(() => getToolName(page)).toBe('select');
  await expect.poll(() => getPathData(page, 'path_1')).toBe('M 16 2 L 20 2');
});

test('draws freehand with the pencil', async ({ page }) => {
  await openSquares(page);
  await page.keyboard.press('Shift+P');
  await expect.poll(() => getToolName(page)).toBe('pencil');
  const canvas = page.locator('.app-canvas');
  const start = await artboardPoint(canvas, 14, 18);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let x = 14; x <= 22; x += 0.5) {
    const point = await artboardPoint(canvas, x, 18 + 2 * Math.sin(x));
    await page.mouse.move(point.x, point.y);
  }
  await page.mouse.up();
  // Pointer moves don't land on exact coordinates, so this only checks that it's made of curves.
  await expect
    .poll(async () => rounded(await getPathData(page, 'path'))?.split(' C ')[0])
    .toBe('M 14 18');
  // The pencil stays on for the next stroke.
  expect(await getToolName(page)).toBe('pencil');
});
