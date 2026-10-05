import type { Page } from '@playwright/test';

import { dispatchClipboardEvent, expect, getState, openApp, test } from './fixtures';

// A square and a triangle, which don't morph until auto fix adds a point to the triangle.
const SQUARE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
  '<path id="square" d="M 4 4 H 12 V 12 H 4 Z" fill="#f00"/></svg>';
const TRIANGLE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
  '<path id="triangle" d="M 14 14 L 22 14 L 18 22 Z" fill="#00f"/></svg>';

async function paste(page: Page, svg: string, names: ReadonlyArray<string>) {
  await dispatchClipboardEvent(page, 'paste', svg);
  await expect(page.locator('.slt-layer')).toHaveText(['vector', ...names]);
}

function getLayerNames(page: Page) {
  return getState(page, s => s.layers.vectorLayer.children.map((l: { name: string }) => l.name));
}

function getBlocks(page: Page) {
  return getState(page, s =>
    s.timeline.animation.blocks.map((b: { propertyName: string; startTime: number }) => [
      b.propertyName,
      b.startTime,
    ]),
  );
}

async function expectMorphEditor(page: Page) {
  await expect(page.locator('.app-canvas')).toHaveCount(3);
  // Auto fix made the square and the triangle morph.
  await expect(page.locator('.action-mode-status-summary')).toHaveText('Morphs');
}

test('morphs a path into another from its context menu, as one undo step', async ({
  page,
  modifier,
}) => {
  await openApp(page, '/');
  await paste(page, SQUARE_SVG, ['square']);
  await paste(page, TRIANGLE_SVG, ['square', 'triangle']);

  await page.locator('.slt-layer', { hasText: 'square' }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Morph into' }).hover();
  const triangle = page.getByRole('menuitem', { name: 'triangle' });
  await expect(triangle).toBeVisible();
  await page.screenshot({ path: 'test-results/morphinto-submenu.png' });
  await triangle.click();
  await expect(page.locator('.MuiModal-root')).toHaveCount(0);

  await expectMorphEditor(page);
  expect(await getLayerNames(page)).toEqual(['square']);
  expect(await getBlocks(page)).toEqual([
    ['pathData', 0],
    ['fillColor', 0],
  ]);

  // One undo brings back both paths as they were, and leaves the morph editor.
  await page.keyboard.press(`${modifier}+z`);
  await expect(page.locator('.app-canvas')).toHaveCount(1);
  expect(await getLayerNames(page)).toEqual(['square', 'triangle']);
  expect(await getBlocks(page)).toEqual([]);
  expect(
    await getState(page, s =>
      Array.from(s.layers.selectedLayerIds as Set<string>).map(
        id => s.layers.vectorLayer.findLayerById(id).name,
      ),
    ),
  ).toEqual(['square']);
});

test('morphs either of two selected paths into the other', async ({ page }) => {
  await openApp(page, '/');
  await paste(page, SQUARE_SVG, ['square']);
  await paste(page, TRIANGLE_SVG, ['square', 'triangle']);
  const layers = page.locator('.slt-layer');
  await layers.filter({ hasText: 'square' }).click();
  await layers.filter({ hasText: 'triangle' }).click({ modifiers: ['Shift'] });
  await layers.filter({ hasText: 'triangle' }).click({ button: 'right' });
  await expect(
    page.getByRole('menuitem', { name: "Morph 'square' into 'triangle'" }),
  ).toBeVisible();
  await page.getByRole('menuitem', { name: "Morph 'triangle' into 'square'" }).click();
  await expectMorphEditor(page);
  expect(await getLayerNames(page)).toEqual(['triangle']);
});

test('offers to morph into a pasted SVG', async ({ page }) => {
  await openApp(page, '/');
  await paste(page, SQUARE_SVG, ['square']);
  await dispatchClipboardEvent(page, 'paste', TRIANGLE_SVG);
  const snackbar = page.locator('.MuiSnackbar-root');
  await expect(snackbar).toContainText("Morph 'square' into the imported shape?");
  await page.screenshot({ path: 'test-results/morphinto-snackbar.png' });
  await snackbar.getByRole('button', { name: 'Morph' }).click();
  await expectMorphEditor(page);
  expect(await getLayerNames(page)).toEqual(['square']);
});

test('edits, auto fixes, and deletes a morph from its block in the timeline', async ({ page }) => {
  await openApp(page, '/?project=demos/playtopause.shapeshifter');
  await expect.poll(() => getState(page, s => s.layers.vectorLayer.children.length)).toBe(1);
  // The path's block is under the group's rotation block.
  const block = page.locator('.slt-timeline-block').last();
  await block.click({ button: 'right' });
  await expect(page.getByRole('menuitem')).toHaveText([
    'Edit morph',
    /^Auto fix\s*The paths already morph$/,
    'Delete',
  ]);
  await page.getByRole('menuitem', { name: 'Edit morph' }).click();
  await expect(page.locator('.app-canvas')).toHaveCount(3);
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('.app-canvas')).toHaveCount(1);

  await block.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await expect(page.locator('.slt-timeline-block')).toHaveCount(1);
});

test("opens a menu for the morph on the canvas editor's keyframe badge", async ({ page }) => {
  await openApp(page, '/?project=demos/playtopause.shapeshifter');
  await expect.poll(() => getState(page, s => s.layers.vectorLayer.children.length)).toBe(1);
  await page.locator('.slt-layer').getByText('path', { exact: true }).click();
  const badge = page.locator('.canvas-editor-keyframe');
  await expect(badge).toContainText('Start of the morph');
  await badge.click({ button: 'right' });
  await expect(page.getByRole('menuitem')).toHaveText(['Edit morph', /^Auto fix/, 'Delete morph']);
  await page.getByRole('menuitem', { name: 'Edit morph' }).click();
  await expect(page.locator('.app-canvas')).toHaveCount(3);
});

test('offers to morph one of two imported files into the other', async ({ page }) => {
  await openApp(page, '/');
  await page.getByRole('button', { name: 'Import' }).click();
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'SVG' }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles([
    { name: 'square.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(SQUARE_SVG) },
    { name: 'triangle.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(TRIANGLE_SVG) },
  ]);
  await expect(page.locator('.slt-layer')).toHaveText(['vector', 'square', 'triangle']);
  const snackbar = page.locator('.MuiSnackbar-root');
  await expect(snackbar).toContainText("Morph 'square.svg' into 'triangle.svg'?");
  await snackbar.getByRole('button', { name: 'Morph' }).click();
  await expectMorphEditor(page);
  expect(await getLayerNames(page)).toEqual(['square']);
});
