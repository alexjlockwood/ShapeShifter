# Timeline and UI bugs found by the 2026-09-25 sweep

- **A click that ends a drag reaches the workspace and clears the selection or exits action
  mode.** Drag-selecting text in the inspector and releasing over the canvas deselects the layer,
  and a split line drawn from one canvas to another resets action mode. When a press and release
  land on different elements, the browser sends the click to their common ancestor, past the
  panels' `stopPropagation`. Only clear when the press started on the workspace too
  (`components/root/Root.tsx`). (UI-1, medium, confirmed by a test)
- **The inspector's typed text outlives undo and selection changes, and is applied to the wrong
  layer.** Type in a path's name field, undo twice, and select a group: the group's field shows
  the path's text, and typing renames the group from it. Typed text is keyed by property name only,
  and Chromium doesn't fire blur when the input is removed, so it's never cleared. Key it by model
  and property, and clear it when either changes (`components/propertyinput/InspectedProperty.ts`).
  (UI-2, medium, confirmed by a test)
- **Renaming a layer to a case- or whitespace-variant of its own name adds `_1`.**
  `getUniqueLayerName` is asked to avoid the layer's own current name, so typing "Path" onto a
  layer named "path" renames it to "path_1" instead of leaving it as entered
  (`components/propertyinput/buildPropertyInputModel.ts`). (UI-3, confirmed by a test; a candidate
  fix exists on the unmerged `alex/fix-sweep-quick-wins` branch, needs a rebase before reuse)
- **A single wheel zoom step doesn't keep the time cursor in place.** One Ctrl+wheel notch zooms
  the timeline but doesn't scroll, so the time cursor jumps off screen (trackpad pinches work). The
  zoom goes through React state, and the scroll is set before the new width renders, so the
  browser clamps it. Scroll after the new width commits
  (`components/layertimeline/LayerTimelineController.ts`, `performZoomFn`). (UI-4, medium,
  confirmed by a test)
- **"Convert to clip path" is hidden whenever any layer has a non-path animation.** The menu
  button's visibility check looks at every block in the whole animation instead of just the blocks
  on the layer being converted, so an unrelated layer's rotation block hides the button on a path
  with only a `pathData` animation (`components/layertimeline/LayerListTree.tsx`). (UI-5, confirmed
  by an e2e test; a candidate fix exists on the unmerged `alex/fix-sweep-quick-wins` branch, needs
  a rebase before reuse)
- **Shift-scaling several blocks of one property can make them overlap.** With blocks from 0 to
  100 and 100 to 200 selected, Shift-dragging the second one's end to 10 ms gives 0 to 10 and 5
  to 15. Each block's minimum length is enforced by pushing its end out. Clamp the scale so every
  block keeps the minimum instead (`components/layertimeline/LayerTimelineController.ts`). (UI-6,
  low, confirmed by a test)
- **Shift-dragging a block's start edge moves its fixed end.** Shift-dragging the start of a block
  from 100 to 200 to 199 gives 199 to 209, where a plain drag clamps to 190 to 200. Give the scale
  a lower bound based on `MIN_BLOCK_DURATION`
  (`components/layertimeline/LayerTimelineController.ts`). (UI-7, low, confirmed by a test)
- **Snapping after clamping lets a multi-block move leave the animation.** When blocks are dragged
  together, the move is clamped for one block and then snapped for another, so a block can end
  past the end of the animation, or the blocks shift relative to each other near 0. Snap first,
  then clamp against every block (`components/layertimeline/LayerTimelineController.ts`). (UI-8,
  low, confirmed by a test)
- **Up and Down arrows in name and color fields throw or change the value.** ArrowUp in an empty
  or numeric name field throws, which is reported to Bugsnag, and in an empty color field it sets
  `#000000`. Only handle the arrows for number and fraction properties, and ignore empty input
  (`components/propertyinput/PropertyInput.tsx`). (UI-9, low, confirmed by a test)
- **Modifier+Up does nothing on integer times, while modifier+Down subtracts 1.** With Cmd or Ctrl
  held, the arrows step by 0.1, which `Math.floor` turns into no change going up and -1 going down
  for integer properties such as block times. Round instead, or step by 1
  (`components/propertyinput/PropertyInput.tsx`). (UI-10, low, confirmed by a test)
- **Recursive collapse leaves child paths stuck collapsed.** Shift-click a group's chevron, then
  click it again without Shift: the paths come back, but their property rows and blocks stay
  hidden, and paths have no chevron to expand them. Only collapse groups and the vector layer
  (`components/layertimeline/LayerListTree.tsx`, `services/layertimeline.service.ts`). (UI-11,
  low, confirmed by a test)
- **Clearing a layer or animation name field stores an empty name.** Blurring an emptied name
  field commits `""`, which shows a blank row and exports `android:name=""`
  (`components/propertyinput/buildPropertyInputModel.ts`). (UI-12, confirmed by a test; a
  candidate fix exists on the unmerged `alex/fix-sweep-quick-wins` branch, needs a rebase before
  reuse)
- **The inspector accepts block times that the timeline would reject.** The inspector stores an
  end time before the start time, past the duration, or overlapping another block of the same
  property. An end before the start exports a negative `android:duration`. Validate against the
  block's neighbors and the duration (`components/propertyinput/buildPropertyInputModel.ts`).
  (UI-13, low, confirmed by reading)
- **The wheel zoom can start from a stale zoom level.** Zoom in to the maximum, scroll one more
  notch, zoom to fit, then zoom out a little: the zoom jumps far in instead. The extra notch leaves
  `targetHorizZoom` at the maximum, and it's only reset when the zoom changes (the same happens at
  the minimum). Reset it when the zoom is clamped, and in `autoZoomToAnimation`
  (`components/layertimeline/LayerTimelineController.ts`). (UI-14, low, confirmed by a test)
- **The timeline header draws time labels past the end of the animation.** The label loop runs to
  the canvas width instead of stopping where the grid lines do, so an animation gets a label
  beyond its own end at some zoom levels, and can drop the end label to fractional layout rounding
  at others (`components/layertimeline/TimelineGridRenderer.ts`). (UI-15, confirmed by a test; a
  candidate fix exists on the unmerged `alex/fix-sweep-quick-wins` branch, needs a rebase before
  reuse)
- **File > Open and the demos replace the workspace without the prompt that New shows.** Opening a
  file or a demo replaces an edited workspace without the "Start over?" confirmation (Cmd+Z brings
  it back). Show the same confirmation (`components/layertimeline/LayerTimelineController.ts`).
  (UI-16, low, confirmed by reading)
