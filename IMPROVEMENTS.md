# Improvement report

A survey of the codebase (as of the React/TypeScript/Vite migration) looking for further
improvements beyond the migration itself: design problems in the model and store, performance,
UX and accessibility, test coverage, the offline/PWA setup, error handling, dependency health,
and editing paths on the canvas. This is a survey only; nothing here has been implemented yet.

## Quick wins (low risk, about a day or less each)

- **Single 1.57 MB (480 KB gzip) JS bundle.** `vite.config.ts` has no `manualChunks` config and
  the only dynamic `import()` in `src/app` loads the canvas editor
  (`components/canvas/loadCanvasEditor.ts`), so MUI, svgo, jszip, rxjs, and bezier-js all ship in
  one chunk that blocks first paint, even though svgo/jszip and the demo loader are only needed
  for export/import flows. Splitting those behind `import()` is a half-day to a day, low risk.
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
7. **UI state lives in the undoable document state.** The canvas editor keeps its UI state out of
   the store, but playback and action mode state are still restored by undo (STORE-1 in
   `docs/bugs/store-and-services.md`). 1 to 2 days.
8. **Class-instance redux actions and imperative service construction.**
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

Besides the bundle splitting above, a performance audit on 2026-09-27 found these, roughly in order
of impact. None has been profiled yet, so measure one on a big document before fixing it. The same
audit fixed the worst finding: `AnimationRenderer` deep cloned the whole document on every pointer
move of a canvas editor gesture, and now only copies the animated layers (#408). It also looked up
each block's interpolator on every frame, and now resolves it once per block.

- **Import and spritesheet export block the main thread.** `optimizeSvg`
  (`scripts/svgo/index.ts`, line 75) returns a promise, but runs svgo synchronously inside its
  executor, so nothing is deferred. `SvgLoader.ts` then builds the layers with a synchronous
  recursive walk (`nodeToLayerFn`, line 80). A large SVG freezes the tab while it imports. A web
  worker for svgo, or at least yielding between steps, is 1 to 2 days, medium risk.
- **Spritesheet export holds every frame in memory.** `createSvgFrames` and `createSvgSprite`
  (`scripts/export/SpriteSerializer.ts`, lines 49-77) render and serialize every frame in one
  synchronous loop, keep all the strings in an array, and run the joined sprite through the same
  blocking `optimizeSvg`. The cost grows with frame rate times duration, and it runs at both 30
  and 60 fps. Yielding per frame is a few hours; streaming frames is about a day.
- **Every visible path replays its commands on every frame.** `executeCommands`
  (`components/canvas/CanvasUtil.ts`, line 11) rebuilds each path on the context from its command
  list on every draw, so layers that don't animate cost as much during playback as ones that do.
  Caching a `Path2D` per unchanged path is about a day, low to medium risk.
- **Morphing allocates a new path every frame.** `PathUtil.interpolate()`
  (`model/paths/PathUtil.ts`, line 11) builds a new `Path`, and a new `Command` with a fresh
  `uniqueId()` for every command, on every frame of a morph. Its TODOs (lines 9 and 32) already
  point this out, and `model/paths/AGENTS.md` calls it the hot path. Reusing ids or a lighter
  frame-only path is 1 to 2 days, medium risk.
- **Bounding boxes aren't cached.** `getBoundingBox()` and `createBoundingBox()`
  (`model/paths/PathState.ts`, lines 292-293 and 351) walk every command on every call, and both
  have a `TODO: cache this?`. Paths are immutable, so caching per path is a few hours, low risk.
- **Every action mode edit recomputes poles of inaccessibility.** `autoAddCollapsingSubPaths`
  (`scripts/algorithms/AutoAwesome.ts`, line 134) runs after each point drag or split, and calls
  `getPoleOfInaccessibility` (`PathState.ts`, line 262, which runs polylabel) per subpath. This
  would cache with the bounding boxes.
- **Auto fix is quadratic in the number of points.** `alignSubPath` (`AutoAwesome.ts`, line 215)
  runs a Needleman-Wunsch alignment, O(n·m), for up to `MAX_ALIGNMENT_CANDIDATES` (10) candidates,
  and `getShiftedEndPoints` (line 404) rotates the whole point ring once per shift before the
  cutoff. It only runs when auto fix is chosen, so it matters mostly for paths with hundreds of
  points. Worth measuring with `npm run playground` first.
- **Trimmed paths rebuild their path on every draw.** `drawPathLayer`
  (`components/canvas/CanvasLayers.ts`, around line 207) transforms and rebuilds the whole path to
  measure its length when a trimmed path is scaled unevenly. Caching the length is an hour or two.
- **The canvas editor redraws on every raw pointer move.** `CanvasEditor.onMove`
  (`components/canvaseditor/CanvasEditor.ts`, line 336) redraws the handles, guides, and snapping
  straight from the `pointermove` listener (`components/canvas/CanvasInput.ts`, line 52), with no
  `requestAnimationFrame` batching, so it relies on the browser coalescing events. An hour or two,
  low risk.

## UX and accessibility

This is the sharpest gap found in the whole survey. Only 9 `aria-*`/`role`/`tabIndex`
attributes exist across the entire component tree, and the path-editing canvas itself
(`components/canvas/Canvas.tsx`, bare `<canvas>` elements over the artboard) has no accessible
fallback at all: a screen reader or keyboard-only user cannot perceive or edit a path. A full
fix (a keyboard-navigable path/segment model) is a multi-week redesign; a minimal pass
(labeling the canvas region, announcing selection/tool state via a visually hidden live region)
is 1 to 2 days, low risk.

Separately, touch support is only starting. The canvas takes pointer events
(`components/canvas/CanvasInput.ts`), so a finger or a pen can drag on the artboard, but the rest of
the app (the timeline and the splitters) still only listens to the mouse, and nothing on the canvas
is sized for fingers yet. Making the whole app touch-operable is likely a week or more
(`docs/canvas-editor.md`, phase 6).

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

## Canvas editor

The paper.js editor won't be revived as it was. `docs/canvas-editor.md` explains why (it only
supported one subpath per layer, and its round trips through paper.js broke morphing) and lays out
a new editor built on the current canvas and path model, behind a feature flag, with a phased
roadmap.

