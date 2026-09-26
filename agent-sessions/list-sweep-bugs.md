# Session notes: listing the bug sweep's findings in BUGS.md

Branch this was done on: `alex/list-sweep-bugs` (not merged; see "What happened to the PR" below).
These notes replace that PR for now, so the findings survive for a combined review across all the
parallel agent sessions working on this sweep.

## The task

An agent named "create-agents" (coordinating work across several Flotilla sessions) asked this
session to add the issues found by an automated bug sweep to `BUGS.md` in the ShapeShifter repo, as
a docs-only change, so they can be triaged later. The full sweep report is preserved alongside this
file at `agent-sessions/list-sweep-bugs.source-report.md` (copied from the sweep agent's scratchpad,
since that path is temporary and could be cleaned up before tomorrow's review).

The sweep read `src/`, `e2e/`, `vite.config.ts`, `playwright.config.ts`, `.github/workflows/ci.yml`,
and `public/`, skipping the uncompiled paper.js beta editor. It found **100 issues total: 3 high, 31
medium, 66 low**, split across seven areas (path model, store/services, layers/properties/rendering,
import, export, canvas, layer timeline/UI) plus build/PWA/e2e/tooling. 85 were confirmed by a
throwaway test (deleted afterward), 14 by reading the code, and 1 is only plausible.

Of those 100, 22 were excluded from this task because they're being fixed in another PR: `CANVAS-1,
STORE-4, STORE-8, STORE-9, STORE-6, UI-5, UI-3, UI-12, EXP-2, EXP-3, EXP-4, IMP-7, IMP-10, PATH-9,
PATH-15, CANVAS-8, CANVAS-9, CANVAS-10, UI-15, PATH-18, EXP-6`, plus `PATH-3` (fixed in a different
PR). That left 78 to add here, listed explicitly in the task prompt.

Formatting requirements: match the existing `BUGS.md` style (`- **Title.**` plus plain prose), group
by the report's areas sorted by severity within each group, no line numbers (they'd go stale), file
paths relative to `src/app/modules/editor/` like the rest of the file, end each entry with
`(sweep-id, severity, confidence)`, no em/en dashes, American spelling, `npx prettier --check`
clean, and every cited file path verified to exist on `master`.

## What was verified, and how

- Fetched `origin`, confirmed the branch already sat at `origin/master`'s tip with no commits of its
  own (`git reset --keep origin/master` wasn't needed), then renamed it to `alex/list-sweep-bugs`
  per the user's branch-naming convention (`alex/` prefix).
- Read the repo's `AGENTS.md` docs from the pending `origin/alex/agent-setup` branch (not yet on
  master), plus the nested ones for `e2e/`, `store/`, `components/`, and `model/paths/`, since the
  task said those docs exist there first.
- `node_modules` in this worktree slot was stale (still had Angular-era packages from before the
  React port), which broke `vitest` with `Cannot find package '@vitejs/plugin-react'`. Running
  `npm ci` fixed it. Worth checking for in any Flotilla slot that's been sitting around.
- Every file path and function/method name cited in the added entries was checked against `master`
  with `grep`, not assumed from the report (the report's line numbers were against a different,
  reformatted commit and are known to drift).
- Wrote a handful of throwaway Vitest specs (not committed) to confirm two things the report didn't
  fully nail down (see "Two bugs found after the sweep" below).
- Ran `npx prettier --check BUGS.md`, plus scripted checks that: no line in the diff was removed
  from the original file, the set of sweep ids in the new section exactly matches the 78 expected
  ids (no extras, none of the excluded ones), no em/en dashes, no British spellings, no lines over
  100 columns.

### Prettier gotcha

Two wrapped lines in the draft happened to start with `1)` and `15.` after word-wrap, which
Prettier's Markdown formatter parses as the start of an ordered list, re-indenting everything after
it. Fixed by rewording so no wrapped line starts with a digit followed by `.` or `)`.

## Code review found 11 problems; all fixed before anything was committed

`/code-review` was run against the draft. It caught real defects in the *documentation itself* (bad
fix advice, and a couple of claims that don't match the code), not typos. Each was checked against
the actual code (and, in one case, a local AOSP mirror) before being fixed:

1. **PATH-2** — the fix advice as originally written ("increment the ordering entries after the
   split, then push the new one") would produce **duplicate** ordering entries when combined with
   the existing `this.subPathOrdering.push(this.subPathOrdering.length)` call already in the code.
   Corrected to say the new index must be inserted next to the split subpath's entry, not appended.
2. **STORE-12** — said Cmd+Shift+G with only paths selected, and pasting unaddable blocks, record
   undo steps "that do nothing." Actually both **also clear the selection** as a side effect
   (`groupOrUngroupSelectedLayers` and `addBlocks` both unconditionally dispatch
   `SetSelectedLayers(new Set())`). The suggested fix ("only dispatch when something changes")
   wouldn't have addressed real behavior since the selection *does* change. Corrected to describe
   the selection-clearing and say these paths need an early return instead.
3. **STORE-13** — the fix pointed at `store/reset/reducer.ts`, but that reducer **never runs on
   undo/redo** — redux-undo 1.1.1 returns the past/future state directly and skips the wrapped
   reducer unless `neverSkipReducer` is set (confirmed: `"redux-undo": "^1.1.1"` in `package.json`,
   no `neverSkipReducer` anywhere in `store/`). Corrected to point the fix at
   `store/undoredo/metareducer.ts`, next to the existing theme carry-over.
4. **STORE-5** — its fix suggested copying `flattenGroupLayer`'s transform-applying logic for
   ungroup, but that function has its own known problems (MODEL-1's mis-decomposition, and STORE-14's
   missed stroke-width block scaling). Added a parenthetical flagging that dependency so a future
   fixer doesn't inherit those bugs silently.
5. **MODEL-6** — claimed Android always interpolates colors in linear RGB. That's only true from
   **Android 8.0 / API 26** onward. Verified against the local AOSP mirror
   (`~/src/aosp-frameworks-base`, pulled fresh first): the two commits that introduced linear
   blending (`ed45ab9004e9` "Evaluate ARGB values in linear space instead of sRGB" and `253f2c213f6e`
   "Linear blending, step 1") are absent from tag `android-7.1.0_r1` and present in
   `android-8.0.0_r1`. So on 7.x the app's current sRGB behavior already matches the device.
   Corrected the entry to scope the claim to API 26+ and note that switching is a judgment call.
6. **PATH-11** — said only `Path.spec.ts` calls the two dead-looking methods, so they could just be
   deleted. Actually `scripts/paper/item/PaperLayer.ts` (the uncompiled paper.js beta) also calls
   `getPathLength()`. That folder is excluded from `tsconfig`/oxlint, so deleting the method
   wouldn't fail CI, but it would silently break the beta editor whenever someone migrates it.
   Also, `getSubPaths()` isn't actually a `PathState` method (it's on `Path`; `PathState` exposes a
   `subPaths` field). Corrected both.
7. **CFG-7** — cited `npm run format:check`, which **doesn't exist on this branch's `package.json`**
   (only `format` = `prettier --write .`). `format:check` is added by the still-unmerged
   `alex/agent-setup` branch. Removed that specific claim so the entry doesn't send someone hunting
   for a script that isn't there yet.
8. **CFG-7** (second issue) — the suggested fix only covers `.claude/worktrees/`, but Flotilla's own
   slots (`.flotilla/slots/N`, i.e. where this session itself is running) have the identical problem
   and are **only excluded via the user's global git ignore**, which Prettier doesn't read (it only
   reads the repo's own `.gitignore`/`.prettierignore`). Added a sentence noting this gap explicitly
   — it is not fixed by CFG-7's proposed change.
9. **CANVAS-5** — "remove the `Math.max(1, ...)` clamps" was ambiguous: `CanvasController.ts` has
   **four** such clamps, and two of them (the canvas width/height guards) are load-bearing — removing
   them lets a collapsed panel produce zero/negative canvas dimensions, which divides by zero
   downstream. Only the ruler-zoom clamp and the two mouse-position clamps are the bug. Corrected to
   name which clamps to remove.
10. **CFG-3** — quoted a test name, "doesn't reload open pages", that doesn't exist. The actual test
    in `e2e/offline.preview.spec.ts` is named `'activates a new version without reloading open
    pages'`. Corrected the quote (and title) to match.
