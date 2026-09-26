# WebKit end-to-end test flakes: session notes (2026-09-25)

These are the findings from one agent session (Flotilla slot 3, Claude Code), written down so that
a later session can combine them with notes from other sessions running in parallel and decide
what to do next. Nothing here is fixed yet.

**Status:** unresolved. PR #367 tried to fix the flakes, didn't work, and was closed without
merging. Its branch (`alex/fix-webkit-flakes`, commit `8004ca74`) is still on origin for
reference, and its full diff is at the end of this file.

## Summary

- `[webkit] e2e/morph.spec.ts` "creates a play-to-pause morph from scratch" fails on most CI runs
  right now, on unrelated branches. It failed both attempts in 6 of the last 9 PR runs, and in
  each of those 6 it was the only failing test. It's what keeps #368, #369, and #370 red. #366
  went green on its latest run (36215127055) only after another WebKit test passed on retry.
- My first diagnosis was wrong. I thought a closing MUI menu was intercepting the click, so #367
  added waits for `.MuiModal-root` to disappear. #367's own CI run then failed the same test on
  both attempts, after the new waits had passed.
- The real symptom is that Playwright's click hangs for the full 30 seconds at "waiting for element
  to be visible, enabled and stable". Menu interception shows up only once, in the first attempt of
  the first run, and Playwright got past it.
- Leading hypotheses, none confirmed:
  1. WebKit on the Linux runner stops producing animation frames, so Playwright's rAF-based
     stability check never completes. The theme test flake (a 200ms CSS transition that never
     moves in 5 seconds) fits the same explanation.
  2. It is tied to downloads. Every hang happens after the test has triggered at least one
     download.
  3. WebKit's network process crashes on CI. Another WebKit flake logged "Network process
     crashed", and WebKit handles downloads in the network process.
- Two app issues came up along the way (not fixed, because the brief limited the PR to tests):
  1. `shortcut.service.ts` drops keyboard shortcuts while a menu is closing, which affects real
     Safari users.
  2. `fileexport.service.ts` revokes a download's blob URL immediately after clicking the link,
     which is a known WebKit hazard and might be related to the stalls.
- Local runs on macOS never reproduce any of this, so passing local runs prove nothing. The next
  step is to reproduce on Linux WebKit, ideally in CI itself, and to read the saved traces.

## How this session started

The `create-agents` Flotilla agent sent this session a brief. In short:

- CI on #366 (`alex/agent-setup`) was red because of flaky WebKit end-to-end tests, not because of
  that PR's changes (it doesn't change app code). Fix the flakiness in a small PR against master so
  that #366 and every other PR can go green.
- Failure 1, from CI run 36203827280: the morph test failed both attempts with
  `locator.click: Test timeout of 30000ms exceeded`, and the log showed the closing File menu's
  `MuiPopover-root MuiMenu-root MuiModal-root` intercepting pointer events. The brief suggested
  waiting for `.MuiModal-root` to have a count of 0 before reopening the File menu after Save and
  after New, as the test already did before pressing Space.
- Failure 2: `[webkit] e2e/app.spec.ts` "switches between the light and dark themes" flaked with
  `expect(locator).toHaveCSS(expected) failed` after 5000ms. Fix it if the cause is clear,
  otherwise leave it and say so.
- Failure 3: audit the other specs for the same pattern (clicking a menu button or item right after
  another menu or dialog closed without waiting) and fix those too.
- Constraints: keep the PR to test changes, and report real app bugs instead of fixing them. Verify
  with `--repeat-each=10` in WebKit and one run in every browser.

Earlier flake fixes on master, for context:

- `bc80ff9a` "Repeat the demo in the playback end-to-end test": the 300ms `playtopause` demo could
  finish before `e2e/canvas.spec.ts` looked for the pause button on a slow runner (WebKit, CI).
- `df6f8929` "Give the auto fix test more time on CI": auto fixing the `morphinganimals` demo takes
  about 1 second locally but 3 to 6 seconds on GitHub's runners, so the Vitest test in
  `createEditorServices.spec.ts` kept hitting the 5 second timeout.

