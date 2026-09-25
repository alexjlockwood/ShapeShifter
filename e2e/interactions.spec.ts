import type { Page } from '@playwright/test';

import { boundingBox, expect, test } from './fixtures';

function getState<T>(page: Page, fn: (state: any) => T) {
  return page.evaluate(
    `(${fn.toString()})(window.shapeshifter.store.getState().present)`,
  ) as Promise<T>;
}

async function loadDemo(page: Page, id = 'playtopause') {
  await page.goto(`/?project=demos/${id}.shapeshifter`);
  await expect
    .poll(() => getState(page, s => s.layers.vectorLayer.children.length))
    .toBeGreaterThan(0);
}

// The Desktop Chrome device reports a Windows user agent, so the app's shortcuts use Control.
const MODIFIER = 'Control';

const SQUARE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M 4 4 H 20 V 20 H 4 Z"/></svg>';

test('undoes and redoes changes', async ({ page }) => {
  await loadDemo(page);
  await page.locator('.slt-layer', { hasText: 'path' }).click();
  await page.locator('.spi-property input[name="name"]').fill('renamed');
  await expect(page.locator('.slt-layer', { hasText: 'renamed' })).toBeVisible();
  // Keyboard shortcuts are ignored while a text field has focus.
  await page.locator('.spi-property input[name="name"]').blur();
  await page.keyboard.press(`${MODIFIER}+z`);
  await expect(page.locator('.slt-layer', { hasText: 'renamed' })).toHaveCount(0);
  await page.keyboard.press(`${MODIFIER}+Shift+z`);
  await expect(page.locator('.slt-layer', { hasText: 'renamed' })).toBeVisible();
});

test('zooms the timeline', async ({ page }) => {
  await loadDemo(page);
  const animation = page.locator('.slt-timeline-animation');
  const { width } = await boundingBox(animation);
  const timeline = await boundingBox(page.locator('.slt-timeline'));
  await page.mouse.move(timeline.x + 100, timeline.y + 100);
  await page.keyboard.down(MODIFIER);
  await page.mouse.wheel(0, -100);
  await page.keyboard.up(MODIFIER);
  await expect.poll(async () => (await boundingBox(animation)).width).toBeGreaterThan(width);
  // The page itself shouldn't scroll or zoom.
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  await page.keyboard.press(`${MODIFIER}+o`);
  await expect.poll(async () => (await boundingBox(animation)).width).toBeCloseTo(width, 0);
});

test('reorders layers by dragging them', async ({ page }) => {
  await loadDemo(page, 'searchtoclose');
  const getLayerNames = () =>
    getState(page, s => s.layers.vectorLayer.children.map((l: { name: string }) => l.name));
  const [first, second] = await getLayerNames();
  const firstBox = await boundingBox(page.locator('.slt-layer', { hasText: first }).first());
  const secondBox = await boundingBox(page.locator('.slt-layer', { hasText: second }).first());
  // Drag the second layer above the first one.
  await page.mouse.move(secondBox.x + 60, secondBox.y + secondBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(firstBox.x + 60, firstBox.y + 2, { steps: 10 });
  await expect(page.locator('.slt-layers-list-drag-indicator')).toBeVisible();
  await page.mouse.up();
  await expect(page.locator('.slt-layers-list-drag-indicator')).toBeHidden();
  await expect.poll(async () => (await getLayerNames()).slice(0, 2)).toEqual([second, first]);
});

test('pastes an SVG', async ({ page }) => {
  await loadDemo(page);
  const numLayers = await page.locator('.slt-layer').count();
  await page.evaluate(svg => {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', svg);
    window.dispatchEvent(new ClipboardEvent('paste', { clipboardData }));
  }, SQUARE_SVG);
  await expect(page.locator('.slt-layer')).toHaveCount(numLayers + 1);
});

test('imports dropped files', async ({ page }) => {
  await loadDemo(page);
  const numLayers = await page.locator('.slt-layer').count();
  const dataTransfer = await page.evaluateHandle(svg => {
    const dt = new DataTransfer();
    dt.items.add(new File([svg], 'square.svg', { type: 'image/svg+xml' }));
    return dt;
  }, SQUARE_SVG);
  const workspace = page.locator('.app-container');
  await workspace.dispatchEvent('dragenter', { dataTransfer });
  await expect(workspace).toHaveClass(/is-dragging-over/);
  await workspace.dispatchEvent('drop', { dataTransfer });
  await expect(workspace).not.toHaveClass(/is-dragging-over/);
  await page.getByRole('button', { name: 'Add layers' }).click();
  await expect(page.locator('.slt-layer')).toHaveCount(numLayers + 1);
});

test('imports vector drawables', async ({ page }) => {
  await loadDemo(page);
  const numLayers = await page.locator('.slt-layer').count();
  await page.getByRole('button', { name: 'Import' }).click();
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Vector Drawable' }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: 'square.xml',
    mimeType: 'text/xml',
    buffer: Buffer.from(`
      <vector xmlns:android="http://schemas.android.com/apk/res/android"
          android:width="24dp" android:height="24dp"
          android:viewportWidth="24" android:viewportHeight="24">
        <path android:name="square" android:fillColor="#000" android:pathData="M 4 4 H 20 V 20 H 4 Z" />
      </vector>`),
  });
  await expect(page.locator('.slt-layer')).toHaveCount(numLayers + 1);
  await expect(page.locator('.slt-layer', { hasText: 'square' })).toBeVisible();
});

