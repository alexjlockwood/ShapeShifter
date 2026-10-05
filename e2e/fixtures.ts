import { test as base, expect, type Locator, type Page } from '@playwright/test';

export const test = base.extend<{ consoleErrors: string[]; modifier: 'Control' | 'Meta' }>({
  /** Fails the test if the page logs any errors. */
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => {
        if (message.type() === 'error') {
          errors.push(message.text());
        }
      });
      await use(errors);
      expect(errors).toEqual([]);
    },
    { auto: true },
  ],
  /**
   * The modifier key for the app's shortcuts. Like the app, this depends on the user agent: the
   * Safari device reports a Mac, and the others report Windows.
   */
  modifier: async ({ page }, use) => {
    const isMac = await page.evaluate(() => navigator.appVersion.includes('Mac'));
    await use(isMac ? 'Meta' : 'Control');
  },
});

export { expect };

/**
 * Goes to the app's URL and waits for the canvas editor to load, or to be off with `?editor=0`.
 * The canvas handles the pointer itself until the editor has loaded, so a test that went on
 * without waiting would test one or the other depending on how fast the editor loaded.
 */
export async function openApp(page: Page, url: string) {
  await page.goto(url);
  await waitForCanvasEditor(page, new URL(url, 'http://localhost').searchParams.get('editor'));
}

/** Waits for the canvas editor after a reload, like openApp. */
export async function reloadApp(page: Page) {
  await page.reload();
  await waitForCanvasEditor(page, new URL(page.url()).searchParams.get('editor'));
}

async function waitForCanvasEditor(page: Page, param: string | null) {
  await expect(page.locator('.app-canvas').first()).toHaveAttribute(
    'data-canvas-editor',
    param === '0' ? 'off' : 'ready',
  );
}

/** Returns the locator's bounding box, which must be visible. */
export async function boundingBox(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error(`${locator} isn't visible`);
  }
  return box;
}

/**
 * Converts a point in a canvas's viewport, 24x24 unless specified, to page coordinates. The canvas
 * covers its panel, and its `.canvas-artboard` shows the viewport.
 */
export async function artboardPoint(
  canvas: Locator,
  x: number,
  y: number,
  viewport = { w: 24, h: 24 },
) {
  const box = await boundingBox(canvas.locator('.canvas-artboard'));
  return { x: box.x + (box.width * x) / viewport.w, y: box.y + (box.height * y) / viewport.h };
}

/** Evaluates fn against the store's present state in the page. */
export function getState<T>(page: Page, fn: (state: any) => T) {
  return page.evaluate(
    `(${fn.toString()})(window.shapeshifter.store.getState().present)`,
  ) as Promise<T>;
}

/**
 * Dispatches a clipboard event with the specified text on the window, and returns the text that
 * the app put on the clipboard. The data is defined on the event itself, because Firefox ignores
 * the clipboardData passed to the ClipboardEvent constructor.
 */
export function dispatchClipboardEvent(page: Page, type: 'cut' | 'copy' | 'paste', text = '') {
  return page.evaluate(
    ({ type, text }) => {
      const clipboardData = new DataTransfer();
      if (text) {
        clipboardData.setData('text/plain', text);
      }
      const event = new ClipboardEvent(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'clipboardData', { value: clipboardData });
      window.dispatchEvent(event);
      return clipboardData.getData('text/plain');
    },
    { type, text },
  );
}
