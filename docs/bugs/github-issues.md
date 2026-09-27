# GitHub issues triaged on 2026-09-26

On 2026-09-26 all 184 open issues on GitHub were checked against `master` (`c2d9f4a4`). They were
filed from 2017 to 2025 against the Angular app, so each one was checked against the current code
rather than taken at its word. Where an issue had an attached SVG, VectorDrawable, or
`.shapeshifter` file, it was run through the current code in a throwaway test (deleted afterward),
often side by side with the browser's own rendering. The rest were checked by reading the code, by
running the app, or for Android behavior, by reading the framework source. Paths are relative to
`src/app/modules/editor/`.

shapeshifter.design was last deployed on 2018-10-22 (1.0.15, commit `56ee03da`), so nearly every
issue listed as fixed below is only fixed on `master`. Close those after the next deploy, not
before. When a bug below is fixed, its issue can be closed the same way.

## Still bugs

### Import

- **A `<use>` of a `<use>` is lost when it comes before the `<defs>`.** Figma and other tools
  put `<defs>` at the end of the file. `replaceUseElems` takes its list of `<use>` elements up
  front, so an earlier `<use>` that points at a `<use>` in the `<defs>` clones it before it's
  replaced, and the clone is never expanded. `SvgLoader` skips `<use>`, so the shape imports as an
  empty group and the import still reports success. Expand clones recursively (with a cycle
  guard), or resolve references before replacing (`scripts/svgo/plugins/replaceUseElems.ts`).
  (GitHub #13, confirmed by a test)
- **Geometry set in CSS is dropped.** SVG 2 lets CSS set a shape's `r`, `cx`, `cy`, `rx`, `ry`,
  `x`, `y`, `width`, and `height`, and Chrome and Firefox draw it (WebKit doesn't). svgo's
  `convertStyleToAttrs` only moves presentation attributes out of `style`, so `convertShapeToPath`
  never sees them, and a circle whose radius comes from a rule like `circle { r: 0.1 }` imports as
  an empty `M x y Z` path. Move these properties from `style` into attributes before
  `convertShapeToPath` (`scripts/svgo/index.ts`). (GitHub #198, confirmed by a test. The 2017 reply
  on the issue called this unsupported SVG 1.1; the maintainer decided on 2026-09-26 to support
  it.)
- **SVGs with more than 512 character references fail to import.** svgo's XML parser (sax)
  gives up after 512 references like `&#10;` or `&#233;`, so an Inkscape SVG with an embedded image
  (whose base64 data is wrapped with `&#10;`) or a file with a lot of accented text fails with
  "Couldn't import layers from file", even when it has vector artwork next to the image. 500
  references import, and 520 fail. Remove `<image>` elements, or decode references in attribute and
  text values, before calling svgo, or catch the error and parse without svgo
  (`scripts/svgo/index.ts`). (Found while triaging GitHub #359, confirmed by a test)
- **Imports drop the intrinsic size, so exports use the viewport size in dp.** A VectorDrawable
  with `android:width="108dp"` and `android:viewportWidth="432"`, as Android Studio writes for
  adaptive icons and splash screens, exports at 432dp, and a Material Symbols SVG (`width="24"
viewBox="0 -960 960 960"`) exports as a 960dp VectorDrawable. The vector layer has one size for
  both, and changing it resizes the viewport, cropping the artwork instead of scaling it. Keep the
  imported width and height apart from the viewport, and export both
  (`scripts/import/VectorDrawableLoader.ts`, `scripts/import/SvgLoader.ts`,
  `scripts/export/AvdSerializer.ts`). (GitHub #362, confirmed by a test. The report is vague, and
  this is its most likely reading.)
- **VectorDrawable `android:tint` is ignored.** A Vector Asset Studio icon with
  `android:tint="#FFFFFF"` and `android:fillColor="#FF000000"` imports black, while Android draws
  it white. Apply the tint to the fill and stroke colors on import (a tint mode of `src_in`,
  Android's default, replaces the color and keeps the alpha)
  (`scripts/import/VectorDrawableLoader.ts`). Keeping the tint as a property is the feature request
  in GitHub #139. (Found while triaging GitHub #342, confirmed by reading and a test import)
- **VectorDrawable gradients import with no fill, silently.** A fill given as an `<aapt:attr>`
  holding a `<gradient>`, as Android Studio writes, imports as a path with no fill, exports without
  it, and the import reports success. Until gradients are supported (GitHub #144), fall back to a
  solid color from the gradient and warn (`scripts/import/VectorDrawableLoader.ts`). SVG gradients
  import as black instead, which is MODEL-5. (Found while triaging GitHub #144, confirmed by a
  test)
- **Dropping a mix of SVG and VectorDrawable files silently does nothing.** The drop handler
  returns early unless every file has the same MIME type, so nothing imports and no message
  appears. Import each file with its own loader, or at least show a snackbar
  (`components/root/Root.tsx`). (Found while triaging GitHub #307, confirmed by reading)

### Export

- **AVD exports don't hold a property's value before its first block, so delayed animations
  misbehave on Android.** The export writes one animator per block and nothing before a
  property's first block, and Android handles that differently from the preview in three ways. On
  Android 7 and later, a property whose first block starts after 0 shows that block's `valueFrom`
  from the start (MODEL-4). Before Android O, a restarted `AnimatorSet` doesn't reset its delayed
  animators, so on a replay they keep the previous run's end values until their delay passes. On
  Android 6 and earlier, every animator in a `<set>` after the first also waits for the first
  one's `startOffset`, so they all run late by that much. The exported offsets are right, but the
  animation doesn't match the preview on those devices. For each animated property, write a
  zero-duration `objectAnimator` at `startOffset` 0, first in its target's `<set>`, holding the
  value the preview shows at t=0. That's what the reporters of #306 and #316 did by hand
  (`scripts/export/AvdSerializer.ts`). (GitHub #306, #317, #222, and #316, confirmed by the
  reporters' files and by reading AOSP's `AnimatorSet`, `ValueAnimator`, and
  `PropertyValuesAnimatorSet`)
- **SVG and spritesheet exports draw a stray dot on round-capped trimmed paths.** When
  `trimPathStart` equals `trimPathEnd`, the export writes a `0,L` dash array instead of leaving
  the stroke out, and a zero-length dash with a round or square cap paints a dot that the preview
  and Android don't draw. The dash period is also exactly the path length, without the small gap
  padding the canvas adds, and svgo rounds `stroke-dashoffset` but not `stroke-dasharray` in
  sprites, so on some frames the pattern restarts at the path's start and shows a dot there. Skip
  the stroke when nothing is visible, and pad the gap like the canvas does
  (`scripts/export/SvgSerializer.ts`). (GitHub #285, confirmed by a test)

### Canvas and action mode

- **Reversing or shifting a subpath replaces its closing `Z` with a line.** Reverse, shift, and
  split turn a trailing `Z` into an `L`, under a TODO that says it breaks line joins. Auto fix
  reverses and shifts subpaths, so after it runs a closed stroked path has no `Z`, even when the
  two paths were already morphable. The corner at the start point is then drawn with two line caps
  instead of a join: a notch with butt caps, and a bump with round or square caps. The exported
  path data has no `Z` either. Keep the `Z` (or add it back when both subpaths ended in one)
  instead of converting it to `L` (`model/paths/Path.ts`, `reverseCommands`, `shiftCommands`, and
  `reverseAndShiftCommandStates`, and `scripts/algorithms/AutoAwesome.ts`). (GitHub #34 and #201,
  confirmed by a test. The fill glitch #201 first reported is fixed.)
- **Auto fix can change how `nonZero` fills render.** Auto fix tries reversing each subpath when
  lining the paths up, and then makes every pair of closed subpaths run the same direction. With
  the default `nonZero` fill type a subpath's direction decides whether it's a hole, so when a pair
  winds opposite ways, one end of the morph changes: a solid square with a clockwise inner square
  gains a hole at the start of the block. Auto fix doesn't know the fill type. It could avoid
  reversals that change the winding of a `nonZero` fill, or switch the layer to `evenOdd` when that
  renders both paths the same (`scripts/algorithms/AutoAwesome.ts`, `getAlignmentCandidates` and
  `permuteSubPath`). (GitHub #31, confirmed by a test)
- **Action mode points at or past the viewport edge are cut off.** The overlay canvas that draws
  the points is exactly the size of the viewport, so a point on the edge shows as half a circle,
  and a point outside it (e.g. from an SVG whose content extends past its viewBox) isn't drawn and
  can't be clicked. Give the overlay canvas a margin of a point radius or more around the viewport,
  or clamp the drawn points into view (`components/canvas/CanvasOverlay.ts`, `onDimensionsChanged`
  and `drawLabeledPoints`). (GitHub #57 and #274, confirmed by reading)
- **Subpaths inside other subpaths can't be selected or paired if they come first.** Clicking a
  filled subpath hits every subpath whose outline contains the point, and the selection and pair
  helpers pick the one with the highest index. A small subpath that comes before the shape around
  it, like the rectangle inside the P of the issue's "PIN" icon, can never be picked, since
  fill-only paths have no segment tolerance either. Prefer the innermost hit (e.g. the smallest
  area) instead of the last (`components/canvas/SelectionHelper.ts` and
  `components/canvas/PairSubPathHelper.ts`, `findHitSubPath`; see also PATH-17). (GitHub #119,
  confirmed by a test)
- **Stacked points can't be told apart or picked in action mode.** When several commands end at
  the same spot (a closing `Z` after a segment that already returns to the start, or the
  zero-length segments auto fix adds), the canvas draws the lowest numbered label on top, but
  hovering picks the highest numbered hit, so the label jumps (e.g. from 1 to 6) and the points in
  between can never be hovered or selected, e.g. to set a first point or delete a split point. The
  choice between stacked commands also decides which half of a split filled subpath keeps the
  zero-length segment, so one half can need an extra point and the other not
  (`components/canvas/CanvasOverlay.ts`, `drawLabeledPoints`, and
  `components/canvas/SelectionHelper.ts`, `findHitPoint`). (GitHub #313, confirmed by a test)
- **Ordinary points show a pointer cursor in action mode but can't be clicked.** Hovering any
  point enlarges it, labels it, and shows the pointer cursor, but clicking a point that isn't a
  split point does nothing, not even selecting its subpath. Either don't set a point hover (or the
  pointer) for them, or let them be selected, which GitHub #176 asks for
  (`components/root/Root.tsx`, `getCursorClassName`, and `components/canvas/SelectionHelper.ts`,
  `onMouseDown`). (GitHub #175, confirmed by reading)

### Timeline and UI

- **Scrolling the layer list or timeline rows barely moves them in most browsers.** A wheel
  notch or arrow key scrolls only a pixel or two on Windows and Linux, and in Firefox. The two
  panes sync their scroll positions, and each sync fires a scroll event on the other pane that
  writes its one-frame-old position back, which cancels the smooth scroll. A smooth scroll by 400px
  ends at 2px in Chromium and 11 to 84px in Firefox and WebKit. macOS trackpads don't animate
  scrolling, which is probably why it went unnoticed. Skip the write-back when the value already
  matches, or ignore the scroll event caused by the sync (`hooks/useScrollGroup.ts`). Both panes
  also hide their vertical scrollbars in CSS (`components/layertimeline/layertimeline.scss`), which
  #324 asks to change. (GitHub #220 and #324, medium, confirmed by a test in three browsers)
- **Adding an animation block that doesn't fit silently does nothing.** When a property has no
  gap of 100 ms left, "Animate this layer", the "+" button, and pasting a block only log a warning,
  and the duration stays the same. Lengthen the animation to fit the block, as the issue asks, or
  at least show a snackbar (`services/layertimeline.service.ts`, `addBlockToAnimation`). A failed
  paste also records an undo step (STORE-12). (GitHub #262, confirmed by a test)
- **The layer list's and timeline's property rows don't fade when the theme changes.** Switching
  between the light and dark themes fades the panels over 200 ms, but the rows under each animated
  layer change color at once. The rows' `.slt-properties` backgrounds don't get the
  `ss-theme-transition` class (`components/layertimeline/_timelineanimationrow-theme.scss`,
  `components/layertimeline/_layerlisttree-theme.scss`). (GitHub #167, low, confirmed in the app.
  The issue has no body, and this is its most likely reading.)

### Offline and PWA

- **Phones install the service worker and precache the whole app.** Mobile browsers only get the
  splash screen, but the service worker is still registered, so it downloads and keeps about 2 MB
  (52 files: the bundle, every font subset, and the demos) that the phone can't use. Skip
  `registerSW` for the same user agents that get the splash screen (`src/main.tsx`,
  `components/root/Root.tsx`). (GitHub #205, low, confirmed by reading and a production build)

## Not decided yet

- **#168: paths that are both stroked and filled, in split subpaths mode.** Such a path is split
  like a filled one, which adds a pair of split segments, and the stroke draws them as a visible
  seam across the shape. The segment splitter used for stroke-only paths would leave the fill
  wrong instead. It could be split like a filled path (seam visible), like a stroked path (fill
  wrong), or the mode could be disabled or warn for these paths
  (`components/canvas/CanvasOverlay.ts`). The other half of the issue, the canvas drawing the
  stroke under the fill, is CANVAS-1.

## Already documented

These are still bugs, and the entry named here covers them.

| Issue | Entry                                                                                       |
| ----- | ------------------------------------------------------------------------------------------- |
| #113  | CANVAS-9 (a dropped point snaps back). The drag preview half is fixed.                      |
| #118  | IMP-6 (SVGs without `xmlns`)                                                                |
| #169  | MODEL-3 (importing a larger SVG doesn't rescale blocks), matched from the video's thumbnail |
| #181  | IMP-2 (element `opacity` is ignored)                                                        |
| #184  | MODEL-7 and UI-13 (typing an end time commits every keystroke, and inverted times swap)     |
| #185  | MODEL-9 (bounds of rotated groups)                                                          |
| #186  | `BUGS.md` "The editor draws strokes in scaled groups at the wrong width", and CANVAS-3      |
| #224  | MODEL-5 (gradients import as black). Gradient support itself is #144.                       |
| #249  | CANVAS-5 (rulers show CSS pixels)                                                           |
| #257  | EXP-1 (empty `android:pathData`)                                                            |
| #286  | CANVAS-1 (stroke drawn under the fill)                                                      |
| #292  | `BUGS.md` stroke width entry and CANVAS-4. Its "expected" screenshot shows EXP-2.           |
| #297  | IMP-4 (a `<clipPath>` outside `<defs>`) and IMP-9 (a `<use>` target outside `<defs>`)       |
| #305  | IMP-5 (fractional viewBox sizes are truncated)                                              |
| #308  | `BUGS.md` stroke width entry and CANVAS-4 (trim length in scaled groups)                    |
| #316  | MODEL-4, which the AVD hold animator entry above fixes                                      |
| #332  | UI-5 ("Convert to clip path" disappears)                                                    |

## Fixed, close after the next deploy

| Issue      | What fixed it                                                                               |
| ---------- | ------------------------------------------------------------------------------------------- |
| #24        | svgo's `removeXMLProcInst` strips the XML declaration                                       |
| #39        | A width and height without a viewBox import at that size                                    |
| #40        | Viewports only need to be 1 unit wide now, and a `0 0 1 1` viewBox imports as 1x1           |
| #41        | `VectorLayer` defaults to 24x24                                                             |
| #125       | `Point` is a plain interface, and `MathUtil.arePointsEqual` handles missing points          |
| #127       | Clicking empty canvas in a split or add points mode returns to selection mode               |
| #129       | Auto fix has unit tests and a playground (`src/playground/autofix/`)                        |
| #188       | Flattening transforms both the from and to values of path blocks                            |
| #264       | `629387af`                                                                                  |
| #265       | `5af30cf7` and `03d1a813`                                                                   |
| #266, #284 | `7d0b789a`. Dropping a file in action mode (#284) now shows a message instead.              |
| #269, #282 | `7ae9d739` and `1f78c126`                                                                   |
| #270, #281 | `fc991051`                                                                                  |
| #275       | `352a0aaa`                                                                                  |
| #276       | `d8eabc32`                                                                                  |
| #277       | `b4c5fd9a`                                                                                  |
| #278       | Groups' `fill="none"` is inherited (`BUGS.md`, "Imported paths lost paint set on groups")   |
| #280       | `e4a994cd` and `7e5b2480`. The maintainer's repro in the thread passes.                     |
| #283       | `7ae9d739` and `707764f0`                                                                   |
| #291       | The theme switch is an MUI `Switch` now, and clicking it works in Chrome                    |
| #293       | Rewritten auto fix. The attached paths weren't identical, and the result keeps both shapes. |
| #301       | The preview draws the animated layer at t=0 (`BUGS.md`, "Fixed during the migration")       |
| #320       | Ids are kept, so paths with ids stay separate layers. Paths without ids still merge.        |
| #339       | `fc991051`. The reporter's file exports in all four formats.                                |
| #357       | Renders the same as the browser now. The fixing commit wasn't pinned down.                  |

## Fixed or implemented before the 2018 deploy, close any time

- #54: SVG spritesheet export exists (Export > SVG spritesheet).
- #163: the empty layer list says to drop an SVG (`06f9dd29`, 2017).
- #170: SVG export skips paths without path data (`60f0104c`, 2018).
- #231: Cmd+C then Cmd+V duplicates the selected blocks (2017). It's hard to discover (#148).

## Not bugs

| Issue | Verdict             | Reason                                                                         |
| ----- | ------------------- | ------------------------------------------------------------------------------ |
| #70   | Obsolete            | The lag came from Angular change detection                                     |
| #72   | Can't reproduce     | WebKit imports and draws the file the same as Chromium                         |
| #92   | Not actionable      | A vague 2017 performance note, with no measured problem                        |
| #171  | Working as intended | Pivots are Android's `pivotX` and `pivotY`, in the group's own coordinates     |
| #215  | Can't reproduce     | Leaving out `fillAlpha="1"` matches Android's default of 1                     |
| #259  | Can't reproduce     | Changing the duration from 300 to 3000 costs about 44 ms                       |
| #314  | Working as intended | A `Z` after a curve that already returns to the start is a zero-length segment |
| #319  | Obsolete            | IE and legacy Edge only                                                        |
| #323  | Can't reproduce     | Both attached SVGs import correctly in Firefox and Chromium                    |
| #327  | Beta only           | The current importer handles the icon                                          |
| #328  | Not enough info     | Title only. 1,000 groups import in about 3 s in a dev build without hanging.   |
| #330  | Obsolete            | Legacy Edge only                                                               |
| #336  | Beta only           | No file attached                                                               |
| #342  | Beta only           | The current importer handles it, apart from the `android:tint` entry above     |
| #343  | Beta only           | The beta couldn't draw paths with several subpaths                             |
| #346  | Obsolete            | The reporter's spritesheets play in current Firefox                            |
| #349  | Not enough info     | The exported timing is right. Probably CANVAS-7.                               |
| #351  | Beta only           | The preview and SVG export already clip only later siblings, like Android      |
| #354  | Working as intended | Import bakes the layer transform into the path, unlike Inkscape's own `d`      |
| #355  | Beta only           | Arrow key nudging is planned, but locking layers isn't                         |

#314 is worth a reply explaining the zero-length segment, since the reporter has asked about it
since 2018. "Beta only" means the paper.js beta, which isn't compiled any more.

Duplicates: #190 of #187, #242 of #115, #274 of #57, #282 of #269, #284 of #266, #309 of #149,
#310 of #245, #324 of #220, #335 and #361 of #333, and #352 of #8.

Questions and other issues with nothing to fix: #131, #187, #190, #312, and #325 (answered in their
threads), #334 (a request for Android Studio), #340 (abusive, no content), #359 (a PNG wrapped in
an SVG, which the reporter worked out; it led to the character reference entry above), and #363
(an Open Source Collective email for the maintainer).

## Feature requests

"Planned" means `docs/canvas-editor.md` has it on its roadmap. Sizes are rough.

| Issue | Request                                  | Status                                                                    |
| ----- | ---------------------------------------- | ------------------------------------------------------------------------- |
| #1    | Snap to grid when dragging points        | Planned                                                                   |
| #8    | Import AVDs (also #347)                  | In `IMPROVEMENTS.md`. AVDs import as groups, without animation (IMP-13).  |
| #9    | Run auto fix in a web worker             | Auto fix was sped up (`c9b356ce`), but there's no worker                  |
| #17   | Keyboard navigation of points            | In `IMPROVEMENTS.md`. Tab between points is planned.                      |
| #19   | Lottie export                            | Not implemented, 1 to 2 weeks. The likely iOS export (`IMPROVEMENTS.md`). |
| #36   | Revert all splits and conversions        | `PathMutator.revert()` exists, but nothing in the UI calls it             |
| #63   | Morph a stroke into a fill               | Not implemented                                                           |
| #86   | Limit the number of splits               | Not implemented, and nothing shows it's needed                            |
| #89   | Import `<glyph>`s                        | Not implemented. The scaling bug from the thread is fixed.                |
| #95   | Reject invalid split subpaths            | Not implemented                                                           |
| #98   | Shift to constrain the split line        | Not implemented                                                           |
| #102  | Marquee selection on the canvas          | Planned                                                                   |
| #105  | Usage instructions in the README         | Not done                                                                  |
| #106  | Open in CodePen                          | Not implemented, better after a CSS keyframes export                      |
| #108  | Highlight the halves of a stroke split   | Not implemented                                                           |
| #115  | GIF export (also #242)                   | Not implemented, 1 to 3 days                                              |
| #116  | Export options dialog                    | Not implemented (fixed 30 and 60 fps, viewport size)                      |
| #120  | Choose where collapsing subpaths go      | Not implemented (TODO in `AutoAwesome.ts`)                                |
| #126  | Enter split subpaths mode from a point   | Not implemented                                                           |
| #130  | Snap dragged points to other points      | Planned                                                                   |
| #133  | Arrow keys in the layer list             | Not implemented                                                           |
| #134  | Golden render tests                      | Pixel probes only                                                         |
| #135  | Color picker                             | Not implemented                                                           |
| #136  | Draw paths with the mouse                | Planned                                                                   |
| #137  | Accounts, saving, and sharing            | `?project=<url>` opens a shared file. No accounts.                        |
| #138  | Theme attributes as colors               | Not implemented                                                           |
| #139  | `android:tint` on the vector             | Not implemented (see the import entry above)                              |
| #140  | `android:repeatCount`                    | Only a preview repeat toggle                                              |
| #141  | AnimatedStateListDrawable export         | Not implemented. The maintainer doubted it in the thread.                 |
| #142  | Facebook Keyframes export                | Obsolete: Keyframes is archived. Could be closed.                         |
| #143  | Copy and paste blocks and layers         | Blocks work. Layers are #245.                                             |
| #144  | Gradients                                | In `IMPROVEMENTS.md`                                                      |
| #146  | Motion along a path                      | Not implemented                                                           |
| #147  | Custom path interpolators                | Not implemented                                                           |
| #148  | Keyboard shortcuts list                  | In `IMPROVEMENTS.md` (quick wins)                                         |
| #149  | Marquee select in the timeline (#309)    | Not implemented                                                           |
| #150  | Zoom and pan the canvas                  | Planned                                                                   |
| #151  | AVD XML cleanups                         | 2 of 5 done                                                               |
| #158  | SVG `<mask>`                             | Not implemented. Masks are ignored silently.                              |
| #159  | Open `.iconanim` files                   | Not implemented. The sample links are dead.                               |
| #162  | Export a reversed animation              | Not implemented                                                           |
| #172  | Say that colors are `#AARRGGBB`          | Not done                                                                  |
| #176  | Set the first point on any point         | The toolbar supports it, but only split points can be selected (#175)     |
| #177  | Save split points in project files       | Not implemented. Saved files lose them.                                   |
| #191  | Export for a JS tweening library         | Not implemented. Too specific; could be closed.                           |
| #195  | List pairing and splitting in the README | Not done                                                                  |
| #196  | Import Sketch files                      | Not implemented                                                           |
| #197  | Import a folder of SVGs                  | Several files import at once. One animation per project (#254).           |
| #209  | Timeline upgrades                        | Copy and paste done. No drag autoscroll, no marquee (#149).               |
| #214  | `animation-list` export                  | Not implemented, niche                                                    |
| #219  | Reverse and shift a path without a morph | Not implemented                                                           |
| #226  | Copy and paste across tabs               | Blocks work. Layers are #245.                                             |
| #228  | Command line conversion                  | Not implemented                                                           |
| #229  | Showcase of projects                     | Demos and `?project=` exist. No gallery.                                  |
| #232  | Move paths on the canvas                 | Planned                                                                   |
| #245  | Copy and paste layers (also #310)        | Not implemented                                                           |
| #246  | Hide animation blocks                    | Not implemented                                                           |
| #254  | More than one animation                  | Not implemented, 1 to 2 weeks                                             |
| #271  | Open files from the desktop              | By URL, drop, or File > Open, but not as a file handler                   |
| #279  | Offer to reload after an update          | Updates apply on the next load. No snackbar.                              |
| #289  | Show that Backspace deletes layers       | Not done                                                                  |
| #290  | Show the exported XML in the page        | Not implemented                                                           |
| #298  | Red toolbar for incompatible paths       | Flagged in the subtitle, canvas, and timeline, but the toolbar isn't red  |
| #302  | Optimize imported VectorDrawables        | Not implemented (redundant moves are kept)                                |
| #304  | Animate transforms on paths              | Works by grouping the path                                                |
| #307  | Bulk import                              | Several files import at once (see the mixed drop entry above)             |
| #315  | Export one animated SVG                  | Not implemented (see CSS keyframes in `IMPROVEMENTS.md`)                  |
| #318  | Flutter export                           | Not implemented. Lottie would cover it.                                   |
| #322  | CSS keyframes export                     | Not implemented, but wanted (`IMPROVEMENTS.md`)                           |
| #326  | Show the pivot on the canvas             | Not implemented                                                           |
| #329  | Auto fix as a package                    | Not implemented                                                           |
| #331  | Duplicate layers and snap to a grid      | Planned                                                                   |
| #333  | iOS export                               | Not implemented, but wanted (`IMPROVEMENTS.md`)                           |
| #338  | Keyframes between from and to            | Back-to-back blocks do most of it                                         |
| #348  | Jetpack Compose `ImageVector` code       | Not implemented                                                           |
| #356  | Gaussian blur                            | VectorDrawables can't blur. Could be closed.                              |
| #358  | Reverse a path                           | Only in action mode. `trimPathStart` from 1 to 0 draws it backward.       |
| #360  | Canvas background color                  | Not implemented. The canvas is always white.                              |
