import { Layer, LayerUtil, PathLayer } from 'app/model/layers';
import { ToolMode } from 'app/model/paper';
import { MathUtil } from 'app/scripts/common';
import { ClickDetector } from 'app/scripts/paper/detector';
import { HitTests, PaperLayer } from 'app/scripts/paper/item';
import {
  AddDeleteHandlesGesture,
  BatchSelectItemsGesture,
  BatchSelectSegmentsGesture,
  CreateEllipseGesture,
  CreateRectangleGesture,
  DeselectItemGesture,
  Gesture,
  HoverItemsGesture,
  HoverSegmentsCurvesGesture,
  PencilGesture,
  RotateItemsGesture,
  ScaleItemsGesture,
  SelectDragCloneItemsGesture,
  SelectDragDrawSegmentsGesture,
  SelectDragHandleGesture,
  SetFocusedPathGesture,
  TransformPathsGesture,
} from 'app/scripts/paper/tool/gesture';
import { PaperUtil } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import { FocusedPathInfo } from 'app/store/paper/actions';
import * as paper from 'paper';

import { Tool } from './Tool';

/**
 * TODO: hook up rotate and transform tools somehow
 * TODO: describe how 'enter' and 'escape' should both behave
 * TODO: https://medium.com/sketch-app/mastering-the-bezier-curve-in-sketch-4da8fdf0dbbb
 */