Both point the same way: GitHub's Linux runners are much slower than a local Mac. The earlier
end-to-end flake was in WebKit too.

## CI evidence

The CI workflow (`.github/workflows/ci.yml`) runs on `ubuntu-latest`, installs browsers with
`npx playwright install --with-deps chromium firefox webkit`, and runs `npm run e2e` with one retry
(`retries: process.env.CI ? 1 : 0` in `playwright.config.ts`). Failed runs upload
`test-results/`, including a Playwright trace for every failed attempt, as the `playwright-report`
artifact.

### Run 36203827280 (`alex/agent-setup`, `744d62e8`): the run in the brief

Attempt 1 hung on the File click right after the Save download (line 280 on master):

```text
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'File' })
    - locator resolved to <button class="slt-layers-menu-group-button">File</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div aria-hidden="true" role="presentation" class="MuiPopover-root MuiMenu-root
        MuiModal-root css-pa188r-MuiModal-root-MuiPopover-root-MuiMenu-root">…</div>
        intercepts pointer events
    - retrying click action
    - waiting 20ms
    - waiting for element to be visible, enabled and stable
```

This is what I misread. The closing menu intercepted the click twice, Playwright retried, and then
the click hung on the stability check for the rest of the 30 seconds. The interception was
transient, and the hang is on something else.

The retry got past Save and New, then hung on the next File click (line 283 on master) with no
interception at all:

```text
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'File' })
    - locator resolved to <button class="slt-layers-menu-group-button">File</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable
```

The theme test flaked in the same run:

```text
Error: expect(locator).toHaveCSS(expected) failed
Locator:  locator('div.display-container')
Expected: "rgb(16, 16, 16)"
Received: "rgb(224, 224, 224)"
Timeout:  5000ms
Call log:
  - Expect "toHaveCSS" locator('div.display-container') with timeout 5000ms
  - waiting for locator('div.display-container')
    14 × locator resolved to <div class="display-container ss-theme-transition fx-column fx-flex">…</div>
       - unexpected value "rgb(224, 224, 224)"
```

The line before it, `expect(page.locator('body')).toHaveClass(/ss-dark-theme/)`, had already
passed, so the dark theme class was on the body for the whole 5 seconds. See "The theme test"
below.

### Run 36214869344 (PR #367, `8004ca74`): with the new waits

Attempt 1 hung on the first File click, right after the AVD export download. The new
`.MuiModal-root` wait on the line before it had passed:

```text
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'File' })
    - locator resolved to <button class="slt-layers-menu-group-button">File</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable

  276 |   // Shortcuts are ignored until the menu has finished closing (Safari leaves the focus in it).
  277 |   await expect(page.locator('.MuiModal-root')).toHaveCount(0);
> 278 |   await page.getByRole('button', { name: 'File' }).click();
```

The retry got further. It opened the File menu after the Save download, then hung clicking the
"New" item inside the open menu:

```text
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('menuitem', { name: 'New' })
    - locator resolved to <li tabindex="0" role="menuitem" class="MuiButtonBase-root MuiMenuItem-root
      MuiMenuItem-gutters css-1p7gsvt-MuiButtonBase-root-MuiMenuItem-root">…</li>
  - attempting click action
    - waiting for element to be visible, enabled and stable

  283 |   await expect(page.locator('.MuiModal-root')).toHaveCount(0);
  284 |   await page.getByRole('button', { name: 'File' }).click();
> 285 |   await page.getByRole('menuitem', { name: 'New' }).click();
```

The theme test passed in this run.

### Where the four hangs happened

In `morph.spec.ts` the end of the test goes: export an Animated Vector Drawable (a download), then
File > Save (a download), File > New, and File > Open. The four hangs:

| Run         | Attempt | Hung on                     | After                            | Interception in log? |
| ----------- | ------- | --------------------------- | -------------------------------- | -------------------- |
| 36203827280 | 1       | File button                 | AVD export and Save downloads    | Yes, then retried    |
| 36203827280 | retry   | File button (before Open)   | Both downloads, then File > New  | No                   |
| 36214869344 | 1       | File button (before Save)   | AVD export download              | No                   |
| 36214869344 | retry   | "New" item in the open menu | Both downloads, then File opened | No                   |

