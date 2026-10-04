import type { Page } from '@playwright/test';

import { artboardPoint, dispatchClipboardEvent, expect, getState, test } from './fixtures';

// Two circles, one inside of the other, and a square to their right.
const SHAPES_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
  '<path id="outer" d="M 2 12 A 8 8 0 1 0 18 12 A 8 8 0 1 0 2 12 Z"/>' +
  '<path id="inner" d="M 6 12 A 4 4 0 1 0 14 12 A 4 4 0 1 0 6 12 Z"/>' +
  '<path id="square" d="M 19 2 H 23 V 6 H 19 Z" fill="none" stroke="#000" stroke-width="1"/>' +
  '</svg>';

async function load(page: Page, editor: boolean) {
  await page.goto(editor ? '/' : '/?editor=0');
  await expect(page.locator('.app-canvas')).toHaveAttribute(
    'data-canvas-editor',
    editor ? 'ready' : 'off',
  );
  await dispatchClipboardEvent(page, 'paste', SHAPES_SVG);
  await expect(page.locator('.slt-layer')).toHaveText(['vector', 'outer', 'inner', 'square']);
  // Records whether the last context menu event was stopped, so the browser's menu didn't open.
  await page.evaluate(() => {
    window.addEventListener('contextmenu', event => {
      (window as any).lastContextMenuPrevented = event.defaultPrevented;
    });
  });
}

function getSelectedNames(page: Page) {
  return getState(page, s =>
    Array.from(s.layers.selectedLayerIds as Set<string>).map(
      id => s.layers.vectorLayer.findLayerById(id).name,
    ),
  );
}

function wasPrevented(page: Page) {
  return page.evaluate(() => (window as any).lastContextMenuPrevented as boolean | undefined);
}

async function rightClickCanvas(page: Page, x: number, y: number) {
  const point = await artboardPoint(page.locator('.app-canvas'), x, y);
  await page.mouse.click(point.x, point.y, { button: 'right' });
}

async function chooseMenuItem(page: Page, name: string) {
  await page.getByRole('menuitem', { name }).click();
  await expect(page.locator('.MuiModal-root')).toHaveCount(0);
}

for (const editor of [true, false]) {
  test(`right-click on the canvas selects the path and opens the menu, with the editor ${
    editor ? 'on' : 'off'
  }`, async ({ page }) => {
    await load(page, editor);
    // The square is outlined, so a click inside of it misses it. Its right edge is at x 23.
    await rightClickCanvas(page, 23, 4);
    await expect(page.getByRole('menu')).toBeVisible();
    expect(await wasPrevented(page)).toBe(true);
    expect(await getSelectedNames(page)).toEqual(['square']);
    const items = page.getByRole('menuitem');
    // Duplicate and Outline stroke need the editor.
    await expect(items.filter({ hasText: 'Duplicate' })).toHaveCount(editor ? 1 : 0);
    await expect(items.filter({ hasText: 'Outline stroke' })).toHaveCount(editor ? 1 : 0);
    await expect(items.filter({ hasText: 'Convert to clip path' })).toHaveCount(1);
    await page.screenshot({ path: `test-results/contextmenu-canvas-${editor}.png` });

    // Group runs from the menu.
    await chooseMenuItem(page, 'Group');
    await expect(page.locator('.slt-layer')).toHaveText([
      'vector',
      'outer',
      'inner',
      'group',
      'square',
    ]);
    expect(await getSelectedNames(page)).toEqual(['group']);
  });

  test(`right-click on an empty canvas imports an SVG, with the editor ${
    editor ? 'on' : 'off'
  }`, async ({ page }) => {
    await page.goto(editor ? '/' : '/?editor=0');
    await expect(page.locator('.app-canvas')).toHaveAttribute(
      'data-canvas-editor',
      editor ? 'ready' : 'off',
    );
    await rightClickCanvas(page, 12, 12);
    // There's nothing to select.
    await expect(page.getByRole('menuitem', { name: 'Select all' })).toHaveCount(0);
    await page.getByRole('menuitem', { name: 'Import' }).hover();
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('menuitem', { name: 'SVG' }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'shapes.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from(SHAPES_SVG),
    });
    await expect(page.locator('.slt-layer')).toHaveText(['vector', 'outer', 'inner', 'square']);
  });
}

