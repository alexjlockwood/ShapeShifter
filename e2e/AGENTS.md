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
  4281, even if you only pick a dev project. If another worktree is running end-to-end tests, the
  run fails because a port is in use. Wait for the other run to finish rather than stopping it.
- A failed test keeps a trace: `npx playwright show-trace test-results/<test>/trace.zip`.
- CI retries a failed test once. Locally there are no retries, so flaky tests fail.
- CI runs pull requests in Chromium only, and master in every browser, so a Firefox or WebKit
  failure can first show up after merging. `gh workflow run CI --ref <branch>` runs every
  browser on a branch. CI splits the tests into shards, and tests in a file run in parallel
  (`fullyParallel`), so a test can't rely on another one running first.
- To skip the app's time-based waits, like the 1 second undo-grouping window, use a fake clock
  (`page.clock.install()` before loading the page, then `page.clock.fastForward`) rather than
  waiting.

## Writing tests

- Import `test` and `expect` from `e2e/fixtures.ts`, not from `@playwright/test`. Its fixtures:
  - `consoleErrors` fails the test if the page logs an error. A test that expects an error clears
    it with `consoleErrors.length = 0`.
  - `modifier` is `Meta` or `Control`, matching how the app picks its shortcut modifier from the
    user agent (the WebKit device reports a Mac).
- `getState(page, s => ...)` runs a function against the store's present state in the page. The
  function is serialized, so it can't use variables from the test. It relies on
  `window.shapeshifter`, which only dev builds have, so preview tests can't use it.
- Each canvas covers its panel, and its `.canvas-artboard` shows the vector layer's viewport.
  `artboardPoint(page.locator('.app-canvas.start'), x, y)` converts viewport coordinates to page
  coordinates for the mouse.
- `dispatchClipboardEvent(page, 'paste', text)` simulates cut, copy, and paste (Firefox ignores
  `clipboardData` in the event constructor).
- To load a demo, go to `/?project=demos/playtopause.shapeshifter` and poll until
  `vectorLayer.children` isn't empty. Several specs have a `loadDemo` helper that does this. The
  demos are short (`playtopause` is 300 ms), so turn on repeat before checking anything while one
  plays, or it can finish first on a slow runner.
- Wait with `expect.poll` and auto-retrying assertions, never fixed timeouts. Drag with
  `page.mouse` and several `steps`. For input that `page.mouse` can't send, like real touches or
  a move with the button already up, use a CDP session in Chromium (`e2e/zoom.spec.ts` and
  `pressWithStrayMove` in `e2e/editor.spec.ts`).
- Find elements by role and name, e.g. `page.getByRole('button', { name: 'Play (Spacebar)' })`.
- Features are on or off in every test as they are for users (`playwright.config.ts` sets the
  dev server's defaults to match production builds). The canvas editor is on, so test it off with
  `?editor=0`. The canvas's `data-canvas-editor` attribute says whether the editor is `off`,
  `loading`, `ready`, or `failed`, so wait for the value you expect rather than for it to be
  missing. Once it's `ready`, drive its tools with the mouse like `e2e/editor.spec.ts` does, or
  preview and commit path edits directly with `window.shapeshifter.canvasEditor`
  (`components/canvaseditor/CanvasEditor.ts`). With it on, the tool letters (V, P, R, O, and L)
  pick tools, so R no longer toggles repeating: click the "Repeat" button instead. Its rulers show
  all the time, just outside the artboard's top and left edges, and a press on one drags out a
  guide, so start drags that should reach the canvas elsewhere.

## Browser quirks

- Shortcuts are ignored while a menu or dialog has focus, and so are the ones without a modifier
  while a text field has focus (the modifier ones, like undo, still fire). The app checks for focus
  inside `.MuiModal-root`, which a closing menu keeps until its exit transition ends, and Safari
  leaves the focus in it. So wait for `.MuiModal-root` to have a count of 0 before pressing a
  shortcut after choosing a menu item (see `e2e/morph.spec.ts`).
- Playwright's WebKit can't navigate while offline, and it can't intercept Firefox's service worker
  scripts, so a few tests in `e2e/offline.preview.spec.ts` are skipped in those browsers.
- Clicks don't land on exact coordinates, so round canvas positions before comparing them.
- On a Mac, Chromium turns a mouse press with Control held into a right-click (a `contextmenu`
  event, which cancels a canvas gesture and opens the context menu), even though its user agent
  reports Windows and `modifier` is `Control`. Press the modifier once a drag has started (see
  `e2e/editor.spec.ts`), and add to a selection with Shift instead (`e2e/contextmenu.spec.ts`).
- Firefox on Linux (CI, not macOS) zooms the page for Ctrl and the wheel when the app doesn't
  handle them, which moves everything on the screen. With the canvas editor off, check the canvas's
  own state (`canvasViewportService.getView()`) rather than where things are.
