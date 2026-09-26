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
  reports a warning (`model/paths/Path.ts`, `deleteFilledSubPathSegmentInternal`).
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
    (`scripts/paper/PaperProject.ts`). Not yet verified.

## Found by the bug sweep

An automated bug sweep on 2026-09-25 found these. Most were reproduced with a throwaway test. The
rest were confirmed by reading the code (PATH-17, STORE-14, STORE-15, MODEL-4, MODEL-8, IMP-13,
EXP-7, CANVAS-11, UI-13, UI-16, CFG-5, and CFG-6), and IMP-14 is only plausible. None of them are
triaged yet. Each entry ends with its sweep id, severity, and confidence. The ids that are skipped
belong to bugs from the same sweep that are being fixed separately. Two entries have no id, since
they were found after the sweep, and their tags say how each was confirmed.

### Path model

- **Reversing a split-off piece of a command draws the wrong geometry.** Split a subpath in the
  middle of a segment, reverse one half, and split that half again: the new segments jump onto
  other parts of the original command. `reverse()` maps split times with `lerp(maxT, minT, t)`,
  which is only right for an unsliced command. Map each t to `1 - t` and flip the range instead
  (`model/paths/CommandState.ts`, `reverse`). (PATH-1, high, confirmed by a test)
- **Splitting a subpath reorders the other subpaths.** Once pairing subpaths or auto fix has
  reordered a path's subpaths, splitting one of them moves the others, so the morph silently pairs
  the wrong shapes. The new subpath's index is appended to the ordering, but the subpath is inserted
  right after the one that was split. Increment every entry above the split subpath's index, then
  insert the new index next to its entry (`model/paths/Path.ts`, `splitStrokedSubPath` and
  `splitFilledSubPath`). (PATH-2, high, confirmed by a test)
- **"Split in half" on an already split curve splits in the wrong place.** On a curve that already
  has a split point, "Split in half" and its hover preview add the point off center, sometimes on
  the neighboring segment. It passes the midpoint in t to `findTimeByDistance`, which expects a
  fraction of the arc length, so it should average the ends' arc length fractions instead
  (`model/paths/CommandState.ts`, `splitInHalfAtIndex`). (PATH-4, medium, confirmed by a test)
- **`isClockwise` can't tell the direction of line segments, so auto fix twists polygons.** A
  square and its reversal are both reported as clockwise, so auto fix reverses polygons it
  shouldn't (or misses ones it should), and they turn inside out during the morph. Most icons are
  made of lines. For `L` and `Z`, `getArea` uses a term that doesn't change sign when the segment
  is reversed, and should use the shoelace term (`model/paths/PathState.ts`, `getArea`). (PATH-5,
  medium, confirmed by a test)
- **Auto fix reverses open subpaths.** Auto fix can reverse an open line or arc, so the stroke
  flips end over end during the morph. `permuteSubPath` compares orientation even for open
  subpaths, where `alignSubPath` has already chosen the direction, and should only compare it when
  both are closed (`scripts/algorithms/AutoAwesome.ts`). (PATH-6, medium, confirmed by a test)
- **Splitting a stroked subpath at its first or last point makes a degenerate subpath that later
  crashes.** In split subpaths mode, clicking the start or end point of a stroked subpath adds an
  empty subpath, and auto fix or the next action mode edit then throws. `SegmentSplitter` should
  ignore those points, and `splitStrokedSubPath` should reject them with a warning
  (`components/canvas/SegmentSplitter.ts`, `model/paths/Path.ts`). (PATH-7, medium, confirmed by a
  test)
- **Deleting the start point of a reversed, shifted subpath throws.** Split a segment of a closed
  subpath, make the new point the first point, reverse the subpath, and delete the point: it
  throws from the keydown handler and nothing changes. For a reversed subpath the removed index is
  `splitIdx - 1`, but the shift is still computed from `splitIdx` (`model/paths/Path.ts`,
  `unsplitCommand`). (PATH-8, low, confirmed by a test)
