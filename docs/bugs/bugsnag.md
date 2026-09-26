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

| Error                                                                                              | Events | Years     | Status                        |
| -------------------------------------------------------------------------------------------------- | ------ | --------- | ----------------------------- |
| Property panel: "reading 'label'" (invalid line cap, line join, fill type, or interpolator)        | 21,000 | 2018-2026 | Fixed in the port             |
| Auto fix: "Error retrieving command mutation"                                                      | 13,000 | 2018-2026 | **Still present** (BUGSNAG-2) |
| Firefox private windows reject the service worker: "The operation is insecure"                     | 12,000 | 2018-2022 | Fixed in the port             |
| "Script error." from cross-origin scripts                                                          | 12,000 | 2018-2026 | Noise, now filtered           |
| Beta: clicking after closing action mode: "reading '_matrix'" of null                              | 9,000  | 2018-2026 | Beta only, unported           |
| Opening a demo offline: "Http failure response ... 504"                                            | 9,000  | 2018-2025 | Fixed in the port             |
| Firefox extensions: "Permission denied to access property 'apply'"                                 | 8,000  | 2018-2022 | Gone with zone.js             |
| Firefox timeline grid canvas too big: `NS_ERROR_FAILURE`                                           | 7,100  | 2018-2025 | Fixed in the port             |
| Blocks for missing layers: "reading 'animatableProperties'", AVD export "reading 'name'"           | 5,200  | 2018-2026 | Fixed in the port             |
| No localStorage: "reading 'present'", "'themeType'", "'nativeElement'"                             | 5,000  | 2018-2026 | **Still present** (BUGSNAG-1) |
| Action mode with an empty path block: "reading 'getSubPaths'"                                      | 4,000  | 2018-2026 | Fixed in the port             |
| Lone `M` after an open subpath: "Error retrieving command mutation", "Subpath index out of bounds" | 4,000  | 2018-2026 | **Still present** (BUGSNAG-3) |
| Up/Down in an empty color field: "Argument has incorrect type (number)"                            | 2,550  | 2018-2025 | **Still present** (BUGSNAG-4) |
| Undo while hovering a new split: "Subpath index out of bounds", "Command index out of bounds"      | 2,000  | 2018-2026 | **Still present** (BUGSNAG-5) |
| Typing "none" in a color field: "Argument has incorrect type (undefined)", then "reading 'a'"      | 1,100  | 2018-2026 | Fixed in the port             |
| Incomplete curves in production builds: bezier-js "reading 'x'", "reading 'filter'"                | 1,000  | 2018-2026 | **Still present** (BUGSNAG-6) |

## Still present

In rough order of priority.

- **The app shows a blank page when localStorage is unavailable.** The theme reducer reads
  `window.localStorage` while building its initial state, and `createEditorStore()` runs at the
  top of `src/main.tsx`. When storage is blocked (cookies or site data blocked in Chrome or
  Firefox, a sandboxed iframe) or null (WebViews with DOM storage off), the throw stops the module
  before anything renders. In Angular this surfaced as a cascade of "reading 'present'",
  "'themeType'", and "'nativeElement'" errors, about 5,000 events. The reducer's `setItem`, the
  `ResetWorkspace` rebuild of the theme state, and `components/splitter/Splitter.tsx` have the same
  exposure. Add a storage helper that falls back to memory, read the theme once in `src/main.tsx`,
  and persist it from `ThemeService` instead of the reducer (`store/theme/reducer.ts`).
  (BUGSNAG-1, high, confirmed by a test)
- **Auto fix throws when a subpath is only a move.** This is PATH-9, and the most common crash still
  in the code: 13,000 events, and every retry throws again. `alignSubPath` clamps the split index to
  1, which is past the end of a one-command subpath. Lone moves come from stray `M x y` in typed or
  pasted path data, arcs the parser drops (PATH-13 and the compact arc flags under "Open" in
  BUGS.md), and splitting a stroked subpath at an end point (PATH-7). Pad a one-command subpath
  like a collapsing subpath, and catch errors in `ActionModeService.autoFix` so the user gets a
  message (`scripts/algorithms/AutoAwesome.ts`). (BUGSNAG-2, high, confirmed by a test; the
  candidate fix for PATH-9 on `alex/fix-sweep-quick-wins` skips these subpaths instead)
