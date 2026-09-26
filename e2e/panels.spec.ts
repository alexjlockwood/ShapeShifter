import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';

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
  // The toolbar switches to the accent color in action mode.
  await expect(page.locator('.toolbar')).toHaveCSS('background-color', 'rgb(41, 121, 255)');
  await page.screenshot({ path: 'test-results/toolbar-action-mode.png' });

  await page.getByRole('button', { name: 'Split subpaths (S)' }).waitFor({ state: 'detached' });
  await page.locator('.action-mode-close-icon').click();
  await expect(page.locator('.app-canvas')).toHaveCount(1);
  await expect(page.locator('.property-input')).toBeVisible();
  await expect(page.locator('.toolbar')).toHaveCSS('background-color', 'rgb(96, 125, 139)');
  await page.screenshot({ path: 'test-results/property-input.png' });
});
