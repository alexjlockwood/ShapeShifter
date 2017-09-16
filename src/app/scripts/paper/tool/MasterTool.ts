import { Layer, LayerUtil, PathLayer } from 'app/model/layers';
import { ToolMode } from 'app/model/paper';
import { MathUtil } from 'app/scripts/common';
import { ClickDetector } from 'app/scripts/paper/detector';
import {
  AddDeleteHandlesGesture,
  BatchSelectItemsGesture,
  BatchSelectSegmentsGesture,
  CreateEllipseGesture,
  CreateRectangleGesture,
  Gesture,
  HoverItemsGesture,
  HoverSegmentsCurvesGesture,
  PencilGesture,
  RotateItemsGesture,
  ScaleItemsGesture,
  SelectDragCloneItemsGesture,
  SelectDragDrawSegmentsGesture,
  SelectDragHandleGesture,
  TransformPathsGesture,
} from 'app/scripts/paper/gesture';
import { PaperLayer } from 'app/scripts/paper/item';
import { PaperService } from 'app/services';
import * as paper from 'paper';

import { Tool } from './Tool';

/**
 * TODO: hook up rotate and transform tools somehow
 * TODO: describe how 'enter' and 'escape' should both behave
 * TODO: https://medium.com/sketch-app/mastering-the-bezier-curve-in-sketch-4da8fdf0dbbb
 */
export class MasterTool extends Tool {
  private readonly paperLayer = paper.project.activeLayer as PaperLayer;
  private readonly clickDetector = new ClickDetector();
  private currentGesture: Gesture = new HoverItemsGesture(this.ps);

  constructor(private readonly ps: PaperService) {
    super();
  }

  // @Override
  onMouseEvent(event: paper.ToolEvent) {
    this.clickDetector.onMouseEvent(event);
    if (event.type === 'mousedown') {
      this.onMouseDown(event);
    } else if (event.type === 'mousedrag') {
      this.currentGesture.onMouseDrag(event);
    } else if (event.type === 'mousemove') {
      this.currentGesture.onMouseMove(event);
    } else if (event.type === 'mouseup') {
      this.onMouseUp(event);
    }
  }

  private onMouseDown(event: paper.ToolEvent) {
    const toolMode = this.ps.getToolMode();
    if (toolMode === ToolMode.Circle) {
      this.currentGesture = new CreateEllipseGesture(this.ps);
    } else if (toolMode === ToolMode.Rectangle) {
      this.currentGesture = new CreateRectangleGesture(this.ps);
    } else if (toolMode === ToolMode.Pencil) {
      this.currentGesture = new PencilGesture(this.ps);
    } else {
      // TODO: also add support for transform/rotate/etc. tools
      if (toolMode === ToolMode.Pen && !this.ps.getFocusedEditPath()) {
        // Then the user is in pen mode and is about to begin creating a new path.
        this.ps.setSelectedLayers(new Set());
        const vl = this.ps.getVectorLayer().clone();
        const pl = new PathLayer({
          name: LayerUtil.getUniqueLayerName([vl], 'path'),
          children: [] as Layer[],
          pathData: undefined,
          fillColor: '#000',
        });
        const children = [...vl.children, pl];
        vl.children = children;
        this.ps.setVectorLayer(vl);
        this.ps.setFocusedEditPath({
          layerId: pl.id,
          selectedSegments: new Set<number>(),
          visibleHandleIns: new Set<number>(),
          selectedHandleIns: new Set<number>(),
          visibleHandleOuts: new Set<number>(),
          selectedHandleOuts: new Set<number>(),
        });
      }
      if (this.ps.getFocusedEditPath()) {
        // The user is editing an existing focused edit path.
        this.currentGesture = this.createEditPathModeGesture(event);
      } else {
        // Otherwise we are in selection mode.
        this.currentGesture = this.createSelectionModeGesture(event);
      }
    }
    this.currentGesture.onMouseDown(event);
  }

  private onMouseUp(event: paper.ToolEvent) {
    this.currentGesture.onMouseUp(event);
    if (this.ps.getFocusedEditPath()) {
      this.currentGesture = new HoverSegmentsCurvesGesture(this.ps);
    } else {
      this.currentGesture = new HoverItemsGesture(this.ps);
    }
  }

