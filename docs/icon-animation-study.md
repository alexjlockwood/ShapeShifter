# Icon animation study (2026-10-04)

Context for picking this work up later: what was built, how, what was found, what PR #416 fixed,
and what's still open. Paths are relative to `src/app/modules/editor/` unless they start with
`docs/`, `e2e/` or `src/`.

## Status

- PR #416 (draft) holds the bug docs and four fixes, plus a fifth commit for a regression the
  end-to-end tests caught. Unit tests (1228), typecheck, lint, format and all 111 Chromium
  end-to-end tests pass on it.
- The rebuild on the fixed code (round 2) is in progress. The table under "Round 2" fills in as
  each part finishes; rows marked "pending" aren't done yet.
- Round 2 turned up two follow-ups worth doing before this merges: the auto pivot is wrong for a
  star, and "Add another keyframe" can land before the block it should follow. See "Open issues".

## Where everything is

- **The gallery** (private Claude artifact): https://claude.ai/artifact/9RBTfPxLcs777ZQEhQddUd.
  Each of the 14 concepts plays three ways side by side at the same moment: the target, the build
  done by hand in Shape Shifter (its exported AVD, played back), and auto fix on the two raw
  Material icons. It also has the ranked gaps, the auto fix ideas and about 47 more ideas. The
  owner's reactions are in its `feedback` database (all 14 liked; the star's bursts were reworked
  after a "glitchy" note).
- **Files attached to the gallery** (`harness/`, `projects/`, `results/`): the scripts that drove
  the app, the `.shapeshifter` projects and AVDs from both rounds, and the per-concept results
  notes. The working copies lived in a session scratchpad that's gone.
- **Bug docs**: `docs/bugs/icon-animations.md` (what's still open), linked from `BUGS.md`.
- **Feature gaps**: `IMPROVEMENTS.md`, "Icon animation workflow".

## How it was done

1. **Concepts.** Fourteen product moments were picked from Material icons, avoiding the existing
   demos and `adp-delightful-details`. Each was hand-built as a prototype (a small renderer with
   AnimatedVectorDrawable semantics: group transforms with pivots, path morphs between
   compatible paths, trim paths, clip paths, color and alpha), so every target is something an
   AVD can play. Each rest frame was checked against the real icon by rasterizing both (all
   above 99% overlap).
2. **Auto fix on the raw icons.** `AutoAwesome.autoFix` was run on each pair of raw Material
   paths, in the dev server, to show what the app makes today without any hand work.
3. **Round 1 builds.** Each concept was built through the UI the way a designer would: Import or
   paste, the layer list, the inspector, the timeline, action mode, the context menu, and the
   canvas editor where the classic UI couldn't do something. The store was only read, never
   written. The builds ran in parallel in four headless Chromium instances against one Vite
   server, each driven step by step over CDP with a screenshot after every step. Each result was
   saved, exported as an AVD, and compared frame by frame with its target.
4. **Fixes.** Four of the bugs were fixed (below).
5. **Round 2 builds.** The same builders rebuilt the same concepts on the fixed code. The browser
   counted every click, key press and field edit (a field whose value changed). Round 1's numbers
   were tallied from the round 1 transcripts with the same rules, leaving out exploration that
   went nowhere, so they're estimates.

The harness, if it needs recreating: Playwright's `launchPersistentContext` with
`--remote-debugging-port`, kept running, and an init script that counts `pointerdown`, `keydown`,
and inputs whose value changed between `focusin` and `focusout`. Each step is a short script that
calls `chromium.connectOverCDP`, takes the open page, does a few gestures and takes a screenshot.
Canvas points go through `artboardPoint`'s math in `e2e/fixtures.ts`; scrubbing clicks the
timeline header and bisects until `playback.currentTime` matches.

## The 14 concepts

| #   | Concept                  | Icons                                                    | Technique                                                  | Round 1          |
| --- | ------------------------ | -------------------------------------------------------- | ---------------------------------------------------------- | ---------------- |
| 1   | Unlock a password vault  | `lock` → `lock_open` (outlined)                          | Shackle lifts and swings, keyhole turns, trimmed leg, clip | match, 11 blocks |
| 2   | Mute yourself in a call  | `mic` → `mic_off`                                        | Slash draws on, gap clip grows with it, turns red          | match, 8         |
| 3   | Unmute media             | `volume_off` → `volume_up`                               | Slash retracts, cone pumps, waves ripple                   | match, 14        |
| 4   | A notification arrives   | `notifications_none` → `notifications_active` (outlined) | Damped pendulum, lagging clapper, waves pop                | match, 22        |
| 5   | Switch to dark theme     | `light_mode` → `dark_mode`                               | Staggered rays, disc swells, moving bite clip              | close, 28        |
| 6   | Copy to clipboard        | `content_copy` → `done` → back                           | Pages slide and unwind, check draws on, reset              | close, 22        |
| 7   | Open the navigation menu | `menu` → `close`                                         | Bars slide and rotate with overshoot                       | match, 7         |
| 8   | Finish a download        | `file_download` → `file_download_done`                   | Anticipation, bar squash, arrow morphs to check            | match, 8         |
| 9   | Hang up a call           | `call` → `call_end`                                      | Turn 135° plus a morph, green to red                       | match, 3         |
| 10  | Connect to a Chromecast  | `cast` → `cast_connected`                                | Searching loop (unrolled), radial clip reveal              | match, 19        |
| 11  | Save an article          | `bookmark_border` → `bookmark`                           | Press, rising clip fill, notch dip                         | close, 9         |
| 12  | Enter full screen        | `fullscreen` → `fullscreen_exit`                         | Corners flip on their own pivots, staggered                | match, 20        |
| 13  | Star a repository        | `star_border` → `star`                                   | Press, 72° turn, hole closes, burst lines                  | match, 37        |
| 14  | Start recording video    | `fiber_manual_record` → `stop`                           | Rounded-square morph plus a quarter turn                   | close, 7         |

"Close" means: theme's crescent ends about 0.5 units off (points can't be placed precisely); copy's
preview shows CANVAS-4's dashes (the AVD is right); bookmark's fill has a flat top instead of a
slosh; record's clean morph needed hand-written `<rect rx>` SVGs. The lock's lift was lowered
after round 1 because the shackle left the 24×24 viewport.

