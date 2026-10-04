import type { Page } from '@playwright/test';

import { boundingBox, dispatchClipboardEvent, expect, getState, test } from './fixtures';

async function loadDemo(page: Page) {
  await page.goto('/?project=demos/playtopause.shapeshifter');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const { store } = (window as any).shapeshifter;
        return store.getState().present.layers.vectorLayer.children.length;
      }),
    )
    .toBeGreaterThan(0);
}

function getVectorLayer(page: Page) {
  return page.evaluate(() => {
    const { store } = (window as any).shapeshifter;
    const vl = store.getState().present.layers.vectorLayer;
    return {
      name: vl.name as string,
      alpha: vl.alpha as number,
      width: vl.width as number,
      canvasColor: vl.canvasColor as string | undefined,
    };
  });
}

test('edits the selected layer in the property inspector', async ({ page }) => {
  await loadDemo(page);
  await expect(page.getByText('Select something to edit its properties')).toBeVisible();
  await page.evaluate(() => {
    const { services } = (window as any).shapeshifter;
    const vl = services.layerTimelineService.getVectorLayer();
    services.layerTimelineService.selectLayer(vl.id, true);
  });

  const nameInput = page.locator('.spi-property input[name="name"]');
  await nameInput.fill('my_vector');
  await expect.poll(async () => (await getVectorLayer(page)).name).toBe('my_vector');

  // Invalid numbers are kept in the text field until it loses focus.
  const widthInput = page.locator('.spi-property input[name="width"]');
  const { width } = await getVectorLayer(page);
  await widthInput.fill('abc');
  await expect(widthInput).toHaveValue('abc');
  await widthInput.press('Tab');
  await expect(widthInput).toHaveValue(`${width}`);

  // The arrow keys step numbers, by 0.1 for fractions.
  const alphaInput = page.locator('.spi-property input[name="alpha"]');
  await alphaInput.fill('0.5');
  await alphaInput.press('ArrowUp');
  await expect.poll(async () => (await getVectorLayer(page)).alpha).toBe(0.6);
  await alphaInput.press('Shift+ArrowDown');
  await expect.poll(async () => (await getVectorLayer(page)).alpha).toBe(0);

  // Other text fields ignore them. An empty color used to turn black.
  const canvasColorInput = page.locator('.spi-property input[name="canvasColor"]');
  await canvasColorInput.fill('');
  await canvasColorInput.press('ArrowUp');
  await expect(canvasColorInput).toHaveValue('');
  expect((await getVectorLayer(page)).canvasColor).toBeFalsy();
});

function getPathFillColor(page: Page, layerId: string) {
  return page.evaluate(id => {
    const { store } = (window as any).shapeshifter;
    const vl = store.getState().present.layers.vectorLayer;
    return vl.findLayerById(id).fillColor as string;
  }, layerId);
}

test('edits a color with the color picker, as one undo step', async ({ page, modifier }) => {
  await loadDemo(page);
  const layerId = await page.evaluate(() => {
    const { services } = (window as any).shapeshifter;
    const path = services.layerTimelineService.getVectorLayer().findLayerByName('path');
    services.layerTimelineService.selectLayer(path.id, true);
    return path.id as string;
  });

  // Start from a saturated color, so dragging the hue slider actually changes it (unlike the
  // demo's black, whose hue doesn't affect its RGB value).
  const fillColorInput = page.locator('.spi-property input[name="fillColor"]');
  await fillColorInput.fill('#ff0000');
  await fillColorInput.press('Tab');
  await expect.poll(() => getPathFillColor(page, layerId)).toBe('#ff0000');
  const originalColor = await getPathFillColor(page, layerId);

  const fillRow = page.locator('.spi-property', { has: page.locator('input[name="fillColor"]') });
  await fillRow.getByRole('button', { name: 'Edit color' }).click();
  const popover = page.locator('.spi-color-picker-popover');
  await expect(popover).toBeVisible();

  // Drag the hue slider. It previews the color on every move and commits once, on release.
  const hueSlider = popover.locator('.react-colorful__hue [role="slider"]');
  const box = await boundingBox(hueSlider);
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();
  await expect.poll(() => getPathFillColor(page, layerId)).not.toBe(originalColor);

  // Backspace in the picker's own hex field edits it, rather than deleting the selected layer.
  const hexField = popover.locator('.spi-color-picker-hex');
  await hexField.click();
  await page.keyboard.press('Backspace');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).shapeshifter.store.getState().present.layers.vectorLayer.children[0]
            .children.length,
      ),
    )
    .toBe(1);

  await page.keyboard.press('Escape');
  await expect(popover).toBeHidden();

  await page.keyboard.press(`${modifier}+z`);
  await expect.poll(() => getPathFillColor(page, layerId)).toBe(originalColor);

  // No color saves '' (not a Mixed value), and the row's text field follows undo afterward.
  await fillRow.getByRole('button', { name: 'Edit color' }).click();
  const noColor = popover.getByRole('button', { name: 'No color' });
  await noColor.click();
  await expect.poll(() => getPathFillColor(page, layerId)).toBe('');
  await expect(noColor).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(popover).toBeHidden();
  await page.keyboard.press(`${modifier}+z`);
  await expect.poll(() => getPathFillColor(page, layerId)).toBe(originalColor);
  await expect(fillColorInput).toHaveValue(originalColor);
});

