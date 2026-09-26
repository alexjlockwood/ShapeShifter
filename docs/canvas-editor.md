# Canvas editor

A design for editing and drawing paths directly on the canvas, the way Figma and Sketch do. It
covers what the old paper.js editor did, why the new one is built on the current canvas instead,
the architecture, a phased roadmap, and the risks. Paths are relative to `src/app/modules/editor/`
unless they start with `src/`, `e2e/`, `public/`, or `docs/`.

## Why

Once an SVG is imported, Shape Shifter is mostly read-only. The only way to change a path is to
type into its `pathData` text field in the property inspector, which re-parses the whole string on
every keystroke. On the canvas, the only thing you can drag is a split point in action mode
(`components/canvas/SelectionHelper.ts`). You can't move an anchor or a handle, draw a shape, move
a layer, zoom, or pan.

The goal is an editor that feels like a native design tool: select, move, and transform layers,
edit points and handles, draw with a pen, snap to the canvas, other layers, guides, and the pixel
grid, and use the keyboard shortcuts people already know from Figma and Sketch. It's built behind
a feature flag so it can be developed on master and deployed switched off.

## The old paper.js editor

The old editor was written in 2017-18 (262 commits, the last feature in June 2018) and only
shipped as a separate beta build at beta.shapeshifter.design, which has since been retired. It was
mounted only outside action mode, and it only ever edited the static layer tree, never animation
blocks. Its code is still in the repo but isn't compiled (see "Code to leave alone" in the root
`AGENTS.md`). The `paper`, `jquery`, and `@angular/core` packages it needs were uninstalled
during the React migration.

### What it had

- Select, move, and marquee select (Alt selects only fully enclosed layers). Double-click drills
  into groups.
- Scale with eight handles (Shift keeps the aspect ratio, Alt scales from the center), a separate
  rotate mode (Shift snaps to 15 degrees) with a draggable pivot, and an unfinished four-corner
  distort.
- A vector tool: clicking adds a point after the selected endpoint, dragging pulls out mirrored
  handles, and clicking the other endpoint closes the path. Clicking a curve inserts a point
  (Shift inserts at its midpoint), double-clicking a point switches it between corner and smooth,
  Cmd-drag bends a curve, and Backspace deletes points.
- Rectangle and oval tools (Shift for a square or circle, Alt to draw from the center), and a
  pencil that smooths the stroke on release.
- A zoom tool, and holding Space to pan.
- Snapping of moves to the bounds of sibling layers and to the canvas edges and center, with red
  guides and distance labels. Scaling snaps to sibling sizes.

### What was missing or broken

- **Only one subpath per layer.** Every layer was loaded into a single `paper.Path`, and paper.js
  ignores every `M` after the first once a path has points. So `M0 0 L10 0 L10 10 Z M20 20 ...`
  became one merged outline, and the first edit, scale, rotate, or distort wrote it back to the
  store. Icons with holes were destroyed. `EditPathInfo` stores flat point indices with no subpath
  index, and the pen could only extend the first or last point. `CompoundPath` support was a TODO
  throughout `scripts/paper/item/PaperLayer.ts`.
- **Lossy round trips that break morphing.** Paths went to paper.js as a string and came back as
  paper's `pathData`. Along the way Q became C, a C with zero-length handles became L, an explicit
  closing `L` before `Z` was dropped (changing the command count), and command ids and split,
  reverse, and shift state were regenerated. `Path.isMorphableWith` needs the same number and
  types of commands, so even a plain rotate could break a morph.
- **Editing animated layers.** The editor read the animated layer tree at the current time and
  wrote the whole tree back as the static one. At any time after 0, an edit baked every animated
  value into the base layers. Edits to a path whose `pathData` was animated at the current time
  seemed to do nothing, since the next render showed the block's value again.
- Alt-drag to duplicate was a TODO (`SelectDragCloneItemsGesture`). Handles had no modes. Snaps
  were computed but never applied while dragging points. There were no tool hotkeys, no arrow key
  nudging, no pixel grid snapping, no user guides, and no snapping across groups. Tolerances
  weren't divided by the zoom, so they grew on screen as you zoomed in.
- Several bugs found by reading the code: Escape during a shape drag makes the mouse up throw,
  distort bends every handle wrongly, the vector tool treats a selected group as a path, and hit
  tests prefer the bottom layer when shapes overlap. There are 106 TODOs and no tests.

### What's worth keeping

- The gesture state machine: `tool/GestureTool.ts` picks a gesture on mouse down from the tool
  mode, the hit test, and the modifiers, runs it until mouse up, and goes back to hovering.
