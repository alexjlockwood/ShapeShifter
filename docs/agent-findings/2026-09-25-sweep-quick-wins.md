# Findings: fixing the bug sweep's 21 quick wins

Written on 2026-09-25 by the Claude Code session that worked in Flotilla slot 4. It records
everything that session found, so that a later session can decide what to do next without the
original context.

## Status

- All 21 bugs were fixed, each with a test, in
  [PR #370](https://github.com/alexjlockwood/ShapeShifter/pull/370) ("Fix 21 small bugs found by
  the bug sweep"). The user then **closed the PR without merging it** and asked for this write-up
  to be merged instead, so that the findings of several parallel sessions can be analyzed together.
- **None of the fixes are on master.** The code is preserved on the branch
  `alex/fix-sweep-quick-wins` (tip `d6929774`), 23 commits on top of master at `15586e7f`. It can
  be revived by reopening PR #370, or by cherry-picking commits from the branch (see
  [Commits](#commits-on-the-branch)).
- When it was closed, the branch passed `npm run typecheck`, `npm run lint`, and
  `npm run test:run` (28 files, 333 tests), plus the Chromium end-to-end tests that cover the
  changes (see [Checks](#checks-at-close)). `npm run build`, Firefox and WebKit, and the preview
  specs were not run.

## Background

- An automated bug sweep found 100 bugs in the app. A coordinating agent (`create-agents`, talking
  over Flotilla) picked 21 of them as "quick wins": each had been reproduced with a test, had a fix
  of a line or two in one spot, and was unlikely to break anything else. Other agents were
  handling the other 79, and one of them lists the bugs in `BUGS.md` (branch
  `alex/list-sweep-bugs`), so this session didn't touch `BUGS.md`.
- The rules for each fix were: write a failing test first and confirm it fails for the reason the
  sweep describes, make the smallest fix, don't refactor or fix neighboring issues, and skip any bug
  that doesn't reproduce or whose fix turns out bigger or riskier than expected. **No bug was
  skipped.**
- The sweep's full entries were in a scratchpad file of another slot
  (`tier1-entries.md`), which may not survive. The essential parts of each entry (trigger and
  impact) are repeated below.
- The sweep's line numbers were against commit `744d62e8` on the unmerged branch
  `alex/agent-setup`, which also reformats 44 files with Prettier. On master they were off by a few
  lines, except in `model/paths/Path.ts`, where they were off by about 75 (see
  [Environment and process notes](#environment-and-process-notes)).
- The repo's agent docs (`AGENTS.md` and nested ones) aren't on master yet. They were read from
  `origin/alex/agent-setup` (`git show origin/alex/agent-setup:AGENTS.md`).

Paths below are relative to `src/app/modules/editor/` unless they start with `src/`, `e2e/`, or
`docs/`. Line numbers are on master at `15586e7f`, before the fixes.

## Commits on the branch

In order, on top of master at `15586e7f`:

| Commit     | Subject                                                                     | Bugs              |
| ---------- | --------------------------------------------------------------------------- | ----------------- |
| `c09687ce` | Draw the fill before the stroke on the canvas                               | CANVAS-1          |
| `da089648` | Fix playback start times for slow motion, repeat, and a shortened animation | STORE-4, 8, and 9 |
| `2b624c19` | Leave Cmd+Z and Cmd+G to focused text fields                                | STORE-6           |
| `e820dda0` | Show "Convert to clip path" unless the path itself has a non-path animation | UI-5              |
| `b3b6cfc8` | Keep layer and animation names that are empty or unchanged after sanitizing | UI-3 and UI-12    |
| `9ae13eeb` | Trim paths in their own units in SVG exports                                | EXP-2             |
| `3170f023` | Give each clip path in SVG exports a unique id                              | EXP-3             |
| `117b3a4d` | Write a stroke width of 0 in SVG exports                                    | EXP-4             |
| `0b260f0c` | Compose clipPath transforms in the right order on SVG import                | IMP-7             |
| `e06eca5a` | Name imported layers after their type when their ids are all non-ASCII      | IMP-10            |
| `9d953e5b` | Skip single command subpaths in auto fix instead of throwing                | PATH-9            |
| `a8aadede` | Don't add collapsing subpaths to a path with no subpaths                    | PATH-15           |
| `bd4fec5a` | Don't clip the selection outlines of later layers to a selected clip path   | CANVAS-8          |
| `7f1dbd8d` | Keep a dragged split point on its own subpath when it's dropped             | CANVAS-9          |
| `10ff49f2` | Give the stubbed hit in the split point drag test a projection              | CANVAS-9 (test)   |
| `4eb9d478` | Clear the shape splitter's hover highlight when the mouse leaves the canvas | CANVAS-10         |
| `1422236b` | Stop drawing timeline header labels past the end of the animation           | UI-15             |
| `9864cdf6` | Delete the unused SvgUtil                                                   | PATH-18           |
| `1ae1db9f` | Type the mocks in the split point drag and shape splitter tests             | Tests only (lint) |
| `7a54918c` | Pad SVG frame file names to the number of digits of the last frame          | EXP-6             |
| `724c13a1` | Bound the timeline header labels by time instead of the canvas width        | UI-15 (review)    |
| `719aca63` | Dispose the canvas renderers in afterEach in their browser tests            | Tests only        |
| `d6929774` | Keep clip path ids in SVG exports from matching layer ids                   | EXP-3 (review)    |

`10ff49f2` and `1ae1db9f` fix a typecheck error and a lint error in tests from earlier commits.
`724c13a1`, `719aca63`, and `d6929774` came out of a code review (see
[Code review](#code-review-of-the-branch)). They were added as new commits rather than folded in,
because rewriting the pushed branch needed a force push, which Claude Code's auto mode blocked and
the coordinator then ruled out. Squashing the follow-ups into their bug's commit would be a
reasonable cleanup if the branch is revived.

## The 21 bugs

Each entry has the sweep's description, the root cause, the fix on the branch, the test, and how
the test failed before the fix. Every test was run against the unfixed code first and failed for
the reason the sweep describes.

### CANVAS-1. The canvas painted the fill over the stroke

- **Sweep:** any path with both a fill and a stroke. `ctx.stroke()` ran before `ctx.fill()`, so the
  fill covered the inner half of the stroke. Android (`libs/hwui/VectorDrawable.cpp`,
  `FullPath::draw`) and SVG draw the fill first, so the exports were right, but the preview showed
  strokes half as thick as on the device, and translucent fills blended wrongly.
- **Cause:** `components/canvas/CanvasLayers.ts:215-225`, in `drawPathLayer`.
- **Fix:** swapped the two blocks, so the fill (with its `evenodd` handling) comes first and the
  stroke second.
- **Test:** `components/canvas/CanvasLayers.browser.spec.ts` (new, runs in Chromium because it
  needs real canvas pixels). It draws a square with an opaque blue stroke 4 wide over a white fill
  at 50% alpha, and reads the pixel at (12, 5), in the inner half of the top edge's stroke. Before
  the fix it was `[128, 128, 255]` (fill blended over the stroke). After, `[0, 0, 255]`.

### STORE-4, STORE-8, and STORE-9. Playback start times

All three are in `services/playback.service.ts`, fixed in one commit, and tested in the new
`services/playback.service.spec.ts` with fake timers (which fake `requestAnimationFrame`).

- **STORE-4, slow motion resumes at a fifth of the current time.** Pause at 500, turn on slow motion
  (S), and play: the first frame showed 100. Line 170 computed
  `progress = timestamp - startTimestamp + startTime`, adding an animation time to wall clock time
  that's scaled by the playback speed (5 in slow motion). Fix:
  `timestamp - startTimestamp + startTime * playbackSpeed`. The test resumed from 500 in slow motion
  and got 100 on the first frame before the fix.
- **STORE-8, repeat restarts from where playback was resumed.** Scrub to 500 of 1000, turn on
  repeat, and play: every loop restarted at 500. Line 175 passed the original `startTime` into the
  repeat timeout. Fix: `this.startAnimation(duration, 0)`. The test runs to the end (600ms), past
  the 750ms repeat delay, and into the next loop. Before the fix the time was 580 (500 plus the
  elapsed time), after it's under 500.
- **STORE-9, play past the end only jumps to the end.** Scrub to 900, shorten the animation to 300,
  and press Space: playback stopped on its first frame at 300, so play had to be pressed twice.
  Line 45 checked `duration === this.getCurrentTime()`, and nothing clamps the current time when
  the duration changes. Fix: `currentTime >= duration ? 0 : currentTime`. The test shortens the
  duration with `SetAnimation` (a `ResetWorkspace` would be different) and checks that playback is
  still running after the first frame. Before the fix `isPlaying` was already false.

### STORE-6. Cmd+Z and Cmd+G fired inside focused text fields

- **Sweep:** typing in a property field or a layer name and pressing Cmd+Z undid an editor step and
  prevented the native text undo, so the field kept the typed text while the store reverted (which
  leads to UI-2). Cmd+G grouped the selected layers mid-typing. `TEXT_FIELD_SELECTOR` existed but
  was only used for open dialogs and menus.
- **Cause:** `services/shortcut.service.ts:60-73`, the modifier shortcuts, run before the text
  field check at line 78.
- **Fix:** inside the modifier branch, compute
  `isTextField = event.target instanceof Element && event.target.matches(TEXT_FIELD_SELECTOR)` and
  skip Z and G when it's true. **This deviates from the sweep's suggestion** to return early before
  all modifier shortcuts: Cmd+O (zoom to fit) keeps working in text fields, because otherwise the
  browser would open its Open File dialog.
- **Test:** `services/shortcut.service.spec.ts` (new). A control test shows that Cmd+Z and Cmd+G
  outside a text field dispatch and call `preventDefault`. The real test focuses an `<input>`,
  presses both, and checks that nothing was dispatched and `defaultPrevented` is false. It sets
  both `metaKey` and `ctrlKey`, since the modifier depends on `navigator.appVersion`. Before the
  fix, `defaultPrevented` was true inside the input.
- **Note:** the existing e2e test "undoes and redoes changes" (`e2e/interactions.spec.ts`) blurs the
  name field before pressing Cmd+Z, so it's unaffected.

### UI-5. "Convert to clip path" was hidden if any layer had a non-path animation

- **Sweep:** in the playtopause demo, the path only animates `pathData`, but the group animates
  `rotation`, so the path had no menu button at all. Deleting the group's rotation block brought it
  back. `swapLayers` already drops incompatible blocks. The Angular code had the same check.
- **Cause:** `components/layertimeline/LayerListTree.tsx:48` checked every block in the animation.
- **Fix:** `!animation.blocks.some(b => b.layerId === layer.id && !(b instanceof PathAnimationBlock))`.
- **Test:** a new e2e test in `e2e/timeline.spec.ts`, "converts a path to a clip path when another
  layer has a non-path animation". It loads playtopause, opens the path's menu, converts it, and
  checks that the layer is a mask and both timeline blocks survive. Before the fix, the menu button
  (`.slt-layer-more-actions`) never appeared. The logic lives in `buildLayerModel` inside a `.tsx`
  component, which isn't exported, so an e2e test was simpler than a unit test.

### UI-3 and UI-12. Layer and animation names

Both in `components/propertyinput/buildPropertyInputModel.ts`, one commit, tested in the existing
`components/propertyinput/buildPropertyInputModel.spec.ts` (new `describe('editing names')`).

- **UI-3, renaming a layer to its own name adds `_1`.** With a layer named "path", typing "Path",
  "path " or "path!" renamed it to "path_1" (the field kept showing what was typed, and the new name
  shows up in AVD target names). Line 150 called `getUniqueLayerName([vl], sanitize(value))`, which
  finds the layer being renamed.
- **UI-12, empty names are accepted.** Clearing the name field and blurring stored `""`, which
  showed a blank row and exported `android:name=""`. Same line for layers, and line 238 (the
  animation's properties, which had no transform at all) for the animation.
- **Fix, layers:** `const name = NameProperty.sanitize(enteredValue);` then
  `return !name || name === layer.name ? layer.name : LayerUtil.getUniqueLayerName([vl], name);`
- **Fix, animation:** a transform that returns `animation.name` when the entered value sanitizes to
  nothing. The sweep only mentioned the animation in passing (`:238`), and the coordinator's
  summary only mentioned line 150, but UI-12's title covers animation names, so both were fixed.
- **Tests:** "Path", "path " and "path!" keep "path" (before: "path_1"). "Other" still becomes
  "other_1" next to a layer named "other" (control). "", " " and "!!!" keep the layer's name
  (before: ""). "" and "!!!" keep the animation's name "anim" (before: "").

### EXP-2. SVG export trimmed paths wrongly inside scaled groups

- **Sweep:** a trimmed path (for example `trimPathEnd` 0.5) inside a group whose scale isn't plus or
  minus 1, including frames of a scale animation. The length was measured after the canvas
  transform, but `stroke-dasharray` is interpreted in the path's local units under the
  `<g transform>`. A 10 unit line in `scale(2)` at 50% got `stroke-dasharray="10,10"` instead of
  `5,5`, so the whole line showed. Affects SVG exports, SVG frames, and spritesheets.
- **Cause:** `scripts/export/SvgSerializer.ts:168-182` (the `Math.abs(a) !== 1` branch at 176).
- **Fix:** always use `pathData.getSubPathLength(0)`, deleting the transformed branch.
- **Test:** `scripts/export/SvgSerializer.spec.ts` (new, jsdom). Before the fix `10,10`, after
  `5,5`.
- **Important:** the canvas preview has the same mix-up in the other direction (CANVAS-4, owned by
  another agent). `CanvasLayers.drawPathLayer` still measures the trim length on the path scaled by
  the inverse transform, so with EXP-2 fixed and CANVAS-4 not, the preview and the SVG export
  disagree for trimmed paths in scaled groups.

### EXP-3. SVG export could give two clip paths the same id

- **Sweep:** a group with two clip path layers followed by layers named `path` and `path_1`
  (exactly the names `getUniqueName` generates). The chained ids `clip_<name>_<i>` collided with the
  base id of a layer named `<name>_<i>`: `clip_path`, `clip_path_1`, `clip_path_1`, and
  `clip_path_1_1`. Browsers resolve `url(#clip_path_1)` to the first match, so `path_1` was clipped
  by the wrong clip path. Sprite frames (`clip_frame<N>_...`) had the same problem.
- **Cause:** `scripts/export/SvgSerializer.ts:98-103` (id prefix), `:115` and `:120` (chain index).
- **Fix (two commits):** `3170f023` separated the chain index with a hyphen. The code review then
  found that the base id `clip_<name>` could also equal another layer's own element id (every path
  and group is exported with its layer name as its id): a clipped layer `path` next to a layer
  named `clip_path` gave both the id `clip_path`. The coordinator counted that as the same bug, so
  `d6929774` separates every part of the id with hyphens: `clip-path`, `clip-path-1`, and
  `clip-frame<N>-path` for sprite frames. Layer names can't contain hyphens, because
  `NameProperty.sanitize` turns them into underscores, and the SVG and VectorDrawable importers and
  the name field all sanitize. **Caveat:** `.shapeshifter` project files are loaded with
  `FileExportService.fromJSON`, which doesn't sanitize names, so a hand-edited project with a
  hyphen in a layer name could still collide.
- **Tests:** "gives each clip path a unique id" (4 clipPaths with 4 distinct ids, and each layer's
  `clip-path` chain resolves to the right shapes). Before the fix there were 3 distinct ids. "doesn't
  give a clip path the same id as a layer" (all 4 `[id]` elements distinct). Before `d6929774`
  there were 3 distinct ids.
- **Note:** frame numbers in spritesheets are not padded (`scripts/export/SpriteSerializer.ts:67`
  passes `i.toString()`), but the digits of the frame number always end at a separator, so ids of
  different frames can't collide.

### EXP-4. SVG export omitted `stroke-width` when it was 0

- **Sweep:** a path with a stroke color and a stroke width of 0 (after animating the width down to
  0, or a VD with `strokeColor` and no `strokeWidth`). The editor draws no stroke
  (`CanvasLayers.ts:215` requires a width), but exported SVGs, frames, and sprites drew one with
  the SVG default width of 1.
- **Cause:** `scripts/export/SvgSerializer.ts:168`,
  `conditionalAttr(node, 'stroke-width', layer.strokeWidth, 0)` skipped 0.
- **Fix:** `conditionalAttr(node, 'stroke-width', layer.strokeWidth, layer.strokeColor ? undefined : 0)`.
  A stroked path always writes its width, and an unstroked path still skips 0, so nothing else
  in the output changes (attribute order included).
- **Test:** in `scripts/export/SvgSerializer.spec.ts`: the stroked path gets `stroke-width="0"`
  (before: no attribute), the unstroked one still has none.

### IMP-7. clipPath transforms were composed in the wrong order on import

- **Sweep:** `<clipPath transform="translate(10 0)"><path id="cp" transform="scale(2)" d="M0 0h5v5H0z"/></clipPath>`
  (the id stops svgo from baking in the transform). Both transform lists were reversed and
  concatenated path first, giving P·C instead of C·P, so the clip landed at x 20 to 30 instead of
  10 to 20. The existing fixture only used translations, which commute.
- **Cause:** `scripts/import/SvgLoader.ts:366` and `:379-380`, in `buildPathInfosForClipPath`.
- **Fix:** `Matrix.flatten([...clipPathTransforms, ...getNodeTransforms(childNode)])` with no
  reversing. `Matrix.flatten([A, B])` is `A·B`, and group transforms (line 106) are already composed
  in document order, outer first.
- **Test:** in `scripts/import/SvgLoader.browser.spec.ts` (Chromium, since it needs
  `transform.baseVal`). The clip path layer's bounding box was `{ l: 20, r: 30 }` before and
  `{ l: 10, r: 20 }` after. The existing clip path fixture (translations only) still passes.

### IMP-10. Non-ASCII ids gave empty layer names

- **Sweep:** `id="图层"`, as Chinese, Japanese, and Russian Illustrator and Sketch exports write.
  `sanitize` stripped every character and the prefix fallback wasn't used, so layers were named
  `''`, `_1`, `_2`, and the exports wrote `android:name=""` and `id=""`. Related to UI-12.
- **Cause:** `makeFinalNodeIdFn` in `scripts/import/SvgLoader.ts:59-66` and
  `scripts/import/VectorDrawableLoader.ts:37-44` (the same helper is copy-pasted in both) called
  `NameProperty.sanitize(nodeId || prefix)`.
- **Fix:** `NameProperty.sanitize(nodeId || '') || NameProperty.sanitize(prefix)` in both. The
  prefix has to be sanitized too, because the VectorDrawable loader's clip path prefix is
  `'clip-path'`, which would otherwise put a hyphen in a name (and break the EXP-3 assumption).
- **Tests:** SVG (`SvgLoader.browser.spec.ts`): a group `图层` with paths `路径一` and `路径二`
  import as `group`, `path`, and `path_1` (before: `_2` and so on). VectorDrawable (new
  `scripts/import/VectorDrawableLoader.spec.ts`, jsdom): a vector, group, clip path, and two paths
  with Chinese names import as `vector`, `group`, `clip_path`, `path`, and `path_1` (before: the
  vector was `_5`). svgo keeps non-ASCII ids.

### PATH-9. Auto fix threw on single command subpaths

- **Sweep:** `autoFix(new Path('M 5 5'), new Path('M 0 0 L 10 10 L 20 0'))`, a path starting with
  `M a b M ...`, or the subpaths PATH-7 creates. `_.clamp(x, 1, numPaths - 1)` returns 1 when
  there's one command, and `splitCommand` then throws.
- **Cause:** `scripts/algorithms/AutoAwesome.ts:296` (`applySplitsFn` inside `alignSubPath`). The
  throw is `'Error retrieving command mutation'` at `model/paths/Path.ts:1135` on master (the sweep
  said 1058).
- **Fix:** two guards in `autoFix`. The alignment loop skips a subpath when either side has only one
  command (a lone move has no segment to split). The permute loop only calls `permuteSubPath` when
  the two subpaths have the same number of commands, because `permuteSubPath` indexes
  `toCmds[cmdIdx].end` and would otherwise throw for `autoFix(3 commands, 'M 5 5')`. Such a
  subpath is left as is, so **auto fix no longer throws, but the result can still be unmorphable**,
  and the user gets no feedback. The sweep allowed "skip or special-case". A special case (turning
  the lone move into a collapsing subpath with the other side's command count, using the existing
  `addCollapsingSubPath`) would produce morphable paths but is a bigger change.
- **Tests:** in `scripts/algorithms/AutoAwesome.spec.ts`, three cases (`M 5 5` against 3 commands,
  the reverse, and `M 5 5 M ...` against a two-subpath path) check that auto fix doesn't throw and
  leaves the single command subpath's length alone. All three threw before. The auto fix test for
  each of the 5 demos in `services/createEditorServices.spec.ts` still passes.
- **A separate bug found here (not fixed):** see
  [Trailing single command subpaths are dropped](#trailing-single-command-subpaths-are-dropped).

### PATH-15. A path with no subpaths crashed `autoAddCollapsingSubPaths`

- **Sweep:** `new Path('L 10 10')`, `'   '`, or `'Z'` has 0 subpaths, and `autoAddCollapsingSubPaths`
  threw "reading 'end'" in either order. Reachable by typing path data without a leading `M` into
  a morph block, which makes the action mode edit or auto fix throw.
- **Cause:** `scripts/algorithms/AutoAwesome.ts:89-98` calls `addCollapsingSubPath`, which reads the
  last command of the path (`model/paths/Path.ts:987-989` on master, the sweep said 917-918).
- **Fix:** `if (numFrom === numTo || !numFrom || !numTo) return [from, to];`
- **Test:** in `scripts/algorithms/AutoAwesome.spec.ts`, each empty path in both orders is returned
  unchanged. Before: `TypeError: Cannot read properties of undefined (reading 'end')`.

### CANVAS-8. A selected clip path clipped the selection outlines of later layers

- **Sweep:** select a clip path, then Cmd-click a layer later in the tree that lies outside the clip,
  even in another group. The clip leaked into the rest of the overlay traversal, so the other
  layer's outline disappeared.
- **Cause:** `components/canvas/CanvasOverlay.ts:363-368`, `ctx.clip()` at line 367 in
  `drawLayerSelections`, with no save and restore around the recursion.
- **Fix:** removed the `ctx.clip()`. The alternative (save and restore per group) would keep
  clipping the outlines of siblings, but only while the clip path is selected, which looked
  accidental (probably copied from `CanvasLayers.drawClipPathLayer`).
- **Test:** `components/canvas/CanvasOverlay.browser.spec.ts` (new, Chromium). A control selects
  only the path and checks that the pixel at (17, 14) on its outline is drawn. Then the clip path
  (in another group) is selected too. Before the fix the pixel was transparent.

### CANVAS-9. Dragging a split point near another subpath was silently undone

- **Sweep:** `M 0 0 L 20 0 M 0 1 L 20 1` with a split point at (10, 0). Drag it to (5, 0.8), where
  the other subpath is closer. The preview snapped the point onto its own subpath at (5, 0), but on
  mouse up the re-projection wasn't restricted to that subpath, so the point jumped back.
- **Cause:** `components/canvas/SelectionHelper.ts:125`,
  `this.calculateProjectionOntoPath(mouseUp)`.
- **Fix:** `this.calculateProjectionOntoPath(mouseUp, oldSubIdx)`, as the drag preview does.
- **Test:** `components/canvas/SelectionHelper.spec.ts` (new, jsdom) with a stub overlay. It drags
  the split point and checks the path passed to `updateActivePathBlock`. Before the fix the split
  point's end was (10, 0), after (5, 0).

### CANVAS-10. The shape splitter's hover highlight stuck after the mouse left

- **Sweep:** in split subpaths mode on a filled path, move off the canvas while near a segment.
  `onMouseLeave` reran the hit test instead of clearing `hitResult`, and returned without drawing
  when no drag was in progress, so the orange highlight and preview point stayed on screen.
- **Cause:** `components/canvas/ShapeSplitter.ts:183-192`.
- **Fix:** `this.reset(); this.lastKnownMouseLocation = mouseLeave; this.component.draw();`, like
  `SegmentSplitter.onMouseLeave` (`SegmentSplitter.ts:72`). During a drag this behaves as before.
- **Test:** `components/canvas/ShapeSplitter.spec.ts` (new, jsdom) with a stub overlay whose hit
  test always hits a segment. Before the fix `getCurrentProjectionOntoPath()` (which drives the
  highlight) was still defined after leaving.

### UI-15. The timeline header drew time labels past the end of the animation

- **Sweep:** a 320ms animation at zoom 2 got a "0.325s" label in the right padding. The label loop
  ran to the canvas width, while the grid lines stop at `width - 2 * padding`.
- **Cause:** `components/layertimeline/TimelineGridRenderer.ts:121`.
- **Fix (two commits):** `1422236b` bounded the loop by `width - 2 * TIMELINE_ANIMATION_PADDING`,
  as the sweep suggested. The code review pointed out that the layout rounds a fractional canvas
  width (to 1/64 px in Chromium), which can drop the label at the end of the animation, and a test
  confirmed it: at zoom 0.73519, a 1000ms animation lost its "1s" label. `724c13a1` bounds the loop
  by time instead, `t <= this.animation.duration`, which is exact because the label times are whole
  milliseconds.
- **Tests:** `components/layertimeline/TimelineGridRenderer.browser.spec.ts` (new, Chromium, since it
  needs layout and a 2D context), spying on `CanvasRenderingContext2D.prototype.fillText`. At zoom 2
  the last label is "0.3s" (before: "0.325s"). At zoom 0.73519 it's "1s" (with the width bound:
  "0.9s").

### PATH-18. `model/paths/SvgUtil.ts` was dead code

- Nothing imported `SvgUtil` or `arcToBeziers`, not even the paper.js editor, and
  `model/paths/index.ts` didn't export it. `PathParser` converts arcs itself. Deleted, with no
  test. The agent docs on `alex/agent-setup` don't mention it either (their
  `src/test/agentDocs.spec.ts` fails on paths that don't exist).

### EXP-6. Frame file names in the SVG zip were padded one digit short

- **Sweep:** `createSvgFrames` returns frames 0 through `numSteps`, but the padding used the length
  of `numSteps - 1`. When `numSteps` is a power of 10 (301 to 333ms at 30fps), the files were
  `frame0` to `frame9` and then `frame10`, which sort out of order.
- **Cause:** `services/fileexport.service.ts:66`.
- **Fix:** `const length = numSteps.toString().length;`
- **Test:** in `services/createEditorServices.spec.ts`: a 310ms animation is exported with
  `exportSvg()`, the zip is read back with JSZip, and the sorted `30fps/` names must be
  `frame00.svg` through `frame10.svg`. Before the fix they were `frame0.svg` through `frame10.svg`.

## Bugs found but not fixed

### Trailing single command subpaths are dropped

Found while fixing PATH-9. Reported to the coordinator for `BUGS.md`.

- `AutoAwesome.autoFix(new Path('M 5 5 M 0 0 L 10 0 L 10 10 Z'), new Path('M 0 0 L 10 10 L 20 0 M 0 0 L 10 0 L 10 10 L 0 10 Z'))`
  still throws `Subpath index out of bounds: subIdx=1 numSubPaths=1`, even with the PATH-9 fix.
- `orderSubPaths` moves `M 5 5` to the end of the from path (`M 0 0 L 10 0 L 10 10 Z M 5 5`, still
  2 subpaths). Then `alignSubPath` at subpath 0 builds reversed and shifted copies
  (`reverseSubPath(0)`, `shiftSubPathBack(0, i)`), and the path it returns has only 1 subpath: the
  trailing lone `M` is gone, so the loop's next `getSubPath(1)` throws.
- Parsing has the same behavior: `new Path('M 0 0 L 10 0 M 5 5')` has 1 subpath with 2 commands.
  A trailing lone move seems to be dropped whenever a path is rebuilt from commands or a string.
- This is in the path model (`model/paths/`), the riskiest part of the app, so it was left alone.

### Repeat ignores a duration changed during playback

Found by the code review. Reported to the coordinator, who passed it to the `BUGS.md` agent.

- With repeat on, the playback `Animator` restarts every loop with the duration captured when play
  was pressed (`startAnimation(duration, 0)` in the repeat timeout). If the duration is shortened
  while playing, later loops still run to the old duration, so the current time and the red time
  marker go past the end of the animation until playback is restarted.

### Other code review findings that were left alone

See [Code review](#code-review-of-the-branch) for the full triage. The ones that describe real,
reachable behavior:

- **CANVAS-4 (owned by another agent):** `CanvasLayers.drawPathLayer` scales `lineWidth` and the trim
  dash length by `canvasToLayerMatrix` (the inverse transform), though the path is built in canvas
  space. A throwaway browser test showed a stroke of width 2 inside a 2x group drawn about 1px wide
  instead of 4px. The coordinator said this is CANVAS-4 plus an existing `BUGS.md` entry.
- **Unsanitized names from project files:** `FileExportService.fromJSON` doesn't sanitize layer
  names. With such a name, the UI-12 fallback returns the raw name, which
  `NameProperty.setEditableValue` then sanitizes, possibly into a duplicate (layers `Circle` and
  `circle`, clear the first one's name, and both are `circle`). The EXP-3 hyphen assumption also
  relies on sanitized names. Both only matter for hand-edited project files.

## Code review of the branch

The user asked for a code review before the PR was opened. Claude Code's `/code-review` ran on the
whole branch and reported 12 findings. How each was handled:

| Finding                                                                                       | Outcome                                                                              |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Canvas stroke width and trim length use the inverse transform in scaled groups                | CANVAS-4, owned by another agent. Not changed.                                       |
| Repeat reuses the duration captured at play                                                   | Pre-existing, reported to the coordinator.                                           |
| UI-15's width bound can drop the end label at fractional zoom                                 | **Fixed** in `724c13a1`, with a test that failed first.                              |
| UI-12's fallback returns the raw name, which is re-sanitized (unsanitized project file names) | Left alone: needs hand-edited project files, and the re-sanitizing predates the fix. |
| EXP-3's hyphen assumption isn't enforced for project files                                    | Left alone, noted in the PR.                                                         |
| A clip path id can equal a layer's element id                                                 | **Fixed** in `d6929774` at the coordinator's request, with a test that failed first. |
| PATH-9 now silently returns unmorphable paths                                                 | Accepted: the sweep allowed skipping. A special case is a bigger change.             |
| `TEXT_FIELD_SELECTOR` matches range, color, and file inputs and `[contenteditable="false"]`   | Not reachable: the app has no such inputs, and its file inputs are `display: none`.  |
| The equal-length guard should live inside `permuteSubPath`                                    | Style. `autoFix` is the only caller. Not changed.                                    |
| `makeFinalNodeIdFn` is duplicated between the two importers                                   | Refactor, out of scope.                                                              |
| The empty-name rule is written twice (layers and animation) instead of in `NameProperty`      | Refactor, out of scope.                                                              |
| The canvas browser specs disposed their renderers only when the test passed                   | **Fixed** in `719aca63` (dispose in `afterEach`).                                    |

The review found no violations of the user's style rules (no em or en dashes, American spelling).

## Where the fixes deviate from the sweep's suggestions

- **STORE-6:** only Cmd+Z and Cmd+G are skipped in text fields, not every modifier shortcut, so
  Cmd+O doesn't fall through to the browser's Open File dialog.
- **UI-12:** covers the animation's name field too.
- **EXP-3:** hyphens everywhere in clip path ids instead of a counter. Only ids of clipped layers
  change, and they stay readable.
- **EXP-4:** writes `stroke-width="0"` instead of leaving out `stroke`, so a re-import keeps the
  stroke color.
- **PATH-9:** also guards `permuteSubPath`, which the sweep didn't mention.
- **CANVAS-8:** removes the clip rather than wrapping it in save and restore.
- **UI-15:** bounded by time, not by `width - 2 * padding`.

## Checks at close

At `d6929774` (the branch tip):

- `npm run typecheck`: passes.
- `npm run lint` (oxlint): passes.
- `npm run test:run`: 28 files and 333 tests pass.
- End-to-end tests in Chromium: `e2e/app.spec.ts`, `e2e/canvas.spec.ts`,
  `e2e/interactions.spec.ts`, `e2e/morph.spec.ts`, `e2e/panels.spec.ts`, and `e2e/timeline.spec.ts`
  (36 tests) passed at `719aca63`. The last commit only changes `SvgSerializer.ts` and its spec, and
  `e2e/timeline.spec.ts` (13 tests, including export and import) passed again with it.
- Not run: `npm run build`, Firefox and WebKit, and the `*.preview.spec.ts` files.
- Formatting: every changed line matches Prettier. `scripts/algorithms/AutoAwesome.ts`,
  `scripts/import/SvgLoader.ts`, and `scripts/export/SvgSerializer.ts` still fail
  `prettier --check`, as they do on master, in lines the branch doesn't change. Master has no
  `format:check` script and CI doesn't check formatting yet. Both come with `alex/agent-setup`.

## Environment and process notes

Things that cost time in this session, or would help the next one:

- **Stale `node_modules` in the worktree slot.** Slot 4's `node_modules` was left over from the
  Angular version of the app (it had `karma`, `ng`, `tslint`, and `webpack`, but no `vitest` or
  `vite`), so `npm run test:run` failed with `vitest: command not found`. `npm ci` fixed it. Other
  slots may be in the same state: check `ls node_modules/.bin | grep vitest`, not just whether
  `node_modules` exists.
- **Don't use `npx vitest`.** Without a local install, it downloads a separate vitest that can't load
  `vite.config.ts`. Use `npm run test:run -- <files>`.
- **Node:** the machine has Node 26.7.0 while `.nvmrc` says 24. Everything worked anyway.
- **Browser specs for canvas code.** `*.browser.spec.ts` files run in real Chromium through
  `@vitest/browser-playwright`, which also gives a real 2D canvas context (jsdom has none, so
  `getContext2d` throws). The repo's docs describe browser specs as being for SVG DOM APIs, but
  they work for canvas pixel tests too.
- **Testing `CanvasLayers` and `CanvasOverlay` without `CanvasController`:**
  `new CanvasLayers(canvas, ActionSource.Animated, store)`, `init()`, then dispatch
  `ResetWorkspace`. `CanvasLayoutMixin` defaults its bounds and viewport to 24x24, and
  `devicePixelRatio` is 1 in headless Chromium, so viewport units map 1:1 to canvas pixels, and the
  canvas never needs sizing.
- **Testing `SelectionHelper` and `ShapeSplitter` in jsdom:** they only use a few overlay members
  (`actionSource`, `actionModeService`, `vectorLayer`, `activePathLayer`, `activePath`,
  `dragTriggerTouchSlop`, `draw`, and `performHitTest`), so a stub object works. Hits in a
  `HitResult` are `ProjectionOntoPath` objects and need a `projection`.
- **Vitest fake timers fake `requestAnimationFrame`**, so `vi.advanceTimersByTime` drives the
  playback `Animator` in 16ms frames.
- **Keyboard events in jsdom** accept `keyCode` in the init dictionary. Set both `metaKey` and
  `ctrlKey`, since the shortcut modifier depends on the platform.
- **Path strings are normalized:** `H` and `V` become `L`, so compare against `L` forms.
- **Line numbers:** the sweep's line numbers (against `alex/agent-setup`) were within a few lines
  on master, except `model/paths/Path.ts` (1058 is 1135 on master, and 917-918 is 987-989).
- **Lint:** oxlint enforces `vitest/require-mock-type-parameters`, so write `vi.fn<Type>()`, e.g.
  `vi.fn<ActionModeService['updateActivePathBlock']>()`, which also types `mock.calls`.
- **Prettier on files that master hasn't formatted yet:** don't run `prettier --write` on them.
  A copy outside the repo doesn't pick up `.prettierrc`, so format a scratch copy with
  `npx prettier --stdin-filepath <repo path> < file` and compare the hunks you changed.
- **End-to-end tests:** they use fixed ports (4280 and 4281) that Playwright reuses, so parallel
  agents share a lock: `until mkdir /tmp/shapeshifter-e2e.lock 2>/dev/null; do sleep 15; done`,
  then `rmdir` it afterwards. The six dev specs took about 18 seconds in Chromium.
- **History rewrites:** Claude Code's auto mode blocked `git push --force-with-lease` on the PR
  branch, and the coordinator then asked for additive commits instead. Plan follow-ups as new
  commits.

## Suggested next steps

- **Reviving the fixes:** reopen PR #370, or cherry-pick from `alex/fix-sweep-quick-wins`. Expect
  conflicts in `scripts/algorithms/AutoAwesome.ts`, `scripts/import/SvgLoader.ts`, and
  `scripts/export/SvgSerializer.ts` once the Prettier commit from `alex/agent-setup` lands, since
  those files are in it. The two test-only follow-ups could be squashed into their bug's commit.
- **Update `BUGS.md`** (branch `alex/list-sweep-bugs`) so that these 21 bugs aren't listed as fixed
  while the fixes are unmerged, and add the two new bugs above if the coordinator hasn't.
- **Fix CANVAS-4 together with EXP-2,** or the preview and the SVG export will disagree for trimmed
  paths in scaled groups.
- **Decide whether PATH-9 deserves a real fix** (turning a lone move into a collapsing subpath), and
  fix the trailing lone move bug in the path model, which PATH-7 and PATH-9 both touch.
- **Consider sanitizing names in `FileExportService.fromJSON`,** which would make the UI-12 and
  EXP-3 assumptions hold for project files too.