test('switches to the dark theme from the overflow menu', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'More options' }).click();
  await page.getByRole('menuitem', { name: 'Dark theme' }).click();
  await expect(page.locator('body')).toHaveClass(/ss-dark-theme/);
  await expect(page.getByRole('menu')).toBeHidden();
});

test('enters action mode from the property inspector', async ({ page }) => {
  await loadDemo(page);
  await page.evaluate(() => {
    const { services } = (window as any).shapeshifter;
    const block = services.layerTimelineService
      .getAnimation()
      .blocks.find((b: { propertyName: string }) => b.propertyName === 'pathData');
    services.layerTimelineService.selectBlock(block.id, true);
  });
  await page.getByRole('button', { name: 'Edit path morphing animation' }).click();
  await expect(page.locator('.app-canvas')).toHaveCount(3);
  await expect(page.locator('.toolbar')).toContainText('Edit path morphing animation');
  // The toolbar switches to the accent fill color (blue A700) in action mode.
  await expect(page.locator('.toolbar')).toHaveCSS('background-color', 'rgb(41, 98, 255)');
  await page.screenshot({ path: 'test-results/toolbar-action-mode.png' });

  await page.getByRole('button', { name: 'Split subpaths (S)' }).waitFor({ state: 'detached' });
  await page.locator('.action-mode-close-icon').click();
  await expect(page.locator('.app-canvas')).toHaveCount(1);
  await expect(page.locator('.property-input')).toBeVisible();
  // Blue-grey 700, not 500: white on 500 was only 4.37:1.
  await expect(page.locator('.toolbar')).toHaveCSS('background-color', 'rgb(69, 90, 100)');
  await page.screenshot({ path: 'test-results/property-input.png' });
});

test('the File, Import, and Export buttons stop showing a gray background once their menu closes', async ({
  page,
}) => {
  await page.goto('/');
  for (const name of ['File', 'Import', 'Export']) {
    // A CSS locator, not getByRole: MUI's Menu marks the rest of the page aria-hidden while open,
    // so a role query can't find the button again once the menu is showing.
    const button = page.locator('.slt-layers-menu-group-button', { hasText: name });
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.MuiMenu-root')).toBeVisible();
    // Closes the menu by clicking the button again, which returns focus to it.
    await button.click({ force: true });
    await expect(page.locator('.MuiMenu-root')).toBeHidden();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(button).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  }

  // Tab focus still shows a ring for keyboard users. A reload resets the input modality, since
  // the clicks above would otherwise make a later focus() not count as keyboard focus (WebKit
  // also doesn't put a plain button in the Tab order by default, so this checks focus()'s ring
  // rather than relying on a real Tab press reaching the button).
  await page.reload();
  const fileButton = page.locator('.slt-layers-menu-group-button', { hasText: 'File' });
  await fileButton.focus();
  await expect(fileButton).toHaveCSS('box-shadow', 'rgb(41, 98, 255) 0px 0px 0px 2px inset');
});

// A square and a horizontal line, which has no height.
const SHAPES_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path id="square" d="M 2 2 H 6 V 6 H 2 Z"/>
  <path id="line" d="M 2 20 H 10" stroke="#000"/>
