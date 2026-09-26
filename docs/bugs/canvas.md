# Canvas bugs found by the 2026-09-25 sweep

- **The canvas paints the fill over the stroke.** `ctx.stroke()` runs before `ctx.fill()` in
  `drawPathLayer`, so the fill covers the inner half of the stroke and translucent fills blend
  wrong, unlike Android and the SVG exports, which draw the fill first
  (`components/canvas/CanvasLayers.ts`). (CANVAS-1, confirmed by a test; a candidate fix exists on
  the unmerged branch `alex/fix-sweep-quick-wins`, which needs a rebase before reuse)
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
- **A selected clip path clips the selection outlines of later layers.** Selecting a clip path and
  then a later layer outside its clip hides that layer's outline, since `drawLayerSelections` calls
  `ctx.clip()` with no save or restore around the recursion
  (`components/canvas/CanvasOverlay.ts`). (CANVAS-8, confirmed by a test; a candidate fix exists on
  the unmerged `alex/fix-sweep-quick-wins` branch, needs a rebase before reuse)
- **Dragging a split point near another subpath snaps back on mouse up.** The drag preview
  restricts the projection to the point's own subpath, but the mouse up handler re-projects onto
  the closest subpath overall, so a point dragged near another subpath jumps back
  (`components/canvas/SelectionHelper.ts`). (CANVAS-9, confirmed by a test; a candidate fix exists
  on the unmerged `alex/fix-sweep-quick-wins` branch, needs a rebase before reuse)
- **The shape splitter's hover highlight sticks after the mouse leaves the canvas.**
  `onMouseLeave` reruns the hit test instead of clearing it, and returns early when no drag is in
  progress, so the orange highlight and preview point stay on screen
  (`components/canvas/ShapeSplitter.ts`). (CANVAS-10, confirmed by a test; a candidate fix exists
  on the unmerged `alex/fix-sweep-quick-wins` branch, needs a rebase before reuse)
- **Right and middle clicks start gestures.** Nothing checks `event.button`, so a right-click adds
  a point in add points mode, leaves pair and split modes, or selects a layer. If the context menu
  swallows the mouseup, a drag keeps following the mouse. Only handle `button === 0`, and cancel
  drags on blur (`components/canvas/CanvasOverlay.ts`, `components/splitter/Splitter.tsx`,
  `scripts/dragger/Dragger.ts`). (CANVAS-11, low, confirmed by reading)
