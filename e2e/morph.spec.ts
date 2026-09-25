import { readFile } from 'node:fs/promises';

import type { Download, Page } from '@playwright/test';

import { boundingBox, expect, getState, test } from './fixtures';

// The Material Design play and pause icons.
const PLAY_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path id="play" d="M8 5v14l11-7z"/></svg>';
const PAUSE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path id="pause" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
const LINE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path id="line" d="M4 12h16" fill="none" stroke="#000" stroke-width="2"/></svg>';

type Canvas = 'start' | 'end';

async function readDownload(download: Download) {
  return readFile(await download.path(), 'utf8');
}

async function importSvg(page: Page, name: string, svg: string) {
  await page.getByRole('button', { name: 'Import' }).click();
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'SVG' }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({ name, mimeType: 'image/svg+xml', buffer: Buffer.from(svg) });
  await expect(page.locator('.slt-layer', { hasText: name.replace('.svg', '') })).toBeVisible();
}

/** Converts a point in the 24x24 viewport to page coordinates in an action mode canvas. */
async function toPageCoords(page: Page, canvas: Canvas, x: number, y: number) {
  const box = await boundingBox(page.locator(`.app-canvas.${canvas} canvas.overlay-canvas`));
  return { x: box.x + (box.width * x) / 24, y: box.y + (box.height * y) / 24 };
}

async function clickCanvas(page: Page, canvas: Canvas, x: number, y: number) {
  const point = await toPageCoords(page, canvas, x, y);
  await page.mouse.click(point.x, point.y);
}

async function dragCanvas(
  page: Page,
  canvas: Canvas,
  from: readonly [number, number],
  to: readonly [number, number],
) {
  const start = await toPageCoords(page, canvas, ...from);
  const end = await toPageCoords(page, canvas, ...to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 10 });
  await page.mouse.up();
}

/**
 * Returns the path morphing block's paths, as arrays of subpath strings. Collapsing subpaths are
 * left out, and coordinates are rounded because clicks don't land on exact coordinates.
 */
function getMorphPaths(page: Page) {
  return getState(page, s => {
    const block = s.timeline.animation.blocks.find(
      (b: { propertyName: string }) => b.propertyName === 'pathData',
    );
    const toSubPaths = (path: any) =>
      path
        .getSubPaths()
        .filter((sp: any) => !sp.isCollapsing())
        .map((sp: any) =>
          sp
            .getCommands()
            .map((c: any) => c.toString())
            .join(' ')
            .replace(/-?\d*\.\d+/g, (n: string) => `${Math.round(Number(n))}`),
        );
    return { from: toSubPaths(block.fromValue), to: toSubPaths(block.toValue) };
  });
}

/** Returns true if the pixel at the given viewport point is drawn in the animated canvas. */
function isPixelDrawn(page: Page, x: number, y: number) {
  return page.locator('.app-canvas canvas.rendering-canvas').evaluate(
    (canvas: HTMLCanvasElement, [vx, vy]) => {
      const px = Math.floor((canvas.width * vx) / 24);
      const py = Math.floor((canvas.height * vy) / 24);
      return canvas.getContext('2d')!.getImageData(px, py, 1, 1).data[3] > 0;
    },
    [x, y],
  );
}

async function setProperty(page: Page, name: string, value: string) {
  const input = page.locator(`.spi-property input[name="${name}"]`);
  await input.fill(value);
  await input.blur();
}

async function animateSelectedLayer(page: Page, propertyName: string) {
  await page
    .locator('.app-propertyinput')
    .getByRole('button', { name: 'Animate this layer' })
    .click();
  await page.getByRole('menuitem', { name: propertyName, exact: true }).click();
}

/** Animates the layer's path from its current value to toPathData, and selects the block. */
async function addPathMorph(page: Page, layerName: string, toPathData: string) {
  await page.locator('.slt-layer', { hasText: layerName }).click();
  await animateSelectedLayer(page, 'pathData');
  await expect(page.locator('.spi-selection-description')).toContainText('pathData');
  await setProperty(page, 'toValue', toPathData);
}

async function startActionMode(page: Page) {
  await page.getByRole('button', { name: 'Edit path morphing animation' }).click();
  await expect(page.locator('.app-canvas')).toHaveCount(3);
}