11. **Intro paragraph** — the list of "confirmed by reading" ids was inconsistent (didn't mention
    the ids that are *partly* by-reading, like CANVAS-7 and EXP-1) and gave no reason for the gaps in
    the numbering. Added a sentence explaining that skipped ids belong to bugs fixed in other PRs.

The review also surfaced something **outside the sweep's own scope**, which was not added as its own
entry (flagged here for whoever picks this up): flattening a rotated group whose child group has its
own rotation or translateX animation block appears to leave the child's blocks at their old local
values while the static transform gets recomputed, so playback would jump. This looks related to
MODEL-1/STORE-14 but wasn't independently confirmed with a test — worth a closer look before adding
it as a numbered entry.

## Two bugs found after the sweep (relayed by the coordinating agent from a sibling session)

While a different session ("sweep-quick-wins") was fixing `PATH-9`, it turned up a bug the original
sweep missed. It was verified here with a throwaway Vitest spec before being added (see note above
about needing `npm ci` first):

- **Reversing or shifting the first subpath drops a trailing lone `M`.** Repro confirmed exactly as
  relayed: `AutoAwesome.autoFix(new Path('M 5 5 M 0 0 L 10 0 L 10 10 Z'), new Path('M 0 0 L 10 10 L
  20 0 M 0 0 L 10 0 L 10 10 L 0 10 Z'))` throws `"Subpath index out of bounds: subIdx=1
  numSubPaths=1"`. One correction versus how it was relayed: the report attributed part of this to
  `PathParser.ts`, but a throwaway test showed the **parser actually keeps** the trailing `M`
  (`parseCommands('M 0 0 L 10 0 M 5 5')` yields command types `M L M`). The drop happens one layer
  up, in `model/paths/SubPath.ts`'s `createSubPaths`: when it hits an `M`, it only starts a new
  subpath if the current one is empty; otherwise it just marks `lastSeenMove` and continues, so a
  *rebuilt* subpath (from `reverseSubPath`/`shiftSubPathBack`, which end in `L` instead of `Z`)
  swallows the following lone `M` instead of ending there. (Confirmed with a test:
  `new Path('M 0 0 L 10 0 L 10 10 Z M 5 5').mutate().reverseSubPath(0).build()` has 1 subpath instead
  of 2.)

