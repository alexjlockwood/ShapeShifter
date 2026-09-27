# Canvas bugs found by the 2026-09-25 sweep

- **The canvas paints the fill over the stroke.** `ctx.stroke()` runs before `ctx.fill()` in
  `drawPathLayer`, so the fill covers the inner half of the stroke and translucent fills blend
  wrong, unlike Android and the SVG exports, which draw the fill first
  (`components/canvas/CanvasLayers.ts`). (CANVAS-1, GitHub #286 and #168, confirmed by a test; a
  candidate fix exists on the unmerged branch `alex/fix-sweep-quick-wins`, which needs a rebase
  before reuse)
- **Split segments of fill-only paths can't be hovered or selected.** After splitting a filled
  subpath without a stroke, clicking the split segment selects the subpath instead, since the
  segment tolerance is half the stroke width. That makes "Delete segment" unreachable for most
  icons. Give segment hits a tolerance in viewport units (`components/canvas/SelectionHelper.ts`).
  (CANVAS-2, medium, confirmed by a test)
- **Hit and snap tolerances ignore the group transform.** In a scaled group, which imported
  VectorDrawables often have, distances in layer units are compared with tolerances in viewport
  units. At scale 0.1 a click 3 pixels from a point misses it, and at scale 10 a click 60 pixels
  away hits it. Divide the tolerances by the layer's scale (`components/canvas/CanvasOverlay.ts`,
  `performHitTest`). (CANVAS-3, GitHub #186, medium, confirmed by a test)
- **The trim path dash length uses the inverse matrix in scaled groups.** In a scaled group, a
  trimmed path's dashes are off by the square of the scale, so trims show repeating dashes (above a
  scale of 1) or don't trim (below it). Like the stroke width bug under "Open", the length is
  measured with `canvasToLayerMatrix` instead of `layerToCanvasMatrix`
  (`components/canvas/CanvasLayers.ts`). (CANVAS-4, GitHub #292 and #308, medium, confirmed by a
  test)
- **The trim path preview doesn't follow Android's rules for fills and later subpaths.** The
  preview only dashes the stroke, so trims never affect the fill, and every subpath is dashed.
  Android trims the path itself, uses it for the fill too, and only draws the first subpath. Build
  the trimmed path the way hwui does, or document the difference
  (`components/canvas/CanvasLayers.ts`). (CANVAS-7, low, confirmed by a test in part, and by
  reading hwui)
- **A selected clip path clips the selection outlines of later layers.** Selecting a clip path and
  then a later layer outside its clip hides that layer's outline, since `drawLayerSelections` calls
  `ctx.clip()` with no save or restore around the recursion
  (`components/canvas/CanvasOverlay.ts`). (CANVAS-8, confirmed by a test; a candidate fix exists on
  the unmerged `alex/fix-sweep-quick-wins` branch, needs a rebase before reuse)
- **Dragging a split point near another subpath snaps back on mouse up.** The drag preview restricts
  the projection to the point's own subpath, but the mouse up handler re-projects onto the closest
  subpath overall, so a point dragged near another subpath jumps back
  (`components/canvas/SelectionHelper.ts`). (CANVAS-9, GitHub #113, confirmed by a test; a candidate
  fix exists on the unmerged `alex/fix-sweep-quick-wins` branch, needs a rebase before reuse)
- **Right and middle clicks start drags outside of the canvas.** The panel splitter and the
  timeline's drags don't check `event.button`, and if the context menu swallows the mouseup, the
  drag keeps following the mouse. Only handle `button === 0`, and cancel drags on blur, like
  `components/canvas/CanvasInput.ts` does for the canvas (`components/splitter/Splitter.tsx`,
  `scripts/dragger/Dragger.ts`). (CANVAS-11, low, confirmed by reading)
