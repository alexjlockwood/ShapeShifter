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
- **Test gaps.** `SvgLoader`'s clip path test asserts nothing (`expect(true).toBe(true)`), and
  the layer and VectorDrawable loader specs were entirely commented out (and have been deleted).
- **Beta only (paper.js, not yet migrated):**
  - The tool panel template binds `model.isDefaultClick`, but the selector provides
    `isDefaultChecked`, so the select tool never shows as checked
    (`components/toolpanel/`, `store/paper/selectors.ts`).
  - `PaperProject.remove()` doesn't remove the `paper.Tool` it created, and paper.js only
    activates a new tool when none is active, so a remounted canvas keeps using the old tool
    (`scripts/paper/PaperProject.ts`). Not yet verified.

## Fixed during the migration

- Importing a malformed `.shapeshifter` file showed an error and then reset the workspace
  anyway (`services/fileimport.service.ts`).
- Google Analytics reported to a Universal Analytics property, which stopped accepting data
  in 2023. The calls are now a no-op `trackEvent()`.
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
