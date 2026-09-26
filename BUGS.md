# Known bugs

Bugs noticed while migrating the app from Angular to React. Paths are relative to
`src/app/modules/editor/`.

## Open

These existed before the migration and are still there.

- **Compact arc flags are misparsed.** `PathParser` can't read arc commands whose flags aren't
  separated by spaces, e.g. `a10 10 0 100 20` (large-arc 1, sweep 0, then `0 20`). svgo 1.x wrote
  paths this way, so importing SVGs with circles, ellipses, or rounded rects produced the wrong
  geometry. svgo 4 no longer compacts flags, which fixes imports, but pasting or typing a
  compact path string (common in optimized icons) still breaks. See
  `model/paths/PathParser.ts`.
- **UI-only state is recorded in the undo history.** Changes to the `paper` slice (cursor, hover,
  zoom) aren't excluded, so they can become undo steps of their own
  (`store/undoredo/metareducer.ts`).
- **Deleting a split segment can find it without a parent command.** It's unclear how the path
  gets into this state. It used to crash with "Cannot read properties of undefined (reading
  'getCommands')" (reported to Bugsnag from 1.0.15), and now it leaves the path as it is and
  reports a warning (`model/paths/Path.ts`, `deleteFilledSubPathSegmentInternal`). A candidate fix
  exists on the unmerged branch `alex/fix-split-filled-subpath-order` (commit `8f66bc6c`, PR #368,
  closed without merging); it fixes this case and many related ones, but deleting a split segment
  in a shifted or reversed subpath is still wrong in a lot of cases, per that branch's fuzz
  testing.
- **Split subpaths can't be deleted, but the toolbar offers to.** It's not clear whether
  deleting them is meant to work. After you split a subpath in action mode, selecting either half
  shows a "Delete subpath" button, but neither it nor Backspace does anything, on this branch or
  on the live site. The toolbar shows the button for subpaths that `isUnsplittable()`, while
  `ActionModeService.deleteSelectedActionModeModels` only deletes subpaths that `isSplit()`,
  which is always false: `PathState` looks up the split state on leaf subpath states
  (`flattenSubPathStates` only returns leaves), and leaves are never split. Either the button
  should go, or the service should check `isUnsplittable()`. The pair and selection helpers also
  prefer "split" subpaths when hits overlap, so that preference never applies either
  (`model/paths/PathState.ts`, `isSubPathSplit`).
- **The editor draws strokes in scaled groups at the wrong width.** `CanvasLayers` multiplies
  the stroke width by the scale of the canvas-to-layer matrix instead of the layer-to-canvas
  one, so a stroke of width 2 in a group scaled by 2 is drawn 1 unit wide, but Android (and the
  exported SVGs) draw it 4 units wide. The exports and flattening scale strokes the Android way
  (`components/canvas/CanvasLayers.ts`).
- **Test gaps.** `SvgLoader`'s clip path test asserts nothing (`expect(true).toBe(true)`), and
  the layer and VectorDrawable loader specs were entirely commented out (and have been deleted).
- **Beta only (paper.js, not yet migrated):**
  - The tool panel template binds `model.isDefaultClick`, but the selector provides
    `isDefaultChecked`, so the select tool never shows as checked
    (`components/toolpanel/`, `store/paper/selectors.ts`).
  - `PaperProject.remove()` doesn't remove the `paper.Tool` it created, and paper.js only
    activates a new tool when none is active, so a remounted canvas keeps using the old tool
    (`scripts/paper/PaperProject.ts`). Verified against paper.js 0.11.5: it caused the most
    common beta crash in Bugsnag (see `docs/bugs/bugsnag.md`).

## Found by the 2026-09-25 bug sweep

An automated bug sweep on 2026-09-25 found 100 issues (3 high, 31 medium, 66 low), split across
seven areas of the compiled app plus build/PWA/e2e/tooling. Most were confirmed with a throwaway
test (deleted afterward, no source changed); the rest by reading the code, and one is only
plausible. None of these are triaged yet. They're grouped by area in `docs/bugs/`, one file per
area, in the same style as the rest of this file:

- **Path model** (18 bugs): `docs/bugs/path-model.md`
- **Store and services** (18 bugs): `docs/bugs/store-and-services.md`
- **Layers and properties** (10 bugs): `docs/bugs/layers-and-properties.md`
- **Import** (15 bugs): `docs/bugs/import.md`
- **Export** (7 bugs): `docs/bugs/export.md`
- **Canvas** (11 bugs): `docs/bugs/canvas.md`
- **Timeline and UI** (15 bugs): `docs/bugs/timeline-and-ui.md`
- **Build and tests** (7 bugs): `docs/bugs/build-and-tests.md`

A subset of these (marked with a candidate fix in their entry) were fixed on a branch,
`alex/fix-sweep-quick-wins`, whose PR (#370) was closed without merging; the branch predates the
Prettier reformat in PR #366, so it would need a rebase before its commits could be reused.

## Found in the Bugsnag reports

Eight years of Bugsnag emails (2018 to 2026) were traced to the Angular source and checked
against the current code on 2026-09-26: `docs/bugs/bugsnag.md`. It ranks the most common errors,
lists which are fixed, and describes the ones still present, some of them sweep bugs that turned
out to be far more common than their rating. The top one is auto fix throwing on a subpath that's
only a move (PATH-9, 13,000 events).

## Fixed during the migration

- Flattening a group set every stroked child's width to `1 / scale` (so a width of 3 in an
  untransformed group became 1), because `l.strokeWidth * scaleFactor ? 1 / scaleFactor : 0`
  was missing parentheses. It now scales the width like the path
  (`services/layertimeline.service.ts`).