- **Playback's repeat loop reuses the duration captured at `play()` time.** Relayed and confirmed by
  reading `services/playback.service.ts`: `Animator.play(duration, startTime)` closes over
  `duration` in `startAnimation`, and the `setTimeout` for each repeat calls
  `startAnimation(duration, startTime)` with that same closed-over value — never re-reading the
  animation's current duration. So shortening the animation mid-playback with repeat on makes every
  subsequent loop run past the new end (current time exceeds duration until playback restarts), and
  lengthening it cuts loops off at the old, shorter end. This second half (lengthening) wasn't
  mentioned in what was relayed but follows from the same code and is included in the entry below.

## Final section as added to `BUGS.md` (80 entries: 78 from the sweep + 2 found after)

This was inserted as a new `## Found by the bug sweep` section immediately after the existing
`## Open` section and before `## Fixed during the migration`, with none of the file's existing
entries touched (verified: zero removed lines in the diff against `origin/master`).

<!-- BEGIN verbatim copy of the BUGS.md section, as last built on branch alex/list-sweep-bugs -->

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

<!-- END verbatim copy -->

## Excluded ids (for reference — not covered by this session, being handled elsewhere)

`CANVAS-1, STORE-4, STORE-8, STORE-9, STORE-6, UI-5, UI-3, UI-12, EXP-2, EXP-3, EXP-4, IMP-7,
IMP-10, PATH-9, PATH-15, CANVAS-8, CANVAS-9, CANVAS-10, UI-15, PATH-18, EXP-6` (fixed in another
PR), plus `PATH-3` (fixed in a different PR).

## What happened to the PR

This work was originally committed to branch `alex/list-sweep-bugs` (3 commits: the 78-entry
addition, then the trailing-`M` entry, then the repeat-duration entry) and opened as
[PR #369](https://github.com/alexjlockwood/ShapeShifter/pull/369), "List the bugs found by the bug
sweep." That PR has been **closed without merging** at the user's request, since the user is
collecting findings from several parallel agent sessions into separate notes files first, for a
combined review in a fresh session. The `alex/list-sweep-bugs` branch and its 3 commits still exist
if the actual `BUGS.md` diff is wanted verbatim later — nothing on it was deleted, only left
unmerged.

## Open questions / things for the combined review to weigh in on

- Whether the flatten-group transform-animation issue noted above (found during code review, not
  independently confirmed) is worth its own numbered entry, and if so, whether it should get a
  sweep-style id or follow the "found after the sweep" pattern used for the other two extras here.
- Whether "found after the sweep" entries from different sessions should get real ids (continuing
  the existing numbering per area) once everything is reconciled, since right now two different
  unrelated sessions could independently pick the same "no id" convention and collide conceptually
  (though not literally, since there's no id to collide).
- Whether the actual `BUGS.md` change should still land as originally drafted (it passed every
  check that was run), or whether the combined-review session will want to re-cut it after
  reconciling with what the other sessions found.