- **Outline stroke gaps.** Outline stroke already turns a stroked path into an identical filled one
  (`outlineStrokes` in `components/canvaseditor/pathOps.ts`, Cmd+Alt+O, and in the context
  menu). But it needs the canvas editor, so the context menu leaves it out with the editor off,
  refuses animated layers, and turns round caps and joins into many short quadratic curves
  (`docs/canvas-editor.md`, phase 6). The follow-up is making it work with the editor off and on
  animated paths, and fitting the rounds as cubics.
- **Morph into gaps.** "Morph into" (`scripts/common/morphLayers.ts`, in the context menu and the
  import snackbar) animates the path, the fill and stroke colors, their alphas, and the stroke
  width. The other path's trim isn't animated, and its caps, joins, miter limit, and fill rule are
  lost, since they can't animate. It also needs a free 300 ms at the current time or after the
  last path block, and refuses otherwise, rather than lengthening the animation or picking a
  shorter morph. Animating the trim, and asking before lengthening, are the obvious follow-ups.

## Icon animation workflow

Building fourteen icon animations from Material icons through the UI on 2026-10-04 (the bugs are
in `docs/bugs/icon-animations.md`) took 215 blocks, each typed in field by field, plus path data
typed by hand for every part that had to be a stroke or a cut-out. Nothing needed a feature the
app can't export; it needed time. These would save most of it, roughly in order of how many of
the fourteen they'd have helped.

- **Animate several layers at once.** With several layers selected, the inspector has no keyframe
  buttons, so four fullscreen corners doing the same flip 40 ms apart took 20 blocks, and five
  star bursts took 30. Adding a block to every selected layer, a command that staggers the
  selected blocks by a step in layer order, and pasting blocks onto the selected layers with their
  relative timing (ICON-8) would cover it. About 3 to 5 days.
