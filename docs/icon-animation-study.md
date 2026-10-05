# Icon animation study (2026-10-04)

Context for picking this work up later: what was built, how, what was found, what PR #416 fixed,
and what's still open. Paths are relative to `src/app/modules/editor/` unless they start with
`docs/`, `e2e/` or `src/`.

## Status

- PR #416 (draft) holds the bug docs and four fixes, plus a fifth commit for a regression the
  end-to-end tests caught. Unit tests (1228), typecheck, lint, format and all 111 Chromium
  end-to-end tests pass on it.
- All 14 were rebuilt on the fixed code (round 2), with the same results as round 1 and 40%
  fewer field edits overall (about 1008 to 607): the biggest drops were theme (field edits 140 to 40), star (162 to 60), fullscreen (91
  to 30), cast (82 to 39) and bell (94 to 59). Nothing that worked before broke.
- Round 2 turned up follow-ups worth doing before this merges, mostly where new and pasted blocks
  land on the timeline, and the auto pivot being wrong for a star. See "Open issues".

## Where everything is

- **The gallery** (private Claude artifact): https://claude.ai/artifact/9RBTfPxLcs777ZQEhQddUd.
  Each of the 14 concepts plays three ways side by side at the same moment: the target, the build
  done by hand in Shape Shifter (its exported AVD, played back), and auto fix on the two raw
  Material icons. It also has the ranked gaps, the auto fix ideas and about 47 more ideas. The
  owner's reactions are in its `feedback` database (all 14 liked; the star's bursts were reworked
  after a "glitchy" note).
- **Files attached to the gallery** (read them with the Artifact tool's `read` and a `path`):
  - `harness/`: the scripts that drove the app (`browser.mjs`, `run.mjs`, `ui.mjs`, `block.mjs`),
    the frame tools, the auto fix runner, and the prototypes' renderer and concept data
    (`engine.js`, `concepts.js`).
  - `projects/round1/<concept>/` and `projects/round2/<concept>/`: the saved `.shapeshifter` files
    from both rounds. Open one with File > Open, and export the AVD from there.
  - `results/`: each builder's round 1 findings and round 2 results, with their counting rules.
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
| 4   | A notification arrives   | `notifications_none` → `notifications_active` (outlined) | Damped pendulum, lagging clapper, waves pop                | match, 20        |
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

| Concept    | Round 1                 | Round 2              | Blocks | What helped                                                                                                                                         |
| ---------- | ----------------------- | -------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| menu       | ~71 / 36 / 36           | 55 / 31 / 21         | 7      | Pivots came out right (6 edits saved); top bar's blocks pasted onto the bottom bar, then 2 edits                                                    |
| record     | ~49 / 30 / 29           | 44 / 24 / 23         | 6      | Pivot at the circle's center; the release block chained from 0.9                                                                                    |
| fullscreen | ~141 / 92 / 91          | 80 / 43 / 30         | 20     | Corner pivots (8 edits saved); one corner's 5 blocks pasted onto the others at their start times, then 10 mirrored values retyped                   |
| star       | ~249 / 172 / 162        | 130 / 82 / 60        | 37     | One burst's 6 blocks pasted onto the other four lines at once (about 100 edits saved)                                                               |
| cast       | ~171 / 101 / 82         | 109 / 69 / 39        | 19     | The dot's searching loop pasted onto each wave, offset in time                                                                                      |
| bookmark   | ~100 / 48 / 42          | 94 / 42 / 37         | 9      | The notch's spring-back chained from the dipped notch, so nothing snaps between keyframes; about the same work                                      |
| lock       | ~125 / 71 / 63          | 109 / 56 / 50        | 11     | The body came out with its hole in one Intersect; chained keyframes saved 6 to 10 values. Built with round 1's original lift, before it was lowered |
| mic        | ~76 / 46 / 41           | 74 / 45 / 40         | 8      | Nothing: none of the fixes touch its layers                                                                                                         |
| volume     | ~124 / 75 / 71          | 114 / 70 / 59        | 14     | The inner wave's blocks pasted onto the outer wave                                                                                                  |
| bell       | ~156 / 95 / 94          | 123 / 80 / 59        | 20     | The bell's swing pasted onto the clapper (12 values edited), the left wave onto the right; the bell stayed outlined after Break apart               |
| theme      | ~306 / 233 / 140        | 140 / 99 / 40        | 28     | One ray's 3 blocks pasted onto the other seven at 30 ms steps: 21 hand-made blocks became 21 clicks                                                 |
| copy       | ~196 / 150 / 101        | 183 / 131 / 99       | 22     | Chaining saved 6 from-values, but 3 came out stale (see open issues)                                                                                |
| download   | ~81 / 55 / 39           | 77 / 49 / 34         | 8      | The arrow's three translate keyframes chained by themselves                                                                                         |
| call       | ~41 / 23 / 17           | 39 / 21 / 16         | 3      | The pivot showed the exact point the canvas editor rotates around                                                                                   |
| **All 14** | **~1886 / 1227 / 1008** | **1371 / 842 / 607** |        | 27% fewer clicks, 31% fewer keys, 40% fewer field edits                                                                                             |

Nothing that worked in round 1 broke, and every build matches its round 1 result. But the fixes
made several existing timeline quirks matter more; they're under "Open issues". (The bell has 20
blocks in both rounds; round 1's report of 22 was a miscount.)

How much each fix mattered:

- **Paste onto selected layers** saved the most by far: theme, star, fullscreen, bell, volume and
  menu all reused one part's blocks on the others.
- **Chained keyframes** saved a few values per icon, but only when the playhead was past the
  previous block; otherwise the fix silently didn't apply (see "Open issues").
- **Holes kept** made the outlined bell and the lock body work in one step.
- **Own-center pivots** were right for the menu bars, fullscreen corners, the record button and
  the handset, but rarely match a part's motion otherwise: right for 1 of 9 animated parts in
  lock, mic, volume and bell (the keyhole). Hinges, shared centers and symmetry centers are the
  norm. Still better than (0, 0), which was never right.

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
- **New blocks can land in the gap before the playhead (bug).** A gap's distance from the playhead
  is the nearer of its two edges, never 0 when the playhead is inside it, so ties go to the
  earlier gap. In copy, with the playhead at 1948 ms after a zero-length block at 1800 ms in a
  2300 ms animation, both gaps scored 148 and new blocks landed at 1700 to 1800, taking the
  layer's value: three wrong values. Score a gap as 0 when it contains the playhead
  (`addBlockToAnimation` in `services/layertimeline.service.ts`).
- **A chained value goes stale when the block is moved.** The held value comes from where the
  block first lands, and isn't recomputed when its start or end is typed. In download, "+" with
  the playhead at 0 put the bar's second Scale Y block before the first (holding the layer's 1),
  and retiming it to after the first kept that 1, so the squash jumped. This happened 6 times in
  volume too. Placing the block after the last one (above) would fix most of it; re-chaining a
  hold block's values when it's moved, while they're unedited, would fix the rest.