- Grouping layers from different parents (Cmd+G) only removed them from the first layer's
  parent, so the others were left in place as well as moved into the new group, with the same
  ids.
- Every export except `.shapeshifter` threw when the root layer was hidden, because
  `LayerUtil.removeLayers` returned `undefined` for the root (despite its type). It now only
  removes descendants, and hiding the root exports an empty vector layer.
- R, B, and F threw in action mode when no subpath was selected, e.g. right after adding a point
  in Add points mode (`services/actionmode.service.ts`).
- Importing a malformed `.shapeshifter` file showed an error and then reset the workspace
  anyway (`services/fileimport.service.ts`).
- Google Analytics reported to a Universal Analytics property, which stopped accepting data
  in 2023. `trackEvent()` now sends GA4 events to `G-0NNYX18R3S`, only from
  `shapeshifter.design` (`scripts/analytics`).
- `ShortcutService.destroy()` removed every jQuery `keydown` handler on the window, not just its
  own. `ClipboardService.init()` could bind its handlers twice.
- Downloads left a hidden `<a>` element in the page for every exported file.
- Adding another animation from a property's "+" button in the layer list selected the new
  block, and then the click bubbled up to the workspace, which deselected it.
- Scroll groups are keyed by name, and the timeline zooms with the standard `wheel` event, so
  zooming now works in Firefox too.
- After editing the vector layer, the preview canvas briefly drew the un-animated layer instead
  of the layer at the current time.
- The layer timeline moved the current time to the start of the selected block (when entering
  action mode) before recording the new action mode, which could run twice. It was harmless
  only because setting the same time does nothing.
- The playback theme's disabled button selector had a typo (`[maticon-button]`) and never
  matched, and the dialog styles used an invalid `:mat-dialog-close` selector.
- The service worker didn't cache the Google Fonts stylesheets or the demos, so fonts and icons
  were missing offline and demos couldn't be loaded. Fonts and icons are now bundled, and the
  demos are precached.
- Undoing in action mode could crash with "Cannot read properties of undefined (reading
  'getSubPaths')". A path animation block's `fromValue` or `toValue` can be empty (e.g. after
  animating a path layer that has no path data yet), and `checkPathsCompatible` assumed both
  existed whenever the block wasn't animatable. Undo could restore such a state while the action
  mode canvases were still subscribed. Reported to Bugsnag from the 1.0.15 release
  (`scripts/actionmode/ActionModeUtil.ts`).
- The toolbar could crash with "Cannot read properties of undefined (reading 'fromValue')" in
  selection mode when no path block was selected. Also reported to Bugsnag from 1.0.15
  (`components/toolbar/ToolbarData.ts`).
- Batched playback changes were recorded in the undo history. The undo meta reducer wraps the
  batch meta reducer, so its filter only saw `__batch__BATCH`. For example, rewinding dispatches
  `BatchAction(SetCurrentTime, SetIsPlaying)`, which became an undo step.
- Actions that aren't recorded in the undo history (e.g. the current time changing on every frame
  of playback) still reset the one second timer that groups edits, so an edit made after
  playback could be merged into the edit made before it.
- Undo and redo could change the theme, since it's part of the recorded state (and then it no
  longer matched the saved preference).
- Imported stroke line joins used the line cap. `SvgLoader` read `strokeLinejoin` from
  `attrMap['strokeLinecap']`.
- Imported layers weren't named after their SVG ids. svgo's `cleanupIds` plugin removed every id
  that wasn't referenced before `SvgLoader` saw them, so imported layers ended up named `path`,
  `path_1`, and so on.
- Imported paths lost paint set on their groups. `SvgLoader` only read `fill`, `stroke`, and the
  other presentation attributes from the path itself, and svgo only moves a group's attributes
  onto its children in some cases (not when the group has more than one child). For example,
  Sketch exports put `fill-rule="evenodd"` on a group.
- `<use>` elements with an SVG 2 `href` weren't inlined. Only `xlink:href` was supported.
- Keyboard shortcuts still fired while a menu or dialog was open, so e.g. Backspace deleted the
  selected layers and Cmd+Z undid edits behind the dialog.
- The property panel crashed with "Cannot read properties of undefined (reading 'label')" when a
  layer had an invalid line cap, line join, fill type, or interpolator, e.g. from importing an SVG
  with the line join bug above. This was the most common error in Bugsnag, and files saved with
  those values crashed again when reopened. Invalid values are now replaced with the default
  (`model/properties/EnumProperty.ts`).
- Animation blocks for layers that no longer exist, or that can't animate the block's property,
  crashed rendering ("reading 'animatableProperties'") and exporting ("reading 'name'"). Exports
  only dropped blocks for hidden layers, not for the children of hidden groups. They're now
  ignored when rendering, exporting, pasting, and loading files.
- Colors that aren't Android colors (e.g. SVG names like 'red' from older files) crashed while
  animating, and entering 'none' in the property panel crashed. They're now converted when set
  (`model/properties/ColorProperty.ts`).
- Zooming in on a long animation made the timeline canvases too big to draw, which throws in
  Firefox ("Canvas exceeds max size").
- The property panel crashed if a selected layer or animation block no longer existed
  (`components/propertyinput/buildPropertyInputModel.ts`).
- The timeline froze the page when it was zoomed out far enough that even the largest grid
  interval was narrower than 40 pixels, e.g. a 60 second animation in a timeline narrower than
  about 90 pixels, because the loop that picks the interval never ended. A timeline narrower than
  its padding made the zoom negative, which froze it too
  (`components/layertimeline/TimelineGridRenderer.ts`).
- In pair subpaths mode, hovering over a subpath that was already paired stopped it from being
  drawn as paired afterward, since drawing removed it from the canvas's copy of the paired
  subpaths (`components/canvas/CanvasOverlay.ts`).
