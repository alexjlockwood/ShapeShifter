# Bugs found building icon animations by hand

On 2026-10-04, fourteen icon animations were designed from Material icons (lock to unlock, mic to
mic off, the notification bell, light to dark theme, copy to check, menu to close, and others),
then built in the app by driving its UI the way a designer would: importing the icons, breaking
them apart, adding blocks in the inspector, fixing morphs in action mode, and using the canvas
editor where the classic UI couldn't do something. All fourteen could be built; ten matched their
target exactly and four came close. These are the bugs that got in the way. The missing features
are in `IMPROVEMENTS.md`, under "Icon animation workflow". Paths are relative to
`src/app/modules/editor/`.

## Layers and parts

- **A new path is invisible.** Add layer > New path makes a path with no fill, no stroke color and
  a stroke width of 0, so it shows nothing even after you type its path data, until you also give
  it a stroke or fill. (ICON-3, low, seen in the app)
- **A new clip path clips nothing.** Add layer > New clip path adds the clip after the selected
  layer's siblings (or at the end of the root), and a clip only affects the layers after it in its
  group, so it clips nothing until it's dragged above them. Converting a path to a clip path has
  the same problem when the path is the last in its group. Inserting the clip just above the
  selection would match what people expect (`services/layertimeline.service.ts`, `addLayer`).
  (ICON-4, medium, seen in the app)
- **A clip path made with Combine loses its hole.** Clip paths always fill with `nonZero`, and the
  canvas editor's shape tools all draw clockwise, so a rectangle combined with a circle and
  converted to a clip path clips to the whole rectangle, with no sign of why. Reversing the circle
  in the path inspector fixes it. Converting to a clip path could reverse holes as needed, or warn.
  (ICON-5, low, seen in the app)
- **Layer names are lowercased as you type,** with no message (`model/properties/NameProperty.ts`,
  `sanitize`). Android doesn't need lowercase names in an AnimatedVectorDrawable. (ICON-6, low,
  confirmed by reading)

## Timeline and inspector

- **Pasted blocks ignore the selected layer and their own timing.** Pasting copied blocks puts
  them back on the layer they came from, even with another layer selected, so one layer's
  animation can't be reused on another. Every pasted block starts at the playhead, so blocks
  copied from 0 and 140 ms both land in the next free gap, and the ones that don't fit are dropped
  with only a console warning ("Ignoring failed attempt to add animation block")
  (`services/clipboard.service.ts`, the paste handler). (ICON-8, medium, seen in the app)
- **Resizing an animated path changes every keyframe.** Changing a path's Layout fields, or
  scaling it with the canvas editor's selection box, with the playhead at the end of its path
  block, transforms its resting path and both ends of every path block. Point edits respect the
  keyframe at the playhead, so this is the one way to edit a path that doesn't
  (`components/canvas/transformLayers.ts`, `transformLayers`). (ICON-9, medium, seen in the app)
- **The timeline doesn't follow a new duration.** After the animation's duration goes from 300 to
  460 ms, the timeline still shows 300 ms, and blocks run off its right edge until you click Zoom
  to fit. (ICON-10, low, seen in the app)

## Canvas and canvas editor

- **The preview ignores an empty clip path, and Android doesn't.** A new clip path starts empty,
  and the canvas skips empty clip paths, so the layers after it still draw. Android clips to
  whatever path it gets (hwui's `ClipPath::draw`), so the same file hides them on a device
  (`components/canvas/CanvasLayers.ts`, `drawClipPathLayer`). Exporting empty path data is EXP-1
  in `docs/bugs/export.md`. (ICON-11, low, confirmed by reading)
- **Points can't be placed off the grid.** Dragging points snaps them to other points even with
  "Snap to pixel grid" off, and on a Mac the Line tool's first point always snaps, because Ctrl
  only turns snapping off once a drag has started (`docs/canvas-editor.md` notes the Ctrl limit).
  Several selected points have no X and Y fields, and the arrow keys nudge by whole units, so a
  point can't be put at, say, (16.5, 7.5) without typing path data. (ICON-12, medium, seen in the
  app)
- **Dragging a clip path's corner once bent its edge.** Dragging the second top corner of a
  rectangular clip path turned the edge next to it into curves instead of moving the point, while
  the first corner moved fine. The cause is unknown and it wasn't reproduced. (ICON-13, low, seen
  once in the app)

## Import

- **Imported icons are named "path".** An SVG whose path has no `id` (all of Material's) names its
  layer "path", then "path_1", and so on, while the "Morph into" offer after importing two icons
  names the files. Naming the layer after the file would help. (ICON-14, low, seen in the app)
- **The offer to morph two imported icons disappears in a few seconds.** It's a snackbar with a
  short timeout, so missing it means finding "Morph into" in the context menu. (ICON-15, low, seen
  in the app)
- **File > Save names the file after the root layer,** so every project saves as
  `vector.shapeshifter` unless the root is renamed, even when the animation has a name. (ICON-16,
  low, seen in the app)
