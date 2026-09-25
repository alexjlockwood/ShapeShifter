# Improvement report

A survey of the codebase (as of the React/TypeScript/Vite migration) looking for further
improvements beyond the migration itself: design problems in the model and store, performance,
UX and accessibility, test coverage, the offline/PWA setup, error handling, dependency health,
and what it would take to bring back the paper.js editor. This is a survey only; nothing here
has been implemented yet.

## Quick wins (low risk, about a day or less each)

- **Single 1.57 MB (480 KB gzip) JS bundle.** `vite.config.ts` has no `manualChunks` config and
  there are no dynamic `import()` calls anywhere in `src/app`, so MUI, svgo, jszip, rxjs, and
  bezier-js all ship in one chunk that blocks first paint, even though svgo/jszip and the demo
  loader are only needed for export/import flows. Splitting those behind `import()` is a
  half-day to a day, low risk.
- **Playback does a linear scan every frame.** `AnimationRenderer.setCurrentTime`
  (`scripts/animator/AnimationRenderer.ts`, around line 71) runs `_.find` over the interpolator
  list for every animated property on every rAF tick; there's already a TODO at line 69
  admitting this. Resolving the interpolator once per block instead of per frame is 1 to 2
  hours, low risk.
- **Import failures fail silently.** In `services/fileimport.service.ts` (lines 74-89, 118-134),
  a multi-file import only shows an error snackbar if every file fails, so one malformed file
  in a batch just vanishes with no feedback, and `FileReader` errors use a blocking `alert()`
  instead of the snackbar the rest of the app uses. Separately, `VectorDrawableLoader.ts`
  (lines 239-248) drops a malformed `<path>` inside an otherwise valid vector drawable with only
  a `console.warn`. Fixing all three is a few hours to half a day, low risk.
- **PWA manifest is missing standard icon sizes.** `public/manifest.json` has a single 600x600
  icon; most installability checks want 192x192 and 512x512 sizes plus a maskable variant.
  About an hour, no risk.
- **No test coverage tooling.** Nothing in `vite.config.ts` or `package.json` configures
  `@vitest/coverage-v8`, so the gaps below can only be estimated, not measured. Under an hour.
- **No keyboard shortcuts help dialog.** `services/shortcut.service.ts` implements a real
  shortcut layer, but the only way to discover a shortcut today is to hover every toolbar
  button. Reusing the existing `dialog.service.ts` for a shortcuts reference is about half a
  day, low risk.
- **No automated dependency update bot.** `.github/workflows/ci.yml` already runs typecheck,
  lint, test, e2e, and build on every PR, but nothing tracks dependency drift automatically.
  Given the project's policy of rejecting packages newer than 5 days, a Dependabot/Renovate
  config would need a cooldown or manual merge gate rather than auto-merge. About an hour.

## Design problems (carried over from the original list, sharpened by this survey)

1. **Stringly typed `any` values** (`AnimationBlock.fromValue: any`, `Property<any>` in
   `model/timeline/AnimationBlock.ts` and `model/properties/PropertyMaps.ts`) are confirmed
   unchanged. 2 to 3 days.
2. **Model classes via interface merging and `Property.register`** are confirmed across
   `Layer.ts`, `Animation.ts`, and `AnimationBlock.ts`. 1 day for separate input/model types.
3. **A path's first move command stores an undefined start point**
   (`Command.points` is `(Point | undefined)[]`), unchanged. 2 to 3 days.
4. **The path state tree** (`Path.ts` 1,479 lines, `PathState.ts` 425, `SubPathState.ts` 149,
   `CommandState.ts` 423, about 2,476 lines total) has no property-based tests anywhere
   (`fast-check` isn't a dependency), and `Path.spec.ts` has explicit TODOs (around lines 759,
   765-770, 827, and 887) for exactly the edit-sequence combinations most likely to trigger the
   "parentless split segment" bug. Recommend doing the fuzz-testing pass (1 to 2 days) before
   any structural redesign, now that the specific untested sequences are identified.
5. **No referential integrity for dangling layer references** is confirmed unchanged. A meta
   reducer that prunes them is half a day to a day.
6. **No validation at data boundaries** (`fromJSON`, paste, imports) is confirmed, and connects
   directly to the silent-import-failure findings above. About a day.
7. **UI state lives in the undoable document state** is confirmed still true and is tracked as
   an open bug in `BUGS.md` (`store/undoredo/metareducer.ts`). 1 to 2 days.
8. **Class-instance redux actions and imperative service construction.** `services/StoreUtil.ts`
   has a literal `// TODO: expand on this class... possibly a better redesigned version?`, and
   `services/createEditorServices.ts` wires every service together by hand. No new scope found;
   still open-ended.

## Performance

Mostly already well-optimized:

- Canvas controllers subscribe via rxjs with `distinctUntilChanged` deep-equality checks before
  redrawing (`components/canvas/CanvasController.ts`, around lines 68-78), so unrelated state
  changes don't trigger repaints.
- The dev-only deep-freeze meta reducer (`store/storefreeze/metareducer.ts`) is gated to
  non-production builds (`store/reducer.ts`), so it costs nothing in production.
- Undo history is bounded to 30 entries and excludes noisy playback actions like
  `SetCurrentTime` (`store/undoredo/metareducer.ts`), so there's no unbounded-history risk.
- MUI icons are already imported per-subpath (`components/icons/Icon.tsx`), not from the
  barrel file, so they are already tree-shakeable.

The bundle-splitting and per-frame interpolator lookup gaps above are the only real findings.

## UX and accessibility