- **`CommandState.getPathLength` ignores `minT` and `maxT`.** A split piece of a command reports
  the length of the whole command. Trim paths use it, so a trimmed stroke on a morph with a split
  subpath gets the wrong dashes at the start and end of the block, in the preview and in SVG and
  spritesheet exports. Measure `calculator.split(minT, maxT)` instead
  (`model/paths/CommandState.ts`, `getPathLength`). (PATH-10, low, confirmed by a test)
- **`PathState.getPathLength` and `getPointAtLength` only see the tree roots.** Once a subpath is
  split, both give wrong answers, and `getPointAtLength` also ignores reversal and shifting. Only
  `model/paths/Path.spec.ts` and the uncompiled paper.js beta call them. Iterate the visible
  subpaths instead of the roots (`model/paths/PathState.ts`). (PATH-11, low, confirmed by a test)
- **`deleteStrokedSubPath` throws when the sibling was split again (latent).** Split a stroked
  subpath, split one half again, and delete the other half: `buildOrderedCommands` throws. It's
  unreachable while split subpaths can't be deleted (see "Open"). Remove the ordering entries of
  every leaf under the parent, as `calculateDeletedSubIdxs` does (`model/paths/Path.ts`,
  `deleteStrokedSubPath`). (PATH-12, low, confirmed by a test)
- **Arcs with zero or negative radii are misparsed.** An arc with a zero radius is dropped instead
  of drawn as a line, and a negative radius bulges the wrong way, so typed or pasted path data,
  VectorDrawables, and `.shapeshifter` files lose segments. Android's parser does the same, so
  only SVG exports differ from browsers. Use the radii's absolute values, and draw a line when
  either is 0 (`model/paths/PathParser.ts`, `drawArc`). (PATH-13, low, confirmed by a test)
- **Tabs, newlines, and `+` aren't treated as number separators.** Path data like `L 10\n10`, typed
  into the property panel or in a hand-edited file, parses to `NaN` coordinates, and `5+5` loses
  its second number. Treat all SVG whitespace as separators, and `+` too when it doesn't follow an
  `e` (`model/paths/PathParser.ts`, `extract`). (PATH-14, low, confirmed by a test)
- **Degenerate "spike" curves are treated as zero-length lines.** A curve that starts and ends at
  the same point but has other control points, like `M 0 0 C 10 10 10 10 0 0`, is treated as a
  point: the bounding box misses it, "Split in half" collapses it, and auto convert can flatten it.
  Only treat a curve as a point when all of its points coincide
  (`model/paths/calculators/Calculator.ts`, `newCalculator`, and `model/paths/Command.ts`,
  `canConvertTo`). (PATH-16, low, confirmed by a test)
- **Filled subpaths without a closing `Z` can't be clicked by their fill.** Fills close
  implicitly, but the shape hit test skips subpaths that aren't closed, so a click inside the fill
  misses the layer. Each subpath is also tested alone with the even-odd rule, ignoring the fill
  type and holes. Treat filled subpaths as closed and test the whole path with its fill rule
  (`model/paths/PathState.ts`, `hitTest`). (PATH-17, low, confirmed by reading)
- **Reversing or shifting the first subpath drops a trailing lone `M`.** A path that ends with a
  subpath that's only an `M` loses it when the subpath before it is reversed or shifted, since
  that subpath is rebuilt ending in an `L` instead of a `Z`. Auto fix's `orderSubPaths` moves lone
  `M`s to the end, so `autoFix` on `M 5 5 M 0 0 L 10 0 L 10 10 Z` and a two-subpath target throws
  "Subpath index out of bounds". Parsing drops it too: `M 0 0 L 10 0 M 5 5` has one subpath.
  `createSubPaths` ends an open subpath at the next `M` but doesn't start the next subpath with it,
  and should (`model/paths/SubPath.ts`, `createSubPaths`, and `scripts/algorithms/AutoAwesome.ts`,
  `alignSubPath`). (found after the sweep, low, confirmed by a test)

### Store and services

- **Undo and redo overwrite playback and action mode state.** Playback and action mode changes
  aren't undo steps, but they're part of every snapshot, so undo restores them too: it can start
  playback, turn off repeat and slow motion, move the time cursor, or enter or leave action mode.
  Carry the playback slice over like the theme, and keep action mode only if the restored state
  selects the same path block (`store/undoredo/metareducer.ts`). (STORE-1, medium, confirmed by a
  test)
