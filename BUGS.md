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
- **Imported stroke line joins use the line cap.** `SvgLoader` sets `strokeLinejoin` from
  `attrMap['strokeLinecap']` instead of `attrMap['strokeLinejoin']`
  (`scripts/import/SvgLoader.ts`, where `strokeLinejoin` is declared).
- **Batched playback changes are recorded in the undo history.** The undo meta reducer wraps the
  batch meta reducer, so its `excludeAction` filter only ever sees `__batch__BATCH`. For example,
  rewinding dispatches `BatchAction(SetCurrentTime, SetIsPlaying)`, which becomes an undo step.
  UI-only state in the `paper` slice (cursor, hover, zoom) is recorded as well
  (`store/undoredo/metareducer.ts`).
- **Imported layers aren't named after their SVG ids.** `SvgLoader` names layers using each
  element's `id`, but svgo's `cleanupIds` plugin removes every id that isn't referenced before
  `SvgLoader` sees them, so imported layers end up named `path`, `path_1`, and so on.
  `SvgLoader.spec` only passes because its test id happens to be `path`
  (`scripts/svgo/index.ts`).
- **`<use>` elements with an SVG 2 `href` aren't inlined.** Only `xlink:href` is supported
  (`scripts/svgo/plugins/replaceUseElems.ts`).
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
