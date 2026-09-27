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

test('selects every visible layer with Cmd+A', async ({ page, modifier }) => {
  await openSquares(page);
  // b and c in a group, which is selected as a whole.
  await click(page, 12, 4);
  await click(page, 4, 12, { shift: true });
  await page.keyboard.press(`${modifier}+g`);
  await expect.poll(() => getState(page, s => s.layers.vectorLayer.children.length)).toBe(2);
  const groupName = await getState<string>(page, s => s.layers.vectorLayer.children[1].name);
  await click(page, 20, 20);
  await expect.poll(() => getSelectedNames(page)).toEqual([]);
  await page.keyboard.press(`${modifier}+a`);
  await expect.poll(() => getSelectedNames(page)).toEqual(['a', groupName].sort());

  // Hidden layers are skipped.
  await page.evaluate(() => {
    const { store, services } = (window as any).shapeshifter;
    const [a] = store.getState().present.layers.vectorLayer.children;
    services.layerTimelineService.toggleVisibleLayer(a.id);
  });
  await click(page, 20, 20);
  await page.keyboard.press(`${modifier}+a`);
  await expect.poll(() => getSelectedNames(page)).toEqual([groupName]);

  // With a drawing tool, it goes back to the select tool first.
  await click(page, 20, 20);
  await page.keyboard.press('p');
  await expect.poll(() => getToolName(page)).toBe('pen');
  await page.keyboard.press(`${modifier}+a`);
  await expect.poll(() => getToolName(page)).toBe('select');
  await expect.poll(() => getSelectedNames(page)).toEqual([groupName]);
});

/** Sends a synthetic Cmd+A (Ctrl+A outside of Macs), and returns whether it was taken. */
function pressSelectAll(
  page: Page,
  modifier: string,
  init: { repeat?: boolean; ctrlKey?: boolean; metaKey?: boolean } = {},
) {
  return page.evaluate(
    key => {
      const event = new KeyboardEvent('keydown', {
        key: 'a',
        code: 'KeyA',
        keyCode: 65,
        bubbles: true,
        cancelable: true,
        ...key,
      });
      (document.activeElement ?? document.body).dispatchEvent(event);
      return event.defaultPrevented;
    },
    { ...(modifier === 'Meta' ? { metaKey: true } : { ctrlKey: true }), ...init },
  );
}

test('swallows Cmd+A during a drag and on key repeat', async ({ page, modifier }) => {
  await openSquares(page);
  // The press selects a. A click first would make it a double-click, which edits the path.
  const canvas = page.locator('.app-canvas');
  const start = await artboardPoint(canvas, 4, 4);
  const middle = await artboardPoint(canvas, 6, 7);
  const end = await artboardPoint(canvas, 8, 10);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(middle.x, middle.y, { steps: 5 });
  // The new selection would cancel the drag.
  expect(await pressSelectAll(page, modifier)).toBe(true);
  expect(await getSelectedNames(page)).toEqual(['a']);
  await page.mouse.move(end.x, end.y, { steps: 5 });
  await page.mouse.up();
  await expect
    .poll(async () => rounded(await getPathData(page, 'a')))
    .toBe('M 6 8 L 10 8 L 10 12 L 6 12 Z');

  // Holding the keys down doesn't select everything again, e.g. after a click cleared it.
  await click(page, 20, 20);
  await expect.poll(() => getSelectedNames(page)).toEqual([]);
  expect(await pressSelectAll(page, modifier, { repeat: true })).toBe(true);
  expect(await getSelectedNames(page)).toEqual([]);
  // Nor does it with the other command key held too, which is left to the browser.
  const other = modifier === 'Meta' ? { ctrlKey: true } : { metaKey: true };
  expect(await pressSelectAll(page, modifier, other)).toBe(false);
  expect(await getSelectedNames(page)).toEqual([]);
});