- **The first action of a burst becomes its own undo step.** After dragging a block or typing a
  name, the first undo only goes back to the first drag event or keystroke, so it takes two. When
  the grouping window has expired, `groupBy` returns `undefined`, so the next action starts
  another step. Increment the counter and return it, and update `store/createEditorStore.spec.ts`,
  which asserts the current behavior (`store/undoredo/metareducer.ts`, `groupBy`). (STORE-2,
  medium, confirmed by a test)
- **Cut in action mode deletes the block being edited, then every edit throws.** In action mode,
  Cmd+X deletes the path block being edited without leaving action mode, and then R, B, F, A, and
  Backspace throw. Cut should only copy (or do nothing) in action mode, and callers of
  `getActivePathBlock()` should bail out when there's no block (`services/clipboard.service.ts`,
  `services/actionmode.service.ts`). (STORE-3, medium, confirmed by a test)
- **Ungroup drops the group's transform and leaves its blocks and hidden state behind.**
  Ungrouping a translated, rotated, or scaled group moves its children without the transform, so
  the artwork jumps. The group's blocks are orphaned, and its id stays in the hidden set, so
  ungrouping a hidden group shows its children. Apply the transform to the children (as
  `flattenGroupLayer` does, which has its own problems in MODEL-1 and STORE-14), run
  `buildCleanupLayerIdActions`, and hide the children instead
  (`services/layertimeline.service.ts`, `groupOrUngroupSelectedLayers`). (STORE-5, medium,
  confirmed by a test)
- **Clipboard handlers ignore open menus and dialogs, and block native copy.** Cmd+X deletes the
  selected block behind an open menu, and paste works behind a dialog. Cmd+C with no blocks
  selected cancels the browser's copy, so page text can't be copied. Add the checks the shortcut
  service uses, and return true when there's nothing to copy (`services/clipboard.service.ts`).
  (STORE-7, low, confirmed by a test)
- **Pasting JSON with a malformed `blocks` field throws.** Pasting `{"blocks": {"a": 1}}` or
  `{"blocks": [null]}` throws an uncaught `TypeError`, reported to Bugsnag. Check `Array.isArray`,
  and drop blocks that `AnimationBlock.from` can't read (`services/clipboard.service.ts`).
  (STORE-10, low, confirmed by a test)
- **Pairing subpaths gets the paired set and the selection wrong.** After a few pairings the wrong
  subpaths are drawn as paired, and the selection can move to another subpath, so R, B, and F act
  on the wrong one. The code assumes the paired subpaths come first, and ignores that
  `moveSubPath(i, 0)` shifts every index below i. Remap both (`services/actionmode.service.ts`,
  `pairSubPath`). (STORE-11, low, confirmed by a test)
- **No-op commands record empty undo steps.** Backspace with nothing selected, Cmd+Shift+G with
  only paths selected, and pasting blocks that can't be added each record an undo step, because
  the reducers always build new Sets. The last two also clear the selection. Return early when
  there's nothing to do (`services/layertimeline.service.ts`, `deleteSelectedModels`,
  `groupOrUngroupSelectedLayers`, and `addBlocks`). (STORE-12, low, confirmed by a test)
- **Undoing the first edit after loading a project resets the timeline zoom.** Load a project,
  zoom the timeline, make an edit, and undo it: undo restores `isBeingReset`, so the timeline zooms
  to fit again. redux-undo doesn't run the slice reducers on undo, so clear the flag in the undo
  meta reducer, next to the theme, or remove it as its TODO in `store/reset/reducer.ts` suggests
  (`store/undoredo/metareducer.ts`). (STORE-13, low, confirmed by a test)
- **Flattening a group doesn't scale stroke width blocks.** Flattening a scaled group scales a
  child path's stroke width but not its `strokeWidth` blocks, so the animated width changes. Scale
  the block values by the same factor (`services/layertimeline.service.ts`, `flattenGroupLayer`).
  (STORE-14, low, confirmed by reading)