test('creates a play-to-pause morph from scratch', async ({ page, modifier }) => {
  await page.goto('/');
  await importSvg(page, 'play.svg', PLAY_SVG);
  await importSvg(page, 'pause.svg', PAUSE_SVG);

  // Copy the pause icon's path into a path morphing animation on the play icon.
  await page.locator('.slt-layer', { hasText: 'pause' }).click();
  const pausePathData = await page.locator('.spi-property input[name="pathData"]').inputValue();
  await page.keyboard.press('Backspace');
  await expect(page.locator('.slt-layer', { hasText: 'pause' })).toHaveCount(0);
  await addPathMorph(page, 'play', pausePathData);
  await expect(page.locator('.paths-incompatible-text')).toContainText('Paths are incompatible');

  await startActionMode(page);
  expect(await getMorphPaths(page)).toEqual({
    from: ['M 8, 5 L 8, 19 L 19, 12 Z'],
    to: [
      'M 6, 19 L 10, 19 L 10, 5 L 6, 5 L 6, 19 Z',
      'M 14, 5 L 14, 19 L 18, 19 L 18, 5 L 14, 5 Z',
    ],
  });

  // Split the triangle into two by drawing a line from its left edge to its right point.
  await clickCanvas(page, 'start', 12, 12);
  await expect(page.locator('.toolbar')).toContainText('1 subpath selected');
  await page.getByRole('button', { name: 'Split subpaths (S)' }).click();
  await expect(page.locator('.toolbar')).toContainText('Draw a line across a subpath');
  await dragCanvas(page, 'start', [8, 12], [19, 12]);
  expect((await getMorphPaths(page)).from).toEqual([
    'M 8, 5 L 8, 12 L 19, 12 L 8, 5',
    'M 8, 12 L 8, 19 L 19, 12 L 8, 12',
  ]);
  await page.keyboard.press('Escape');
  await expect(page.locator('.toolbar-subtitle')).toHaveText(
    'Add 2 points to the highlighted subpath on the left',
  );

  // Add two points along the diagonal edge of each half of the triangle.
  await clickCanvas(page, 'start', 12, 12);
  await page.getByRole('button', { name: 'Add points (A)' }).click();
  await expect(page.locator('.toolbar')).toContainText('Click along the edge of a subpath');
  for (const [x, y] of [
    [15.33, 9.67],
    [11.67, 7.33],
    [11.67, 16.67],
    [15.33, 14.33],
  ]) {
    await clickCanvas(page, 'start', x, y);
  }
  await expect(page.locator('.toolbar-title')).toHaveText('Add points');
  const getNumCommands = async () => {
    const { from, to } = await getMorphPaths(page);
    const count = (subPaths: string[]) => subPaths.map(sp => sp.split(' L ').length);
    return { from: count(from), to: count(to) };
  };
  expect(await getNumCommands()).toEqual({ from: [6, 6], to: [6, 6] });
  // Adding points clears the selection, so the subpath shortcuts have nothing to change (and
  // used to throw).
  const pathsAfterAddingPoints = await getMorphPaths(page);
  for (const key of ['r', 'b', 'f']) {
    await page.keyboard.press(key);
  }
  expect(await getMorphPaths(page)).toEqual(pathsAfterAddingPoints);
  await page.keyboard.press('Escape');
  await expect(page.locator('.toolbar-subtitle')).toHaveText(
    'Select something below to edit its properties',
  );

  // Shift the left bar's first point forward.
  const pathsBeforeShift = await getMorphPaths(page);
  await clickCanvas(page, 'end', 8, 12);
  await expect(page.locator('.toolbar')).toContainText('1 subpath selected');
  await page.getByRole('button', { name: 'Shift forward points (F)' }).click();
  await expect
    .poll(async () => (await getMorphPaths(page)).to)
    .toEqual(['M 10, 19 L 10, 5 L 6, 5 L 6, 19 L 6, 19 L 10, 19', pathsBeforeShift.to[1]]);
  expect((await getMorphPaths(page)).from).toEqual(pathsBeforeShift.from);

  // Pair the left bar with the bottom half of the triangle.
  await page.getByRole('button', { name: 'Pair subpaths (D)' }).click();
  await expect(page.locator('.toolbar-subtitle')).toHaveText(
    'Pair the selected subpath with a corresponding subpath on the left',
  );
  const pathsBeforePair = await getMorphPaths(page);
  await clickCanvas(page, 'start', 10, 16);
  // The paired subpaths move to the front of each path.
  await expect
    .poll(() => getMorphPaths(page))
    .toEqual({
      from: [pathsBeforePair.from[1], pathsBeforePair.from[0]],
      to: pathsBeforePair.to,
    });
  expect(await getNumCommands()).toEqual({ from: [6, 6], to: [6, 6] });

  // Leave pair mode (which also clears the selection), and then exit action mode.
  await page.keyboard.press('Escape');
  await expect(page.locator('.toolbar-title')).toHaveText('Edit path morphing animation');
  await page.keyboard.press('Escape');
  await expect(page.locator('.app-canvas')).toHaveCount(1);
  await expect(page.locator('.paths-incompatible-text')).toHaveCount(0);

  // Group the path and rotate the group by 90 degrees about the center.
  await page.locator('.slt-layer', { hasText: 'play' }).click();
  await page.keyboard.press(`${modifier}+g`);
  await expect(page.locator('.slt-layer')).toHaveText(['vector', 'group', 'play']);
  await page.locator('.slt-layer', { hasText: 'group' }).click();
  await setProperty(page, 'pivotX', '12');
  await setProperty(page, 'pivotY', '12');
  await animateSelectedLayer(page, 'rotation');
  await expect(page.locator('.slt-timeline-block')).toHaveCount(2);
  // The new block is selected.
  await expect(page.locator('.spi-selection-description')).toContainText('rotation');
  await setProperty(page, 'toValue', '90');

  // The play icon morphs into a pause icon, rotated into two horizontal bars.
  const expectPixels = async (drawn: [number, number][], blank: [number, number][]) => {
    for (const [x, y] of drawn) {
      await expect.poll(() => isPixelDrawn(page, x, y), `(${x}, ${y})`).toBe(true);
    }
    for (const [x, y] of blank) {
      await expect.poll(() => isPixelDrawn(page, x, y), `(${x}, ${y})`).toBe(false);
    }
  };
  const PLAY_ONLY: [number, number][] = [[12, 12]];
  const PAUSE_ONLY: [number, number][] = [
    [6, 8],
    [6, 16],
  ];
  await expectPixels(PLAY_ONLY, PAUSE_ONLY);
  await page.keyboard.press('Space');
  await expect.poll(() => getState(page, s => s.playback.isPlaying)).toBe(false);
  expect(await getState(page, s => s.playback.currentTime)).toBe(300);
  await expectPixels(PAUSE_ONLY, PLAY_ONLY);
  await page.keyboard.press('ArrowLeft');
  await expectPixels(PLAY_ONLY, PAUSE_ONLY);

  // Export the animated vector drawable.
  await page.getByRole('button', { name: 'Export' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Animated Vector Drawable' }).click();
  const avd = await readDownload(await downloadPromise);
  expect(avd).toContain('android:pivotX="12"');
  expect(avd).toContain('android:propertyName="pathData"');
  expect(avd).toContain('android:propertyName="rotation"');
  expect(avd).toContain('android:valueTo="90"');
  const fromPathString = await getState(
    page,
    s =>
      s.timeline.animation.blocks
        .find((b: { propertyName: string }) => b.propertyName === 'pathData')
        .fromValue.getPathString() as string,
  );
  // The bottom half of the triangle comes first, since it was paired with the left bar.
  expect(fromPathString).toMatch(/^M 8 1[12][.\d]* L 8 19 .* M 8 5 /);
  expect(avd).toContain(`android:valueFrom="${fromPathString}"`);

  // Save the project, and then open it in a new workspace.
  const paths = await getMorphPaths(page);
  await page.getByRole('button', { name: 'File' }).click();
  const saveDownloadPromise = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Save' }).click();
  const project = await readDownload(await saveDownloadPromise);
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'New' }).click();
  await expect(page.locator('.slt-layer')).toHaveText(['vector']);
  await page.getByRole('button', { name: 'File' }).click();
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Open' }).click();
  await (
    await fileChooserPromise
  ).setFiles({
    name: 'playtopause.shapeshifter',
    mimeType: 'application/json',
    buffer: Buffer.from(project),
  });
  await expect(page.locator('.slt-layer')).toHaveText(['vector', 'group', 'play']);
  expect(await getMorphPaths(page)).toEqual(paths);
  // Shortcuts are ignored until the menu has finished closing (Safari leaves the focus in it).
  await expect(page.locator('.MuiModal-root')).toHaveCount(0);
  await page.keyboard.press('Space');
  await expect.poll(() => getState(page, s => s.playback.isPlaying)).toBe(false);
  await expectPixels(PAUSE_ONLY, PLAY_ONLY);
});

