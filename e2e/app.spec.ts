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