- **Converting to or from a clip path, and importing into an empty workspace, lose per-layer
  state.** Converting gives the layer a new id without its hidden, collapsed, and selected state,
  so a hidden path becomes visible. Importing into an empty workspace replaces the root's id,
  which orphans blocks on the root. Carry the old ids over (`services/layertimeline.service.ts`,
  `swapLayers` and `importLayers`). (STORE-15, low, confirmed by reading)
- **A zero-length path block shows its from path on the end canvas.** Give a path block the same
  start and end time and enter action mode: the end canvas shows the from path, and edits there
  may write it into the to value. The selector compares the time with the block's start time, and
  should take an explicit from or to flag instead (`store/actionmode/selectors.ts`). (STORE-16,
  low, confirmed by a test)
- **`createDeepEqualSelector` deep-compares inputs, not results.** `getSelectedBlockLayerIds`
  still returns a new Set whenever the animation changes, and the selected, hidden, and collapsed
  layer selectors deep-compare the whole layers slice on every change. Use a result equality check
  (`resultEqualityCheck: _.isEqual`) instead (`store/selectors.ts`). (STORE-17, low, confirmed by
  a test)
- **Repeat keeps using the duration from when play was pressed.** With repeat on, every loop
  reuses the duration passed to `play`, so after the animation is shortened during playback the
  loops run past the new end, and the current time goes past the duration until playback is
  restarted. Lengthening it cuts the loops off at the old end. Read the current duration at the
  start of each loop instead (`services/playback.service.ts`, `Animator.play` and
  `startAnimation`). (found after the sweep, low, confirmed by reading)

### Layers and properties

- **Flattening a group mis-decomposes mirrored or rotated nested groups.** Flattening a group
  whose child group is mirrored, rotated by more than 90 degrees, or rotated with a non-uniform
  scale moves or flips that group's content. `getScaling` and `getRotation` are only right for
  uniform positive scales. Use `atan2(b, a)` for the rotation and `hypot(a, b)` and the
  determinant for the scales, and refuse to flatten skews (`scripts/common/Matrix.ts`, used by
  `flattenGroupLayer`). (MODEL-1, medium, confirmed by a test)
- **Merging viewports of different sizes misplaces the content.** Importing a 24x12 SVG into a
  non-empty 48x48 project puts it at the bottom instead of the middle, and content in rotated or
  scaled groups moves sideways. The offsets are in scaled units but applied before scaling, and to
  every path. Apply them once, after scaling, at the top level (`model/layers/LayerUtil.ts`,
  `adjustViewports`). (MODEL-2, medium, confirmed by a test)
- **Importing a larger SVG into an animated project breaks the existing animation.** Importing a
  48x48 SVG into a 24x24 project rescales the existing layers but not their blocks, so during
  playback animated paths and translations jump back to the old scale. `adjustViewports` could
  return its transform so `importLayers` can apply it to the blocks, or the import could fit the
  new layers into the existing viewport (`model/layers/LayerUtil.ts`). (MODEL-3, medium, confirmed
  by a test)
- **Before a delayed block starts, the preview shows the static value, unlike Android 7.1+.**
  Before a block that starts after 0, the preview and the SVG and sprite exports show the layer's
  own value, then jump to the block's `fromValue`. Since API 25, AVDs show the `fromValue` from
  the start. Matching that (with the `fromValue` of the block that ends first) is a judgment call,
  and documenting it may be enough (`scripts/animator/AnimationRenderer.ts`). (MODEL-4, medium,
  confirmed by reading)
- **Invalid and partial colors become black, and garbage hex is accepted.** The property panel
  commits every keystroke, so typing `#00ff00` flashes black several times, and a typo like
  `#12345` turns the color black. `#1z1z1z` in a file is accepted and exported, and SVG
  `currentColor` and gradients import as black. `svgToAndroidColor` should reject invalid colors,
  and `setEditableValue` should ignore them (`scripts/common/ColorUtil.ts`,
  `model/properties/ColorProperty.ts`). (MODEL-5, low, confirmed by a test)