## What got in the way (round 1)

Ranked by how many of the 14 each slowed down. The bugs among these are in
`docs/bugs/icon-animations.md`; the features are in `IMPROVEMENTS.md`.

1. The same motion on several layers is hand work: no keyframe buttons with several layers
   selected, no stagger or mirror, no linked scale. The rays, corners and bursts took 74 blocks.
2. Keyframes are typed one from/to block at a time (about 50 edits for the menu, 70 for the
   bell's swing), and a second block started from the layer's resting value (fixed, ICON-7).
3. Material icons don't come apart into usable parts: Break apart made holes into filled shapes
   (fixed, ICON-1), pieces pivoted at (0, 0) (fixed, ICON-2), it's refused on animated paths,
   and nothing turns outlined strokes back into strokes, so every trimmed part was typed in.
4. Clip paths need guesswork: a new one clips nothing until dragged into place, and a gap that
   grows with a slash has to be typed with computed corners.
5. Points can't be placed or rotated precisely in the canvas editor, and resizing an animated
   path changes every keyframe.
6. Good morphs need tricks auto fix doesn't know (a pre-rotated end shape, rounded-rect markup),
   and auto fix flips the lock body's hole (GitHub #31).
7. Nothing can be reused between projects, and there's no repeat count (GitHub #140).

Auto fix on the raw icons did well on the bell, star, bookmark and download arrow. It melts copy
into check, bends the menu bars, pinches the handset and folds the fullscreen corners. The
ideas that would help most: fit a rotation between paired subpaths and offer a rotation block
(confirmed by hand on the call: once the end shape was turned back, auto fix's morph was clean),
recognize circles and rounded rectangles and morph their corner radius, keep hole winding, draw
off then on when shapes are unrelated, and grow or collapse unpaired subpaths toward a chosen
point with a stagger.

## The fixes in PR #416

| Commit     | Bug        | Change                                                                                                                                                                                                                                                                     |
| ---------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e400e481` | ICON-2     | Imported paths (SVG and VectorDrawable) and Break apart's pieces pivot at the center of their bounds (`LayerUtil.getPathCenterPivot`). Break apart keeps the old pivot if the path uses its transform. A pivot alone isn't exported and doesn't raise the project version. |
| `1ea81cb3` | ICON-7     | A new block for an already animated property holds the value the previous block ends at (`addBlockToAnimation`'s `holdPreviousValue`). It holds rather than ramps, so it invents no motion and path blocks stay morphable.                                                 |
| `9a1cfdde` | ICON-1     | Break apart keeps each hole with the shape it cuts: a subpath is a hole when the area just inside its edge is unfilled under the fill type, so a keyhole inside a hole stays its own piece. Stroke-only paths split every subpath.                                         |
| `c7eed647` | ICON-8     | Blocks copied from one layer paste onto the selected layers, keeping their relative timing with the first at the playhead. Path morphs only paste onto their own layer. A snackbar says what was skipped or had no room (`ClipboardService.pasteBlocks`).                  |
| `0dc2b375` | Regression | The end-to-end test "combines two paths into a donut, and breaks it apart" failed after ICON-1, since a donut is one shape with a hole. When keeping holes would leave one piece, Break apart splits every subpath again.                                                  |

Behavior changes to check in review: pasting goes onto layers selected after copying (selecting
a block clears the layer selection, so plain copy and paste is unchanged); an outlined icon that's
a single shape, like `bookmark_border`, still splits its hole out (the donut rule).

## Round 2

Clicks / keys / field edits. Round 1 is tallied from transcripts, round 2 is counted by the
browser.

| Concept    | Round 1          | Round 2       | Blocks | What helped                                                                                                                       |
| ---------- | ---------------- | ------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------- |
| menu       | ~71 / 36 / 36    | 55 / 31 / 21  | 7      | Pivots came out right (6 edits saved); top bar's blocks pasted onto the bottom bar, then 2 edits                                  |
| record     | ~49 / 30 / 29    | 44 / 24 / 23  | 6      | Pivot at the circle's center; the release block chained from 0.9                                                                  |
| fullscreen | ~141 / 92 / 91   | 80 / 43 / 30  | 20     | Corner pivots (8 edits saved); one corner's 5 blocks pasted onto the others at their start times, then 10 mirrored values retyped |
| star       | ~249 / 172 / 162 | 130 / 82 / 60 | 37     | One burst's 6 blocks pasted onto the other four lines at once (about 100 edits saved)                                             |
| cast       | pending          | pending       |        |                                                                                                                                   |
| bookmark   | ~100 / 48 / 42   | 94 / 42 / 37  | 9      | The notch's spring-back chained from the dipped notch, so nothing snaps between keyframes; about the same work                    |
| lock       | pending          | pending       |        |                                                                                                                                   |
| mic        | pending          | pending       |        |                                                                                                                                   |
| volume     | pending          | pending       |        |                                                                                                                                   |
| bell       | pending          | pending       |        |                                                                                                                                   |
| theme      | pending          | pending       |        |                                                                                                                                   |
| copy       | pending          | pending       |        |                                                                                                                                   |
| download   | pending          | pending       |        |                                                                                                                                   |
| call       | pending          | pending       |        |                                                                                                                                   |

No regressions so far, apart from the misleading star pivot below.

## Open issues

- **The bounding-box center is the wrong pivot for some shapes.** The star's bounds center is
  (12, 11.5), but its rotational center is (12, 12.5), so a 72° turn about the auto pivot ends
  1.2 units off instead of landing on itself. Before ICON-2 the pivot was (0, 0), obviously
  wrong; now it looks right and is subtly wrong. Options: use the pole of inaccessibility or the
  area centroid for a single filled shape, or keep the bounds center and show the pivot on the
  canvas so it's visible.
- **"Add another keyframe" goes to the gap nearest the playhead,** so with the playhead before an
  existing block, the new block lands before it and gets the layer's static value, not the
  chained one. A designer reads it as "the next segment", so it should follow the property's last
  block whatever the playhead (falling back to the nearest gap only when there's no room after).
- **Pasting at an exact time needs an exact playhead.** Clicking the ruler lands within a pixel
  (41 ms instead of 40), and there's no field to type the current time.
- **Pasted values can't be mirrored.** The fullscreen corners needed 10 of 15 pasted values
  retyped with their signs flipped. A "paste mirrored" (negate rotation, or translate X or Y)
  would cover symmetric parts.
- **Shapes drawn with the canvas editor pivot at the canvas center,** not their own center, so
  fix ICON-2 doesn't reach the Line, Rectangle and Ellipse tools.
- Everything in `docs/bugs/icon-animations.md` and IMPROVEMENTS.md's "Icon animation workflow".

## Next steps

1. Fix the two follow-ups above (pivot for symmetric shapes, keyframe placement) in this PR,
   then rebuild star and bookmark to confirm.
2. Animate several selected layers at once, with a stagger command: the largest remaining cost.
3. Auto fix's rotation fitting, then rounded-rect recognition.
4. Rerun the builds after each step, with the same counting, and compare.
