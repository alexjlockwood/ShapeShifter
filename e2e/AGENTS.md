# End-to-end tests

Playwright tests of the real app in Chromium, Firefox, and WebKit (`playwright.config.ts`).

## Running them

- `npx playwright test e2e/timeline.spec.ts --project=chromium` runs one file in one browser. Add
  `-g "<test name>"` to run one test.
- Each test runs in every browser, against either the dev server (projects `chromium`, `firefox`,
  and `webkit`) or a production build (`chromium-preview` and so on). Only `*.preview.spec.ts`
  files run against the production build, for what only it has: the service worker, source maps,
  and the unsaved-changes prompts (which dev builds skip).
- Every run starts both servers, the dev server on port 4280 and `vite build && vite preview` on
  4281, even if you only pick a dev project. Locally, Playwright reuses whatever is already
  listening on those ports. If another worktree is running end-to-end tests at the same time, you'd
  be testing its code, so check `lsof -i :4280 -i :4281` first. A preview server that's still
  running also won't include your changes.
- A failed test keeps a trace: `npx playwright show-trace test-results/<test>/trace.zip`.
- CI retries a failed test once. Locally there are no retries, so flaky tests fail.

## Writing tests

- Import `test` and `expect` from `e2e/fixtures.ts`, not from `@playwright/test`. Its fixtures:
  - `consoleErrors` fails the test if the page logs an error. A test that expects an error clears
    it with `consoleErrors.length = 0`.
  - `modifier` is `Meta` or `Control`, matching how the app picks its shortcut modifier from the
    user agent (the WebKit device reports a Mac).
- `getState(page, s => ...)` runs a function against the store's present state in the page. The
  function is serialized, so it can't use variables from the test. It relies on
  `window.shapeshifter`, which only dev builds have, so preview tests can't use it.
- `dispatchClipboardEvent(page, 'paste', text)` simulates cut, copy, and paste (Firefox ignores
  `clipboardData` in the event constructor).
- To load a demo, go to `/?project=demos/playtopause.shapeshifter` and poll until
  `vectorLayer.children` isn't empty. Several specs have a `loadDemo` helper that does this. The
  demos are short (`playtopause` is 300 ms), so turn on repeat before checking anything while one
  plays, or it can finish first on a slow runner.
- Wait with `expect.poll` and auto-retrying assertions, never fixed timeouts. Drag with
  `page.mouse` and several `steps`.
- Find elements by role and name, e.g. `page.getByRole('button', { name: 'Play (Spacebar)' })`.

## Browser quirks

- Shortcuts are ignored while a menu or dialog has focus, and so are the ones without a modifier
  while a text field has focus (the modifier ones, like undo, still fire). The app checks for focus
  inside `.MuiModal-root`, which a closing menu keeps until its exit transition ends, and Safari
  leaves the focus in it. So wait for `.MuiModal-root` to have a count of 0 before pressing a
  shortcut after choosing a menu item (see `e2e/morph.spec.ts`).
- Playwright's WebKit can't navigate while offline, and it can't intercept Firefox's service worker
  scripts, so a few tests in `e2e/offline.preview.spec.ts` are skipped in those browsers.
- Clicks don't land on exact coordinates, so round canvas positions before comparing them.