export class MasterTool extends Tool {
  private readonly pl = paper.project.activeLayer as PaperLayer;
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
      let focusedPathInfo = this.ps.getFocusedPathInfo();
      if (toolMode === ToolMode.Pen && !focusedPathInfo) {
        // Then the user has created the first segment of a new path, in which
        // case we must create a new dummy path and bring it into focus.
        this.ps.setSelectedLayers(new Set());
        const newPathLayer = PaperUtil.addPathToStore(this.ps, '');
        focusedPathInfo = {
          layerId: newPathLayer.id,
          selectedSegments: new Set<number>(),
          visibleHandleIns: new Set<number>(),
          visibleHandleOuts: new Set<number>(),
          selectedHandleIn: undefined,
          selectedHandleOut: undefined,
        };
        this.ps.setFocusedPathInfo(focusedPathInfo);
      }
      if (focusedPathInfo) {
        // The user is editing a focused path.
        this.currentGesture = this.createFocusedPathModeGesture(event, focusedPathInfo);
      } else {
        // Otherwise the user is in selection mode.
        this.currentGesture = this.createSelectionModeGesture(event);
      }
    }
    this.currentGesture.onMouseDown(event);
  }

  private onMouseUp(event: paper.ToolEvent) {
    this.currentGesture.onMouseUp(event);
    const fpi = this.ps.getFocusedPathInfo();
    if (fpi) {
      this.currentGesture = new HoverSegmentsCurvesGesture(this.ps, fpi.layerId);
    } else {
      this.currentGesture = new HoverItemsGesture(this.ps);
    }
  }

  private createSelectionModeGesture(event: paper.ToolEvent) {
    const selectedLayers = this.ps.getSelectedLayers();
    if (selectedLayers.size > 0) {
      // First perform a hit test on the selection bound segments.
      const selectionBoundSegmentsHitResult = HitTests.selectionModeSegments(event.point);
      if (selectionBoundSegmentsHitResult) {
        // If the hit item is a selection bounds segment, then perform a scale gesture.
        return new ScaleItemsGesture(this.ps, selectionBoundSegmentsHitResult.item);
      }
    }

    const hitResult = HitTests.selectionMode(event.point);
    if (!hitResult) {
      // If there is no hit item, then batch select items using a selection box box.
      return new BatchSelectItemsGesture(this.ps);
    }

    const hitItemId = hitResult.item.data.id;
    if (this.clickDetector.isDoubleClick()) {
      // If a double click event occurs on top of a hit item, then enter focused path mode.

      // TODO: It should only be possible to enter focused path mode
      // for an editable item (i.e. a path, but not a group). Double clicking
      // on a non-selected and editable item that is contained inside a selected
      // parent layer should result in the editable item being selected (it is
      // actually a tiny bit more complicated than that but you get the idea).
      return new SetFocusedPathGesture(this.ps, hitItemId);
    }

    if (
      event.modifiers.shift &&
      selectedLayers.has(hitResult.item.data.id) &&
      selectedLayers.size > 1
    ) {
      // If the hit item is selected, shift is pressed, and there is at least
      // one other selected item, then deselect the hit item.

      // TODO: After the item is deselected, it should still be possible
      // to drag/clone any other selected items in subsequent mouse events
      return new DeselectItemGesture(this.ps, hitItemId);
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
    return new SelectDragCloneItemsGesture(this.ps, hitItemId);
  }

  private createFocusedPathModeGesture(event: paper.ToolEvent, fpi: FocusedPathInfo) {
    // First, do a hit test on the focused path's segments and handles.
    const segmentsAndHandlesHitResult = HitTests.focusedPathModeSegmentsAndHandles(event.point);
    if (segmentsAndHandlesHitResult) {
      const { segmentIndex, type } = segmentsAndHandlesHitResult.item;
      if (type === 'handle-in' || type === 'handle-out') {
        // If a mouse down event occurred on top of a handle,
        // then select/drag or begin to drag the handle.
        return new SelectDragHandleGesture(this.ps, segmentIndex, type);
      }
      if (this.clickDetector.isDoubleClick()) {
        // If a double click occurred on top of a segment,
        // then add/delete the segment's handles.
        return new AddDeleteHandlesGesture(this.ps, fpi.layerId, segmentIndex);
      }
      // If a mouse down event occurred on top of a segment,
      // then select/drag the segment.
      return SelectDragDrawSegmentsGesture.hitSegment(this.ps, segmentIndex);
    }

    // Second, do a hit test on the underlying path's curves.
    const focusedPath = this.pl.findItemByLayerId(fpi.layerId) as paper.Path;
    const curvesHitResult = HitTests.focusedPathModeCurves(event.point, focusedPath);
    if (curvesHitResult) {
      const { location } = curvesHitResult;
      return SelectDragDrawSegmentsGesture.hitCurve(this.ps, location.index, location.time);
    }

    // Third, check to see if we hit the focused path.
    // TODO: can we merge this hit test with the one above once we get hitOptions.curves working?
    if (HitTests.focusedPathMode(event.point, focusedPath)) {
      // Don't exit focused path mode on the next mouse up event
      // (since the gesture began with a successful filled hit test).
      const clearFocusedPathOnDraglessClick = false;
      return new BatchSelectSegmentsGesture(this.ps, fpi.layerId, clearFocusedPathOnDraglessClick);
    }

    if (focusedPath.segments.length === 0) {
      // Then we are beginning to build a new path from scratch.
      return SelectDragDrawSegmentsGesture.miss(this.ps);
    }

    const { selectedSegments } = fpi;
    if (!focusedPath.closed && selectedSegments.size === 1) {
      const selectedSegmentIndex = selectedSegments.values().next().value;
      if (selectedSegmentIndex === 0 || selectedSegmentIndex === focusedPath.segments.length - 1) {
        // Then we are extending an existing open path with a single selected end point segment.
        return SelectDragDrawSegmentsGesture.miss(this.ps);
      }
    }

    // If there is no hit item and we are in focused path mode, then
    // enter selection box mode for the selected item so we can
    // batch select its individual segments.
    return new BatchSelectSegmentsGesture(this.ps, fpi.layerId);
  }

  // @Override
  onKeyEvent(event: paper.KeyEvent) {
    // TODO: add support for other gestures (i.e. move shape 10px using keyboard, etc.)
    if (event.type === 'keydown') {
      this.currentGesture.onKeyDown(event);
    } else if (event.type === 'keyup') {
      this.currentGesture.onKeyUp(event);
    }
  }
}