</svg>`;

/** Opens an empty project, pastes the shapes, and selects one. */
async function openShapes(page: Page, name: string, { editor = true } = {}) {
  await page.goto(editor ? '/' : '/?editor=0');
  await expect(page.locator('.app-canvas')).toHaveAttribute(
    'data-canvas-editor',
    editor ? 'ready' : 'off',
  );
  await dispatchClipboardEvent(page, 'paste', SHAPES_SVG);
  await expect.poll(() => getState(page, s => s.layers.vectorLayer.children.length)).toBe(2);
  await selectLayer(page, name);
}

function selectLayer(page: Page, name: string) {
  return page.evaluate(layerName => {
    const { services } = (window as any).shapeshifter;
    const layer = services.layerTimelineService.getVectorLayer().findLayerByName(layerName);
    services.layerTimelineService.setSelectedLayers(new Set([layer.id]));
  }, name);
}

function getPathData(page: Page, name: string) {
  return page.evaluate(layerName => {
    const { store } = (window as any).shapeshifter;
    const layer = store.getState().present.layers.vectorLayer.findLayerByName(layerName);
    return layer?.pathData.getPathString() as string | undefined;
  }, name);
}

test('moves and resizes a layer in the Layout section, as one undo step each', async ({
  page,
  modifier,
}) => {
  await openShapes(page, 'square');
  const layout = page.getByRole('region', { name: 'Layout' });
  const x = layout.getByLabel('Layout X');
  await expect(x).toHaveValue('2');
  await expect(layout.getByLabel('Layout W')).toHaveValue('4');
  await x.fill('10');
  await x.press('Enter');
  await expect.poll(() => getPathData(page, 'square')).toBe('M 10 2 L 14 2 L 14 6 L 10 6 Z');
  const width = layout.getByLabel('Layout W');
  await width.fill('8');
  await width.press('Enter');
  await expect.poll(() => getPathData(page, 'square')).toBe('M 10 2 L 18 2 L 18 6 L 10 6 Z');
  await page.keyboard.press(`${modifier}+z`);
  await expect.poll(() => getPathData(page, 'square')).toBe('M 10 2 L 14 2 L 14 6 L 10 6 Z');
  await page.keyboard.press(`${modifier}+z`);
  await expect.poll(() => getPathData(page, 'square')).toBe('M 2 2 L 6 2 L 6 6 L 2 6 Z');
  await expect(x).toHaveValue('2');

  // A line has no height to scale.
  await selectLayer(page, 'line');
  await expect(layout.getByLabel('Layout H')).toBeDisabled();
  await expect(layout.getByLabel('Layout W')).toBeEnabled();
});

test("edits a path's text in its row, without the canvas editor", async ({ page }) => {
  await openShapes(page, 'square', { editor: false });
  // The text is the only way to edit the path without the editor, so it isn't under Advanced.
  const input = page.getByRole('textbox', { name: 'Path', exact: true });
  await expect(input).toBeVisible();
  await expect(input).toHaveValue('M 2 2 L 6 2 L 6 6 L 2 6 Z');
  await expect(page.getByText('Advanced')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit points' })).toHaveCount(0);
  await input.fill('M 0 0 L 4 0 L 4 4 Z');
  await input.blur();
  await expect.poll(() => getPathData(page, 'square')).toBe('M 0 0 L 4 0 L 4 4 Z');
  await expect(page.getByLabel('Layout X')).toHaveValue('0');
});

test('animates a property from its row, and marks the rows that are animated', async ({ page }) => {
  await openShapes(page, 'square');
  // Only properties that can be animated have the button.
  await expect(page.getByRole('button', { name: 'Animate fill type' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Animate fill opacity' }).click();
  await expect(page.locator('.spi-selection-description')).toHaveText('Fill opacity');
  const getBlockNames = () =>
    getState(page, s => s.timeline.animation.blocks.map((b: any) => b.propertyName));
  await expect.poll(getBlockNames).toEqual(['fillAlpha']);

  await selectLayer(page, 'square');
  await page.getByRole('button', { name: 'Fill opacity is animated' }).click();
  await expect(
    page.getByRole('menuitem', { name: 'Animated: this is the value before the first keyframe' }),
  ).toBeDisabled();
  await page.getByRole('menuitem', { name: 'Add another keyframe' }).click();
  await expect.poll(getBlockNames).toEqual(['fillAlpha', 'fillAlpha']);
});

/** Selects several layers by name at once, as a Shift-click extending a selection would. */
function selectLayers(page: Page, names: string[]) {
  return page.evaluate(layerNames => {
    const { services } = (window as any).shapeshifter;
    const vl = services.layerTimelineService.getVectorLayer();
    const ids = layerNames.map(name => vl.findLayerByName(name).id);
    services.layerTimelineService.setSelectedLayers(new Set(ids));
  }, names);
}

function getStrokeWidths(page: Page, names: string[]) {
  return page.evaluate(
    layerNames =>
      layerNames.map(
        name =>
          (window as any).shapeshifter.store
            .getState()
            .present.layers.vectorLayer.findLayerByName(name).strokeWidth,
      ),
    names,
  );
}

test('batch edits several selected layers as one undo step, showing Mixed where they differ', async ({
  page,
  modifier,
}) => {
  // A fake clock, so the test can skip the undo-grouping window below instead of waiting it out.
  await page.clock.install();
  await openShapes(page, 'square');
  // SVG paths default to a black fill, so both shapes start out agreeing on fillColor: give the
  // square a different one, so the batch selection below actually disagrees.
  const fillColorInput = page.locator('.spi-property input[name="fillColor"]');
  await fillColorInput.fill('#ff0000');
  await fillColorInput.press('Tab');

  await selectLayers(page, ['square', 'line']);
  await expect(page.locator('.spi-selection-description')).toHaveText('2 layers');

  // A batch edit never shows the path itself, or a name (which must stay unique).
  await expect(page.locator('.spi-property input[name="pathData"]')).toHaveCount(0);
  await expect(page.locator('.spi-property input[name="name"]')).toHaveCount(0);
  await expect(fillColorInput).toHaveValue('');
  await expect(fillColorInput).toHaveAttribute('placeholder', 'Mixed');

  const originalStrokeWidths = await getStrokeWidths(page, ['square', 'line']);
  // Past the app's 1 second undo-grouping window (metareducer.ts's UNDO_DEBOUNCE_MILLIS), so the
  // edit below gets its own undo step instead of joining the selection change above.
  await page.clock.fastForward(1100);
  const strokeWidthInput = page.locator('.spi-property input[name="strokeWidth"]');
  await strokeWidthInput.fill('3');
  await strokeWidthInput.press('Tab');
  await expect.poll(() => getStrokeWidths(page, ['square', 'line'])).toEqual([3, 3]);

  await page.keyboard.press(`${modifier}+z`);
  await expect.poll(() => getStrokeWidths(page, ['square', 'line'])).toEqual(originalStrokeWidths);
});

test('batch edits several selected blocks as one undo step', async ({ page, modifier }) => {
  await page.clock.install();
  await openShapes(page, 'square');
  await page.getByRole('button', { name: 'Animate fill opacity' }).click();
  await selectLayer(page, 'line');
  await page.getByRole('button', { name: 'Animate fill opacity' }).click();

  const blockIds = await getState(page, s =>
    s.timeline.animation.blocks.map((b: { id: string }) => b.id),
  );
  await page.evaluate(ids => {
    const { services } = (window as any).shapeshifter;
    services.layerTimelineService.selectBlock(ids[0], true);
    services.layerTimelineService.selectBlock(ids[1], false);
  }, blockIds);
  await expect(page.locator('.spi-selection-description')).toHaveText('2 property animations');

  // A shared start or end time would turn blocks that end before it inside out.
  await expect(page.locator('.spi-property input[name="startTime"]')).toHaveCount(0);
  await expect(page.locator('.spi-property input[name="endTime"]')).toHaveCount(0);

  const getToValues = () =>
    getState(page, s => s.timeline.animation.blocks.map((b: { toValue: number }) => b.toValue));
  const originalToValues = await getToValues();
  // Past the app's 1 second undo-grouping window, so the edit below gets its own undo step
  // instead of joining adding the blocks and selecting them.
  await page.clock.fastForward(1100);
  const toValueInput = page.locator('.spi-property input[name="toValue"]');
  await toValueInput.fill('0.5');
  await toValueInput.press('Tab');
  await expect.poll(getToValues).toEqual([0.5, 0.5]);

  await page.keyboard.press(`${modifier}+z`);
  await expect.poll(getToValues).toEqual(originalToValues);
});