This is the sharpest gap found in the whole survey. Only 9 `aria-*`/`role`/`tabIndex`
attributes exist across the entire component tree, and the path-editing canvas itself
(`components/canvas/Canvas.tsx`, lines 60-71, four bare `<canvas>` elements) has no accessible
fallback at all: a screen reader or keyboard-only user cannot perceive or edit a path. A full
fix (a keyboard-navigable path/segment model) is a multi-week redesign; a minimal pass
(labeling the canvas region, announcing selection/tool state via a visually hidden live region)
is 1 to 2 days, low risk.

Separately, there is no touch or pointer event handling anywhere in the active code (only in
the deferred paper.js tree), so the app is effectively mouse-only. Tablets and touchscreen
laptops cannot interact with the canvas at all. Making the core canvas touch-operable is
substantial, likely a week or more, and moderate risk given the imperative gesture
architecture; it may make sense to fold into any paper.js revival work.

MUI's `Dialog` and `Tooltip` usage already provide correct focus trapping and labeling, and
destructive actions (deleting layers, etc.) already go through a confirmation dialog
(`dialog.service.ts`), so no changes are needed there.

## Test coverage and flakiness

The existing suite is healthy: 284 unit tests, all passing, no skipped or `.only()` tests, no
`sleep`/`waitForTimeout` workarounds in the e2e suite, and retries are only enabled in CI
(`playwright.config.ts`), which is reasonable rather than a sign of known flakiness.

Real gaps:

- **Zero component-level unit tests.** `@testing-library/react` isn't a dependency, and none
  of the 18 `.tsx` components under `components/` have a spec file. All UI behavior is only
  verified through Playwright e2e today. 2 to 3 days for baseline coverage of the toolbar,
  property inputs, and dialogs.
- **No e2e test drags a path point or handle on the canvas** (add/delete point, split segment,
  mould a curve, drag-select segments). Given that path-editing invariant bugs are the open
  issue most worth chasing down, this is the highest-value e2e gap. 1 to 2 days; medium risk of
  flakiness since Playwright mouse-move sequences against canvas coordinates are fiddly to get
  pixel-accurate.
- **No property-based/fuzz testing** for the path state tree, covered above under design
  problem 4.

## Offline / PWA

Already well designed: `vite-plugin-pwa` uses `skipWaiting`/`clientsClaim` so new builds
activate immediately, `src/main.tsx` deliberately no-ops `onNeedReload` with a comment
explaining that reloading an open tab could lose in-progress edits, and the legacy Angular
service worker is excluded from precache and self-unregisters. The only real gap is the
manifest icon sizes listed above under quick wins.

## Error handling

Bugsnag setup is solid: `scripts/bugsnag/index.ts` filters events with `isReportable`, which
excludes cross-origin noise and non-production origins, and per-panel error boundaries are
wired correctly. The import-path silent failures listed under quick wins are the only real
gaps found.

## Dependency health

- `npm audit` reports 0 vulnerabilities.
- CI (`.github/workflows/ci.yml`) already gates typecheck, lint, test, e2e, and build on every
  PR.
- **rxjs is not legacy Angular cruft.** It's used meaningfully in 9 files, including
  `store/Store.ts`, the canvas controllers, `playback.service.ts`, and `shortcut.service.ts`.
  It underpins the observable-based service/controller architecture from the migration.
  Removing it would be a real architectural change, not a cleanup.
- `bezier-js` is intentionally pinned tight (`~2.2.14`) because upstream has moved 4 major
  versions past a rewrite; this is a deliberate hold, not an oversight, and any upgrade needs
  its own scoped effort.
- `lodash: ^4.18.1` is a real installed version (confirmed against `node_modules`), not a typo.

## Paper.js editor revival

About 9,770 lines of code total. `model/paper/` and `store/paper/` (6 files) already compile
and ship live today (`Root.tsx` and `CanvasController.ts` import from them). Everything else,
49 files under `scripts/paper/`, `components/toolpanel/`, `services/paper.service.ts`, and
`typings/paper/`, is excluded from `tsconfig.json` and the Vite build.

Three files were never migrated off Angular at all: the toolpanel component still uses
Angular's `@Component` decorator and an rxjs `Observable`, `paper.service.ts` still uses
`@Injectable`, `NgZone`, and jQuery, and the canvas directive still uses `@Directive` and
jQuery. The `paper`, `jquery`, and `@angular/core` packages are no longer installed anywhere in
the project, so this code can't even be type-checked as it sits. The other 49 files under
`scripts/paper/` are plain TypeScript classes built on the `paper` library and the `Store`
facade, so they are comparatively portable.

Bringing it back means: reinstalling `paper` and checking the hand-rolled types in
`typings/paper/` against whatever version is installed; rewriting the three Angular-native
files from scratch as React components/hooks (no jQuery, no Angular DI); rewiring
`PaperProject.ts`/`MasterToolPicker.ts` into the current layout-effect-based
`CanvasController.ts` pattern; and fixing two known, unverified bugs already listed in
`BUGS.md` under "Beta only, not yet migrated." There is no test coverage for any of it, so
verification would be manual.

`README.md` frames this editor as the intended replacement for the current
property-panel-driven path editing: freeform drawing and editing directly on the canvas.

Estimate: 5 to 8 days total (roughly 1 day to get the 49 portable files typechecking again, 2
to 3 days to rewrite the three Angular-native files, 1 to 2 days to fix the known bugs and
confirm tool switching/snapping/gestures against the current paper.js API, 1 to 2 days of
manual QA). Risk: moderate to high. This is the largest remaining pocket of Angular code in the
repo, has zero test coverage, and changes the app's core editing model, so it is as much a
product decision as an engineering one.

## Suggested starting point

Best effort-to-value ratio, all low risk: bundle splitting, the import-error-swallowing fixes,
and the path-state fuzz tests (which also de-risk any future work on design problem 4).