- **Color interpolation doesn't use Android's linear color space.** Halfway from `#ff0000` to
  `#0000ff` the preview shows `#800080`, but Android 8.0 (API 26) and later interpolate in linear
  RGB and show about `#ba00ba`, so the preview and the SVG and sprite exports are darker than
  those devices mid-block. Android 7.x matches the preview, so switching to linear is a judgment
  call (`model/properties/ColorProperty.ts`, `interpolateValue`). (MODEL-6, low, confirmed by a
  test)
- **An end time of 0 turns into 100, and inverted times flip on the next clone.** An end time of
  0, which the property panel allows, becomes 100 the next time the animation is cloned or loaded,
  because of `obj.endTime || 100`. A start time after the end time is stored as entered, then
  swapped by the next unrelated edit. Use `??`, and normalize or reject inverted times when they're
  set (`model/timeline/AnimationBlock.ts`). (MODEL-7, low, confirmed by a test)
- **Overshooting fraction animations are clamped in the preview but wrap on Android.** Animating
  `trimPathEnd` from 0 to 1 with an overshoot interpolator shows the whole path in the preview,
  which clamps fractions to 1, but Android wraps 1.05 to 0.05 and draws 5% of it. Model the
  wrapping, or warn about overshooting interpolators on fraction properties
  (`model/properties/FractionProperty.ts`). (MODEL-8, low, confirmed by reading)
- **The selection box of rotated or mirrored groups is wrong.** A group rotated 45 degrees gets a
  selection outline that collapses to a line, and a mirrored subgroup's content falls outside it.
  `GroupLayer.bounds` only transforms two corners of its children's bounds, and should transform
  all four (`model/layers/Layer.ts`). (MODEL-9, low, confirmed by a test)
- **Decimal commas are silently truncated in number fields.** Typing `1,5`, as people in
  comma-decimal locales do, stores 1, since `parseFloat` stops at the comma. Accept the comma, or
  reject input that isn't a number (`model/properties/NumberProperty.ts`). (MODEL-10, low,
  confirmed by a test)

### Import

- **A `<use>` inside `<clipPath>` is deleted by svgo, so Illustrator clip groups import
  invisible.** Illustrator writes every clipping mask as a `<clipPath>` holding a `<use>`. svgo
  turns the `<use>` into a `<g>`, which isn't allowed in a `<clipPath>` and is removed, and an
  empty clip path clips everything, so the artwork imports blank. Inside a `<clipPath>`, insert the
  referenced shape with its transform instead of a `<g>`
  (`scripts/svgo/plugins/replaceUseElems.ts`). (IMP-1, high, confirmed by a test)
- **SVG `opacity` on paths and groups is ignored.** Only the root's `opacity` is read, so Material
  two-tone icons (`<path opacity=".3">`) and groups with an opacity from Figma and Sketch import
  fully opaque. Multiply the element's and its ancestors' opacity into `fillAlpha` and
  `strokeAlpha` (`scripts/import/SvgLoader.ts`). (IMP-2, medium, confirmed by a test)
- **VectorDrawable color references are dropped, so Android Studio icons import with no fill.**
  Vector Asset Studio icons use `android:fillColor="@android:color/white"`, and `getColor` returns
  `''` for anything that isn't a hex color, so they import invisible and report success. Map the
  common `@android:color/` values, and fall back to an opaque color for other references
  (`scripts/import/VectorDrawableLoader.ts`, `getColor`). (IMP-3, medium, confirmed by a test)
- **Unrendered SVG elements outside `<defs>` become layers.** A `<clipPath>`, `<mask>`,
  `<symbol>`, gradient, or `<text>` outside `<defs>`, which Illustrator writes, imports as layers:
  clip path, mask, and symbol content as visible paths, and the rest as empty groups. Skip every
  element that isn't a group or a shape (`scripts/import/SvgLoader.ts`). (IMP-4, medium, confirmed
  by a test)
- **Fractional viewBox sizes are truncated, cropping the content.** Inkscape's millimeter
  documents have viewBoxes like `0 0 16.933333 16.933333`, which import as 16x16 and cut off about
  6% at the right and bottom. Round the size up, or scale the content to fit
  (`scripts/import/SvgLoader.ts`, `scripts/import/VectorDrawableLoader.ts`). (IMP-5, low,
  confirmed by a test)
