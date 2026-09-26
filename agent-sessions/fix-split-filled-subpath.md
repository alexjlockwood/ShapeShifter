# Splitting a filled subpath between two points on one command (PATH-3): session notes (2026-09-25)

These are the findings from one agent session (Flotilla slot 6, Claude Code, first Sonnet 5 and then
Opus 5.5), written down so that a later session can combine them with the notes from the other
sessions running in parallel and decide what to do next. Nothing here is merged.

**Status:** PR #368 was closed without merging. The fix is commit `8f66bc6c` on branch
`alex/fix-split-filled-subpath-order` (also at `refs/pull/368/head`), on top of master `15586e7f`.
Its full diff is in Appendix B. It fixes the reported bug and many related cases, but deleting a
split segment is still wrong in a lot of cases, mostly in shifted or reversed subpaths, and a few
of those used to do nothing on master and now give a wrong shape or throw. `BUGS.md` on master
still has the entry the PR removed, which is correct for now.

Line numbers for `Path.ts` and `Path.spec.ts` below are against `8f66bc6c`, which predates the
Prettier reformat in PR #366, so they'll move after a rebase.

## Summary

- **The bug (PATH-3):** splitting a filled subpath from one point to another point on the same
  command gives the wrong shapes. The first half loses the rest of the command after the second
  point (a hole), and the second half runs to the end of the command without a split segment back
  (an open shape). Deleting the unpaired split segment then does nothing and reports "Couldn't find
  the split segment's parent command" to Bugsnag. Before 2.0.0 it crashed with "reading
  'getCommands'" (reported to Bugsnag from 1.0.15).
- **The fix (`8f66bc6c`)** changes four things in `model/paths/Path.ts`: the two halves built by
  `splitFilledSubPath`, a typo in ordering the two split points, and two things in deleting a split
  segment. It adds 6 tests to `Path.spec.ts`, which all fail on master and pass with the fix. Unit
  tests, typecheck, lint, and the Chromium morph end-to-end test pass.
- **Code review** (`/code-review` on Opus 5.5) reported one blocker plus a few smaller things. When
  I reran the review's repros, 3 of its 4 "delete corrupts the shape" repros turned out to delete a
  curve instead of a split segment, which the app can't do, and a 5th claim (a square losing a
  vertex) is expected behavior. One repro was real: deleting a split segment in a shifted subpath
  collapses it.
- **My fuzz** (Appendix A) splits two shapes once or twice, over every pair of points, with the
  subpath plain, shifted, or reversed, and deletes each new split segment. With the fix:
  - Plain and shifted-back subpaths are nearly all right (1,824 of 1,844 deletes).
  - Shifted-forward subpaths are right in 574 of 922.
  - Reversed subpaths are right in 584 of 2,024. Many of those are the known reverse bug, PATH-1.
  - Compared case by case with master, 496 deletes went from wrong or no-op to right, 153 went from
    right or no-op to wrong or a throw, and about 920 are wrong on both.
- **Recommendation:** don't merge `8f66bc6c` as is. Rework the merge step in
  `deleteFilledSubPathSegmentInternal` (`Path.ts:856-930`) so it doesn't find command states by
  backing ID, then use the fuzz in Appendix A as the test (or turn it into one).

## The bug

### What the user sees

These steps came from the create-agents session. I didn't run the app in this session.

1. Import a filled dome, `M 2 16 C 2 4 22 4 22 16 Z`.
2. Pair it for morphing and enter action mode.
3. Add a point at the top of the curve, around (12, 7).
4. Choose "Split subpaths" and drag from that point to another point on the same curve.

Before the fix:

- Dragging to the curve's end, (22, 16), leaves the second half open, without a split segment
  back.
- Dragging to a point 3/4 along the curve loses the rest of the curve in the first half, which
  leaves a visible hole.
- Selecting the split segment and pressing Backspace does nothing and sends the Bugsnag warning
  "Couldn't find the split segment's parent command".

The Backspace step needs a path with a stroke. The bug sweep found that split segments of fill-only
paths can't be hovered or selected, because the hit tolerance is half the stroke width (CANVAS-2
in `agent-sessions/list-sweep-bugs.md`, `components/canvas/SelectionHelper.ts`). The app only calls
`deleteFilledSubPathSegment` when the selected command is a split segment
(`services/actionmode.service.ts:403`).

### In unit tests

`fromPathOpString` in `src/test/PathUtil.ts` applies edits written as ops. The ones used here:

| Op                 | Meaning                                                         |
| ------------------ | --------------------------------------------------------------- |
| `S sub cmd t...`   | Add split points to a command at the given t values             |
| `SIH sub cmd`      | Split a command in half                                         |
| `SFSP sub from to` | Split a filled subpath from the end of command `from` to `to`   |
| `DFSPS sub cmd`    | Delete the split segment at that command (Backspace in the app) |
| `DFSP sub`         | Delete a split filled subpath                                   |
| `US sub cmd`       | Unsplit (delete) a split point                                  |
| `SF sub`, `SB sub` | Shift a closed subpath's start point forward or back            |
| `RV sub`           | Reverse a subpath                                               |

Command indices are the displayed ones, after reversing and shifting. `DFSPS` on a command that
isn't a split segment runs anyway and gives garbage, so check `isSplitSegment()` before trusting a
repro (see "Code review" below).

### Why it happened on master

`splitFilledSubPath` (`Path.ts:626-773`) builds the two halves in two loops over the subpath's
command states. A command state wraps one command from the path string plus its split points, and
`slice(splitIdx)` cuts it into `left` and `right` pieces. When both split points are in the same
command state (`startCsIdx === endCsIdx`):

