import type { Page } from '@playwright/test';

import { boundingBox, expect, test } from './fixtures';

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
