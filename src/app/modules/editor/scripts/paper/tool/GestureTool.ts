import { ToolMode } from 'app/modules/editor/model/paper';
import { ClickDetector } from 'app/modules/editor/scripts/paper/detector';
import { Gesture } from 'app/modules/editor/scripts/paper/gesture';
import {
  EllipseGesture,
  PencilGesture,
  RectangleGesture,
} from 'app/modules/editor/scripts/paper/gesture/create';
import {
  BatchSelectSegmentsGesture,
  MouldCurveGesture,
  SelectDragDrawSegmentsGesture,
  SelectDragHandleGesture,
  ToggleSegmentHandlesGesture,
} from 'app/modules/editor/scripts/paper/gesture/edit';
import { HoverGesture } from 'app/modules/editor/scripts/paper/gesture/hover';
import {
  RotateItemsDragPivotGesture,
  RotateItemsGesture,
} from 'app/modules/editor/scripts/paper/gesture/rotate';
import { ScaleItemsGesture } from 'app/modules/editor/scripts/paper/gesture/scale';
import {
  BatchSelectItemsGesture,
  DeselectItemGesture,
  EditPathGesture,
  SelectDragCloneItemsGesture,
} from 'app/modules/editor/scripts/paper/gesture/select';
import { TransformPathsGesture } from 'app/modules/editor/scripts/paper/gesture/transform';
import { HitTests, PaperLayer } from 'app/modules/editor/scripts/paper/item';
import { PaperUtil } from 'app/modules/editor/scripts/paper/util';
import { PaperService } from 'app/modules/editor/services';
import * as paper from 'paper';

import { Tool } from './Tool';

/**
 * A tool that delegates responsibilities to different gestures given the
 * state of the current tool mode and key/mouse events.
 */
export class GestureTool extends Tool {
  private readonly pl = paper.project.activeLayer as PaperLayer;
  private readonly clickDetector = new ClickDetector();
  private currentGesture: Gesture = new HoverGesture(this.ps);

  constructor(private readonly ps: PaperService) {
    super();
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
    this.currentGesture = new HoverGesture(this.ps);
  }

  private createSelectionModeGesture(event: paper.ToolEvent) {
    if (this.ps.getEditPathInfo()) {
      return this.createEditPathModeGesture(event);
    }
    const selectedLayerIds = this.ps.getSelectedLayerIds();
    if (selectedLayerIds.size) {
      // First perform a hit test on the selection bound's segments.
      const selectionBoundSegmentsHitResult = HitTests.selectionModeSegments(event.point);
      const rii = this.ps.getRotateItemsInfo();
      if (selectionBoundSegmentsHitResult) {
        // If the hit item is a selection bound segment, then perform
        // a scale/rotate/transform gesture.
        if (rii) {
          return new RotateItemsGesture(this.ps);
        }
        if (this.ps.getTransformPathsInfo()) {
          return new TransformPathsGesture(this.ps, selectionBoundSegmentsHitResult.item);
        }
        return new ScaleItemsGesture(this.ps, selectionBoundSegmentsHitResult.item);
      }
      if (rii) {
        // Perform a hit test on the rotate items pivot.
        const rotateItemsHitResult = HitTests.rotateItemsPivot(event.point);
        if (rotateItemsHitResult) {
          return new RotateItemsDragPivotGesture(this.ps);
        }
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
        // then enter edit path mode.
        return new EditPathGesture(this.ps, hitItemId);
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

  private createEditPathModeGesture(event: paper.ToolEvent) {
    const selectedLayerIds = this.ps.getSelectedLayerIds();
    let layerId = selectedLayerIds.size ? selectedLayerIds.values().next().value : '';
    let epi = this.ps.getEditPathInfo();
    if (!layerId) {
      // Then the user has created the first segment of a new path, in which
      // case we must create a new dummy path and bring it into focus.
      const newPathLayer = PaperUtil.addPathToStore(this.ps, '');
      layerId = newPathLayer.id;
      epi = {
        selectedSegments: new Set<number>(),
        visibleHandleIns: new Set<number>(),
        visibleHandleOuts: new Set<number>(),
        selectedHandleIn: undefined,
        selectedHandleOut: undefined,
      };
      this.ps.setSelectedLayerIds(new Set([layerId]));
      this.ps.setEditPathInfo(epi);
    }

    const editPathId = layerId;
    const editPath = this.pl.findItemByLayerId(editPathId) as paper.Path;

    // First, do a hit test on the edit path's segments and handles.
    const segmentsAndHandlesHitResult = HitTests.editPathModeSegmentsAndHandles(event.point);
    if (segmentsAndHandlesHitResult) {
      const { segmentIndex, type } = segmentsAndHandlesHitResult.item;
      if (type === 'handle-in' || type === 'handle-out') {
        // If a mouse down event occurred on top of a handle,
        // then select/drag the handle.
        return new SelectDragHandleGesture(this.ps, editPathId, segmentIndex, type);
      }
      if (this.clickDetector.isDoubleClick()) {
        // If a double click occurred on top of a segment, then toggle the segment's handles.
        return new ToggleSegmentHandlesGesture(this.ps, editPathId, segmentIndex);
      }
      // If a mouse down event occurred on top of a segment,
      // then select/drag the segment.
      return SelectDragDrawSegmentsGesture.hitSegment(this.ps, editPathId, segmentIndex);
    }

    // Second, do a hit test on the edit path itself.
    let hitResult = HitTests.editPathMode(event.point, editPath, {
      fill: true,
      stroke: true,
      curves: true,
    });
    if (hitResult) {
      if (hitResult.type !== 'curve') {
        // TODO: is there a way to avoid a second hit test like this?
        hitResult = HitTests.editPathMode(event.point, editPath, {
          curves: true,
        });
      }
      if (hitResult && hitResult.type === 'curve') {
        if (event.modifiers.command) {
          // If the user is holding down command, then modify the curve
          // by dragging it.
          return new MouldCurveGesture(this.ps, editPathId, {
            curveIndex: hitResult.location.index,
            time: hitResult.location.time,
          });
        }
        // Add a segment to the curve.
        return SelectDragDrawSegmentsGesture.hitCurve(
          this.ps,
          editPathId,
          hitResult.location.index,
          hitResult.location.time,
        );
      }
      // Note that we won't exit edit path mode on the next mouse up event
      // (since the gesture began with a successful hit test).
      return new BatchSelectSegmentsGesture(
        this.ps,
        editPathId,
        false /* clearEditPathOnDraglessClick */,
      );
    }

    if (!editPath.segments.length) {
      // Then we are beginning to build a new path from scratch.
      return SelectDragDrawSegmentsGesture.miss(this.ps, editPathId);
    }

    if (!editPath.closed && epi.selectedSegments.size === 1) {
      const selectedSegmentIndex = epi.selectedSegments.values().next().value;
      if (selectedSegmentIndex === 0 || selectedSegmentIndex === editPath.segments.length - 1) {
        // Then we are extending an existing open path with a single selected end point segment.
        return SelectDragDrawSegmentsGesture.miss(this.ps, editPathId);
      }
    }

    // If there is no hit item and we are in edit path mode, then
    // enter selection box mode for the edit path so we can
    // batch select its segments. If no drag occurs, the gesture will
    // exit edit path mode on the next mouse up event.
    return new BatchSelectSegmentsGesture(
      this.ps,
      editPathId,
      true /* clearEditPathOnDraglessClick */,
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