test('cuts and pastes animation blocks', async ({ page }) => {
  await loadDemo(page);
  await page.locator('.slt-timeline-block').last().click();
  const numBlocks = await getState(page, s => s.timeline.animation.blocks.length);
  const cut = await page.evaluate(() => {
    const clipboardData = new DataTransfer();
    window.dispatchEvent(new ClipboardEvent('cut', { clipboardData }));
    return clipboardData.getData('text/plain');
  });
  expect(JSON.parse(cut).blocks).toHaveLength(1);
  await expect
    .poll(() => getState(page, s => s.timeline.animation.blocks.length))
    .toBe(numBlocks - 1);
  // Blocks are pasted wherever there's room for them, so paste the block back where it was.
  await page.evaluate(text => {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', text);
    window.dispatchEvent(new ClipboardEvent('paste', { clipboardData }));
  }, cut);
  await expect.poll(() => getState(page, s => s.timeline.animation.blocks.length)).toBe(numBlocks);
});

test('remembers the theme', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'More options' }).click();
  await page.getByRole('menuitem', { name: 'Dark theme' }).click();
  await expect(page.locator('body')).toHaveClass(/ss-dark-theme/);
  await page.reload();
  await expect(page.locator('body')).toHaveClass(/ss-dark-theme/);
});

test('reverses subpaths in action mode', async ({ page }) => {
  await loadDemo(page);
  const getFromValue = () =>
    getState(page, s => {
      const block = s.timeline.animation.blocks.find(
        (b: { propertyName: string }) => b.propertyName === 'pathData',
      );
      return block.fromValue.getPathString() as string;
    });
  const initialFromValue = await getFromValue();
  await page.locator('.slt-timeline-block').last().click();
  await page.getByRole('button', { name: 'Edit path morphing animation' }).click();
  const box = await boundingBox(page.locator('.app-canvas.start canvas.overlay-canvas'));
  await page.mouse.click(box.x + (box.width * 10) / 24, box.y + (box.height * 9) / 24);
  await expect(page.locator('.toolbar')).toContainText('1 subpath selected');
  await page.getByRole('button', { name: 'Reverse points (R)' }).click();
  await expect.poll(getFromValue).not.toBe(initialFromValue);
  await page.keyboard.press('r');
  await expect.poll(getFromValue).toBe(initialFromValue);
});

test('ignores shortcuts while a menu or dialog is open', async ({ page }) => {
  await loadDemo(page);
  const getSnapshot = () =>
    getState(page, s => ({
      isSlowMotion: s.playback.isSlowMotion,
      isPlaying: s.playback.isPlaying,
      selectedLayerIds: [...s.layers.selectedLayerIds],
      vectorLayer: JSON.stringify(s.layers.vectorLayer),
    }));
  await page.locator('.slt-layer', { hasText: 'path' }).click();
  const snapshot = await getSnapshot();
  const expectKeysIgnored = async (keys: string[]) => {
    for (const key of keys) {
      await page.keyboard.press(key);
      expect(await getSnapshot(), key).toEqual(snapshot);
    }
  };

  await page.getByRole('button', { name: 'File' }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await expectKeysIgnored(['s', 'Backspace', `${MODIFIER}+z`]);
  await page.getByRole('menuitem', { name: 'Demo' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectKeysIgnored(['s', 'Space', 'Backspace', `${MODIFIER}+z`]);
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // The shortcuts work again once the dialog is closed.
  await page.keyboard.press('s');
  await expect.poll(async () => (await getSnapshot()).isSlowMotion).toBe(true);
});