- The catalog of gestures and their modifier keys, which already follow Sketch closely.
- The snapping math in `scripts/paper/util/snap/SnapUtil.ts` and `SnapBounds.ts`, and the curve
  bending math in `MouldCurveGesture.ts`.
- The cursor images in `public/assets/cursor/` and `public/assets/paper/`, and the tool icons in
  `public/assets/tools/`.
- The compiled `store/paper/` slice, whose shape (tool mode, selection box, edit path info, snap
  guides, zoom and pan, cursor) fits the new editor's transient state.

## Is paper.js the right library?

Not as the editor's engine.

- **It's dormant.** The last release is 0.12.18 (July 2024), and there have been no commits since.
  There are hundreds of open issues, unanswered boolean operation bugs from 2025 and 2026, and a
  public report of an XSS in `importSVG` (issue 2100, March 2026) that has had no response. It
  has no ESM build, weighs about 84 KB gzipped, and can't be tree-shaken.
- **Its model doesn't fit.** paper.js stores only cubic curves, merges the closing point, and
  regenerates everything that Shape Shifter's `Path` tracks for morphing (command types and ids,
  split points, reversal, and shift). Keeping two path models in sync is where most of the old
  editor's data loss came from.
- **It fights the renderer.** It wants to own the canvas size, the device pixel ratio, and the
  view matrix. It clips every sibling with the first clip mask in a group, where Android only
  clips the layers after it, and it scales strokes with group matrices. Its single global scope
  doesn't sit well with React's StrictMode, which mounts everything twice in development.

So the new editor is built on Shape Shifter's own `Path` model and the existing Canvas2D
renderer, and ports the old editor's design and logic rather than its paper.js calls.

Geometry doesn't need paper.js:

- `bezier-js`, already a dependency, has nearest point on a curve, split, bounding boxes,
  intersections, and lengths.