- **SVGs without `xmlns` import as empty groups and report success.** SVG copied from a web page,
  for example with DevTools' "Copy element", often has no `xmlns`, so paths become empty groups,
  the viewBox is ignored, and the import still reports success. Add the namespace before parsing
  when it's missing (`scripts/import/SvgLoader.ts`). (IMP-6, low, confirmed by a test)
- **Bad `clip-path` references hide the element or fail the whole import.** A `clip-path` pointing
  at a missing id hides the element, where browsers draw it unclipped. A missing id inside a clip
  path, or clip paths that reference each other, fail the whole import, and a quoted `url('#c')`
  is ignored. Ignore unresolved references, guard against cycles, and accept quotes
  (`scripts/import/SvgLoader.ts`, `getReferencedClipPathId`). (IMP-8, low, confirmed by a test)
- **`<use>` outside `<defs>`, `<symbol>`, and nested `<svg>` positioning are mishandled.** A
  `<use>` of an element outside `<defs>` loses its copy, a used `<symbol>` imports nothing, and a
  nested `<svg>` with a position and a viewBox imports as a plain group, in the wrong place and at
  the wrong size. Resolve `<use>` against any id, and treat symbols and nested SVGs as viewports
  (`scripts/svgo/plugins/replaceUseElems.ts`, `scripts/import/SvgLoader.ts`). (IMP-9, low,
  confirmed by a test)
- **Percentage values import as NaN.** `fill-opacity="50%"` or `stroke-width="5%"` imports as
  `NaN`, which is kept and exported. Parse percentages, and use the default for values that aren't
  finite (`scripts/import/SvgLoader.ts`). (IMP-11, low, confirmed by a test)
- **`.shapeshifter` import keeps duplicate layer ids.** Files saved on the live site before the
  Cmd+G fix under "Fixed during the migration" can have two layers with the same id, and both get
  the same new id on import, so selecting, deleting, and animating them stays ambiguous. Assign
  new ids per node while walking the tree (`scripts/common/ModelUtil.ts`, `regenerateModelIds`).
  (IMP-12, low, confirmed by a test)
- **Some files in a multi-file import silently stall the batch.** If one of several dropped files
  is a type no branch handles, or a `.shapeshifter` file, the batch never finishes and the other
  files are silently dropped. The VectorDrawable loader also accepts any XML, so an AVD or a layout
  file "imports" as groups. Count unsupported files as errors, and require a `<vector>` root
  (`services/fileimport.service.ts`, `scripts/import/VectorDrawableLoader.ts`). (IMP-13, low,
  confirmed by reading, and the XML cases by a test)
- **A slow `?project=` fetch can overwrite work done in the meantime.** On a slow connection, if
  you open `/?project=...` and then open a file or a demo before it loads, the late project
  replaces your work without a prompt, since the fetch is only aborted on unmount. Abort it, or
  ignore its result, once anything else is loaded (`components/root/Root.tsx`). (IMP-14, low,
  plausible)

### Export