- **Keyframes rather than from/to blocks.** Each block is five fields (start, end, from, to,
  easing): about 50 edits for menu to close and 70 for the bell's damped swing. An auto-key mode,
  where moving the playhead and changing a value adds a block from the previous keyframe, and new
  blocks that start where the last one ended (ICON-7), would make a two-step press a few clicks.
  A pendulum or wiggle preset that writes damped rotation keyframes would cover the bell. About 1
  to 2 weeks for auto-key.
- **A linked scale and translate.** A uniform press is four blocks (scale X and Y, in and out),
  since the keyframe button asks for one axis. One block that animates both, kept in step, would
  halve these. About 2 days.
- **Turn Material icons into parts.** Material ships each icon as one compound path. Break apart
  should keep holes with their outlines (ICON-1), work on animated paths (it's refused once a
  path has a path block, so both icons have to be broken apart before Morph into), and pivot each
  piece at its center (ICON-2). Parts drawn as one outline, like the lock's body and shackle,
  need a knife or a boolean split. Most trimmed parts (pages, checks, a shackle) are 2dp strokes
  that were outlined into fills, and nothing turns them back: a "convert to centerline stroke"
  (the reverse of Outline stroke) would save typing their path data. About 1 week.
- **Add a slash.** Every `*_off`, `*_disabled` and `no_*` icon in Material (213 of them) uses the
  same slash: a 1.8-wide bar from (3.6, 3.6) to (20.4, 20.4) with a gap on its upper right. Mute,
  camera off and similar animations need a stroked slash with a trim block and a clip path whose
  gap grows with it, and today the clip's start and end shapes have to be typed with corners
  computed by hand. A command that builds both from the icon would make the whole family one
  click. About 2 to 3 days.
- **Reuse an animation in another project.** Opening a project replaces the workspace, and copy
  only copies blocks, so the mic's slash was rebuilt by hand for the volume icon. Importing
  another project's layers with their blocks would fix it. About 2 to 3 days.
- **Precise point editing.** X and Y fields for several selected points, fractional nudges, and a
  way to rotate points about a chosen point. The last is what makes a turn-and-morph work (the
  hang-up animation morphs into `call_end` turned back by 135°, so the rotation does the turning),
  and today it takes the canvas editor's rotate handle around the shape's own center. About 3 to 5
  days.
- **Show what a clip path clips.** Highlight the layers a selected clip affects, and insert new
  clips above the selection (ICON-4). About 1 to 2 days.
