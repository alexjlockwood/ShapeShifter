import { expect, test } from './fixtures';

test('loads a project from the URL', async ({ page }) => {
  await page.goto('/?project=demos/playtopause.shapeshifter');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const { store } = (window as any).shapeshifter;
        return store.getState().present.layers.vectorLayer.children.length;
      }),
    )
    .toBeGreaterThan(0);
});

test('shows an error when the project fails to load', async ({ page, consoleErrors }) => {
  await page.goto('/?project=demos/missing.shapeshifter');
  await expect(
    page.getByText('There was a problem loading the Shape Shifter project'),
  ).toBeVisible();
  // The browser logs the failed request.
  consoleErrors.length = 0;
});

test('switches between the light and dark themes', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).not.toHaveClass(/ss-dark-theme/);
  await page.evaluate(() => (window as any).shapeshifter.services.themeService.toggleTheme());
  await expect(page.locator('body')).toHaveClass(/ss-dark-theme/);
  await expect(page.locator('div.display-container')).toHaveCSS(
    'background-color',
    'rgb(16, 16, 16)',
  );
});

test('keeps the rest of the editor working when a panel crashes', async ({
  page,
  consoleErrors,
}) => {
  await page.goto('/?project=demos/playtopause.shapeshifter');
  await expect(page.locator('.slt-layer').first()).toHaveText('playtopause');
  // Make the property panel throw while it renders a layer's line cap and join.
  const setEnumDisplayValuesThrow = (shouldThrow: boolean) =>
    page.evaluate(throwErrors => {
      const w = window as any;
      const vl = w.shapeshifter.store.getState().present.layers.vectorLayer;
      const property = vl.findLayerByName('path').inspectableProperties.get('strokeLinejoin');
      const enumProperty = Object.getPrototypeOf(property);
      w.displayValueForValue ??= enumProperty.displayValueForValue;
      enumProperty.displayValueForValue = throwErrors
        ? () => {
            throw new Error('Test error');
          }
        : w.displayValueForValue;
    }, shouldThrow);
  await setEnumDisplayValuesThrow(true);
  await page.locator('.slt-layer', { hasText: 'path' }).click();
  const fallback = page.locator('.app-panel-error');
  await expect(fallback).toHaveCount(1);
  await expect(page.locator('.toolbar')).toContainText('Shape Shifter');
  await expect(page.locator('.slt-layer').first()).toHaveText('playtopause');
  await expect(page.locator('.app-error')).toHaveCount(0);

  await setEnumDisplayValuesThrow(false);
  await fallback.getByRole('button', { name: 'Try again' }).click();
  await expect(fallback).toHaveCount(0);
  await expect(page.locator('.spi-property input[name="name"]')).toHaveValue('path');

  // React logs the errors that the boundary caught.
  expect(consoleErrors.length).toBeGreaterThan(0);
  consoleErrors.length = 0;
});
