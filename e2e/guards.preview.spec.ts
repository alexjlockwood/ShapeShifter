import { expect, test } from './fixtures';

// These prompts are skipped in development builds.
test.describe('with unsaved changes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?project=demos/playtopause.shapeshifter');
    await expect(page.locator('.slt-layer').first()).toHaveText('playtopause');
  });

  test('confirms before starting over', async ({ page }) => {
    await page.getByRole('button', { name: 'File' }).click();
    await page.getByRole('menuitem', { name: 'New' }).click();
    await expect(page.getByText('Start over?')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('.slt-layer').first()).toHaveText('playtopause');

    await page.getByRole('button', { name: 'File' }).click();
    await page.getByRole('menuitem', { name: 'New' }).click();
    await page.getByRole('button', { name: 'OK' }).click();
    await expect(page.locator('.slt-layer')).toHaveText(['vector']);
  });

  test('confirms before leaving the page', async ({ page }) => {
    // Browsers only show the prompt after the user has interacted with the page.
    await page.locator('.slt-layer').first().click();
    const dialogPromise = page.waitForEvent('dialog');
    await page.close({ runBeforeUnload: true });
    const dialog = await dialogPromise;
    expect(dialog.type()).toBe('beforeunload');
    await dialog.dismiss();
  });
});