test('handles Cmd+A with the focus on the toolbar', async ({ page, modifier }) => {
  await openSquares(page);
  const toolbar = page.getByRole('toolbar', { name: 'Tools' });
  // The pen goes back to the select tool, rather than staying on with every layer selected.
  await page.keyboard.press('p');
  await expect.poll(() => getToolName(page)).toBe('pen');
  await toolbar.getByRole('button', { name: 'Pen', exact: true }).focus();
  await page.keyboard.press(`${modifier}+a`);
  await expect.poll(() => getToolName(page)).toBe('select');
  await expect.poll(() => getSelectedNames(page)).toEqual(['a', 'b', 'c']);

  // While editing a path, it selects every point rather than every layer, which would stop the
  // edit.
  const point = await artboardPoint(page.locator('.app-canvas'), 4, 4);
  await page.mouse.dblclick(point.x, point.y);
  await expect.poll(() => isEditingPath(page)).toBe(true);
  await toolbar.getByRole('button', { name: 'Move' }).focus();
  await page.keyboard.press(`${modifier}+a`);
  expect(await isEditingPath(page)).toBe(true);
  expect(await getSelectedNames(page)).toEqual(['a']);
  // The arrow keys belong to the toolbar while it has the focus.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => getPathData(page, 'a')).toBe('M 3 2 L 7 2 L 7 6 L 3 6 Z');
});