- **VD and AVD export write empty or unmorphable path data, which crashes Android at inflate
  time.** A new path or clip path layer has no path data, and exporting it writes
  `android:pathData=""` (and empty `valueFrom` and `valueTo` if it's animated). Android throws
  when inflating those, and when a path block isn't morphable, so the app crashes. Skip layers
  without path data and blocks that can't animate, and warn before exporting
  (`scripts/export/AvdSerializer.ts`). (EXP-1, medium, confirmed by a test and by reading AOSP)
- **Spritesheet frames aren't clipped to their cells.** Content that goes past the viewport, like
  a slide-in, a rotation, or a stroke at the edge, draws into the neighboring frames, since each
  frame is only translated. Wrap each frame in a nested `<svg>`, or clip it
  (`scripts/export/SpriteSerializer.ts`, `createSvgSprite`). (EXP-5, low, confirmed by a test)
- **The spritesheet CSS never rests on the last frame.** Without `animation-fill-mode: forwards`,
  the sprite snaps back to frame 0 when it ends, so a one-shot play-to-pause icon ends on the play
  icon. Add it (`scripts/export/SpriteSerializer.ts`, `createCss`). (EXP-7, low, confirmed by
  reading)

### Canvas

- **Split segments of fill-only paths can't be hovered or selected.** After splitting a filled
  subpath without a stroke, clicking the split segment selects the subpath instead, since the
  segment tolerance is half the stroke width. That makes "Delete segment" unreachable for most
  icons. Give segment hits a tolerance in viewport units (`components/canvas/SelectionHelper.ts`).
  (CANVAS-2, medium, confirmed by a test)
- **Hit and snap tolerances ignore the group transform.** In a scaled group, which imported
  VectorDrawables often have, distances in layer units are compared with tolerances in viewport
  units. At scale 0.1 a click 3 pixels from a point misses it, and at scale 10 a click 60 pixels
  away hits it. Divide the tolerances by the layer's scale (`components/canvas/CanvasOverlay.ts`,
  `performHitTest`). (CANVAS-3, medium, confirmed by a test)
- **The trim path dash length uses the inverse matrix in scaled groups.** In a scaled group, a
  trimmed path's dashes are off by the square of the scale, so trims show repeating dashes (above a
  scale of 1) or don't trim (below it). Like the stroke width bug under "Open", the length is
  measured with `canvasToLayerMatrix` instead of `layerToCanvasMatrix`
  (`components/canvas/CanvasLayers.ts`). (CANVAS-4, medium, confirmed by a test)
- **Rulers show wrong coordinates when the viewport is bigger than the canvas.** When the viewport
  has more units than the canvas has CSS pixels, as with a 512 viewBox or in action mode's three
  canvases, the rulers and the mouse position show CSS pixels. Remove the `Math.max(1, ...)`
  clamps on the ruler zoom and the mouse position (not the ones on the canvas size), and fix the
  ruler's loop condition, which never ends at small zooms without them
  (`components/canvas/CanvasRuler.ts`, `components/canvas/CanvasController.ts`). (CANVAS-5, medium,
  confirmed by a test)
- **Canvases ignore devicePixelRatio changes.** Moving the window between a Retina and a 1x
  display doesn't resize the canvases, so they draw at half or double scale and clicks don't line
  up until something else resizes them. Listen for ratio changes with `matchMedia` and rerun
  `onDimensionsChanged` (`components/canvas/CanvasLayoutMixin.ts`). (CANVAS-6, low, confirmed by
  a test)
- **The trim path preview doesn't follow Android's rules for fills and later subpaths.** The
  preview only dashes the stroke, so trims never affect the fill, and every subpath is dashed.
  Android trims the path itself, uses it for the fill too, and only draws the first subpath. Build
  the trimmed path the way hwui does, or document the difference
  (`components/canvas/CanvasLayers.ts`). (CANVAS-7, low, confirmed by a test in part, and by
  reading hwui)
- **Right and middle clicks start gestures.** Nothing checks `event.button`, so a right-click adds
  a point in add points mode, leaves pair and split modes, or selects a layer. If the context menu
  swallows the mouseup, a drag keeps following the mouse. Only handle `button === 0`, and cancel
  drags on blur (`components/canvas/CanvasOverlay.ts`, `components/splitter/Splitter.tsx`,
  `scripts/dragger/Dragger.ts`). (CANVAS-11, low, confirmed by reading)

### Timeline and UI

- **A click that ends a drag reaches the workspace and clears the selection or exits action
  mode.** Drag-selecting text in the inspector and releasing over the canvas deselects the layer,
  and a split line drawn from one canvas to another resets action mode. When a press and release
  land on different elements, the browser sends the click to their common ancestor, past the
  panels' `stopPropagation`. Only clear when the press started on the workspace too
  (`components/root/Root.tsx`). (UI-1, medium, confirmed by a test)
