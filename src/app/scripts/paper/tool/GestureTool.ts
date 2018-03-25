import { ToolMode } from 'app/model/paper';
import { ClickDetector } from 'app/scripts/paper/detector';
import { Gesture } from 'app/scripts/paper/gesture';
import { EllipseGesture, PencilGesture, RectangleGesture } from 'app/scripts/paper/gesture/create';
import {
  BatchSelectSegmentsGesture,
  HoverSegmentsCurvesGesture,
  MouldCurveGesture,
  SelectDragDrawSegmentsGesture,
  SelectDragHandleGesture,
  ToggleSegmentHandlesGesture,
} from 'app/scripts/paper/gesture/focus';
import {
  BatchSelectItemsGesture,
  DeselectItemGesture,
  FocusPathGesture,
  HoverItemsGesture,
  SelectDragCloneItemsGesture,
} from 'app/scripts/paper/gesture/select';
import {
  RotateItemsGesture,
  ScaleItemsGesture,
  TransformPathsGesture,
} from 'app/scripts/paper/gesture/transform';
import { HitTests, PaperLayer } from 'app/scripts/paper/item';
import { PaperUtil } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import * as paper from 'paper';

import { Tool } from './Tool';

/**
 * A tool that delegates responsibilities to different gestures given the
 * state of the current tool mode and key/mouse events.
 */
export class GestureTool extends Tool {
  private readonly pl = paper.project.activeLayer as PaperLayer;
  private readonly clickDetector = new ClickDetector();
  private currentGesture: Gesture = new HoverItemsGesture(this.ps);

  constructor(private readonly ps: PaperService) {
    super();
  }

  // @Override
  onToolModeChanged() {
    this.resetDefaultGesture();
  }

  private resetDefaultGesture() {
    const fpi = this.ps.getFocusedPathInfo();
    if (fpi) {
      this.currentGesture = new HoverSegmentsCurvesGesture(this.ps, fpi.layerId);
    } else {
      this.currentGesture = new HoverItemsGesture(this.ps);
    }
  }

  // @Override
  onToolEvent(event: paper.ToolEvent) {
    this.clickDetector.onToolEvent(event);
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
    if (toolMode === ToolMode.Ellipse) {
      this.currentGesture = new EllipseGesture(this.ps);
    } else if (toolMode === ToolMode.Rectangle) {
      this.currentGesture = new RectangleGesture(this.ps);
    } else if (toolMode === ToolMode.Pencil) {
      this.currentGesture = new PencilGesture(this.ps);
    } else {
      this.currentGesture = this.createSelectionModeGesture(event);
    }
    this.currentGesture.onMouseDown(event);
  }

  private onMouseUp(event: paper.ToolEvent) {
    this.currentGesture.onMouseUp(event);
    this.resetDefaultGesture();
  }