- The first loop's `i === startCsIdx` branch matched first, so the `i === endCsIdx` branch that adds
  `secondRight` never ran. The first half lost everything after the second point.
- The second loop pushed `firstRight` (the whole rest of the command) and never pushed `endLine`,
  so the second half was open and its split segment had no pair.

Deleting the unpaired segment then failed to find the second half's parent command state and hit
`reportMissingSplitSegmentParent()`.

There was also a typo in `findTargetSplitIdxs` (`Path.ts:638`): ordering the two points compared
`s.splitIdx > e.csIdx` instead of `s.splitIdx > e.splitIdx`. It only mattered once the first
problem was fixed, e.g. with three points added to one command.

## What the fix changes (`8f66bc6c`)

1. **Both halves get the right pieces** when both split points are in one command state. The first
   half gets `firstLeft`, `startLine`, then `secondRight` (`Path.ts:683-687`). The second half gets
   the move, the piece between the two points (`secondLeft.slice(startSplitIdx).right`), and
   `endLine` (`Path.ts:706-713`).
2. **The ordering typo** is fixed (`Path.ts:638`).
3. **Deleting a split segment removes both split points when they're in the same command state.**
   `deleteSpsSplitPoint` now returns the updated command states, and the caller threads them
   through both deletions instead of looking both up in the original array (`Path.ts:934-939`,
   `Path.ts:977-1005`).
4. **Merging the two halves back together** handles the new shapes. If the second half is only a
   move, the middle piece, and the split segment, it pops the middle piece back off `newCss` to
   merge it with the rest (`Path.ts:889-894`). The search for the piece right of the second split
   point now starts after the first split (`Path.ts:895-901`), since the piece left of the first
   split has the same backing ID when both points are in one command state. This also stops it
   losing the rest of a command when a segment went from the end of one command to a point on the
   next.

