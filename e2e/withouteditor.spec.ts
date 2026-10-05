import type { Page } from '@playwright/test';

import { artboardPoint, dispatchClipboardEvent, expect, getState, test } from './fixtures';

// The app without the canvas editor, whether ?editor=0 turned it off or its code couldn't be
// downloaded. Either way the canvas handles the pointer itself, the inspector edits paths as text,
// and the context menu leaves out what only the editor does.

const SQUARE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path id="square" d="M 2 2 H 8 V 8 H 2 Z"/></svg>';

const CASES = [
  { name: 'turned off', url: '/?editor=0', state: 'off' },
  { name: "that couldn't be downloaded", url: '/', state: 'failed' },
] as const;

function getSelectedNames(page: Page) {
  return getState(page, s =>
    [...s.layers.selectedLayerIds].map(id => s.layers.vectorLayer.findLayerById(id).name),
  );
}

function getSquare(page: Page) {
  return getState(page, s =>
    s.layers.vectorLayer.findLayerByName('square').pathData.getPathString(),
  );
}

for (const { name, url, state } of CASES) {
  test(`works with the canvas editor ${name}`, async ({ page, consoleErrors }) => {
    if (state === 'failed') {
      await page.route(/\/components\/canvaseditor\/CanvasEditor\.ts/, route => route.abort());
    }
    await page.goto(url);
    await expect(page.locator('.app-canvas')).toHaveAttribute('data-canvas-editor', state);
    if (state === 'failed') {
      await expect(page.getByText("Couldn't load the canvas editor")).toBeVisible();
      // Only the blocked download, which some browsers log.
      expect(consoleErrors.filter(error => !error.includes('Failed to load resource'))).toEqual([]);
      consoleErrors.length = 0;
    }
    await dispatchClipboardEvent(page, 'paste', SQUARE_SVG);
    await expect.poll(() => getState(page, s => s.layers.vectorLayer.children.length)).toBe(1);

    // Clicking the square's fill selects it.
    const inside = await artboardPoint(page.locator('.app-canvas'), 5, 5);
    await page.mouse.click(inside.x, inside.y);
    await expect.poll(() => getSelectedNames(page)).toEqual(['square']);

    // The inspector moves it, and edits its path as text.
    const x = page.getByRole('region', { name: 'Layout' }).getByLabel('Layout X');
    await x.fill('10');
    await x.press('Enter');
    await expect.poll(() => getSquare(page)).toBe('M 10 2 L 16 2 L 16 8 L 10 8 Z');
    const pathText = page.getByRole('textbox', { name: 'Path', exact: true });
    await expect(pathText).toHaveValue('M 10 2 L 16 2 L 16 8 L 10 8 Z');
    await expect(page.getByRole('button', { name: 'Edit points' })).toHaveCount(0);

    // The context menu leaves out Duplicate, which only the editor does.
    const moved = await artboardPoint(page.locator('.app-canvas'), 13, 5);
    await page.mouse.click(moved.x, moved.y, { button: 'right' });
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Duplicate' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('.MuiModal-root')).toHaveCount(0);

    // R toggles repeating rather than picking a tool, and Space plays. Shortcuts without a modifier
    // are ignored while a text field has the focus, and closing the menu can return it to Layout X.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('r');
    await expect.poll(() => getState(page, s => s.playback.isRepeating)).toBe(true);
    await page.keyboard.press('Space');
    await expect.poll(() => getState(page, s => s.playback.isPlaying)).toBe(true);
  });
}