- **The inspector's typed text outlives undo and selection changes, and is applied to the wrong
  layer.** Type in a path's name field, undo twice, and select a group: the group's field shows
  the path's text, and typing renames the group from it. Typed text is keyed by property name only,
  and Chromium doesn't fire blur when the input is removed, so it's never cleared. Key it by model
  and property, and clear it when either changes (`components/propertyinput/InspectedProperty.ts`).
  (UI-2, medium, confirmed by a test)
- **A single wheel zoom step doesn't keep the time cursor in place.** One Ctrl+wheel notch zooms
  the timeline but doesn't scroll, so the time cursor jumps off screen (trackpad pinches work). The
  zoom goes through React state, and the scroll is set before the new width renders, so the
  browser clamps it. Scroll after the new width commits
  (`components/layertimeline/LayerTimelineController.ts`, `performZoomFn`). (UI-4, medium,
  confirmed by a test)
- **Shift-scaling several blocks of one property can make them overlap.** With blocks from 0 to
  100 and 100 to 200 selected, Shift-dragging the second one's end to 10 ms gives 0 to 10 and 5
  to 15. Each block's minimum length is enforced by pushing its end out. Clamp the scale so every
  block keeps the minimum instead (`components/layertimeline/LayerTimelineController.ts`). (UI-6,
  low, confirmed by a test)
- **Shift-dragging a block's start edge moves its fixed end.** Shift-dragging the start of a block
  from 100 to 200 to 199 gives 199 to 209, where a plain drag clamps to 190 to 200. Give the scale
  a lower bound based on `MIN_BLOCK_DURATION`
  (`components/layertimeline/LayerTimelineController.ts`). (UI-7, low, confirmed by a test)
- **Snapping after clamping lets a multi-block move leave the animation.** When blocks are dragged
  together, the move is clamped for one block and then snapped for another, so a block can end
  past the end of the animation, or the blocks shift relative to each other near 0. Snap first,
  then clamp against every block (`components/layertimeline/LayerTimelineController.ts`). (UI-8,
  low, confirmed by a test)
- **Up and Down arrows in name and color fields throw or change the value.** ArrowUp in an empty
  or numeric name field throws, which is reported to Bugsnag, and in an empty color field it sets
  `#000000`. Only handle the arrows for number and fraction properties, and ignore empty input
  (`components/propertyinput/PropertyInput.tsx`). (UI-9, low, confirmed by a test)
- **Modifier+Up does nothing on integer times, while modifier+Down subtracts 1.** With Cmd or Ctrl
  held, the arrows step by 0.1, which `Math.floor` turns into no change going up and -1 going down
  for integer properties such as block times. Round instead, or step by 1
  (`components/propertyinput/PropertyInput.tsx`). (UI-10, low, confirmed by a test)
- **Recursive collapse leaves child paths stuck collapsed.** Shift-click a group's chevron, then
  click it again without Shift: the paths come back, but their property rows and blocks stay
  hidden, and paths have no chevron to expand them. Only collapse groups and the vector layer
  (`components/layertimeline/LayerListTree.tsx`, `services/layertimeline.service.ts`). (UI-11,
  low, confirmed by a test)
- **The inspector accepts block times that the timeline would reject.** The inspector stores an
  end time before the start time, past the duration, or overlapping another block of the same
  property. An end before the start exports a negative `android:duration`. Validate against the
  block's neighbors and the duration (`components/propertyinput/buildPropertyInputModel.ts`).
  (UI-13, low, confirmed by reading)
- **The wheel zoom can start from a stale zoom level.** Zoom in to the maximum, scroll one more
  notch, zoom to fit, then zoom out a little: the zoom jumps far in instead. The extra notch leaves
  `targetHorizZoom` at the maximum, and it's only reset when the zoom changes (the same happens at
  the minimum). Reset it when the zoom is clamped, and in `autoZoomToAnimation`
  (`components/layertimeline/LayerTimelineController.ts`). (UI-14, low, confirmed by a test)
- **File > Open and the demos replace the workspace without the prompt that New shows.** Opening a
  file or a demo replaces an edited workspace without the "Start over?" confirmation (Cmd+Z brings
  it back). Show the same confirmation (`components/layertimeline/LayerTimelineController.ts`).
  (UI-16, low, confirmed by reading)

### Build and tests

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
