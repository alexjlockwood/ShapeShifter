import { readFile } from 'node:fs/promises';

import type { Page } from '@playwright/test';

import { artboardPoint, expect, getState, openApp, test } from './fixtures';

// A bar along the top of the 24x24 artboard, from (2, 2) to (22, 6).
const BAR_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path id="bar" d="M2 2h20v4H2z"/></svg>';

async function importSvg(page: Page, name: string, svg: string) {
  await page.getByRole('button', { name: 'Import' }).click();
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'SVG' }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({ name, mimeType: 'image/svg+xml', buffer: Buffer.from(svg) });
  await expect(page.locator('.slt-layer', { hasText: name.replace('.svg', '') })).toBeVisible();
}

async function setProperty(page: Page, name: string, value: string) {
  const input = page.locator(`.spi-property input[name="${name}"]`);
  await input.fill(value);
  await input.blur();
}

function isPixelDrawn(page: Page, x: number, y: number) {
  return page.locator('.app-canvas').evaluate(
    (root, [vx, vy]) => {
      // The canvas covers the panel, and the artboard under it shows the viewport.
      const canvas = root.querySelector<HTMLCanvasElement>('canvas.rendering-canvas')!;
      const artboard = root.querySelector('.canvas-artboard')!.getBoundingClientRect();
      const rect = canvas.getBoundingClientRect();
      const scale = canvas.width / rect.width;
      const px = Math.floor((artboard.left - rect.left + (artboard.width * vx) / 24) * scale);
      const py = Math.floor((artboard.top - rect.top + (artboard.height * vy) / 24) * scale);
      return canvas.getContext('2d')!.getImageData(px, py, 1, 1).data[3] > 0;
    },
    [x, y],
  );
}

async function expectPixels(page: Page, drawn: [number, number][], blank: [number, number][]) {
  for (const [x, y] of drawn) {
    await expect.poll(() => isPixelDrawn(page, x, y), `(${x}, ${y})`).toBe(true);
  }
  for (const [x, y] of blank) {
    await expect.poll(() => isPixelDrawn(page, x, y), `(${x}, ${y})`).toBe(false);
  }
}

function getSelectedLayerNames(page: Page) {
  return getState(page, s =>
    [...s.layers.selectedLayerIds].map((id: string) => s.layers.vectorLayer.findLayerById(id).name),
  );
}

async function clickArtboard(page: Page, x: number, y: number) {
  const point = await artboardPoint(page.locator('.app-canvas'), x, y);
  await page.mouse.click(point.x, point.y);
}

test('rotates a path without a group, animates it, and exports it in a group', async ({ page }) => {
  await openApp(page, '/');
  await importSvg(page, 'bar.svg', BAR_SVG);
  await page.locator('.slt-layer', { hasText: 'bar' }).click();
  // Imported paths pivot at 0, like VectorDrawables.
  await expect(page.locator('.spi-property input[name="pivotX"]')).toHaveValue('0');

  // A quarter turn clockwise around the center puts the bar down the right side.
  await setProperty(page, 'pivotX', '12');
  await setProperty(page, 'pivotY', '12');
  await setProperty(page, 'rotation', '90');
  await expect.poll(() => getState(page, s => s.layers.vectorLayer.children[0].rotation)).toBe(90);
  const TOP: [number, number][] = [[12, 4]];
  const RIGHT: [number, number][] = [[20, 12]];
  const BOTTOM: [number, number][] = [[12, 20]];
  await expectPixels(page, RIGHT, [...TOP, ...BOTTOM]);

  // It's hit where it's drawn, not where its path is.
  await clickArtboard(page, 12, 4);
  await expect.poll(() => getSelectedLayerNames(page)).toEqual([]);
  await clickArtboard(page, 20, 12);
  await expect.poll(() => getSelectedLayerNames(page)).toEqual(['bar']);

  // Animate it another quarter turn, to the bottom.
  await page
    .locator('.app-propertyinput')
    .getByRole('button', { name: 'Animate this layer' })
    .click();
  await page.getByRole('menuitem', { name: 'Rotation', exact: true }).click();
  await expect(page.locator('.spi-selection-description')).toContainText('Rotation');
  await setProperty(page, 'toValue', '180');
  // Shortcuts are ignored until the menu has finished closing (Safari leaves the focus in it).
  await expect(page.locator('.MuiModal-root')).toHaveCount(0);
  await page.keyboard.press('Space');
  await expect.poll(() => getState(page, s => s.playback.isPlaying)).toBe(false);
  expect(await getState(page, s => s.playback.currentTime)).toBe(300);
  await expectPixels(page, BOTTOM, [...TOP, ...RIGHT]);
  await page.keyboard.press('ArrowLeft');
  await expectPixels(page, RIGHT, [...TOP, ...BOTTOM]);

  // AnimatedVectorDrawable paths can't rotate, so the export wraps it in a group, which the
  // rotation animation targets.
  await page.getByRole('button', { name: 'Export' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Animated Vector Drawable' }).click();
  const avd = await readFile(await (await downloadPromise).path(), 'utf8');
  const doc = await page.evaluate(xml => {
    const parsed = new DOMParser().parseFromString(xml, 'application/xml');
    const android = 'http://schemas.android.com/apk/res/android';
    const group = parsed.getElementsByTagName('group')[0];
    const target = parsed.getElementsByTagName('target')[0];
    return {
      group: ['name', 'pivotX', 'pivotY', 'rotation'].map(a => group?.getAttributeNS(android, a)),
      path: group?.getElementsByTagName('path')[0]?.getAttributeNS(android, 'name'),
      target: target?.getAttributeNS(android, 'name'),
      animated: target
        ?.getElementsByTagName('objectAnimator')[0]
        ?.getAttributeNS(android, 'propertyName'),
    };
  }, avd);
  expect(doc).toEqual({
    group: ['bar_transform', '12', '12', '90'],
    path: 'bar',
    target: 'bar_transform',
    animated: 'rotation',
  });
});