test('combines two paths into a donut, and breaks it apart', async ({ page }) => {
  await load(page, true);
  const layers = page.locator('.slt-layer');
  await layers.filter({ hasText: 'outer' }).click();
  // Not Ctrl, which is a right-click on a Mac, even with a user agent that isn't a Mac's.
  await layers.filter({ hasText: 'inner' }).click({ modifiers: ['Shift'] });
  // A right-click on a selected path keeps the selection.
  await rightClickCanvas(page, 3, 12);
  expect(await getSelectedNames(page)).toEqual(['outer', 'inner']);
  await page.getByRole('menuitem', { name: 'Boolean operation' }).hover();
  await expect(page.getByRole('menuitem', { name: /Subtract/ })).toBeVisible();
  await page.screenshot({ path: 'test-results/contextmenu-booleans.png' });
  await chooseMenuItem(page, 'Combine into one path');

  await expect(layers).toHaveText(['vector', 'outer', 'square']);
  expect(
    await getState(page, s => {
      const outer = s.layers.vectorLayer.findLayerByName('outer');
      return { fillType: outer.fillType, subPaths: outer.pathData.getSubPaths().length };
    }),
  ).toEqual({ fillType: 'evenOdd', subPaths: 2 });

  await rightClickCanvas(page, 3, 12);
  await chooseMenuItem(page, 'Break apart');
  await expect(layers).toHaveText(['vector', 'outer', 'outer_1', 'square']);
});

test('right-click on a layer row selects it and opens the menu', async ({ page }) => {
  await load(page, false);
  const inner = page.locator('.slt-layer').filter({ hasText: 'inner' });
  await inner.click({ button: 'right' });
  expect(await wasPrevented(page)).toBe(true);
  expect(await getSelectedNames(page)).toEqual(['inner']);
  await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible();

  // The Animate submenu works with the keyboard: ArrowRight opens it, and ArrowLeft goes back.
  const animate = page.getByRole('menuitem', { name: 'Animate' });
  await animate.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('menuitem', { name: 'Path', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(animate).toBeFocused();
  await expect(page.getByRole('menuitem', { name: 'Path', exact: true })).toHaveCount(0);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Fill color', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.MuiModal-root')).toHaveCount(0);
  expect(
    await getState(page, s => s.timeline.animation.blocks.map((b: any) => b.propertyName)),
  ).toEqual(['fillColor']);

  // Escape closes the menu, and the row's "more" button opens it too.
  await inner.hover();
  await inner.getByRole('button', { name: 'More actions' }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.MuiModal-root')).toHaveCount(0);
});

test('zooms the canvas to fit from the menu, once it no longer fits', async ({ page }) => {
  await load(page, true);
  const getViewType = () =>
    page.evaluate(
      () => (window as any).shapeshifter.services.canvasViewportService.getView().type as string,
    );
  await rightClickCanvas(page, 12, 23);
  await expect(page.getByRole('menu')).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /Zoom to fit/ })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('.MuiModal-root')).toHaveCount(0);

  await page.keyboard.press('Shift+Digit0');
  await expect.poll(getViewType).toBe('manual');
  await rightClickCanvas(page, 12, 23);
  await chooseMenuItem(page, 'Zoom to fit');
  await expect.poll(getViewType).toBe('fit');
});

test("the browser's menu only opens over text fields and links", async ({ page }) => {
  await load(page, false);
  await page.getByRole('button', { name: 'Import' }).click({ button: 'right' });
  expect(await wasPrevented(page)).toBe(true);
  await expect(page.getByRole('menu')).toHaveCount(0);
  await page.locator('.slt-layer').filter({ hasText: 'inner' }).click();
  await page.locator('.spi-property input[name="name"]').click({ button: 'right' });
  expect(await wasPrevented(page)).toBe(false);

  // So that a link can be opened in a new tab, or copied.
  await page.getByRole('button', { name: 'More options' }).click();
  await page.getByRole('menuitem', { name: 'Getting started' }).click({ button: 'right' });
  expect(await wasPrevented(page)).toBe(false);
});

test("right-button drags don't move layers", async ({ page }) => {
  await load(page, false);
  const inner = await page.locator('.slt-layer').filter({ hasText: 'inner' }).boundingBox();
  const square = await page.locator('.slt-layer').filter({ hasText: 'square' }).boundingBox();
  if (!inner || !square) {
    throw new Error("The layers aren't shown");
  }
  await page.mouse.move(inner.x + 20, inner.y + inner.height / 2);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(square.x + 20, square.y + square.height, { steps: 5 });
  await page.mouse.up({ button: 'right' });
  await page.keyboard.press('Escape');
  await expect(page.locator('.MuiModal-root')).toHaveCount(0);
  await expect(page.locator('.slt-layer')).toHaveText(['vector', 'outer', 'inner', 'square']);
});