test('adds and deletes points, and splits stroked subpaths', async ({ page }) => {
  await page.goto('/');
  await importSvg(page, 'line.svg', LINE_SVG);
  await addPathMorph(page, 'line', 'M 4 6 L 20 6 M 4 18 L 20 18');
  await startActionMode(page);
  expect(await getMorphPaths(page)).toEqual({
    from: ['M 4, 12 L 20, 12'],
    to: ['M 4, 6 L 20, 6', 'M 4, 18 L 20, 18'],
  });

  // Add a point halfway along the line.
  await clickCanvas(page, 'start', 12, 12);
  await expect(page.locator('.toolbar-title')).toHaveText('1 subpath selected');
  await page.getByRole('button', { name: 'Add points (A)' }).click();
  await clickCanvas(page, 'start', 12, 12);
  await expect
    .poll(async () => (await getMorphPaths(page)).from)
    .toEqual(['M 4, 12 L 12, 12 L 20, 12']);
  await page.keyboard.press('Escape');

  // Only added points can be selected. Split the segment before the new point in half.
  await clickCanvas(page, 'start', 12, 12);
  await expect(page.locator('.toolbar-title')).toHaveText('1 point selected');
  await page.getByRole('button', { name: 'Add point (A)' }).click();
  await expect
    .poll(async () => (await getMorphPaths(page)).from)
    .toEqual(['M 4, 12 L 8, 12 L 12, 12 L 20, 12']);

  // Drag the first added point past the second one.
  await dragCanvas(page, 'start', [8, 12], [16, 12]);
  await expect
    .poll(async () => (await getMorphPaths(page)).from)
    .toEqual(['M 4, 12 L 12, 12 L 16, 12 L 20, 12']);

  // Delete the point in the middle.
  await clickCanvas(page, 'start', 12, 12);
  await expect(page.locator('.toolbar-title')).toHaveText('1 point selected');
  await page.getByRole('button', { name: 'Delete point' }).click();
  await expect
    .poll(async () => (await getMorphPaths(page)).from)
    .toEqual(['M 4, 12 L 16, 12 L 20, 12']);

  // Stroked paths are split with a single click along the edge.
  await clickCanvas(page, 'start', 6, 12);
  await expect(page.locator('.toolbar-title')).toHaveText('1 subpath selected');
  await page.getByRole('button', { name: 'Split subpaths (S)' }).click();
  await expect(page.locator('.toolbar-subtitle')).toHaveText(
    'Click along the edge of a subpath to split it into 2',
  );
  await clickCanvas(page, 'start', 10, 12);
  await expect
    .poll(async () => (await getMorphPaths(page)).from)
    .toEqual(['M 4, 12 L 10, 12', 'M 10, 12 L 16, 12 L 20, 12']);
  await page.keyboard.press('Escape');
  await expect(page.locator('.toolbar-subtitle')).toHaveText(
    'Add 1 point to the highlighted subpath on the right',
  );

  // Add the missing point to the bottom line on the right.
  await clickCanvas(page, 'end', 12, 18);
  await expect(page.locator('.toolbar-title')).toHaveText('1 subpath selected');
  await page.getByRole('button', { name: 'Add points (A)' }).click();
  await clickCanvas(page, 'end', 12, 18);
  await expect
    .poll(async () => (await getMorphPaths(page)).to)
    .toEqual(['M 4, 6 L 20, 6', 'M 4, 18 L 12, 18 L 20, 18']);
  await page.keyboard.press('Escape');
  await expect(page.locator('.toolbar-subtitle')).toHaveText(
    'Select something below to edit its properties',
  );
});

test('auto fixes incompatible paths', async ({ page }) => {
  await page.goto('/');
  await importSvg(page, 'play.svg', PLAY_SVG);
  await addPathMorph(page, 'play', 'M 6 19 L 10 19 L 10 5 L 6 5 Z M 14 5 L 14 19 L 18 19 L 18 5 Z');
  await expect(page.locator('.paths-incompatible-text')).toContainText('Paths are incompatible');
  await page.locator('.app-propertyinput').getByRole('button', { name: 'Auto fix' }).click();
  await expect(page.locator('.paths-incompatible-text')).toHaveCount(0);

  // The morph plays, ending with the gap between the pause icon's bars.
  expect(await isPixelDrawn(page, 12, 12)).toBe(true);
  await page.keyboard.press('Space');
  await expect.poll(() => getState(page, s => s.playback.isPlaying)).toBe(false);
  await expect.poll(() => isPixelDrawn(page, 12, 12)).toBe(false);
  expect(await isPixelDrawn(page, 8, 12)).toBe(true);
});
