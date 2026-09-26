# Build and tests bugs found by the 2026-09-25 sweep

- **Unhashed files in `public/assets/` are precached without a revision and never update.**
  vite-plugin-pwa assumes every file in the build's assets folder has a hash in its name, but
  `public/assets/` is copied there unhashed, so its images are precached without a revision and
  returning users never get a changed one. Move the images, or set `dontCacheBustURLsMatching` to
  match only hashed names (`vite.config.ts`). (CFG-1, low, confirmed by a test)
- **`navigateFallback` serves the app for every uncached navigation.** With the service worker
  installed, opening the `og:image`, a source map, or a mistyped path returns the app instead of
  the file or a 404. Add a `navigateFallbackAllowlist` for the app's own URL, since a denylist of
  extensions would also match `?project=` links (`vite.config.ts`). (CFG-2, low, confirmed by a
  test)
- **The "activates a new version without reloading open pages" test passes even without
  `onNeedReload`.** It installs the new service worker on the first visit, before the page is
  controlled, so the reload that `onNeedReload` prevents can't happen, and the test passes with it
  deleted from `src/main.tsx`. Reload once after "Ready to work offline", then register the new
  worker (`e2e/offline.preview.spec.ts`). (CFG-3, low, confirmed by a test)
- **The zoom test's "page doesn't scroll or zoom" check can't fail.** It checks `scrollY`, which
  can't change (the page has `overflow: hidden`) and doesn't see browser zoom, so it passes
  without the timeline's `preventDefault`. Assert `defaultPrevented` from a capture listener
  instead (`e2e/interactions.spec.ts`). (CFG-4, low, confirmed by a test)
- **The Space-in-dialog check races the 300 ms demo.** The test compares `isPlaying` before and
  after pressing Space in a dialog, but on a slow runner the demo could play and finish in
  between, so a regression would pass. Compare the current time too, or turn on repeat first
  (`e2e/interactions.spec.ts`). (CFG-5, low, confirmed by reading)
- **Screenshots from the three browsers overwrite each other.** Tests save screenshots to fixed
  paths, so the Chromium, Firefox, and WebKit runs overwrite each other, and a CI artifact shows an
  arbitrary browser. Use `test.info().outputPath()` (`e2e/canvas.spec.ts`, `e2e/timeline.spec.ts`,
  and `e2e/panels.spec.ts`). (CFG-6, low, confirmed by reading)
- **Prettier and oxlint scan `.claude/worktrees/`.** With Claude Code worktrees in the main
  checkout, `npm run lint` lints other sessions' code, and `npm run format` rewrites it. Add
  `.claude/worktrees/` to `.gitignore`, which both tools honor. Other nested worktrees, like
  Flotilla's slots, have the same problem when they're only in a global git ignore, which Prettier
  doesn't read. (CFG-7, low, confirmed by a test)
