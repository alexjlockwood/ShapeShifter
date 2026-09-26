# Bugs found in eight years of Bugsnag reports

Bugsnag emailed a notification for every new error group, and again at its 10th, 100th, 1000th,
and later events, plus a weekly summary with event counts. On 2026-09-26 the Gmail export of those
emails (about 2,300 notifications and 440 summaries, May 2018 to September 2026) was parsed and
grouped by error, message, and top stack frame. Each group was traced to the Angular source that
produced it (commit `56ee03da`, the 1.0.15 release that ran on shapeshifter.design until the React
port) and then checked against the current code. Paths are relative to `src/app/modules/editor/`.

How to read the numbers:

- Event counts are lower bounds: the highest milestone email or weekly all-time count seen for the
  error. Bugsnag doesn't email every event, and some groups were split or merged over the years.
- Session stability, reported weekly from 2021, averaged about 98.5%, so roughly 1 in 70 sessions
  hit an unhandled error. Those figures include the noise described at the end.
- "Stable" is shapeshifter.design (1.0.15-stable and older). "Beta" is beta.shapeshifter.design,
  which ran the unported paper.js editor.
- "Confirmed by a test" means a throwaway Vitest spec reproduced the throw through the current
  code. The specs were deleted afterward.

## The most common errors

Ranked by events. Everything not marked "beta" happened on the live site.

| Error                                                                                              | Events | Years     | Status              |
| -------------------------------------------------------------------------------------------------- | ------ | --------- | ------------------- |
| Property panel: "reading 'label'" (invalid line cap, line join, fill type, or interpolator)        | 21,000 | 2018-2026 | Fixed in the port   |
| Auto fix: "Error retrieving command mutation"                                                      | 13,000 | 2018-2026 | Fixed               |
| Firefox private windows reject the service worker: "The operation is insecure"                     | 12,000 | 2018-2022 | Fixed in the port   |
| "Script error." from cross-origin scripts                                                          | 12,000 | 2018-2026 | Noise, now filtered |
| Beta: clicking after closing action mode: "reading '_matrix'" of null                              | 9,000  | 2018-2026 | Beta only, unported |
| Opening a demo offline: "Http failure response ... 504"                                            | 9,000  | 2018-2025 | Fixed in the port   |
| Firefox extensions: "Permission denied to access property 'apply'"                                 | 8,000  | 2018-2022 | Gone with zone.js   |
| Firefox timeline grid canvas too big: `NS_ERROR_FAILURE`                                           | 7,100  | 2018-2025 | Fixed in the port   |
| Blocks for missing layers: "reading 'animatableProperties'", AVD export "reading 'name'"           | 5,200  | 2018-2026 | Fixed in the port   |
| No localStorage: "reading 'present'", "'themeType'", "'nativeElement'"                             | 5,000  | 2018-2026 | Fixed               |
| Action mode with an empty path block: "reading 'getSubPaths'"                                      | 4,000  | 2018-2026 | Fixed in the port   |
| Lone `M` after an open subpath: "Error retrieving command mutation", "Subpath index out of bounds" | 4,000  | 2018-2026 | Fixed               |
| Up/Down in an empty color field: "Argument has incorrect type (number)"                            | 2,550  | 2018-2025 | Fixed               |
| Undo while hovering a new split: "Subpath index out of bounds", "Command index out of bounds"      | 2,000  | 2018-2026 | Fixed               |
| Typing "none" in a color field: "Argument has incorrect type (undefined)", then "reading 'a'"      | 1,100  | 2018-2026 | Fixed in the port   |
| Incomplete curves in production builds: bezier-js "reading 'x'", "reading 'filter'"                | 1,000  | 2018-2026 | Fixed               |

## Fixed since the port

These were still in the code when the reports were traced, and were fixed afterward.

- Auto fix threw on a subpath that's only a move (PATH-9, 13,000 events). It now pads the move to
  match the subpath it's paired with, and the Auto fix action shows a message if it still fails.
  (BUGSNAG-2)
- A lone `M` after an open subpath was dropped from the visible subpaths while the path state still
  counted it (4,000 events). Every `M` now starts a subpath. (BUGSNAG-3)
- Production builds stored curves with missing numbers (1,000 events). The parser skips an
  incomplete group of numbers, whatever the build. (BUGSNAG-6)
- The toolbar's Auto fix threw after the block being edited was cut. Cut only copies in action
  mode, and the action mode edits do nothing without a block. (BUGSNAG-7)