  private createSelectionModeGesture(event: paper.ToolEvent) {
    const { ps, paperLayer } = this;
    const selectedLayers = ps.getSelectedLayers();
    if (selectedLayers.size > 0) {
      // First perform a hit test on the selection bounds.
      const res = paperLayer.hitTestSelectionBoundsItem(event.point);
      if (res) {
        // If the hit item is a selection bounds segment, then perform a scale gesture.
        return new ScaleItemsGesture(this.ps, res.item);
      }
    }

    const hitResult = paperLayer.hitTest(event.point, {
      fill: true,
      stroke: true,
    });
    if (!hitResult) {
      // If there is no hit item, then batch select items using a selection box box.
      return new BatchSelectItemsGesture(ps);
    }

    const hitItem = hitResult.item;
    if (this.clickDetector.isDoubleClick()) {
      // TODO: It should only be possible to enter edit path mode
      // for an editable item (i.e. a path, but not a group). Double clicking
      // on a non-selected and editable item that is contained inside a selected
      // parent layer should result in the editable item being selected (it is
      // actually a tiny bit more complicated than that but you get the idea).
      return new class extends Gesture {
        // @Override
        onMouseDown(e: paper.ToolEvent) {
          // If a double click event occurs on top of a hit item, then enter edit path mode.
          ps.setSelectedLayers(new Set());
          ps.setFocusedEditPath({
            layerId: hitItem.data.id,
            // TODO: auto-select the last curve in the path
            selectedSegments: new Set<number>(),
            visibleHandleIns: new Set<number>(),
            selectedHandleIns: new Set<number>(),
            visibleHandleOuts: new Set<number>(),
            selectedHandleOuts: new Set<number>(),
          });
        }
      }();
    }

    if (event.modifiers.shift && selectedLayers.has(hitItem.data.id) && selectedLayers.size > 1) {
      // TODO: After the item is deselected, it should still be possible
      // to drag/clone any other selected items in subsequent mouse events
      return new class extends Gesture {
        // @Override
        onMouseDown(e: paper.ToolEvent) {
          // If the hit item is selected, shift is pressed, and there is at least
          // one other selected item, then deselect the hit item.
          const layerIds = new Set(selectedLayers);
          layerIds.delete(hitItem.data.id);
          ps.setSelectedLayers(layerIds);
        }
      }();
    }

    // TODO: The actual behavior in Sketch is a bit more complicated.
    // For example, (1) a cloned item will not be generated until the next
    // onMouseDrag event, (2) on the next onMouseDrag event, the
    // cloned item should be selected and the currently selected item should
    // be deselected, (3) the user can cancel a clone operation mid-drag by
    // pressing/unpressing alt (even if alt wasn't initially pressed in
    // onMouseDown).

    // At this point we know that either (1) the hit item is not selected
    // or (2) the hit item is selected, shift is not being pressed, and
    // there is only one selected item. In both cases the hit item should
    // end up being selected. If alt is being pressed, then we should
    // clone the item as well.
    return new SelectDragCloneItemsGesture(ps, hitItem);
  }

  private createEditPathModeGesture(event: paper.ToolEvent) {
    const { ps, paperLayer } = this;
    const focusedEditPath = ps.getFocusedEditPath();

    // First do a hit test on the underlying path's stroke/curves.
    const editPath = paperLayer.findItemByLayerId(focusedEditPath.layerId) as paper.Path;
    const strokeCurveHitResult = editPath.hitTest(paperLayer.globalToLocal(event.point), {
      stroke: true,
      curves: true,
    });
    if (strokeCurveHitResult) {
      const { location } = strokeCurveHitResult;
      return SelectDragDrawSegmentsGesture.hitCurve(ps, location.index, location.time);
    }

    // Second, do a hit test on the focused edit path's segments and handles.
    const segmentHandleHitResult = paperLayer.hitTestFocusedEditPathItem(event.point);
    if (segmentHandleHitResult) {
      const { type, segmentIndex } = segmentHandleHitResult.item;
      if (type === 'handle-in' || type === 'handle-out') {
        // If a mouse down event occurred on top of a handle,
        // then select/drag the handle.
        return new SelectDragHandleGesture(ps, segmentIndex, type);
      }
      if (this.clickDetector.isDoubleClick()) {
        // If a double click occurred on top of a segment,
        // then create/delete the segment's handles.
        return new AddDeleteHandlesGesture(ps, segmentIndex);
      }
      // If a mouse down event occurred on top of a segment,
      // then select/drag the segment.
      return SelectDragDrawSegmentsGesture.hitSegment(ps, segmentIndex);
    }

    if (
      // Then we are beginning to build a new path from scratch.
      editPath.segments.length === 0 ||
      // Then we are extending an existing open path.
      hasSingleSelectedEndPointSegment(editPath)
    ) {
      return SelectDragDrawSegmentsGesture.hitNothing(ps);
    }

    // TODO: Only enter selection box mode when we are certain that a drag
    // has occurred. If a drag does not occur, then we should interpret the
    // gesture as a click. If a click occurs and shift is not pressed, then
    // we should exit edit path mode.

    // If there is no hit item and we are in edit path mode, then
    // enter selection box mode for the selected item so we can
    // batch select its individual properties.
    return new BatchSelectSegmentsGesture(ps);
  }

  // @Override
  onKeyEvent(event: paper.KeyEvent) {
    if (event.type === 'keydown') {
      this.currentGesture.onKeyDown(event);
    } else if (event.type === 'keyup') {
      this.currentGesture.onKeyUp(event);
    }
  }
}

/**
 * Returns true iff the given path is open and has a single selected
 * end point segment.
 */
function hasSingleSelectedEndPointSegment(path: paper.Path) {
  const selectedSegments = path.segments.filter(s => s.selected);
  return (
    !path.closed &&
    selectedSegments.length === 1 &&
    (selectedSegments[0].isFirst() || selectedSegments[0].isLast())
  );
}
