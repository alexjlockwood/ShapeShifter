---
name: run-app
description: Start Shape Shifter's dev server and drive the app in a real browser, to see a change working, reproduce a UI bug, take a screenshot, or inspect the store. Use when asked to run, start, open, or screenshot the app, or to check a change beyond what the tests cover.
---

# Run the app

## Start the dev server

Run `npx vite` in the background. It serves the app with hot reloading and prints the URL, e.g.
`Local: http://localhost:5173/`. Read the port from that line instead of assuming 5173: another
worktree may already be serving its own copy of the app there, and Vite moves to the next free
port. Stop the server when you're done.

## Open a project

- `/` opens an empty project.
- `/?project=demos/playtopause.shapeshifter` loads a demo from `public/demos/`. The others are
  `searchtoclose`, `morphinganimals`, `visibilitystrike`, and `heartbreak`. The parameter is
  fetched as a URL, so a scratch `.shapeshifter` file under `public/` loads the same way (don't
  commit it).
- To import an SVG or VectorDrawable, paste its source or drop the file on the page.

## Drive it with Playwright

If your tools include a browser, use it. Otherwise write a script in `tmp/` at the repo root
(gitignored, and it resolves the repo's `@playwright/test`) and run it with `node tmp/<name>.mjs`:

```js
import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', error => console.error(error));
await page.goto('http://localhost:5173/?project=demos/playtopause.shapeshifter');
await page.waitForFunction(
  () => window.shapeshifter.store.getState().present.layers.vectorLayer.children.length > 0,
);
await page.screenshot({ path: 'tmp/playtopause.png' });
await browser.close();
```

Then look at the screenshot. Prefer role-based locators, like the end-to-end tests do (e.g.
`page.getByRole('button', { name: 'Play (Spacebar)' })`); `e2e/` has working examples of most
interactions, including drags on the canvas and timeline.

## Inspect and change state

- Dev builds expose `window.shapeshifter`, which holds the `store` and the `services` the UI uses.
  `store.getState().present` is the current document state (the undo history wraps it).
- Calling a service is the quickest way to set up a state, e.g.
  `window.shapeshifter.services.layerTimelineService`.
- Dev builds log every action to the console.

## Gotchas

- A mobile user agent gets a splash screen instead of the editor. Use a desktop viewport.
- Keyboard shortcuts are ignored while a text field, menu, or dialog has focus. Shortcuts use
  Meta when the user agent is a Mac, and Control otherwise.
- The dev server has no service worker, and `window.shapeshifter` only exists in dev builds. To
  test offline support, run `npm run build && npm run preview` (port 4173). The service worker it
  registers keeps serving that build on that origin until you unregister it, so use a fresh
  browser context.