- **A second paste goes back to the original layer.** Pasting selects the pasted blocks, which
  clears the layer selection, so pressing Cmd+V again pastes onto the layer the blocks were copied
  from. Keeping the layer selection after a paste would fix it.
- **A pasted block whose slot is taken moves to another gap without saying so.** The download
  arrow's morph, meant for 300 to 600 ms, landed at 0 to 300; a bell block meant for 570 ms
  landed at 110 ms. The snackbar counts a moved block as pasted, or blames the wrong one. A block
  that can't keep its time should be named, or not pasted. The old "Ignoring failed attempt to
  add animation block" console warning is still logged too.
- **Undo rewinds the playhead,** so a paste right after an undo lands at 0.
- **Blocks can't be range-selected.** Shift-click toggles one block, with no range or "select the
  row", so copying the bell's 7-block swing took 7 clicks.
- **Boolean operations keep the old pivot.** Intersect left the lock body at (12, 11.5) rather
  than its own center.
- **Breaking apart a single outlined shape still turns it solid.** `star_border` gives two filled
  stars, by the donut rule. That's as specified, but a designer reads it as broken; a hint in the
  snackbar would help.
- **Pasting at an exact time needs an exact playhead.** Clicking the ruler lands within a pixel
  (41 ms instead of 40), and there's no field to type the current time.
- **Pasted values can't be mirrored.** The fullscreen corners needed 10 of 15 pasted values
  retyped with their signs flipped. A "paste mirrored" (negate rotation, or translate X or Y)
  would cover symmetric parts.
- **Shapes drawn with the canvas editor pivot at the canvas center,** not their own center, so
  fix ICON-2 doesn't reach the Line, Rectangle and Ellipse tools.
- Everything in `docs/bugs/icon-animations.md` and IMPROVEMENTS.md's "Icon animation workflow".

## Next steps

1. Fix the follow-ups that the fixes made more visible, in this PR: the gap tie, placing "Add
   another keyframe" after the property's last block, the paste selection, moved and messages,
   and the pivot for symmetric shapes. Then rebuild star, copy, download and volume to confirm.
2. Show the pivot on the canvas and let it be dragged or snapped to a hinge, since own-center
   pivots are only sometimes right.
3. Animate several selected layers at once, with a stagger command: the largest remaining cost.
4. Auto fix's rotation fitting, then rounded-rect recognition.
5. Rerun the builds after each step, with the same counting, and compare.
