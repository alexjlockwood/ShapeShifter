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

/** Returns the locator's bounding box, which must be visible. */
export async function boundingBox(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error(`${locator} isn't visible`);
  }
  return box;
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