It also removes the `BUGS.md` entry and rewrites the comment on `reportMissingSplitSegmentParent`
(the Bugsnag warning stays, in case there's another way to get there).

## Verification

### Checks (on `8f66bc6c`, Node 24.14.0)

| Check                                                      | Result                |
| ---------------------------------------------------------- | --------------------- |
| `npx vitest run src/app/modules/editor/model/paths`        | 190 passed            |
| `npm run test:run`                                         | 305 passed (19 files) |
| `npm run typecheck`                                        | passed                |
| `npm run lint`                                             | passed                |
| `npx playwright test e2e/morph.spec.ts --project=chromium` | 3 passed              |
| Path tests with master's `Path.ts` swapped in              | 6 failed, 184 passed  |

### The 6 new tests on master

| Test                                                                                                       | Expected                                                                         | Master gives                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `M 0 10 C 0 0 20 0 20 10 L 0 10`, `SIH 0 1 SFSP 0 1 2`                                                     | `M 0 10 C 0 5 5 2.5 10 2.5 L 20 10 L 0 10 M 10 2.5 C 15 2.5 20 5 20 10 L 10 2.5` | `... M 10 2.5 C 15 2.5 20 5 20 10` (second half open)                                                                                                               |
| same path, `SIH 0 1 SFSP 0 2 1`                                                                            | same as above                                                                    | `M 0 10 C 0 5 5 2.5 10 2.5 C 15 2.5 20 5 20 10 L 10 2.5 L 0 10` (one subpath)                                                                                       |
| `M 0 0 L 20 0 L 20 20 L 0 20 L 0 0`, `S 0 1 0.25 0.5 0.75 SFSP 0 3 4`                                      | `M 0 0 L 5 0 L 10 0 L 15 0 L 20 0 L 20 20 L 0 20 L 0 0 M 15 0 L 20 0 L 15 0`     | `M 0 0 L 5 0 L 10 0 L 15 0 L 20 0 L 15 0 L 20 20 L 0 20 L 0 0` (typo swaps the points)                                                                              |
| dome, `S 0 1 0.25 0.75 SFSP 0 1 2 DFSPS 0 2`                                                               | `M 0 10 C 0 0 20 0 20 10 L 0 10`                                                 | `M 0 10 C 0 7.5 1.25 5.625 3.125 4.375 L 16.875 4.375 L 0 10 M 3.125 4.375 C 6.875 1.875 13.125 1.875 16.875 4.375 C 18.75 5.625 20 7.5 20 10` (delete did nothing) |
| `M 0 20 L 0 0 C 5 -5 15 -5 20 0 L 20 20 L 0 20`, `SIH 0 4 SFSP 0 1 4 S 1 1 0.25 0.75 SFSP 1 1 2 DFSPS 1 2` | `M 0 20 L 0 0 L 10 20 L 0 20 M 0 0 C 5 -5 15 -5 20 0 L 20 20 L 10 20 L 0 0`      | `... M 4.531 -2.813 C 7.969 -4.063 12.031 -4.063 15.469 -2.813 C 17.188 -2.188 18.75 -1.25 20 0`                                                                    |
| same path, `SIH 0 4 SFSP 0 1 4 SIH 1 1 SFSP 1 0 1 DFSPS 1 1`                                               | same as above                                                                    | `... M 0 0 C 2.5 -2.5 6.25 -3.75 10 -3.75 L 20 20 L 10 20 L 0 0` (rest of the curve lost)                                                                           |

## Code review

`/code-review` ran as a forked agent. The first run started on Sonnet 5 and was stopped when the
session switched to Opus 5.5; the second ran on Opus 5.5 with several finder passes (conventions,
simplification, cross-file callers, removed behavior, reuse, line-by-line, efficiency, altitude)
and a final verification pass. I then reran the repros myself on the branch and on master (by
swapping master's `Path.ts` in), because the passes disagreed with each other.

### The review's claims, rechecked

| Claim                                                                                                                                                       | Source                 | Recheck                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shifted subpath: `SIH 0 4 SFSP 0 1 4 S 1 1 0.25 0.5 0.75 SF 1 SFSP 1 1 3 DFSPS 1 2` on `M 0 20 L 0 0 C 5 -5 15 -5 20 0 L 20 20 L 0 20` collapses subpath 1  | final pass (finding 1) | **Real.** `DFSPS 1 2` is a split segment. Subpath 1 becomes `M 4.531 -2.813 C 7.969 -4.063 12.031 -4.063 15.469 -2.813 C 12.031 -4.063 7.969 -4.063 4.531 -2.813`, losing `L 20 20`, `L 10 20`, `L 0 0`, and logs "Merging command states out of order". Deleting the pair's other half (`DFSPS 2 3`) does the same. On master the split itself is wrong (second half open) and this delete does nothing. |
| Three subpaths: `SIH 0 1 SFSP 0 1 2 SIH 0 3 SFSP 0 3 4 DFSPS 2 1` on the dome collapses the curve to `C 10 2.5 10 2.5 10 2.5`                               | line-by-line pass      | **Not a valid repro.** Subpath 2 command 1 is a `C`, not a split segment. Deleting each real split segment in that setup gives the right result.                                                                                                                                                                                                                                                          |
| Nested splits crash: `S 0 1 0.13 0.31 0.62 0.91 SFSP 0 1 4 SFSP 1 1 2 DFSPS 1 1 DFSPS 0 1` on `M 0 10 C 0 0 40 0 40 10 L 0 10` throws in `BezierCalculator` | efficiency pass        | **Didn't reproduce, and not valid.** It returns the original path with a warning, and `DFSPS 1 1` targets a `C`. Every real split segment in that setup deletes correctly (checked the merged curves by hand). On master, the first split is already wrong.                                                                                                                                               |
| Two splits on one curve: `S 0 1 0.2 0.4 0.6 0.8 SFSP 0 1 3 SFSP 0 2 4 DFSPS 1 2` on `M 0 0 C 10 -10 30 -10 40 0 L 0 0` doubles the curve back               | altitude pass          | **Not valid.** `DFSPS 1 2` is a `C`. Real split segments all delete correctly. On master the second split throws "Error retrieving command mutation".                                                                                                                                                                                                                                                     |
| Square: `S 0 1 0.25 0.5 0.75 SFSP 0 3 4 SIH 0 5 SFSP 0 5 7`, then deleting drops the `15 0` vertex                                                          | altitude pass          | **Expected behavior.** Deleting the second split gives exactly the state after the first. Deleting the first split's segment removes its split point at (15, 0), the same way the PR's own test removes the points a deleted segment ran between.                                                                                                                                                         |
| Removing the `+ 1` from the search at `Path.ts:897` fixes a repro but breaks the new tests                                                                  | altitude pass          | Not checked.                                                                                                                                                                                                                                                                                                                                                                                              |
| Equal command indices (`splitFilledSubPath(0, 1, 1)`) make an empty `M 10 2.5 L 10 2.5` subpath                                                             | final pass             | Not rerun. `ShapeSplitter` never passes equal indices.                                                                                                                                                                                                                                                                                                                                                    |
| Reversed subpath loses a vertex: `SIH 0 4 SFSP 0 1 4 S 1 1 0.25 0.5 0.75 RV 1 SFSP 1 4 6` gives `L 10 20 L 10 20 L 20 0`                                    | final pass             | **Real, and the same on master.** This is PATH-1 (`CommandState.reverse` remaps t but keeps `minT`/`maxT`).                                                                                                                                                                                                                                                                                               |

The cross-file pass found nothing: `ShapeSplitter.ts:176` is the only production caller of
`splitFilledSubPath`, `deleteStrokedSubPath` (`Path.ts:589`) only deletes one split point so it
doesn't need the threaded command states, and the other caller of `findInternalIndices`
(`Path.ts:535`) never orders two indices. The conventions pass found no em dashes or British
spelling.

### Smaller findings (all from the review, none rerun)

- `IMPROVEMENTS.md:54` still describes the parentless split segment bug as open, and cites
  `Path.spec.ts` TODOs "around lines 759, 765-770, 827, and 887", which the new tests move down by
  32 lines.
- The comment at `Path.ts:890` says the popped piece is "the part left of the second split point".
  In the same-command case it's the middle piece, already merged with `firstLeft` at line 875.
- The merge still finds the piece right of the second split point by backing ID (`Path.ts:897`),
  which breaks whenever one backing command appears twice, e.g. at both ends of a shifted subpath.
  The review suggests using position instead: in the first half, `secondRight` always comes right
  after `startLine`, so check `splitCss1[parentBackingCmdIdx1 + 2]` (backing ID plus `minT` matching
  `lastParentCs`'s `maxT`).
- `findInternalIndices` is monotonic in the command index, so ordering `startCmdIdx` and
  `endCmdIdx` before the lookup would replace the two-level comparison where the typo was
  (`Path.ts:638`).
- `deleteSpsSplitPoint` now keeps a second copy of the command states next to the mutator's
  (`Path.ts:1002`), and its second call rescans from index 0 (`Path.ts:936`).
- `secondLeft.slice(startSplitIdx)` builds a left piece it throws away, and `firstRight` is only used
  as a truthiness check in the same-command case (`Path.ts:709`).
- The two `i === endCsIdx` checks are really `startCsIdx === endCsIdx` and could be one named
  constant (`Path.ts:683`, `Path.ts:706`).
- `cs.getCommands().map(...)` builds an array just to call `indexOf` (`Path.ts:989`).
- Test gaps: no delete after `S 0 1 0.25 0.5 0.75 SFSP 0 3 4`, no `DFSP` case, no shifted or
  reversed subpath, and no case with more than 2 split subpaths where the second point is the end of
  the command.

## Fuzz: where deleting a split segment is still wrong

The review's repros were mostly invalid, so I wrote a fuzz (Appendix A) to map it properly.

**Method.** Two closed shapes, a dome (`M 0 10 C 0 0 20 0 20 10 L 0 10`) and a square
(`M 0 0 L 20 0 L 20 20 L 0 20 L 0 0`), each with three split points added to command 1
(`S 0 1 0.25 0.5 0.75`), so most pairs of points are in one command state.

- **One split:** shift or reverse the subpath (none, `SF`, `SB`, `RV`, or `RV` then `SF`), then
  split between every pair of points.
- **Two splits:** split between every pair of points, pick either half, apply one of the same five
  variants to it, and split it again between every pair of points.
- **Deletes:** after each split, delete each new split segment. The expected result is the path
  before that split, with `US` on whichever of the two points were split points (a delete removes
  those too). Results count as right if they match exactly, or draw the same shape with a
  different start point.
- **Older segments:** those from the first split were also deleted, but only checked for throws
  and no-ops, since there's no simple expected answer.

### Deleting the newest split's segment

| Case              | Branch (`8f66bc6c`)                              | Master                                                            |
| ----------------- | ------------------------------------------------ | ----------------------------------------------------------------- |
| 1 split, plain    | 62 of 62 right                                   | 38 right, 12 no-op, of 50                                         |
| 1 split, `SF`     | 62 of 62 right (20 with a different start point) | 42 right, 8 wrong, 6 no-op, of 56                                 |
| 1 split, `SB`     | 62 of 62 right (12 with a different start point) | 38 right, 12 no-op, of 50                                         |
| 1 split, `RV`     | 62 of 62 right                                   | 38 right, 12 no-op, of 50                                         |
| 1 split, `RV SF`  | 14 right, **48 throw**, of 62                    | 14 right, 12 no-op, 24 throw, of 50                               |
| 2 splits, plain   | 856 right, 4 wrong, of 860                       | 613 right, 33 wrong, 65 no-op, of 711 (and 7 second splits throw) |
| 2 splits, `SF`    | 512 right, **348 wrong** (72 warn), of 860       | 475 right, 265 wrong (231 warn), 35 no-op, of 775                 |
| 2 splits, `SB`    | 844 right, 16 wrong, of 860                      | 503 right, 127 wrong, 90 no-op, of 720                            |
| 2 splits, `RV`    | 254 right, 696 wrong (28 warn), of 950           | 166 right, 496 wrong, 112 no-op, of 774                           |
| 2 splits, `RV SF` | 254 right, 696 wrong (16 warn), of 950           | 178 right, 484 wrong, 110 no-op, of 772                           |

"Warn" means `CommandState.merge()` logged "Merging command states out of order", which only warns
and then builds the wrong command state (`CommandState.ts:121`). Master has fewer deletes in each
row because its broken splits leave some segments unpaired.

### Branch versus master, case by case

Matching the same split and the same segment on both (6,342 deletes, keyed by the split ops and the
segment's endpoints):

- **Fixed:** 282 deletes that did nothing on master (the reported bug) are right now, and 214 that
  were wrong are right now.
- **Newly broken:** 121 deletes that did nothing on master are now wrong or throw: 93 in reversed
  subpaths (including the 12 single-split `RV SF` throws), 24 in `SF`, 2 in `SB`, 2 plain. Another
  32 that were right on master are wrong now: 20 reversed, 12 `SB`. The master "right" in those 12
  `SB` cases is relative to master's own broken first split.
- **Wrong on both:** about 920.
- **Older segments:** deleting the first split's segment after its half was split again logs the
  out-of-order warning in 796 of 5,360 deletes on the branch, against 224 of 4,186 on master. The
  fuzz doesn't grade these, but the warning means a wrong shape, so this is probably worse on the
  branch.

### The patterns behind the failures

1. **Shifted forward.** When the shift offset falls inside the command state being split, that
   command state appears at both ends of the shifted list (its right piece first, its left piece
   last). The merge's backing-ID search then finds the wrong piece. Example:
   `S 0 1 0.25 0.5 0.75 SFSP 0 1 2 SF 0 SFSP 0 1 3 DFSPS 0 2` on the dome gives
   `M 3.125 4.375 L 10 2.5 C 12.5 2.5 15 3.125 16.875 4.375 C 13.125 1.875 6.875 1.875 3.125 4.375 ...`
   (the curve doubles back and `C ... 20 10`, `L 0 10` are gone) with the warning. The shifted
   repro from the review is this pattern.
2. **Reversed, then shifted, single split.** Deleting throws "Cannot read properties of undefined
   (reading 'start')", e.g. `S 0 1 0.25 0.5 0.75 RV 0 SF 0 SFSP 0 1 2 DFSPS 0 2`. Master throws in
   some of these too and does nothing in the others. It may be related to PATH-8 (deleting the
   start point of a reversed, shifted subpath throws in `unsplitCommand`).
3. **Reversed second splits.** Mostly wrong on both branches. PATH-1 (`CommandState.reverse`)
   corrupts split pieces of reversed commands, so this has to be fixed first before these results
   mean much.
4. **The second split ends where the first split's segment starts.** Deleting the second split
   removes the shared split point, which also removes the first split's segment from one half, e.g.
   `S 0 1 0.25 0.5 0.75 SFSP 0 2 3 SFSP 0 1 2 DFSPS 0 2` on the dome gives
   `M 0 10 C 0 0 20 0 20 10 L 0 10 M 10 2.5 C 12.5 2.5 15 3.125 16.875 4.375 L 10 2.5` (subpath 0
   no longer has the first split's segment, so the first split's sliver overlaps it). This is the
   4 plain and most of the 16 `SB` failures.
5. **Start point after a delete in a shifted subpath.** The shape is right but the subpath starts
   at a different point than unsplitting would leave it, e.g.
   `S 0 1 0.25 0.5 0.75 SF 0 SFSP 0 1 5 DFSPS 0 2` starts at `16.875 4.375` instead of `0 10`. That
   matters for morphing, since the start point is how the user lines up two paths.

## Related work in other sessions

- `session-notes/create-agents.md` has its own review of #368, with a fuzzer that checks that total
  signed area is conserved. It confirmed a data-loss bug when deleting "the first split line" after
  splitting twice on one curve, with a one-line fix (also push `splitCss1[i]` in the `else if (cs)`
  branch at `Path.ts:908-912`). I tried that fix: all 190 path tests pass, and my fuzz results
  didn't change at all, so it doesn't touch any case the fuzz grades. It may still fix older-segment
  deletes, which my fuzz doesn't grade. Its two "plausible" findings match patterns 4 and 5 above.
  It also says an input sequence still reaches `reportMissingSplitSegmentParent`, which I didn't
  check.
- `agent-sessions/list-sweep-bugs.md` lists PATH-1, PATH-8, and CANVAS-2, and leaves PATH-3 out
  because #368 was going to fix it. With #368 closed, PATH-3 is only described here and in the
  create-agents notes.
- PR #366 (agent setup) reformats `Path.ts`, `Path.spec.ts`, and `CommandState.ts` with Prettier, so
  `8f66bc6c` will conflict with it.

## Suggested next steps

1. Decide whether to keep `8f66bc6c` as a base. It's a net improvement (496 deletes fixed against
   153 newly broken), but it makes some Backspace presses throw or give a wrong shape where they did
   nothing before.
2. Rewrite the merge in `deleteFilledSubPathSegmentInternal` so it finds the pieces by position
   relative to the split segment (or rebuilds the parent's command states and merges neighbors
   with the same backing ID and touching t ranges), instead of searching by backing ID. The
   create-agents review suggests the same thing.
3. Fix PATH-1 first, or at least before judging reversed cases.
4. Turn the fuzz into a test: fail on any throw, any out-of-order warning, and any new-segment
   delete that doesn't match unsplitting the two points. Add older-segment deletes with an expected
   answer.
5. Keep the `BUGS.md` entry until the fuzz is clean, fix the `IMPROVEMENTS.md` line references, and
   fix the comment at `Path.ts:890`.
6. Check CANVAS-2 (split segments of fill-only paths can't be selected), since it decides how many
   users can reach any of this.

## Environment notes for other agents

- The Flotilla slot's `node_modules` was incomplete (no `vite`, `@vitejs/plugin-react`, or
  `vitest`). `npx vitest` then downloaded vitest 5.0.1 on its own and failed to load
  `vite.config.ts` with `ERR_MODULE_NOT_FOUND`. `npm ci` fixed it.
- `node` on the PATH is Homebrew's v26.7.0, but `.nvmrc` says 24, and the `nvm` function isn't
  loaded in agent shells. Prepend `~/.nvm/versions/node/v24.14.0/bin` to `PATH`. `npm ci` warns
  that jsdom 30 wants `^24.15.0`, but everything passes on 24.14.0.
- Vitest prefixes `console.log` output, so `grep '^...'` on it finds nothing. The probes here write
  to a file instead.
- The `/code-review` passes left scratch specs in `model/paths/` (`__scratch_review.spec.ts`).
  Check `git status` after a review.
- A review pass's repro that uses `DFSPS` needs checking: the op runs on any command, but the app
  only deletes split segments.
- To get the fix back: `git fetch origin alex/fix-split-filled-subpath-order` (or
  `pull/368/head`). To compare with master, swap the file in with
  `git show origin/master:src/app/modules/editor/model/paths/Path.ts > src/app/modules/editor/model/paths/Path.ts`
  and restore it with `git checkout -- src/app/modules/editor/model/paths/Path.ts`.

## Appendix A: the fuzz

Put it at `src/app/modules/editor/model/paths/__fuzz.spec.ts` on `8f66bc6c` and run
`PROBE_OUT=/tmp/fuzz.txt npx vitest run src/app/modules/editor/model/paths/__fuzz.spec.ts`. It
writes a tally and examples to `$PROBE_OUT`, and one line per delete to `$PROBE_OUT.tsv` (split ops
and segment endpoints, new or old segment, result, and the full op string) for comparing runs. It
takes about 3 seconds. It's scratch code, not written to the repo's standards.

```ts
import * as fs from 'fs';
import * as PathUtil from 'test/PathUtil';

type P = ReturnType<typeof PathUtil.fromPathOpString>;
const r = (n: number) => String(+n.toFixed(2));
const run = (path: string, ops: string) => {
  const warns: string[] = [];
  const orig = console.warn;
  console.warn = (...a: unknown[]) => warns.push(String(a[0]));
  try {
    const p = PathUtil.fromPathOpString(path, ops.replace(/\s+/g, ' ').trim());
    p.getPathString();
    return { p: p as P | undefined, warns, err: '' };
  } catch (e) {
    return { p: undefined as P | undefined, warns, err: (e as Error).message };
  } finally {
    console.warn = orig;
  }
};
const safe = <T>(f: () => T, d: T) => {
  try {
    return f();
  } catch {
    return d;
  }
};
const numCmds = (p: P | undefined, s: number) =>
  safe(() => p!.getSubPath(s).getCommands().length, 0);
const segKey = (c: any) => `${r(c.start.x)},${r(c.start.y)}>${r(c.end.x)},${r(c.end.y)}`;
const segs = (p: P) => {
  const out: Array<{ s: number; i: number; key: string }> = [];
  p.getSubPaths().forEach((sp, s) =>
    sp.getCommands().forEach((c, i) => c.isSplitSegment() && out.push({ s, i, key: segKey(c) })),
  );
  return out;
};
// Same drawn shape: each subpath's segments up to rotation, subpaths in any order.
const shape = (p: P) =>
  p
    .getSubPaths()
    .map(sp => {
      const xs = sp
        .getCommands()
        .slice(1)
        .map(
          c =>
            c.type +
            c.points
              .slice(1)
              .map(pt => `${r(pt!.x)},${r(pt!.y)}`)
              .join(' '),
        );
      let best = xs.join('|');
      for (let k = 1; k < xs.length; k++) {
        const rot = [...xs.slice(k), ...xs.slice(0, k)].join('|');
        if (rot < best) best = rot;
      }
      return best;
    })
    .sort()
    .join(' || ');

const bases: Array<[string, string, string]> = [
  ['dome', 'M 0 10 C 0 0 20 0 20 10 L 0 10', 'S 0 1 0.25 0.5 0.75'],
  ['square', 'M 0 0 L 20 0 L 20 20 L 0 20 L 0 0', 'S 0 1 0.25 0.5 0.75'],
];
const variants = (s: number) => ['', `SF ${s}`, `SB ${s}`, `RV ${s}`, `RV ${s} SF ${s}`];
const label = (v: string) => (v ? v.replace(/ \d+/g, '') : 'plain');

it('fuzz', () => {
  const tally: Record<string, number> = {};
  const examples: Record<string, string[]> = {};
  const recs: string[] = [];
  const note = (cat: string, ex: string) => {
    tally[cat] = (tally[cat] || 0) + 1;
    (examples[cat] = examples[cat] || []).length < 3 && examples[cat].push(ex);
  };

  const check = (level: string, path: string, setup: string, s: number, a: number, b: number) => {
    const p0 = run(path, setup);
    if (!p0.p) return;
    const cmds0 = safe(() => p0.p!.getSubPath(s).getCommands(), []);
    const splitOps = `${setup} SFSP ${s} ${a} ${b}`;
    const sp = run(path, splitOps);
    if (!sp.p) return note(`${level} | split threw`, `${splitOps}: ${sp.err}`);
    if (sp.warns.length) note(`${level} | split warned`, `${splitOps}: ${sp.warns[0]}`);
    const oldKeys = new Set(segs(p0.p).map(x => x.key));
    const unsplit = [a, b].filter(k => cmds0[k]?.isSplitPoint()).sort((x, y) => y - x);
    const exp = run(path, `${setup} ${unsplit.map(k => `US ${s} ${k}`).join(' ')}`);
    const before = sp.p.getPathString();
    for (const g of segs(sp.p)) {
      const tag = `${splitOps} DFSPS ${g.s} ${g.i}`;
      const rec = (c: string) =>
        recs.push(
          `${splitOps.replace(/\s+/g, ' ').trim()} @${g.key}\t${isNew ? 'new' : 'old'}\t${c}\t${tag.replace(/\s+/g, ' ').trim()}`,
        );
      const isNew = !oldKeys.has(g.key);
      const del = run(path, tag);
      const w = del.warns.length ? ' + warned' : '';
      if (!del.p) {
        rec('threw');
        note(`${level} | ${isNew ? 'new' : 'old'} seg | threw`, `${tag}: ${del.err}`);
        continue;
      }
      const got = del.p.getPathString();
      if (!isNew) {
        rec(got === before ? 'no-op' : 'changed');
        note(`${level} | old seg | ${got === before ? 'no-op' : 'changed (not judged)'}${w}`, tag);
        continue;
      }
      if (!exp.p) {
        note(`${level} | new seg | no expectation`, tag);
        continue;
      }
      const expStr = exp.p.getPathString();
      rec(
        got === expStr
          ? 'exact'
          : shape(del.p) === shape(exp.p)
            ? 'same-shape'
            : got === before
              ? 'no-op'
              : 'wrong' + w.replace(' + ', '-'),
      );
      if (got === expStr) note(`${level} | new seg | exact${w}`, tag);
      else if (shape(del.p) === shape(exp.p))
        note(
          `${level} | new seg | same shape, other start${w}`,
          `${tag}\n        got ${got}\n        exp ${expStr}`,
        );
      else if (got === before) note(`${level} | new seg | no-op${w}`, tag);
      else
        note(`${level} | new seg | WRONG${w}`, `${tag}\n        got ${got}\n        exp ${expStr}`);
    }
  };

  for (const [name, path, pre] of bases) {
    for (const v of variants(0)) {
      const n = numCmds(run(path, `${pre} ${v}`).p, 0);
      for (let a = 1; a < n; a++)
        for (let b = a + 1; b < n; b++)
          check(`${name} 1-split ${label(v)}`, path, `${pre} ${v}`, 0, a, b);
    }
    const n0 = numCmds(run(path, pre).p, 0);
    for (let a = 1; a < n0; a++)
      for (let b = a + 1; b < n0; b++) {
        const first = `${pre} SFSP 0 ${a} ${b}`;
        if (!run(path, first).p) continue;
        for (const s of [0, 1])
          for (const v of variants(s)) {
            const setup = `${first} ${v}`;
            const n = numCmds(run(path, setup).p, s);
            for (let c = 1; c < n; c++)
              for (let d = c + 1; d < n; d++)
                check(`${name} 2-split ${label(v)}`, path, setup, s, c, d);
          }
      }
  }

  const out: string[] = ['TALLY'];
  for (const k of Object.keys(tally).sort()) out.push(`  ${k}: ${tally[k]}`);
  out.push('', 'EXAMPLES');
  for (const k of Object.keys(examples).sort()) {
    if (/exact$|not judged\)$|no-op$/.test(k)) continue;
    out.push(`  [${k}]`);
    for (const e of examples[k]) out.push(`    ${e}`);
  }
  fs.writeFileSync(process.env.PROBE_OUT as string, out.join('\n') + '\n');
  fs.writeFileSync((process.env.PROBE_OUT as string) + '.tsv', recs.join('\n') + '\n');
}, 300000);
```

## Appendix B: the full commit `8f66bc6c`

```diff
commit 8f66bc6c2a9b472a6cbec8f7e1c2764d9fa2bd45
Author: Alex Lockwood <alexjlockwood@gmail.com>
Date:   Fri Sep 25 19:17:09 2026 -0700

    Fix splitting a filled subpath between two points on one command

    Splitting a filled subpath from one point to another on the same command, e.g. from a point
    added to a curve to the end of that curve, gave the wrong shapes. The first half lost the rest of
    the command after the second point, which left a hole, and the second half ran to the end of the
    command without a split segment back. Deleting the unpaired split segment then did nothing and
    reported "Couldn't find the split segment's parent command" to Bugsnag (before 2.0.0 it crashed
    with "reading 'getCommands'"), which is the open bug this removes from BUGS.md.

    - Both halves now get the right parts of the command when both split points are in it.
    - Putting the two points in order compared the start's split index with the end's command state
      index. This only showed once the case above worked, e.g. with three points added to the first
      command.
    - Deleting a split segment now removes both split points when they're in the same command, and
      no longer loses the rest of a command when the segment went from the end of one command to a
      point on the next.

    The Bugsnag warning stays, in case there's another way to get into that state.

    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

diff --git a/BUGS.md b/BUGS.md
index 83ed73b3..64f12a20 100644
--- a/BUGS.md
+++ b/BUGS.md
@@ -16,10 +16,6 @@ These existed before the migration and are still there.
 - **UI-only state is recorded in the undo history.** Changes to the `paper` slice (cursor, hover,
   zoom) aren't excluded, so they can become undo steps of their own
   (`store/undoredo/metareducer.ts`).
-- **Deleting a split segment can find it without a parent command.** It's unclear how the path
-  gets into this state. It used to crash with "Cannot read properties of undefined (reading
-  'getCommands')" (reported to Bugsnag from 1.0.15), and now it leaves the path as it is and
-  reports a warning (`model/paths/Path.ts`, `deleteFilledSubPathSegmentInternal`).
 - **Split subpaths can't be deleted, but the toolbar offers to.** It's not clear whether
   deleting them is meant to work. After you split a subpath in action mode, selecting either half
   shows a "Delete subpath" button, but neither it nor Backspace does anything, on this branch or
diff --git a/src/app/modules/editor/model/paths/Path.spec.ts b/src/app/modules/editor/model/paths/Path.spec.ts
index 7b5fc228..e2fd4994 100644
--- a/src/app/modules/editor/model/paths/Path.spec.ts
+++ b/src/app/modules/editor/model/paths/Path.spec.ts
@@ -756,6 +756,38 @@ describe('Path', () => {
         'M 12 5.5 C 8.69 5.5 6 8.19 6 11.5 C 6 14.81 8.69 17.5 12 17.5 L 18 11.5 C 18 8.19 15.31 5.5 12 5.5 L 12 5.5 M 12 17.5 ' +
           'C 15.31 17.5 18 14.81 18 11.5 L 12 17.5',
       ),
+      // Split/unsplit filled sub paths between two points in the same command.
+      makeTest(
+        'M 0 10 C 0 0 20 0 20 10 L 0 10',
+        'SIH 0 1 SFSP 0 1 2',
+        'M 0 10 C 0 5 5 2.5 10 2.5 L 20 10 L 0 10 M 10 2.5 C 15 2.5 20 5 20 10 L 10 2.5',
+      ),
+      makeTest(
+        'M 0 10 C 0 0 20 0 20 10 L 0 10',
+        'SIH 0 1 SFSP 0 2 1',
+        'M 0 10 C 0 5 5 2.5 10 2.5 L 20 10 L 0 10 M 10 2.5 C 15 2.5 20 5 20 10 L 10 2.5',
+      ),
+      makeTest(
+        'M 0 0 L 20 0 L 20 20 L 0 20 L 0 0',
+        'S 0 1 0.25 0.5 0.75 SFSP 0 3 4',
+        'M 0 0 L 5 0 L 10 0 L 15 0 L 20 0 L 20 20 L 0 20 L 0 0 M 15 0 L 20 0 L 15 0',
+      ),
+      makeTest(
+        'M 0 10 C 0 0 20 0 20 10 L 0 10',
+        'S 0 1 0.25 0.75 SFSP 0 1 2 DFSPS 0 2',
+        'M 0 10 C 0 0 20 0 20 10 L 0 10',
+      ),
+      makeTest(
+        'M 0 20 L 0 0 C 5 -5 15 -5 20 0 L 20 20 L 0 20',
+        'SIH 0 4 SFSP 0 1 4 S 1 1 0.25 0.75 SFSP 1 1 2 DFSPS 1 2',
+        'M 0 20 L 0 0 L 10 20 L 0 20 M 0 0 C 5 -5 15 -5 20 0 L 20 20 L 10 20 L 0 0',
+      ),
+      // Unsplit a filled sub path split from the end of one command to a point in the next.
+      makeTest(
+        'M 0 20 L 0 0 C 5 -5 15 -5 20 0 L 20 20 L 0 20',
+        'SIH 0 4 SFSP 0 1 4 SIH 1 1 SFSP 1 0 1 DFSPS 1 1',
+        'M 0 20 L 0 0 L 10 20 L 0 20 M 0 0 C 5 -5 15 -5 20 0 L 20 20 L 10 20 L 0 0',
+      ),
       // TODO: determine if this is the right behavior
       // makeTest(
       //   'M 4 4 h 16 v 16 h -16 v -16',
diff --git a/src/app/modules/editor/model/paths/Path.ts b/src/app/modules/editor/model/paths/Path.ts
index 58c93314..88911562 100644
--- a/src/app/modules/editor/model/paths/Path.ts
+++ b/src/app/modules/editor/model/paths/Path.ts
@@ -635,7 +635,7 @@ export class PathMutator {
     const findTargetSplitIdxs = () => {
       let s = this.findInternalIndices(targetCss, startCmdIdx);
       let e = this.findInternalIndices(targetCss, endCmdIdx);
-      if (s.csIdx > e.csIdx || (s.csIdx === e.csIdx && s.splitIdx > e.csIdx)) {
+      if (s.csIdx > e.csIdx || (s.csIdx === e.csIdx && s.splitIdx > e.splitIdx)) {
         // Make sure the start index appears before the end index in the path.
         const temp = s;
         s = e;
@@ -680,6 +680,11 @@ export class PathMutator {
       } else if (i === startCsIdx) {
         startCommandStates.push(firstLeft);
         startCommandStates.push(startLine);
+        if (i === endCsIdx && secondRight) {
+          // Both split points are in this command state, so the first split path
+          // continues with what's left of it after the second split point.
+          startCommandStates.push(secondRight);
+        }
       } else if (i === endCsIdx && secondRight) {
         startCommandStates.push(secondRight);
       }
@@ -698,7 +703,15 @@ export class PathMutator {
             .setSplitSegmentInfo(firstLeft, '')
             .build(),
         );
-        if (firstRight) {
+        if (i === endCsIdx) {
+          // Both split points are in this command state, so the second split path
+          // only gets the part between them.
+          const { right: middle } = secondLeft.slice(startSplitIdx);
+          if (middle) {
+            endCommandStates.push(middle);
+          }
+          endCommandStates.push(endLine);
+        } else if (firstRight) {
           endCommandStates.push(firstRight);
         }
       } else if (startCsIdx < i && i < endCsIdx) {
@@ -873,7 +886,19 @@ export class PathMutator {
         }
         newCss.push(cs);
       }
-      i = _.findIndex(splitCss1, c => c.getBackingId() === parentBackingId2);
+      if (!cs) {
+        // The second split path is only a move, the part left of the second split
+        // point, and the split segment, so that part was added above. Take it back
+        // so it can be merged with the part right of the second split point.
+        cs = newCss.pop();
+      }
+      // Search after the first split, since the command state left of it has the same
+      // backing ID when both split points are in the same command state.
+      i = _.findIndex(
+        splitCss1,
+        c => c.getBackingId() === parentBackingId2,
+        parentBackingCmdIdx1 + 1,
+      );
       if (i >= 0) {
         if (cs) {
           if (splitCss1[i].getBackingId() === cs.getBackingId()) {
@@ -906,8 +931,11 @@ export class PathMutator {
     const mutator = psps.mutate().setSplitSubPaths(updatedSplitSubPaths);
     const firstSplitSegId = last(firstParentCs.getCommands()).id;
     const secondSplitSegId = last(lastParentCs.getCommands()).id;
+    // Both split points can be in the same command state, so delete the second one
+    // from the command states left by deleting the first.
+    let css = pcss;
     for (const id of [firstSplitSegId, secondSplitSegId]) {
-      this.deleteSpsSplitPoint(pcss, id, mutator);
+      css = this.deleteSpsSplitPoint(css, id, mutator);
     }
     this.subPathStateMap = this.replaceSubPathStateNode(
       psps,
@@ -946,6 +974,9 @@ export class PathMutator {
       .sort((a, b) => b - a);
   }

+  /**
+   * Deletes the split point with the specified ID and returns the updated command states.
+   */
   private deleteSpsSplitPoint(
     css: ReadonlyArray<CommandState>,
     splitCmdId: string,
@@ -968,7 +999,9 @@ export class PathMutator {
         .unsplitAtIndex(splitIdx)
         .build();
       mutator.setCommandState(csIdx, unsplitCs);
+      return css.map((cs, i) => (i === csIdx ? unsplitCs : cs));
     }
+    return css;
   }

   private updateOrderingAfterUnsplitSubPath(subIdx: number) {
@@ -1470,8 +1503,9 @@ function last<T>(array: ReadonlyArray<T>): T {
   return array[array.length - 1];
 }

-// TODO: figure out how a split segment can end up without a parent (reported to Bugsnag as
-// "reading 'getCommands'"). Paths are left as they are instead of crashing.
+// Splitting a filled subpath between two points on the same command used to leave a split
+// segment without its pair, and deleting it ended up here (reported to Bugsnag as "reading
+// 'getCommands'"). Paths are left as they are in case there's another way to get here.
 function reportMissingSplitSegmentParent() {
   bugsnagClient.notify(new Error("Couldn't find the split segment's parent command"), {
     severity: 'warning',
```