The hang doesn't happen at a fixed step: it's anywhere from the first to the third pointer action
after a download. But no hang has been seen before the test's first download.

### Recent CI runs across branches

I pulled the e2e summary for recent runs (`gh run view <id> --log-failed`, or `--log` for passing
runs). Durations are for the `npm run e2e` step as Playwright reports them.

| Run         | Branch                                | Commit     | Result  | Failed or flaky tests                               | e2e time |
| ----------- | ------------------------------------- | ---------- | ------- | --------------------------------------------------- | -------- |
| 36217111879 | `alex/fix-sweep-quick-wins`           | `d6929774` | failure | morph failed                                        | 5.0m     |
| 36216941450 | `alex/list-sweep-bugs`                | `aec16e32` | failure | morph failed, theme flaky                           | 5.0m     |
| 36216900576 | `alex/fix-sweep-quick-wins`           | `719aca63` | success | none                                                | 3.2m     |
| 36216757832 | `alex/list-sweep-bugs`                | `0455bfa0` | failure | morph failed                                        | 4.8m     |
| 36216404431 | `alex/list-sweep-bugs`                | `8d076822` | success | `panels.spec.ts:25` flaky (network process crashed) | 4.0m     |
| 36215127055 | `alex/agent-setup`                    | `535648a5` | success | `app.spec.ts:3` flaky (demo didn't load in 5s)      | 3.1m     |
| 36215005763 | `alex/fix-split-filled-subpath-order` | `8f66bc6c` | failure | morph failed                                        | 5.1m     |
| 36214869344 | `alex/fix-webkit-flakes` (#367)       | `8004ca74` | failure | morph failed                                        | 4.7m     |
| 36203827280 | `alex/agent-setup`                    | `744d62e8` | failure | morph failed, theme flaky                           | 4.9m     |
| 36202648110 | `master`                              | `15586e7f` | success | none                                                | 2.8m     |
| 36202347301 | `alex/google-analytics`               | `bc80ff9a` | success | none                                                | 3.0m     |
| 36201903201 | `alex/google-analytics`               | `df6f8929` | failure | `canvas.spec.ts:23` failed (fixed by `bc80ff9a`)    | 3.7m     |
| 36201613029 | `alex/google-analytics`               | `d0f04f77` | failure | Vitest timeout at 5000ms (before e2e)               | n/a      |
| 36196227144 | `master`                              | `2d67b7fc` | failure | Vitest timeout at 5000ms (before e2e)               | n/a      |

Notes on the table:

- Every e2e failure and flake in this list is in WebKit. Chromium and Firefox were clean.
- The two Vitest timeouts are most likely the auto fix test that `df6f8929` gave more time. I didn't
  check which test it was.
- The failing runs take longer, but a failing morph test alone adds more than a minute (two 30
  second timeouts plus the retry), so the time difference doesn't show that those runners were
  slower.
- Master has only one e2e run on its current commit (`15586e7f`), and it passed. The morph test
  has passed on some branches built from the same base, so this is intermittent, not a
  deterministic break. But since run 36203827280 it has failed twice as often as it has passed.

The two other WebKit flakes, from passing runs, are worth reading because they aren't in the morph
test:

- Run 36216404431, `panels.spec.ts:25` "edits the selected layer in the property inspector": the
  `loadDemo` poll threw `Cannot destructure property 'store' from null or undefined value`, meaning
  `window.shapeshifter` never appeared, and the `consoleErrors` fixture caught:

  ```text
  "WebSocket connection to 'ws://localhost:4280/?token=R3BFIMhPhW-X' failed: WebSocket network error: Network process crashed.",
  "Failed to load resource: WebKit encountered an internal error",
  ```

- Run 36215127055, `app.spec.ts:3` "loads a project from the URL": the demo's layers never showed
  up in the store within 5 seconds (`Timeout 5000ms exceeded while waiting on the predicate`).

The first one shows that WebKit's network process really does crash on these runners. Playwright
starts one browser per worker and gives each test a new context, so a crash in one test could
affect later tests in the same worker. I didn't check whether the network process is shared across
contexts.

### Traces

Both runs' traces are saved as the `playwright-report` artifact, and they expire on 2026-12-25:

```sh
gh run download 36203827280 -n playwright-report -D /tmp/trace-36203827280
gh run download 36214869344 -n playwright-report -D /tmp/trace-36214869344
npx playwright show-trace /tmp/trace-36214869344/morph-creates-a-play-to-pause-morph-from-scratch-webkit/trace.zip
```

I didn't open them. Things to look for: whether the screenshots stop changing around the hang
(which would confirm that frames stopped), console errors, and failed network requests near the
downloads.

## Analysis

### Why the click hangs

Before clicking, Playwright checks that the element is "stable", meaning it has kept the same
bounding box for two consecutive animation frames. If the page stops producing frames
(`requestAnimationFrame` callbacks stop firing), the check can never complete and the click waits
until the test times out. That matches all four hangs: the element was found, and in the first
case it was even reported as "visible, enabled and stable" before the interception retry. After
that, Playwright never gets past the stability check.

So the question is why WebKit stops rendering frames on the CI runner. It is not a closing menu: in
three of the four hangs the log reports nothing intercepting the click, and in #367's run the new
waits had confirmed there was no `.MuiModal-root` left.

### The theme test

`div.display-container` has the class `ss-theme-transition`
(`src/app/modules/editor/components/root/Root.tsx:179`), and on master that class adds
`transition: background-color 200ms ease-out` (`src/app/modules/editor/styles/theme.scss:94-95`).
When the body gets `ss-dark-theme`, the computed background color should move from
`rgb(224, 224, 224)` to `rgb(16, 16, 16)` over 200ms. `getComputedStyle` reports the in-between
values during a transition, and those only advance as the page renders frames.

The log shows exactly the starting value 14 times over 5 seconds: not an in-between value, and not
the final one. A 200ms transition that doesn't move for 5 seconds is the same "no frames"
symptom as the morph hangs. In the session I wrote this off as unrelated CI load, because the test
doesn't touch a menu and passed 15 out of 15 times locally. That was wrong. It very likely has
the same cause as the morph failure.

(`alex/agent-setup` rewrites `theme.scss`, so these line numbers will move once #366 merges.)

### Downloads as a trigger

Every morph hang follows a download. The app downloads files in `downloadFile`
(`src/app/modules/editor/services/fileexport.service.ts:154-165` on master):

```ts
const blob = content instanceof Blob ? content : new Blob([content], { type: 'octet/stream' });
const url = window.URL.createObjectURL(blob);
const anchor = document.createElement('a');
anchor.style.display = 'none';
anchor.href = url;
anchor.download = fileName;
document.body.appendChild(anchor);
anchor.click();
anchor.remove();
window.URL.revokeObjectURL(url);
```

The URL is revoked in the same task as the click. WebKit handles an `a[download]` click
asynchronously, which is why FileSaver.js waits 40 seconds before revoking. Revoking right away
can make the download fail in WebKit, and WebKit handles downloads in its network process, which
we know crashes on these runners. That makes this worth testing, but it is only a correlation so
far.

Other tests download files too (`timeline.spec.ts` "exports and imports files" downloads three),
and they haven't shown up in the failures. The morph test is one of the longest tests in the suite
(about 8 seconds in WebKit locally) and does two downloads followed by many more interactions,
which might be why it's the one that catches the problem.

## App issues found (not fixed)

### 1. Shortcuts are dropped while a menu is closing (Safari)

`src/app/modules/editor/services/shortcut.service.ts:51-59` on master:

```ts
this.removeKeyDownListener = on(window, 'keydown', event => {
  if (event.target instanceof Element && event.target.closest('.MuiModal-root')) {
    // Leave the keys to the open dialog or menu, but still keep browsers that go back on
    // backspace (e.g. WebKit without Safari's settings) from leaving the page.
    if (event.keyCode === 8 && !event.target.matches(TEXT_FIELD_SELECTOR)) {
      event.preventDefault();
    }
    return undefined;
  }
```

How it goes wrong, checked against `@mui/material` 9.4.0 in `node_modules`:

- `Popover` and `Menu` don't set `closeAfterTransition`, so it defaults to `false`
  (`Modal/Modal.js:93`). On close, the modal root gets `aria-hidden="true"` right away but stays
  mounted until the exit transition ends. The CI log above shows exactly this: an
  `aria-hidden="true"` `MuiPopover-root` still in the page.
- `Dialog` sets `closeAfterTransition: true` (`Dialog/Dialog.js:333`), so dialogs behave
  differently from menus here.
- `FocusTrap` remembers which element to give focus back to from `event.relatedTarget`
  (`Unstable_TrapFocus/FocusTrap.js:292-293` and `303-304`). Safari on macOS doesn't focus a
  button when it's clicked, so `relatedTarget` is null and nothing gets focus back when the menu
  closes. Focus stays on the menu item inside the closing root.
- A key pressed during the exit transition has its target inside `.MuiModal-root`, so the handler
  ignores it. In Safari, pressing Space or S right after choosing a menu item does nothing until
  the menu has finished animating out.

`e2e/AGENTS.md` on `alex/agent-setup` (line 43) already describes this as a browser quirk and tells
tests to wait for `.MuiModal-root` to have a count of 0 before pressing a shortcut. The code review
in this session argued that it's an app bug and should be fixed in the handler. Possible fixes,
untested: skip modal roots that are closing (for example
`closest('.MuiModal-root:not([aria-hidden="true"])')`), or explicitly move focus back when a menu
closes. If this gets fixed, the `e2e/AGENTS.md` quirk note and the matching waits in
`e2e/morph.spec.ts` should change too.

What I verified: the handler code and the MUI source lines above, and the `aria-hidden` root in
the CI log. What I didn't: reproducing the dropped shortcut in real Safari.

### 2. Blob URL revoked immediately after the download click

See "Downloads as a trigger" above. Even if it turns out to have nothing to do with the CI stalls,
it's a known way to break downloads in Safari. Delaying the revoke (FileSaver.js uses 40 seconds)
is a small change.

## What PR #367 did, and what was wrong with it

#367 only changed tests. It added
`await expect(page.locator('.MuiModal-root')).toHaveCount(0)` in nine places:

- `e2e/morph.spec.ts`: before each of the three File clicks at the end of the play-to-pause test
  (after the AVD export, after Save, and after New).
- `e2e/interactions.spec.ts`: before pressing S after the Demo dialog's Cancel button closes it.
- `e2e/timeline.spec.ts`: at the end of each Export loop iteration in "exports and imports files",
  and before each of the two layer menu reopens in "groups, flattens, and converts layers".
- `e2e/guards.preview.spec.ts`: before reopening the File menu after canceling "Start over?".

Local verification, all on macOS:

- The theme test alone, `--repeat-each=15` in WebKit: 15 of 15 passed (before any changes).
- `morph`, `app`, `interactions`, and `timeline` specs, `--repeat-each=10` in WebKit: 290 of 290
  passed.
- `guards.preview.spec.ts`, `--repeat-each=10` in `webkit-preview`: 20 of 20 passed.
- Every changed spec once in all three browsers: passed. Typecheck, lint, and Prettier: clean.

None of that means anything, because the failure never reproduced locally in the first place.

A code review of #367 (run in this session after the PR was opened) found these problems, which I
checked and agree with:

1. The waits don't fix the morph test (CI run 36214869344, above).
2. The theme test was wrongly written off as unrelated (see "The theme test").
3. The shortcut handler bug is the real issue behind the test comments, and the PR patched tests
   instead of reporting it clearly (see "App issues").
4. The wait in `interactions.spec.ts` does nothing. Dialogs use `closeAfterTransition`, so once
   `getByRole('dialog')` has a count of 0, the modal root is already gone. Worse, the PR replaced
   the comment "The shortcuts work again once the dialog is closed" with "Shortcuts are ignored
   until the dialog has finished closing", which describes the bug as intended behavior.
5. The audit missed cases with the same pattern: the two back-to-back `importSvg` calls at the
   start of the morph test (Import menu reopened right after it closed), and the clicks on "Edit
   path morphing animation" and "Auto fix" right after `addPathMorph` closes the "Animate this
   layer" menu.
6. Several of the added comments say "Shortcuts are ignored..." above a mouse click, and say
   "Safari" when the failing engine is Playwright's WebKit on Linux.
7. The same wait line was pasted nine times with four different comments. If waits turn out to be
   needed at all, a helper in `e2e/fixtures.ts` would be better.
8. The PR description used em dashes, against the user's style rules.

## Suggested next steps

1. **Read the traces** (commands above) to see whether frames stop, and what the console and
   network show around the downloads.
2. **Reproduce in CI, where it actually fails.** A throwaway branch whose workflow runs only
   `npx playwright test e2e/morph.spec.ts --project=webkit --repeat-each=20` would give a failure
   rate in a few minutes. Then try variations to narrow it down:
   - delay `revokeObjectURL` in `downloadFile` (an app change)
   - skip the AVD export and Save steps
   - `--workers=1`, to see whether load or sharing a browser between tests matters
3. **Or reproduce on Linux locally**, using the official Playwright Docker image for the same
   version as `@playwright/test` (1.63.0).
4. **Decide about the shortcut handler bug.** It's a real Safari bug whether or not it has anything
   to do with CI. Fixing it means updating the `e2e/AGENTS.md` quirk note on `alex/agent-setup` too.
5. **If PRs need to merge before this is solved**, marking the morph test `test.fixme` for WebKit
   (or moving its Save/New/Open part into a separate test) would unblock CI. Master isn't
   branch-protected, so red CI doesn't technically block merges, but it hides real failures.
6. Retry the theme test and the other WebKit flakes after whatever fixes the morph test, before
   treating them as separate problems.

## Environment notes for other agents

- In this Flotilla slot, `node_modules` existed but was incomplete: `npm ls @playwright/test`
  showed it missing. `npx playwright test` then quietly downloaded a separate `playwright@1.63.0`
  and failed with `Cannot find package '@playwright/test' imported from .../playwright.config.ts`.
  `npm ci` fixed it. Check `npm ls @playwright/test` before running end-to-end tests in a slot.
- The local Node was v26.7.0 while `.nvmrc` says 24. That didn't cause any problems.
- End-to-end runs share ports 4280 and 4281 across worktrees, so this session used the lock the
  brief described: `until mkdir /tmp/shapeshifter-e2e.lock 2>/dev/null; do sleep 15; done`, then
  `rmdir /tmp/shapeshifter-e2e.lock` afterwards.
- `ci.yml` on master has no `npm run format:check` step, although `AGENTS.md` on `alex/agent-setup`
  says CI runs it first. #366 adds the step.

## References

- PRs: #366 (`alex/agent-setup`, the PR the brief was about), #367 (closed,
  `alex/fix-webkit-flakes`), and #368, #369, #370 (currently failing on the morph test).
- CI runs: 36203827280 (the run in the brief) and 36214869344 (#367). The rest are in the table
  above.
- Commits: `bc80ff9a` and `df6f8929` (earlier CI flake fixes), and `8004ca74` (#367).
- Code: `e2e/morph.spec.ts`, `e2e/app.spec.ts`,
  `src/app/modules/editor/services/shortcut.service.ts`,
  `src/app/modules/editor/services/fileexport.service.ts`,
  `src/app/modules/editor/styles/theme.scss`, and `playwright.config.ts`.

## Appendix: the full diff of #367

```diff
diff --git a/e2e/guards.preview.spec.ts b/e2e/guards.preview.spec.ts
index 2453c997..42896347 100644
--- a/e2e/guards.preview.spec.ts
+++ b/e2e/guards.preview.spec.ts
@@ -14,6 +14,9 @@ test.describe('with unsaved changes', () => {
     await page.getByRole('button', { name: 'Cancel' }).click();
     await expect(page.locator('.slt-layer').first()).toHaveText('playtopause');

+    // The File button is clicked again right away, so wait for the dialog to finish closing first
+    // (Safari leaves the focus in it).
+    await expect(page.locator('.MuiModal-root')).toHaveCount(0);
     await page.getByRole('button', { name: 'File' }).click();
     await page.getByRole('menuitem', { name: 'New' }).click();
     await page.getByRole('button', { name: 'OK' }).click();
diff --git a/e2e/interactions.spec.ts b/e2e/interactions.spec.ts
index 25e1de6d..0c7b9c15 100644
--- a/e2e/interactions.spec.ts
+++ b/e2e/interactions.spec.ts
@@ -175,7 +175,8 @@ test('ignores shortcuts while a menu or dialog is open', async ({ page, modifier
   await page.getByRole('button', { name: 'Cancel' }).click();
   await expect(page.getByRole('dialog')).toHaveCount(0);

-  // The shortcuts work again once the dialog is closed.
+  // Shortcuts are ignored until the dialog has finished closing (Safari leaves the focus in it).
+  await expect(page.locator('.MuiModal-root')).toHaveCount(0);
   await page.keyboard.press('s');
   await expect.poll(async () => (await getSnapshot()).isSlowMotion).toBe(true);
 });
diff --git a/e2e/morph.spec.ts b/e2e/morph.spec.ts
index 61d3dd56..ae316670 100644
--- a/e2e/morph.spec.ts
+++ b/e2e/morph.spec.ts
@@ -273,13 +273,18 @@ test('creates a play-to-pause morph from scratch', async ({ page, modifier }) =>

   // Save the project, and then open it in a new workspace.
   const paths = await getMorphPaths(page);
+  // Shortcuts are ignored until the menu has finished closing (Safari leaves the focus in it).
+  await expect(page.locator('.MuiModal-root')).toHaveCount(0);
   await page.getByRole('button', { name: 'File' }).click();
   const saveDownloadPromise = page.waitForEvent('download');
   await page.getByRole('menuitem', { name: 'Save' }).click();
   const project = await readDownload(await saveDownloadPromise);
+  // Shortcuts are ignored until the menu has finished closing (Safari leaves the focus in it).
+  await expect(page.locator('.MuiModal-root')).toHaveCount(0);
   await page.getByRole('button', { name: 'File' }).click();
   await page.getByRole('menuitem', { name: 'New' }).click();
   await expect(page.locator('.slt-layer')).toHaveText(['vector']);
+  await expect(page.locator('.MuiModal-root')).toHaveCount(0);
   await page.getByRole('button', { name: 'File' }).click();
   const fileChooserPromise = page.waitForEvent('filechooser');
   await page.getByRole('menuitem', { name: 'Open' }).click();
diff --git a/e2e/timeline.spec.ts b/e2e/timeline.spec.ts
index 914a3089..288fa402 100644
--- a/e2e/timeline.spec.ts
+++ b/e2e/timeline.spec.ts
@@ -101,6 +101,9 @@ test('exports and imports files', async ({ page }) => {
     await page.getByRole('menuitem', { name: item, exact: true }).click();
     const download = await downloadPromise;
     expect(download.suggestedFilename()).toMatch(fileName);
+    // The menu button is clicked again right away, so wait for the menu to finish closing first
+    // (Safari leaves the focus in it).
+    await expect(page.locator('.MuiModal-root')).toHaveCount(0);
   }

   const numLayers = await page.locator('.slt-layer').count();
@@ -231,9 +234,12 @@ test('groups, flattens, and converts layers', async ({ page, modifier }) => {
   expect(await getLine()).toEqual({ pathData: 'M 4 12 L 20 12', strokeWidth: 2 });

   // Convert the line to a clip path and back.
+  // Shortcuts are ignored until the menu has finished closing (Safari leaves the focus in it).
+  await expect(page.locator('.MuiModal-root')).toHaveCount(0);
   await openLayerMenu('line');
   await page.getByRole('menuitem', { name: 'Convert to clip path' }).click();
   await expect(layers.filter({ hasText: 'line' })).toHaveClass(/slt-layer-type-mask/);
+  await expect(page.locator('.MuiModal-root')).toHaveCount(0);
   await openLayerMenu('line');
   await page.getByRole('menuitem', { name: 'Convert to path' }).click();
   await expect(layers.filter({ hasText: 'line' })).toHaveClass(/slt-layer-type-path/);
```