test('selects every layer with Cmd+A with the canvas editor off, except while typing', async ({
  page,
  modifier,
}) => {
  await page.goto('/');
  await expect(page.locator('.app-canvas')).toHaveAttribute('data-canvas-editor', 'off');
  await dispatchClipboardEvent(page, 'paste', SQUARES_SVG);
  await expect.poll(() => getState(page, s => s.layers.vectorLayer.children.length)).toBe(3);
  await page.keyboard.press(`${modifier}+a`);
  await expect.poll(() => getSelectedNames(page)).toEqual(['a', 'b', 'c']);

  // A text field keeps the browser's select all.
  await click(page, 4, 4);
  await expect.poll(() => getSelectedNames(page)).toEqual(['a']);
  await page.locator('.spi-property input[name="name"]').focus();
  const isPrevented = await page.evaluate(
    key => {
      const event = new KeyboardEvent('keydown', {
        key: 'a',
        keyCode: 65,
        bubbles: true,
        cancelable: true,
        ...key,
      });
      document.activeElement?.dispatchEvent(event);
      return event.defaultPrevented;
    },
    modifier === 'Meta' ? { metaKey: true } : { ctrlKey: true },
  );
  expect(isPrevented).toBe(false);
  expect(await getSelectedNames(page)).toEqual(['a']);
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

test("doesn't count a press right after a drag as a double-click", async ({ page }) => {
  await openSquares(page);
  await click(page, 4, 4);
  await page.keyboard.press('Enter');
  await expect.poll(() => isEditingPath(page)).toBe(true);
  // Drags the top right point away and back in one drag, then drags it again right away.
  const canvas = page.locator('.app-canvas');
  const start = await artboardPoint(canvas, 6, 2);
  const away = await artboardPoint(canvas, 9, 9);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(away.x, away.y, { steps: 5 });
  await page.mouse.move(start.x, start.y, { steps: 5 });
  await page.mouse.up();
  await drag(page, [6, 2], [8.1, 0.9]);
  // A double-click would have made it a smooth point, with curves on either side.
  await expect.poll(() => getPathData(page, 'a')).toBe('M 2 2 L 8 1 L 6 6 L 2 6 Z');
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

test('moves a handle on its own, and mirrors the other one with Cmd held', async ({
  page,
  modifier,
}) => {
  await page.goto('/?editor=1');
  await expect(page.locator('.app-canvas')).toHaveAttribute('data-canvas-editor', 'ready');
  // The point at (8, 12) has mirrored handles, at (6, 8) and (10, 16).
  await dispatchClipboardEvent(
    page,
    'paste',
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path id="curve" d="M 2 12 C 2 8 6 8 8 12 C 10 16 14 16 14 12"/>
    </svg>`,
  );
  await expect
    .poll(() => getPathData(page, 'curve'))
    .toBe('M 2 12 C 2 8 6 8 8 12 C 10 16 14 16 14 12');
  // Inside the curve's first bump, which is filled.
  await click(page, 5, 10.5);
  await page.keyboard.press('Enter');
  await expect.poll(() => isEditingPath(page)).toBe(true);
  await click(page, 8, 12);
  await drag(page, [10, 16], [10, 18]);
  await expect
    .poll(async () => rounded(await getPathData(page, 'curve')))
    .toBe('M 2 12 C 2 8 6 8 8 12 C 10 18 14 16 14 12');
  // Pressing the key once the drag has started mirrors the other handle from then on. (On a Mac,
  // Chromium makes a press with Ctrl held a right-click, whatever its user agent says.)
  const canvas = page.locator('.app-canvas');
  const start = await artboardPoint(canvas, 10, 18);
  const middle = await artboardPoint(canvas, 10.5, 17);
  const end = await artboardPoint(canvas, 11, 16);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(middle.x, middle.y, { steps: 5 });
  await page.keyboard.down(modifier);
  await page.mouse.move(end.x, end.y, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up(modifier);
  await expect
    .poll(async () => rounded(await getPathData(page, 'curve')))
    .toBe('M 2 12 C 2 8 5 8 8 12 C 11 16 14 16 14 12');
});

test('drags a copy out of a point with Alt held, or drops it back to leave nothing to undo', async ({
  page,
  modifier,
}) => {
  await openSquares(page);
  await click(page, 4, 4);
  await page.keyboard.press('Enter');
  await expect.poll(() => isEditingPath(page)).toBe(true);
  await page.keyboard.down('Alt');
  await drag(page, [6, 2], [9, 1]);
  await page.keyboard.up('Alt');
  await expect
    .poll(async () => rounded(await getPathData(page, 'a')))
    .toBe('M 2 2 L 6 2 L 9 1 L 6 6 L 2 6 Z');
  await page.keyboard.press(`${modifier}+z`);
  await expect.poll(() => getPathData(page, 'a')).toBe('M 2 2 L 6 2 L 6 6 L 2 6 Z');
  const getUndoSteps = () =>
    page.evaluate(() => (window as any).shapeshifter.store.getState().past.length as number);
  const steps = await getUndoSteps();
  const canvas = page.locator('.app-canvas');
  // Drags a copy out of another point, and drops it back.
  const start = await artboardPoint(canvas, 6, 6);
  const away = await artboardPoint(canvas, 9, 9);
  await page.keyboard.down('Alt');
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(away.x, away.y, { steps: 10 });
  expect(
    await page.evaluate(() => (window as any).shapeshifter.canvasEditor.isEditing() as boolean),
  ).toBe(true);
  await page.mouse.move(start.x, start.y, { steps: 10 });
  await page.mouse.up();
  await page.keyboard.up('Alt');
  await expect.poll(() => getPathData(page, 'a')).toBe('M 2 2 L 6 2 L 6 6 L 2 6 Z');
  expect(await getUndoSteps()).toBe(steps);
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

/**
 * Presses at from and drags to to, in viewport coordinates, then moves 1px with the main button
 * already up and releases there, as a macOS trackpad can. Only Chromium's DevTools protocol sends
 * mouse events like that.
 */
async function pressWithStrayMove(page: Page, from: [number, number], to = from) {
  const canvas = page.locator('.app-canvas');
  const start = await artboardPoint(canvas, ...from);
  const end = await artboardPoint(canvas, ...to);
  const cdp = await page.context().newCDPSession(page);
  type MouseType = 'mouseMoved' | 'mousePressed' | 'mouseReleased';
  const send = (type: MouseType, { x, y }: { x: number; y: number }, buttons: number) =>
    cdp.send('Input.dispatchMouseEvent', {
      type,
      x,
      y,
      button: type === 'mouseMoved' && !buttons ? 'none' : 'left',
      buttons,
      clickCount: type === 'mouseMoved' ? 0 : 1,
    });
  await send('mouseMoved', start, 0);
  await send('mousePressed', start, 1);
  if (to !== from) {
    for (let i = 1; i <= 10; i++) {
      const t = i / 10;
      await send(
        'mouseMoved',
        { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t },
        1,
      );
    }
  }
  const stray = { x: end.x + 1, y: end.y + 1 };
  await send('mouseMoved', stray, 0);
  await send('mouseReleased', stray, 0);
  await cdp.detach();
}

test("keeps the pen's point when the mouse reports its button up before the release", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Needs the Chrome DevTools Protocol');
  await openSquares(page);
  await page.keyboard.press('p');
  await click(page, 16, 16);
  await click(page, 22, 16);
  await pressWithStrayMove(page, [22, 22]);
  await expect.poll(() => getPathData(page, 'path')).toBe('M 16 16 L 22 16 L 22 22');
  // The pen is still drawing, from the new point.
  await click(page, 16, 22);
  await expect.poll(() => getPathData(page, 'path')).toBe('M 16 16 L 22 16 L 22 22 L 16 22');
});

test('keeps a dragged point when the mouse reports its button up before the release', async ({
  page,
  browserName,
  modifier,
}) => {
  test.skip(browserName !== 'chromium', 'Needs the Chrome DevTools Protocol');
  await openSquares(page);
  const point = await artboardPoint(page.locator('.app-canvas'), 4, 4);
  await page.mouse.dblclick(point.x, point.y);
  await expect.poll(() => isEditingPath(page)).toBe(true);
  await pressWithStrayMove(page, [6, 2], [8.1, 0.9]);
  await expect.poll(() => getPathData(page, 'a')).toBe('M 2 2 L 8 1 L 6 6 L 2 6 Z');
  // As one undo step.
  await page.keyboard.press(`${modifier}+z`);
  await expect.poll(() => getPathData(page, 'a')).toBe('M 2 2 L 6 2 L 6 6 L 2 6 Z');
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

function getGuides(page: Page) {
  return getState(page, s =>
    s.guides.guides.map((guide: { axis: string; value: number }) => `${guide.axis} ${guide.value}`),
  );
}

/** Drags a new guide out of a ruler to a point on the artboard. */
async function dragFromRuler(
  page: Page,
  orientation: 'horizontal' | 'vertical',
  to: [number, number],
) {
  const ruler = await boundingBox(page.locator(`.canvas-ruler.orientation-${orientation}`));
  const end = await artboardPoint(page.locator('.app-canvas'), ...to);
  const start =
    orientation === 'horizontal'
      ? { x: end.x, y: ruler.y + ruler.height / 2 }
      : { x: ruler.x + ruler.width / 2, y: end.y };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 10 });
  await page.mouse.up();
}

test('drags guides out of the rulers, and back onto them to remove them', async ({
  page,
  modifier,
}) => {
  await openSquares(page);
  // They snap to c's top edge, and to the pixel grid.
  await dragFromRuler(page, 'horizontal', [16, 9.8]);
  await expect.poll(() => getGuides(page)).toEqual(['y 10']);
  await dragFromRuler(page, 'vertical', [17.1, 20]);
  await expect.poll(() => getGuides(page)).toEqual(['y 10', 'x 17']);

  // Moves snap to them.
  await drag(page, [12, 4], [15.1, 4.1]);
  await expect.poll(() => getPathData(page, 'b')).toBe('M 13 2 L 17 2 L 17 6 L 13 6 Z');

  // Dragging a guide back onto its ruler removes it, as an undo step.
  const guide = await artboardPoint(page.locator('.app-canvas'), 20, 10);
  const ruler = await boundingBox(page.locator('.canvas-ruler.orientation-horizontal'));
  await page.mouse.move(guide.x, guide.y);
  await page.mouse.down();
  await page.mouse.move(guide.x, ruler.y + ruler.height / 2, { steps: 10 });
  await page.mouse.up();
  await expect.poll(() => getGuides(page)).toEqual(['x 17']);
  await page.keyboard.press(`${modifier}+z`);
  await expect.poll(() => getGuides(page)).toEqual(['y 10', 'x 17']);
});

test('hides the rulers and guides with Shift+R', async ({ page }) => {
  await openSquares(page);
  const ruler = page.locator('.canvas-ruler.orientation-horizontal');
  const button = page.getByRole('button', { name: 'Rulers', exact: true });
  await expect(ruler).toBeVisible();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Shift+R');
  await expect(ruler).toBeHidden();
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  // Shift+R doesn't toggle repeating too.
  expect(await getState(page, s => s.playback.isRepeating)).toBe(false);
  await button.click();
  await expect(ruler).toBeVisible();
});

test('snaps moves to space layers out evenly', async ({ page }) => {
  await openSquares(page);
  // a and b are 4 units apart, so c goes 4 units past b.
  await drag(page, [4, 12], [20.2, 4.3]);
  await expect.poll(() => getPathData(page, 'c')).toBe('M 18 2 L 22 2 L 22 6 L 18 6 Z');
});

test('edits an animated path at the ends of its morph, and auto fixes it', async ({ page }) => {
  await page.goto('/?editor=1&project=demos/playtopause.shapeshifter');
  await expect(page.locator('.app-canvas')).toHaveAttribute('data-canvas-editor', 'ready');
  await expect.poll(() => getState(page, s => s.layers.vectorLayer.children.length)).toBe(1);
  await page.evaluate(() => {
    const { services, store } = (window as any).shapeshifter;
    const block = store
      .getState()
      .present.timeline.animation.blocks.find((b: any) => b.propertyName === 'pathData');
    services.layerTimelineService.setSelectedLayers(new Set([block.layerId]));
    services.playbackService.setCurrentTime(150);
  });
  const badge = page.locator('.canvas-editor-keyframe');
  // In the middle of the morph, the path can't be edited.
  await expect(badge).toContainText('Morphing from 0 to 300 ms');
  await page.keyboard.press('Enter');
  expect(await isEditingPath(page)).toBe(false);

  await page.getByRole('button', { name: 'Go to end' }).click();
  await expect(badge).toContainText('End of the morph, at 300 ms');
  await expect(badge).toContainText('Morphs');
  await page.keyboard.press('Enter');
  await expect.poll(() => isEditingPath(page)).toBe(true);
  // Adding a point to the end of the morph means it no longer morphs.
  await click(page, 6, 12);
  await expect(badge).toContainText("Doesn't morph");
  await page.getByRole('button', { name: 'Auto fix' }).click();
  await expect(badge).toContainText('Morphs');
  await expect(badge).not.toContainText("Doesn't morph");
  expect(
    await getState(page, s =>
      s.timeline.animation.blocks.find((b: any) => b.propertyName === 'pathData').isAnimatable(),
    ),
  ).toBe(true);

  // The badge also edits the morph in action mode, which starts at the beginning of the block.
  await page.keyboard.press('Escape');
  await badge.getByRole('button', { name: 'Edit morph' }).click();
  await expect(page.locator('.app-canvas')).toHaveCount(3);
  await expect.poll(() => getState(page, s => s.playback.currentTime)).toBe(0);
  await expect(badge).toBeHidden();
});

/** The numbers of the selected points of the path being edited, which has one subpath. */
function getSelectedPointNumbers(page: Page) {
  return page.evaluate(() => {
    const { services } = (window as any).shapeshifter;
    const { pointEdit } = services.canvasEditorBridgeService.getState();
    const commands: { id: string }[] = pointEdit?.path.getCommands() ?? [];
    return commands
      .map((command, i) => (pointEdit.selectedAnchorIds.has(command.id) ? i + 1 : 0))
      .filter(n => n > 0);
  });
}

test('shows and edits the selected point in the inspector while editing points', async ({
  page,
  modifier,
}) => {
  await openSquares(page);
  await click(page, 4, 4);
  await page.getByRole('button', { name: 'Edit points' }).click();
  await expect.poll(() => isEditingPath(page)).toBe(true);
  await expect(page.locator('.spi-selection-sub-description')).toHaveText('Editing points');

  // A point clicked on the canvas shows in the inspector, and editing it moves it, as one undo
  // step.
  await click(page, 6, 2);
  const position = page
    .getByRole('region', { name: 'Point 2', exact: true })
    .getByRole('group', { name: 'Position' });
  await expect(position.getByLabel('X')).toHaveValue('6');
  await expect(position.getByLabel('Y')).toHaveValue('2');
  await position.getByLabel('X').fill('8');
  await position.getByLabel('X').press('Enter');
  await expect.poll(() => getPathData(page, 'a')).toBe('M 2 2 L 8 2 L 6 6 L 2 6 Z');
  await page.keyboard.press(`${modifier}+z`);
  await expect.poll(() => getPathData(page, 'a')).toBe('M 2 2 L 6 2 L 6 6 L 2 6 Z');
  expect(await isEditingPath(page)).toBe(true);

  // Subpaths are collapsed until they're opened, and clicking a point there selects it.
  const subPath = page.getByRole('region', { name: 'Subpath 1', exact: true });
  await expect(subPath.getByRole('button', { name: 'Point 3', exact: true })).toHaveCount(0);
  await subPath.getByRole('button', { name: /^Subpath 1/ }).click();
  await subPath.getByRole('button', { name: 'Point 3', exact: true }).click();
  await expect.poll(() => getSelectedPointNumbers(page)).toEqual([3]);
  await expect(page.getByRole('region', { name: 'Point 3', exact: true })).toBeVisible();

  // Done stops editing, and the path's text is under "Advanced".
  await page.getByRole('button', { name: 'Done' }).click();
  await expect.poll(() => isEditingPath(page)).toBe(false);
  await page.getByText('Advanced').click();
  await expect(page.locator('.spi-property input[name="pathData"]')).toHaveValue(
    'M 2 2 L 6 2 L 6 6 L 2 6 Z',
  );
});

test('applies a typed value when the canvas is pressed instead of Enter', async ({ page }) => {
  await openSquares(page);
  await click(page, 4, 4);
  await page.getByRole('button', { name: 'Edit points' }).click();
  await expect.poll(() => isEditingPath(page)).toBe(true);
  const pointX = (n: number) =>
    page
      .getByRole('region', { name: `Point ${n}`, exact: true })
      .getByRole('group', { name: 'Position' })
      .getByLabel('X');

  // Pressing another point selects it, which replaces the field.
  await click(page, 6, 2);
  await pointX(2).fill('8');
  await click(page, 6, 6);
  await expect.poll(() => getPathData(page, 'a')).toBe('M 2 2 L 8 2 L 6 6 L 2 6 Z');

  // Pressing the empty artboard starts a gesture, which the editor won't edit points during.
  await pointX(3).fill('7');
  await click(page, 20, 20);
  await expect.poll(() => getPathData(page, 'a')).toBe('M 2 2 L 8 2 L 7 6 L 2 6 Z');

  // The same goes for the Layout section when another layer is pressed.
  if (await isEditingPath(page)) {
    await page.getByRole('button', { name: 'Done' }).click();
  }
  await click(page, 4, 4);
  await page.getByRole('region', { name: 'Layout' }).getByLabel('Layout X').fill('3');
  await click(page, 12, 4);
  await expect.poll(() => getSelectedNames(page)).toEqual(['b']);
  expect(await getPathData(page, 'a')).toBe('M 3 2 L 9 2 L 8 6 L 3 6 Z');
});

test('reverses, opens, and closes a subpath in the inspector', async ({ page }) => {
  await openSquares(page);
  await click(page, 4, 4);
  await page.keyboard.press('Enter');
  await expect.poll(() => isEditingPath(page)).toBe(true);
  const subPath = page.getByRole('region', { name: 'Subpath 1', exact: true });
  await expect(subPath).toContainText('closed · 4 points');
  await subPath.getByRole('button', { name: 'Reverse', exact: true }).click();
  await expect.poll(() => getPathData(page, 'a')).toBe('M 2 2 L 2 6 L 6 6 L 6 2 Z');
  await subPath.getByRole('button', { name: 'Open', exact: true }).click();
  await expect.poll(() => getPathData(page, 'a')).toBe('M 2 2 L 2 6 L 6 6 L 6 2 L 2 2');
  // The new last point is on top of the first one.
  await expect(subPath).toContainText('open · 5 points');
  await subPath.getByRole('button', { name: 'Close', exact: true }).click();
  await expect.poll(() => getPathData(page, 'a')).toBe('M 2 2 L 2 6 L 6 6 L 6 2 Z');
  await expect(subPath.getByRole('button', { name: 'Open', exact: true })).toBeVisible();
});

test('sets the first point from the inspector and the context menu', async ({ page }) => {
  await openSquares(page);
  await click(page, 4, 4);
  await page.keyboard.press('Enter');
  await expect.poll(() => isEditingPath(page)).toBe(true);
  await click(page, 6, 6);
  await page.getByRole('button', { name: 'Set as first point' }).click();
  // The shape stays, and so does the selection, which is the first point now.
  await expect.poll(() => getPathData(page, 'a')).toBe('M 6 6 L 2 6 L 2 2 L 6 2 Z');
  await expect(page.getByRole('region', { name: 'Point 1', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Set as first point' })).toBeDisabled();

  // A right-click on another point selects it for the menu.
  const canvas = page.locator('.app-canvas');
  const topLeft = await artboardPoint(canvas, 2, 2);
  await page.mouse.click(topLeft.x, topLeft.y, { button: 'right' });
  await expect(page.getByRole('menuitem', { name: 'Open subpath' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Set as first point' }).click();
  await expect.poll(() => getPathData(page, 'a')).toBe('M 2 2 L 6 2 L 6 6 L 2 6 Z');
  expect(await isEditingPath(page)).toBe(true);

  // An open subpath starts at one of its ends, so the item says why it can't.
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect.poll(() => getPathData(page, 'a')).toBe('M 2 2 L 6 2 L 6 6 L 2 6 L 2 2');
  const corner = await artboardPoint(canvas, 6, 6);
  await page.mouse.click(corner.x, corner.y, { button: 'right' });
  await expect(page.getByRole('menuitem', { name: /Set as first point/ })).toContainText(
    'An open subpath starts at one of its ends',
  );
});

test("edits a keyframe's path in the inspector, where the canvas does", async ({ page }) => {
  await openSquares(page);
  // a's path morphs to a bigger square, and the time is at the end of the morph.
  await page.evaluate(() => {
    const { services } = (window as any).shapeshifter;
    const lts = services.layerTimelineService;
    const a = lts.getVectorLayer().findLayerByName('a');
    lts.addBlockForProperty(a.id, 'pathData');
    const block = lts.getAnimation().blocks[0].clone();
    block.toValue = new a.pathData.constructor('M 1 1 L 9 1 L 9 9 L 1 9 Z');
    lts.updateBlocks([block]);
    services.playbackService.setCurrentTime(block.endTime);
    lts.setSelectedLayers(new Set([a.id]));
  });
  await page.getByRole('button', { name: 'Edit points' }).click();
  await expect.poll(() => isEditingPath(page)).toBe(true);
  await click(page, 9, 1);
  const position = page
    .getByRole('region', { name: 'Point 2', exact: true })
    .getByRole('group', { name: 'Position' });
  await expect(position.getByLabel('X')).toHaveValue('9');
  await position.getByLabel('X').fill('10');
  await position.getByLabel('X').press('Enter');
  const getToValue = () =>
    getState<string>(page, s => s.timeline.animation.blocks[0].toValue.getPathString());
  await expect.poll(getToValue).toBe('M 1 1 L 10 1 L 9 9 L 1 9 Z');
  // The layer's own path is the start of the morph, which stays.
  expect(await getPathData(page, 'a')).toBe('M 2 2 L 6 2 L 6 6 L 2 6 Z');
});

test('joins the ends of a path with Cmd+J', async ({ page, modifier }) => {
  await openSquares(page);
  await page.keyboard.press('p');
  await click(page, 16, 2);
  await click(page, 20, 2);
  await click(page, 20, 6);
  await page.keyboard.press('Escape');
  await expect.poll(() => getPathData(page, 'path')).toBe('M 16 2 L 20 2 L 20 6');
  await page.keyboard.press('Enter');
  await expect.poll(() => isEditingPath(page)).toBe(true);
  await click(page, 16, 2);
  await click(page, 20, 6, { shift: true });
  await page.keyboard.press(`${modifier}+j`);
  await expect.poll(() => getPathData(page, 'path')).toBe('M 16 2 L 20 2 L 20 6 Z');
});

test('combines paths and outlines strokes, as undo steps', async ({ page, modifier }) => {
  await openSquares(page);
  await click(page, 4, 4);
  await click(page, 12, 4, { shift: true });
  await page.getByRole('button', { name: 'Union' }).click();
  await expect
    .poll(() => getState(page, s => s.layers.vectorLayer.children.map((l: any) => l.name)))
    .toEqual(['a', 'c']);
  expect((await getPathData(page, 'a'))?.match(/M/g)).toHaveLength(2);
  await page.keyboard.press(`${modifier}+z`);
  await expect.poll(() => getState(page, s => s.layers.vectorLayer.children.length)).toBe(3);

  // A line is a stroke, which becomes a filled outline.
  await page.keyboard.press('l');
  await drag(page, [4, 20], [20, 20]);
  await expect.poll(() => getToolName(page)).toBe('select');
  await page.keyboard.press(`${modifier}+Alt+o`);
  await expect
    .poll(() =>
      getState(page, s => {
        const line = s.layers.vectorLayer.findLayerByName('line');
        return line && [line.fillColor, line.strokeColor];
      }),
    )
    .toEqual(['#000000', '']);
});