- `Path2D` with `isPointInPath` and `isPointInStroke` covers hit testing, including fill rules.
- Boolean operations and pencil simplification can come later from a lazily loaded headless
  `paper-core` or from `pathkit-wasm` (Skia's PathOps), neither of which needs to touch the
  renderer.

Other libraries considered and rejected: Konva, Fabric.js, two.js, Pixi, and the tldraw SDK. Each
brings a scene graph and path model of its own that would compete with the morph model, and
tldraw's license isn't open source. Useful references instead:

- Penpot, whose paths are lists of commands like Shape Shifter's, not networks.
- Excalidraw's `snapping.ts` (MIT), the most portable snapping implementation.
- Graphite's snapping code (MIT or Apache), which covers snapping while editing paths.

## Vector networks

Figma's [vector networks](https://www.figma.com/blog/introducing-vector-networks/) replace paths
with a graph: any two points can be joined, edges have no direction, and fills are computed from
the regions the edges enclose. That makes branching strokes and region fills easy, but it's the
wrong model for Shape Shifter:

- `AnimatedVectorDrawable` morphing and trim paths need ordered, directed paths whose commands
  match one to one. A graph has to be turned into paths by picking a traversal, and a small edit
  can change the traversal, which breaks the morph.
- Stroke joins at a point with three or more edges can't be expressed in SVG or VectorDrawable.
- Per-region fills turn one shape into several `<path>`s, which multiplies the morph targets.
- They're hard to get right. Graphite, which added branching "vector meshes", still drew their
  fills wrong in late 2025.

The editor keeps ordered subpaths and borrows the ideas instead: bending a segment by dragging it
with Cmd held, point types (straight, mirrored, asymmetric, disconnected), joining and averaging
endpoints, and a "paint bucket" only as a boolean operation that produces a new ordered path.

## Architecture

1. **A feature flag.** `canvasEditor` has a build-time default from the `VITE_CANVAS_EDITOR`
   environment variable (on in development, off in production builds), and a runtime override:
   `?editor=1` or `?editor=0` in the URL, remembered in localStorage, and `?editor=default` to
   forget it. It's read once per page load and passed to the services. The editor itself is a
   lazily loaded chunk, so users with the flag off never download it.
2. **A camera.** A pure class holds the zoom and pan and converts between three coordinate
   spaces: viewport units (the vector layer's), panel CSS pixels, and device pixels. It zooms
   around a point, fits the artboard in the panel, and clamps panning. Its state lives in a
   service outside Redux, since wheel events arrive 60 to 120 times a second and shouldn't be
   undo steps. The canvases are sized to their panel rather than to the artboard, so memory stays
   flat at any zoom, and all three action mode canvases share one camera so the start and end
   paths stay aligned.
3. **Pointer input.** Pointer events with pointer capture replace the React mouse handlers, so a
   drag keeps going when the pointer leaves the canvas, and touch and pen input can work later. A
   small router decides who gets each gesture: panning, the editor's tools, or the existing
   action mode helpers.
4. **Previewing edits.** A gesture keeps a working copy of the paths it changes, and the canvases
   draw that copy until the gesture ends. The edit is dispatched once, on pointer up, as its own
   undo step. Dispatching on every pointer move would rebuild the animation renderer each time
   and split one drag into several undo steps.
5. **Path editing operations.** Pure functions over a path's commands, in a new module next to
   `Path`, that keep command ids:
   - moving an anchor (updating the command's end, the next command's start, and the start and
     `Z` of a closed subpath together)
   - moving a handle, with a mode for mirrored, asymmetric, and disconnected handles
   - inserting an anchor (a real split, not action mode's reversible one)
   - deleting an anchor, which merges its two segments with a fitted curve
   - setting a point's type, adding points at either end for the pen, closing and starting
     subpaths, joining endpoints, and reversing

   An "anchor view" derived from the commands lists each anchor with its incoming and outgoing
   handles, indexed by subpath and command, for drawing and hit testing. Multiple subpaths are
   supported from the start. Moving points and handles never changes a path's structure, so it
   can't break a morph. The operations that do (adding or deleting points, and turning a line
   into a curve) are checked against the other end of the morph.

6. **Tools as state machines,** ported from `GestureTool` and kept in the lazy chunk. They get the
   first chance at pointer events when the flag is on and action mode is off.
7. **A snap engine.** A pure module collects candidates: the canvas edges, center, and midpoints;
   the corners, edge midpoints, and centers of the layers that aren't selected; guides; the
   pixel grid, which matters for icons drawn on a 24 unit grid; and, while editing a path, its
   anchors and the nearest point on each curve. It snaps x and y separately to the nearest
   candidate within 8 screen pixels (divided by the zoom), and returns the guide lines to draw.
   Holding Ctrl turns snapping off for a moment. It starts from `SnapUtil` and borrows from
   Excalidraw.
8. **Rulers and guides.** Ruler ticks follow the zoom, and dragging from a ruler creates a guide.
   Guides are editor state saved in the `.shapeshifter` file and never exported. Shift+R toggles
   the rulers.

## Keyboard shortcuts

Figma's mapping is the default, since it's also a web app and avoids shortcuts the browser takes
(Cmd+R reloads, Cmd+1 switches tabs):

| Action                     | Shortcut                                            |
| -------------------------- | --------------------------------------------------- |
| Move, pen, pencil          | V, P, Shift+P                                       |
| Rectangle, ellipse, line   | R, O, L                                             |
| Zoom in, zoom out          | Cmd+=, Cmd+-                                        |
| Zoom to fit, zoom to 100%  | Shift+1, Shift+0                                    |
| Pan                        | Hold Space and drag, or drag with the middle button |
| Duplicate                  | Alt-drag, Cmd+D                                     |
| Nudge                      | Arrow keys (1 unit), Shift+arrow keys (10 units)    |
| Edit a path, stop editing  | Enter or double-click, Enter or Esc                 |
| Point types                | 1 to 4, as in Sketch                                |
| Bend a segment             | Cmd-drag                                            |
| Next point, previous point | Tab, Shift+Tab                                      |
| Rulers                     | Shift+R                                             |
| Measure distances          | Hold Alt                                            |
| Turn snapping off          | Hold Ctrl                                           |

Some of these clash with the app's shortcuts (`services/shortcut.service.ts`): R toggles repeat,
S toggles slow motion, A, D, B, and F are action mode tools, Space plays and pauses, and the
arrow keys rewind and fast forward. Tool letters only apply when the flag is on and action mode is
off. With the flag on, Space pans while held and plays or pauses when tapped. Repeat and slow
motion keep their toolbar buttons.

## Roadmap

Phase 0 is the foundation, and it's split into small pull requests:

1. This document.
2. Keep UI state out of the undo history (the `paper` slice entry in `BUGS.md`, and STORE-2 in
   `docs/bugs/store-and-services.md`).
3. The feature flag and the lazily loaded editor chunk.
4. Remove the old `environment.beta` flag and the paper-era behavior it guards.
5. Size the canvases to their panel and draw through a camera that only fits for now. This is the
   one change users with the flag off could notice, so it's checked against the old drawing code.
6. Camera state, and ruler ticks that follow the zoom (CANVAS-5 and CANVAS-6 in
   `docs/bugs/canvas.md`).
7. Pointer input (CANVAS-10, part of CANVAS-11, and UI-1 in `docs/bugs/timeline-and-ui.md`).
8. Zoom and pan, with the flag on.
9. Previewing edits during a gesture, committed as one undo step.

After that:

| Phase | Scope                                                                                                                                                                                                                                                                                                                               | Estimate       |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| 1     | Selecting and transforming layers: hover outlines, click and marquee selection, moving (Shift locks the axis), Alt-drag to duplicate (with new ids and names, and the animation blocks copied), arrow key nudging, scale and rotate handles, and the first snapping. Moving or scaling a path also transforms its animation blocks. | 1.5 to 2 weeks |
| 2     | Editing paths: Enter or double-click to start, selecting and marquee selecting points across subpaths, dragging anchors and handles, point types, adding a point on a segment, deleting points, bending segments, Tab between points, and snapping to geometry.                                                                     | 2 to 3 weeks   |
| 3     | Drawing: a pen (click for a corner, drag for a smooth point, Alt to break the handles, Shift for 45 degree angles, click the first point to close, Enter or Esc to finish, and starting a new subpath in an existing path), rectangle, ellipse, and line tools, and a pencil. New layers go into the selected group.                | 1.5 to 2 weeks |
| 4     | Rulers and guides, measuring distances with Alt, equal spacing snaps, and pixel grid settings.                                                                                                                                                                                                                                      | 1 week         |
| 5     | Editing animated paths: at the start or end of a path animation block, edits change that end of the morph, with a live badge that says whether the two ends still morph, and a button to run auto fix. Between the ends, editing is disabled with a hint.                                                                           | 1 to 2 weeks   |
| 6     | A structured path inspector that lists subpaths and points with x and y fields (keeping the text field under "Advanced"), joining, reversing, and closing subpaths, boolean operations and outlining strokes, and touch.                                                                                                            | 1 to 2 weeks   |

Once the new editor covers what the old one did, the old code, its exclusions, and
`src/test/paperExclusions.spec.ts` can be deleted.

## Risks and edge cases

- **Morph compatibility.** Structural edits to one end of a morph break the pairing. Show that as
  it happens, never run auto fix without asking, and keep action mode as the place to fix morphs.
  The editor is off in action mode.
- **Animated layers.** Paths have no position of their own, so moving a path layer transforms its
  `pathData`. Its path animation blocks have to be transformed too, or the morph jumps, as
  `LayerTimelineService.flattenGroupLayer` already does for groups. Don't allow edits in the middle
  of an interpolation, and never write animated values into the base layers.
- **Transforms.** Pointer positions are mapped into a layer's own coordinates with the inverse of
  `LayerUtil.getCanvasTransformForLayer`. Group bounds have to transform all four corners
  (MODEL-9 in `docs/bugs/layers-and-properties.md`). Decide how stroke widths behave when scaling
  (CANVAS-4 in `docs/bugs/canvas.md`, and the scaled group stroke width entry in `BUGS.md`).
- **Path invariants.** The first `M` has no start point, each command starts where the previous
  one ended, and collapsing subpaths come last (see `model/paths/AGENTS.md`). Path strings are
  rounded to 3 decimals, so snapping should produce values at that precision. A subpath that's
  only an `M` still breaks several operations ("Reversing or shifting the first subpath drops a
  trailing lone `M`" in `docs/bugs/path-model.md`), so the pen needs that fixed first. The parser
  also accepts incomplete curves, which the editor mustn't produce.
- **Hit testing.** Tolerances are in screen pixels, so they're divided by the zoom and by the
  layer's scale (CANVAS-3). Filled subpaths without a `Z` should still be hit by their fill
  (PATH-17). Clip paths are editable but drawn as outlines.
- **Names and ids.** Duplicated and new layers need unique names, since the
  `AnimatedVectorDrawable` export targets layers by name (`LayerUtil.getUniqueLayerName`), and new
  ids with their blocks remapped (`regenerateModelIds` in `scripts/common/ModelUtil.ts`).
- **Shortcut priority.** Esc and Backspace mean different things to the pen, path editing,
  action mode, and the layer list, so they need a clear order.
- **Performance.** No store dispatches during a drag. The whole layer tree is redrawn every
  frame, which is fine at icon sizes.
- **Testing.** Keep the logic in plain modules (the camera, the path editing operations, the snap
  engine, and the tools driven by synthetic events) with unit tests. The end-to-end tests that
  click on the canvas have to find points through the artboard's position rather than assuming
  the canvas fits it.