- **A lone `M` after an open subpath is dropped from the visible subpaths.** `createSubPaths` ends an
  open subpath at the next `M` but drops that `M` when nothing follows it, while the path state
  still counts it. The `PathState` constructor then maps subpaths to the wrong states and throws
  "Error retrieving command mutation", and auto fix, `isClockwise`, and the hit tests read past the
  end ("Subpath index out of bounds"). `autoAddCollapsingSubPaths` runs after every action mode
  edit, so after PATH-7 almost any edit throws. This is the same root cause as "Reversing or
  shifting the first subpath drops a trailing lone `M`" in `path-model.md`, which rates it low;
  it's about 4,000 events. Start a new subpath at every `M` (`model/paths/SubPath.ts`).
  (BUGSNAG-3, high, confirmed by a test)
- **Up and Down arrows in an empty text field put a number into the property.** UI-9 describes the
  handler, but the reports show it's one of the most frequent errors on the live site, and it's
  worse for path fields than UI-9 says. `Number('')` is 0, so the handler calls `setEditableValue`
  with 1 or -1 (or 10 or -10 with Shift):
  - A color field reports "Argument has incorrect type (number)" to Bugsnag and turns black. That's
    2,550 events by 2020, and still 10 to 30 a week in 2025.
  - A path field (a new path or clip path layer's `pathData`, or an empty block value) stores
    `new Path(1)`, because the `Path` constructor keeps any non-string argument as its state. In
    production builds, drawing, the property panel, playback, hit tests, and every export then
    throw ("reading 'length'", "reading 'forEach'", "this.ps.hitTest is not a function").
  - A name field throws "toLowerCase is not a function".

  Only handle the arrows for number and fraction properties, and ignore empty input
  (`components/propertyinput/PropertyInput.tsx`). Also have the `Path` constructor throw for
  anything that isn't a string, a command array, or a `PathState`. (BUGSNAG-4, high, confirmed by
  tests)

- **Undo leaves the action mode splitters hovering indices that no longer exist.** Split a filled
  subpath or add a point, leave the mouse over the result, and press Cmd+Z. `ShapeSplitter` and
  `SegmentSplitter` only update their hover on mouse events, so `drawHighlights` asks for the old
  subpath or command and throws "Subpath index out of bounds: subIdx=1 numSubPaths=1" or "Command
  index out of bounds" (2,000 events). `autoFix()` and `shiftPointToFront()` don't clear the
  selections or the hover either. Reset the splitters when the active path changes, and skip
  out-of-range indices when drawing (`components/canvas/CanvasOverlay.ts`). (BUGSNAG-5, medium,
  confirmed by tests)
- **Production builds accept path data with missing curve numbers.** `PathProperty.setEditableValue`
  relies on `new Path()` throwing for bad input, but `Path` and `BezierCalculator` only build their
  curves eagerly in dev builds. So in production, typing a path one keystroke at a time stores
  every incomplete curve, like `M 0 0 Q 1 1` or `M 0 0 C 1 1 2 2`. bezier-js then builds a curve of
  the wrong order and throws "reading 'filter'" from the bounding box and "reading 'x'" from
  lengths and splits (1,000 events). Splitting such a curve writes a 3-point `C`, and morphing to
  one throws "Commands always have an end point" during playback. PATH-14 is another way to lose
  numbers. Validate that each command has whole groups of finite numbers in `PathParser`, whatever
  the build (`model/paths/PathParser.ts`, `model/properties/PathProperty.ts`). (BUGSNAG-6, medium,
  confirmed by tests with production mocked)
- **Auto fix in the toolbar throws after the active block is cut.** STORE-3 lists R, B, F, A, and
  Backspace; the toolbar's Auto fix button also throws "reading 'fromValue'" from
  `getActivePathBlockValue`, since the toolbar still shows it with nothing selected
  (`services/actionmode.service.ts`). (BUGSNAG-7, low, confirmed by a test)
