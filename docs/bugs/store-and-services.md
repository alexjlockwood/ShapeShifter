# Store and services bugs found by the 2026-09-25 sweep

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
- **Resuming slow motion playback jumps to a fifth of the current time.** `Animator`'s resume math
  scales the whole elapsed-time-plus-start-time sum by the playback speed instead of just the
  start time, so pausing at 500ms and resuming in slow motion starts the next frame at 100ms
  (`services/playback.service.ts`). (STORE-4, confirmed by a test; a candidate fix exists on the
  unmerged `alex/fix-sweep-quick-wins` branch, needs a rebase before reuse)
- **Ungroup drops the group's transform and leaves its blocks and hidden state behind.**
  Ungrouping a translated, rotated, or scaled group moves its children without the transform, so
  the artwork jumps. The group's blocks are orphaned, and its id stays in the hidden set, so
  ungrouping a hidden group shows its children. Apply the transform to the children (as
  `flattenGroupLayer` does, which has its own problems in MODEL-1 and STORE-14), run
  `buildCleanupLayerIdActions`, and hide the children instead
  (`services/layertimeline.service.ts`, `groupOrUngroupSelectedLayers`). (STORE-5, medium,
  confirmed by a test)
- **Cmd+Z and Cmd+G fire while typing in a property or name field.** The modifier shortcuts run
  before the shortcut service's text field check, so undoing or grouping while typing reverts or
  regroups behind the cursor, and the field keeps the stale typed text
  (`services/shortcut.service.ts`). (STORE-6, confirmed by a test; a candidate fix exists on the
  unmerged `alex/fix-sweep-quick-wins` branch, needs a rebase before reuse)
- **Clipboard handlers ignore open menus and dialogs, and block native copy.** Cmd+X deletes the
  selected block behind an open menu, and paste works behind a dialog. Cmd+C with no blocks
  selected cancels the browser's copy, so page text can't be copied. Add the checks the shortcut
  service uses, and return true when there's nothing to copy (`services/clipboard.service.ts`).
  (STORE-7, low, confirmed by a test)
- **Repeat restarts playback from where it was resumed, not from the start.** The repeat timeout
  passes the original `startTime` back into `startAnimation` instead of 0, so every loop after a
  scrub restarts from the scrubbed time (`services/playback.service.ts`). (STORE-8, confirmed by a
  test; a candidate fix exists on the unmerged `alex/fix-sweep-quick-wins` branch, needs a rebase
  before reuse)
- **Playing past a shortened animation's end takes two presses of Space.** Nothing clamps the
  current time when the duration shrinks, so the first press only jumps to the end without
  starting playback (`services/playback.service.ts`). (STORE-9, confirmed by a test; a candidate
  fix exists on the unmerged `alex/fix-sweep-quick-wins` branch, needs a rebase before reuse)
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