  private createSelectionModeGesture(event: paper.ToolEvent) {
    if (this.ps.getFocusedPathInfo()) {
      return this.createFocusedPathModeGesture(event);
    }
    const selectedLayerIds = this.ps.getSelectedLayerIds();
    if (selectedLayerIds.size) {
      // First perform a hit test on the selection bound's segments.
      const selectionBoundSegmentsHitResult = HitTests.selectionModeSegments(event.point);
      if (selectionBoundSegmentsHitResult) {
        // If the hit item is a selection bound segment, then perform
        // a scale/rotate/transform gesture.
        if (this.ps.getRotateItemsInfo()) {
          return new RotateItemsGesture(this.ps);
        }
        if (this.ps.getTransformPathsInfo()) {
          return new TransformPathsGesture /*this.ps, selectionBoundSegmentsHitResult.item*/();
        }
        return new ScaleItemsGesture(this.ps, selectionBoundSegmentsHitResult.item);
      }
    }

    const hitResults = this.pl.hitTestVectorLayer(event.point);
    const selectionMap = HitTests.getSelectedLayerMap(this.ps);
    const hitResult = HitTests.findFirstHitResult(hitResults.children, selectionMap);
    if (!hitResult) {
      // If there is no hit item, then batch select items using a selection box.
      return new BatchSelectItemsGesture(this.ps);
    }

    const hitItemId = hitResult.hitItem.data.id;
    if (this.clickDetector.isDoubleClick()) {
      const hitLayer = this.ps.getVectorLayer().findLayerById(hitItemId);
      if (hitLayer.children.length) {
        const newHitResult = HitTests.findFirstHitResult(
          hitResults.children,
          selectionMap,
          new Set([hitLayer.id]),
        );
        if (newHitResult) {
          return new SelectDragCloneItemsGesture(this.ps, newHitResult.hitItem.data.id);
        } else {
          return new BatchSelectItemsGesture(this.ps);
        }
      } else {
        // If a double click event occurs on top of a hit item w/ no children,
        // then enter focused path mode.
        return new FocusPathGesture(this.ps, hitItemId);
      }
    }

    if (selectedLayerIds.has(hitItemId) && event.modifiers.shift && selectedLayerIds.size > 1) {
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

  private createFocusedPathModeGesture(event: paper.ToolEvent) {
    let fpi = this.ps.getFocusedPathInfo();
    if (!fpi.layerId) {
      // Then the user has created the first segment of a new path, in which
      // case we must create a new dummy path and bring it into focus.
      const newPathLayer = PaperUtil.addPathToStore(this.ps, '');
      const layerId = newPathLayer.id;
      fpi = {
        layerId,
        selectedSegments: new Set<number>(),
        visibleHandleIns: new Set<number>(),
        visibleHandleOuts: new Set<number>(),
        selectedHandleIn: undefined,
        selectedHandleOut: undefined,
      };
      this.ps.setSelectedLayerIds(new Set([layerId]));
      this.ps.setFocusedPathInfo(fpi);
    }

    const focusedPathId = fpi.layerId;
    const focusedPath = this.pl.findItemByLayerId(focusedPathId) as paper.Path;

    // First, do a hit test on the focused path's segments and handles.
    const segmentsAndHandlesHitResult = HitTests.focusedPathModeSegmentsAndHandles(event.point);
    if (segmentsAndHandlesHitResult) {
      const { segmentIndex, type } = segmentsAndHandlesHitResult.item;
      if (type === 'handle-in' || type === 'handle-out') {
        // If a mouse down event occurred on top of a handle,
        // then select/drag the handle.
        return new SelectDragHandleGesture(this.ps, focusedPathId, segmentIndex, type);
      }
      if (this.clickDetector.isDoubleClick()) {
        // If a double click occurred on top of a segment, then toggle the segment's handles.
        return new ToggleSegmentHandlesGesture(this.ps, focusedPathId, segmentIndex);
      }
      // If a mouse down event occurred on top of a segment,
      // then select/drag the segment.
      return SelectDragDrawSegmentsGesture.hitSegment(this.ps, focusedPathId, segmentIndex);
    }

    // Second, do a hit test on the focused path itself.
    let hitResult = HitTests.focusedPathMode(event.point, focusedPath, {
      fill: true,
      stroke: true,
      curves: true,
    });
    if (hitResult) {
      if (hitResult.type !== 'curve') {
        // TODO: is there a way to avoid a second hit test like this?
        hitResult = HitTests.focusedPathMode(event.point, focusedPath, {
          curves: true,
        });
      }
      if (hitResult && hitResult.type === 'curve') {
        if (event.modifiers.command) {
          // If the user is holding down command, then modify the curve
          // by dragging it.
          return new MouldCurveGesture(this.ps, focusedPathId, {
            curveIndex: hitResult.location.index,
            time: hitResult.location.time,
          });
        }
        // Add a segment to the curve.
        return SelectDragDrawSegmentsGesture.hitCurve(
          this.ps,
          focusedPathId,
          hitResult.location.index,
          hitResult.location.time,
        );
      }
      // Note that we won't exit focused path mode on the next mouse up event
      // (since the gesture began with a successful hit test).
      return new BatchSelectSegmentsGesture(
        this.ps,
        focusedPathId,
        false /* clearFocusedPathOnDraglessClick */,
      );
    }

    if (!focusedPath.segments.length) {
      // Then we are beginning to build a new path from scratch.
      return SelectDragDrawSegmentsGesture.miss(this.ps, focusedPathId);
    }

    if (!focusedPath.closed && fpi.selectedSegments.size === 1) {
      const selectedSegmentIndex = fpi.selectedSegments.values().next().value;
      if (selectedSegmentIndex === 0 || selectedSegmentIndex === focusedPath.segments.length - 1) {
        // Then we are extending an existing open path with a single selected end point segment.
        return SelectDragDrawSegmentsGesture.miss(this.ps, focusedPathId);
      }
    }

    // If there is no hit item and we are in focused path mode, then
    // enter selection box mode for the focused path so we can
    // batch select its segments. If no drag occurs, the gesture will
    // exit focused path mode on the next mouse up event.
    return new BatchSelectSegmentsGesture(
      this.ps,
      focusedPathId,
      true /* clearFocusedPathOnDraglessClick */,
    );
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