- Unsplitting in a reversed, shifted subpath left the shift offset out of range (PATH-8, about 200
  events). (BUGSNAG-8)
- Splitting in half after a subpath split could pick an undefined command type (PATH-4). The split
  time is now measured along the curve and clamped to the command's range. (BUGSNAG-11)

## Error reporting

- **Old copies still report under the same API key.** Saved copies of the page, forks, a desktop
  AVD player, and an Adobe extension that bundle old builds sent about 30% of all
  notifications, and they don't have `isReportable`. Discard events whose app version isn't 2.x in
  the Bugsnag project settings, or give 2.0 a new API key (`scripts/bugsnag/index.ts`).

## Fixed in the port

Each of these was checked against every stack trace in the reports.

- "reading 'label'" (21,000 events): invalid enum values, mostly from the `SvgLoader` line join
  bug, are replaced on set (`7ae9d739`, `1f78c126`).
- Firefox service worker and "Rejected" registration failures (12,000 plus 440): `registerSW`
  catches them.
- Offline demo fetches (9,000): caught, and the demos are precached.
- The timeline grid canvas in Firefox (7,100): capped at 16,384 pixels (`d8eabc32`).
- Blocks whose layer is missing from the rendered or exported tree (5,200) (`fc991051`). The ways
  blocks get orphaned, STORE-5 and STORE-15, are still open, and orphans are still written to
  `.shapeshifter` files, though loading drops them.
- "reading 'getSubPaths'" (4,000) and the toolbar's "reading 'fromValue'" (100) (`7d0b789a`).
- "none" and other non-Android colors (1,100) (`7ae9d739`, `707764f0`).
- Exports with the root layer hidden (255) (`174d99e0`).
- Action mode canvases with no active block (146), dragging a split point when the projection
  fails (133), and hit testing in a group scaled to 0 (21) (`9b2b9b3e`).
- Deleting a split segment without a parent command is a warning now, though the root cause is
  still open (see "Open" in BUGS.md).
- Stale selections in the property panel and the timeline, the `ga` global blocked by ad blockers,
  and IE and legacy Edge failures (`createDocument(undefined)`), which the new build doesn't run in
  anyway.

## Beta only (paper.js)

The paper.js editor isn't ported, so these don't affect the live site, but a port would bring them
back. They were checked against paper.js 0.11.5 and rxjs 6.3.3 outside the app.

- **Closing action mode leaves the old paper.js tool active.** This confirms the "not yet
  verified" `PaperProject.remove()` item under "Open" in BUGS.md, and it's the top beta crash
  ("reading '_matrix'" of null, 9,000 events, plus 1,000 for "reading 'globalMatrix'"). The canvas
  remounts, but paper.js only activates a new tool when none is active, and the old tool's
  `GestureTool` caches the removed project's layer, so every click hit-tests a project with no
  view. Under StrictMode a port would hit it on the first load. Remove the tool in
  `PaperProject.remove()` and read `paper.project.activeLayer` when needed
  (`scripts/paper/tool/GestureTool.ts`, `scripts/paper/PaperProject.ts`).
- **Gestures keep getting events after their `onMouseDown` threw or before their first drag**
  (about 4,300). Holding Shift or Alt with the shape tools throws "reading 'vpDownPoint'" on every
  key repeat, pressing Escape mid-drag throws "reading 'pathData'", and a failed mouse down throws
  "reading 'keys'" on every drag (`scripts/paper/gesture/`).
- **Paths without a fill or stroke report a color warning on every redraw** (4,000 events, shared
  with the stable color field warning) (`scripts/paper/item/PaperLayer.ts`).
- **Hit testing throws inside a group scaled to 0**, since `globalToLocal` returns null (about 1,250).
- **The Vector tool enters edit path mode on a group or the vector layer** (1,000), which has no
  segments.
- Smaller: NaN in path data breaks paper.js's parser (the `a` in `NaN` reads as an arc), a click just
  past an open path's end point throws in `divideAtTime`, handle images that failed to load are
  drawn anyway, and after any error rxjs 6 silently unsubscribed the canvas from the store (which
  rxjs 7 no longer does).

## Noise

Not bugs in Shape Shifter, and mostly filtered or gone in 2.0: "Script error.", browser extensions
and userscripts, crypto wallets, Googlebot's renderer rejecting service workers, Angular bootstrap
errors from saved copies and embeds, Angular animations' `getComputedStyle` errors, Firefox "dead
object" and "shutdown" errors, and IE-only failures.