- **Unsplitting in a reversed, shifted subpath leaves the shift offset out of range.** This is PATH-8.
  It's behind about 200 "reading 'start'" and "reading 'type'" errors from dragging, deleting, and
  auto fix. For example, reverse a closed subpath, add a point, press F, then delete the point.
  (BUGSNAG-8, medium, confirmed by a test)
- **Pasting or dropping in action mode does nothing and reports a warning.** The paste and drop
  handlers call `bugsnagClient.notify('Attempt to import files while in action mode')` and ignore
  the input. That's 221 warnings, from users who were probably trying to bring in the shape to
  morph into. Exit action mode and import, or show a snackbar, and leave a breadcrumb instead of
  reporting it (`services/clipboard.service.ts`, `components/root/Root.tsx`). (BUGSNAG-9, low,
  confirmed by a test)
- **A translucent vector layer with a non-square viewport can crash drawing in a small canvas.**
  The offscreen canvas's attributes are the viewport times the attribute scale, so a short side
  under 1 becomes 0, and compositing it throws "drawImage ... canvas element with a width or height
  of 0". It was still reported in August 2026. Round the size up to at least 1, or skip the
  composite (`components/canvas/CanvasLayers.ts`). (BUGSNAG-10, low, confirmed by a browser test)
- **Splitting in half after a subpath split can pick an undefined command type.**
  `CommandStateMutator.split` looks up the new command's type by split time, which is undefined when
  the time is past the command's last split ("Attempt to convert an undefined svgChar"). Related to
  PATH-4. Clamp split times to the command's range (`model/paths/CommandState.ts`). (BUGSNAG-11,
  low, found by a fuzz test)
- **Smaller issues:**
  - The drop target handlers assume `event.dataTransfer` isn't null, which fails for
    script-created drag events ("t.dataTransfer is null", about 40 in Firefox)
    (`components/root/useDropTarget.ts`).
  - Pasted block JSON keeps its `layerId`, and ids restart on every page load, so blocks copied
    in another tab or before a reload can silently animate an unrelated layer
    (`services/layertimeline.service.ts`).
  - `serializeNamespace(node, options.isRootNode)` passes a boolean where it expects the options.
    It can't be reached with the roots the serializers create today
    (`scripts/export/XmlSerializer.ts`).
  - `new FileReader()` and `readAsText` aren't guarded, and Safari with restricted features has
    thrown "Can't find variable: FileReader" (`services/fileimport.service.ts`).
  - The demo fetch's error handler reads `navigator.serviceWorker.controller`, which throws where
    `navigator.serviceWorker` is undefined. Its catch also hides errors from loading the demo
    itself, like a model change that breaks `fromJSON`, behind "Couldn't fetch demo"
    (`components/layertimeline/LayerTimelineController.ts`, `components/root/Root.tsx`).
  - The rulers aren't capped at the maximum canvas size the way the timeline is now. It's rare on
    the live site, where the zoom is always 1, but it was the beta zoom tool's
    most common error (`components/canvas/CanvasRuler.ts`).

## Error reporting

- **Old copies still report under the same API key.** Saved copies of the page, forks, a desktop
  AVD player, and an Adobe extension that bundle old builds sent about 30% of all
  notifications, and they don't have `isReportable`. Discard events whose app version isn't 2.x in
  the Bugsnag project settings, or give 2.0 a new API key (`scripts/bugsnag/index.ts`).
- **Page-injected scripts still get through `isReportable`.** Cross-origin extension errors arrive
  as "Script error." and are dropped, but Safari `webkit-masked-url://` frames, `user-script:`
  frames, crypto wallet rejections, and rejections whose reason isn't an Error are reported. Drop
  events whose top frame isn't on the page's origin.
- **Service worker failures on the live site are now invisible.** `onRegisterError` only leaves a
  breadcrumb, which is right for private windows and Googlebot, but hides install and script
  evaluation failures that mean a deploy is broken offline. Report those with severity `info`
  (`src/main.tsx`).

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
