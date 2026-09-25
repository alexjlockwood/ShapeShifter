import { test as base, expect, type Locator, type Page } from '@playwright/test';

/** Fails the test if the page logs any errors. */
export const test = base.extend<{ consoleErrors: string[] }>({
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