- **A repeat count,** so a searching or loading state can loop (`android:repeatCount`). The
  Chromecast search had to be unrolled into 18 blocks. (GitHub #140, in `docs/bugs/github-issues.md`)
- **Auto fix that knows more than point positions.** Run on the fourteen pairs of raw icons, auto
  fix did well on the bell, star, bookmark and download arrow. It can't do what the others need,
  and these would help most:
  - Fit the best rotation between paired subpaths and offer a rotation block, morphing only
    what's left over. The hang-up morph was clean once the end shape was turned back by hand.
  - Recognize circles and rounded rectangles and morph their corner radius. Morph into turns the
    raw circle into a pinched lemon on its way to a square; only hand-written `<rect rx>` SVGs,
    whose structure survives import, gave a clean morph.
  - Keep each hole's winding (GitHub #31), which fills in the lock's body.
  - When two shapes have nothing in common (copy into check), offer to draw one off and the next
    one on with trim paths, rather than a morph that melts.
  - Let unpaired subpaths grow from, or shrink toward, a chosen point, and stagger them.

## Planned features

Export formats the maintainer wants to add, decided while triaging the GitHub issues on
2026-09-26. `docs/bugs/github-issues.md` lists the other feature requests.

- **A CSS keyframes export for the web.** The README used to say the app exports CSS keyframe
  animations, but `exportCssKeyframes()` (`services/fileexport.service.ts`) is an empty stub that
  nothing calls; the only CSS animation today is the spritesheet's `steps()`. The export would
  write one SVG animated with CSS instead of frames. Path morphs need CSS `d` animation, which
  Safari doesn't support, so they'd need SMIL or a fallback. About 3 to 5 days. (GitHub #322 and
  #315)
- **An export for iOS.** The README used to say the app was for iOS too, but iOS apps can only use
  the SVG and spritesheet exports. Lottie (GitHub #19) is the likely format, since it also plays on
  Android, the web, and Flutter (GitHub #318). Morphs already have matching commands, which Lottie
  shape keyframes need, but lines and quadratic curves would have to become cubics, and
  interpolators that aren't cubic beziers (overshoot, anticipate) would need sampled keyframes.
  About 1 to 2 weeks. (GitHub #333)

## Feature requests

Ideas under consideration, not yet scoped or scheduled:

- **A pivot relative to the layer's bounds, as a percentage.** New groups and paths pivot at the
  canvas's center (`getCenterPivot` in `model/layers/LayerUtil.ts`), but pivots are absolute, so
  the pivot stays put when the layer's contents move or the canvas is resized. Three options were
  weighed:
  - edit it as a percentage in the inspector but store it absolute (about 2 days, no format
    change);
  - store a fraction of the bounds at the start of the animation (about 1 week, with a version
    bump and conversions for old files and VectorDrawable imports);
  - store a fraction of the bounds on every frame, like CSS `transform-origin` (1 to 2 weeks, and
    animated content needs sampled pivot keyframes in the AVD).

  For reference, Compose's `ImageVector` groups are absolute with a default of 0
  (`compose/ui/ui/.../graphics/vector/Vector.kt:50-51`), `DrawScope.rotate` and `scale` default
  to the center, and only `graphicsLayer`'s `TransformOrigin` uses fractions.

- **A batch edit's Layout section.** Selecting several layers shows the sections they share
  (`components/propertyinput/buildPropertyInputModel.ts`'s batch branches), but not Layout, which
  isn't made of properties: it's the union of `getLayerBounds` for one layer
  (`components/propertyinput/layoutValues.ts`). Showing the selection's combined bounds and moving
  or resizing every layer together through `components/canvas/transformLayers.ts` (as a single
  layer's Layout already does) is a follow-up once there's a helper for a bounding box's union and
  for scaling several layers from one anchor.

- **Fix AnimatedVectorDrawable import.** `scripts/import/VectorDrawableLoader.ts` doesn't
  special-case the `animated-vector` root tag, so an AVD's
  `<aapt:attr name="android:drawable"><vector>` wrapper produces an extra nested `GroupLayer`, and
  `viewportWidth`/`viewportHeight`/`alpha` are read off the `animated-vector` root instead of the
  nested `vector`, silently falling back to defaults. `<target>`/`<objectAnimator>` content is
  dropped entirely rather than becoming animation blocks. A more complete parser
  (`loadAnimationFromXmlString`, lines 119-216) already exists in the file but is commented out
  and not wired into `services/fileimport.service.ts` or `scripts/import/index.ts`. Reconnecting
  and finishing that parser, plus fixing the sizing/nesting bug for the static case, is the path
  here. (GitHub #8 and #347)
- **Gradient import support.** Gradients are a complete gap in the data model, not just an
  importer limitation: `model/layers/Layer.ts` defines `fillColor` (and `strokeColor`) as a plain
  `string` via `ColorProperty`, with no gradient type anywhere in `model/layers/` or
  `model/paths/`. Both importers only read a flat color: `VectorDrawableLoader.ts`'s `getColor()`
  ignores `<gradient>` children of `android:fillColor`/`strokeColor`, and `SvgLoader.ts` only
  reads the `fill` attribute as a color string, with no `<linearGradient>`/`<radialGradient>`
  parsing. Supporting this needs a gradient paint type in the layer model before either importer
  can populate it. (GitHub #144 and #224)
- **Show gradients in the UI.** Follows from the point above: `components/canvas/CanvasLayers.ts`
  sets `ctx.fillStyle` to a solid RGBA string with no `CanvasGradient` construction anywhere in
  `components/canvas/`, and there's no gradient UI in the property inspector either. Once the
  model has a gradient paint type, this needs canvas rendering (building a `CanvasGradient` from
  stops) and an inspector control for editing stops/angle, likely the largest piece of the three.
  (GitHub #144)

## Suggested starting point

Best effort-to-value ratio, all low risk: bundle splitting, the import-error-swallowing fixes,
and the path-state fuzz tests (which also de-risk any future work on design problem 4).
