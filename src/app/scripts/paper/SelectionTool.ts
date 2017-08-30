import { ToolMode } from 'app/model/paper';
import { MathUtil } from 'app/scripts/common';
import * as $ from 'jquery';
import * as paper from 'paper';

import { BaseTool } from './BaseTool';
import { ClickDetector } from './detector';
import {
  BatchSelectItemsGesture,
  BatchSelectSegmentsGesture,
  CreateOrDeleteSegmentHandlesGesture,
  DeselectItemGesture,
  EditPathGesture,
  EnterEditPathModeGesture,
  Gesture,
  HoverGesture,
  RotateGesture,
  ScaleGesture,
  SelectCurvesGesture,
  SelectHandlesGesture,
  SelectItemsGesture,
  SelectSegmentsGesture,
} from './gesture';
import { Guides, HitTests, Items, Selections } from './util';

/**
 * A tool that selects, moves, rotates, scales, and modifies items.
 * The selection tool has two different states:
 *
 * (1) The first is the standard selection mode, in which the user can
 *     click on items in the canvas in order to select them. Items may be
 *     selected individually or in batches by selecting a rectangular region.
 *     Selected items can then be rotated and scaled by dragging its edge and
 *     corner segments.
 *
 * (2) The second is edit path mode, in which there is a single selected
 *     path. The user can then make modifications to the path by
 *     selecting/moving/creating/deleting segments on the path. If the path
 *     is open, then the user can continue creating the path by adding new
 *     segments to its end points. Selecting a segment shows the handles for
 *     the two curves associated with that segment, which can also be modified.
 *     Double clicking on a segment with no handles creates and displays two
 *     new handles for that segment. Similarly, double clicking on a segment
 *     with handles will result in those handles being deleted. The user
 *     enters this mode by double clicking on a single selected path while
 *     in mode (1).
 *
 * TODO: describe how 'enter' and 'escape' should both behave
 * TODO: https://medium.com/sketch-app/mastering-the-bezier-curve-in-sketch-4da8fdf0dbbb
 */
export class SelectionTool extends BaseTool {
  private readonly clickDetector = new ClickDetector();
  private currentGesture: Gesture = new HoverGesture();

  // If this is non-nil, then we are in edit path mode. Otherwise, we are in
  // selection mode.
  private selectedEditPath: paper.Path;

  // @Override
  protected onInterceptEvent(toolMode: ToolMode) {
    return toolMode === ToolMode.Selection;
  }

  // @Override
  protected onMouseEvent(event: paper.ToolEvent) {
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
    if (this.selectedEditPath) {
      // If a segment selected item is set, then we are in edit path mode.
      this.currentGesture = this.createEditPathModeGesture(event);
    } else {
      // Otherwise we are in selection mode.
      this.currentGesture = this.createSelectionModeGesture(event);
    }
    this.currentGesture.onMouseDown(event);
  }

  private createSelectionModeGesture(event: paper.ToolEvent) {
    const selectionBounds = Guides.getSelectionBoundsPath();
    if (selectionBounds) {
      // First perform a hit test on the selection bounds, if they exist.
      const res = HitTests.selectionBoundsPivot(selectionBounds, event.point);
      if (res) {
        // If the hit item is a selection bounds segment, then perform a scale gesture.
        return new ScaleGesture(res.segment, Selections.getSelectedItems());
      }
    }

    const hitResult = paper.project.hitTest(event.point, {
      stroke: true,
      fill: true,
      tolerance: 8 / paper.view.zoom,
    });
    if (!hitResult) {
      // If there is no hit item, then enter selection box mode.
      return new BatchSelectItemsGesture();
    }

    const hitItem = hitResult.item;
    if (this.clickDetector.isDoubleClick()) {
      // TODO: It should only be possible to enter edit path mode
      // for an editable item (i.e. a path, but not a group). Double clicking
      // on a non-selected and editable item that is contained inside a selected
      // parent layer should result in the editable item being selected (it is
      // actually a tiny bit more complicated than that but you get the idea).

      // TODO: possible to double click on a non-Path object? (missing types below!)
      const hitPath = hitItem as paper.Path;

      // If a double click event occurs on top of a hit item, then enter
      // edit path mode.
      this.selectedEditPath = hitPath;
      return new EnterEditPathModeGesture(hitPath);
    }

    if (event.modifiers.shift && hitItem.selected && Selections.getSelectedItems().length > 1) {
      // TODO: After the item is deselected, it should still be possible
      // to drag/clone any other selected items in subsequent mouse events

      // If the hit item is selected, shift is pressed, and there is at least
      // one other selected item, then deselect the hit item.
      return new DeselectItemGesture(hitItem);
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
    return new SelectItemsGesture(hitItem, event.modifiers.alt);
  }

  private createEditPathModeGesture(event: paper.ToolEvent) {
    const hitResult = this.selectedEditPath.hitTest(event.point, {
      segments: true,
      stroke: true,
      curves: true,
      handles: true,
      fill: true,
      tolerance: 3 / paper.view.zoom,
    });
    if (!hitResult) {
      // TODO: Only enter selection box mode when we are certain that a drag
      // has occurred. If a drag does not occur, then we should interpret the
      // gesture as a click. If a click occurs and shift is not pressed, then
      // we should exit edit path mode.

      // If there is no hit item and we are in edit path mode, then
      // enter selection box mode for the selected item so we can
      // batch select its individual properties.
      return new BatchSelectSegmentsGesture(this.selectedEditPath);
    }

    const { type } = hitResult;
    if (type === 'segment') {
      const isDoubleClick = this.clickDetector.isDoubleClick();
      const { segment } = hitResult;
      if (isDoubleClick) {
        // If a double click occurred on top of a segment,
        // then either create or delete its handles.
        return new CreateOrDeleteSegmentHandlesGesture(segment);
      }
      return new SelectSegmentsGesture(this.selectedEditPath, hitResult.segment);
    }
    if (type === 'stroke' || type === 'curve') {
      return new SelectCurvesGesture();
    }
    if (type === 'handle-in' || type === 'handle-out') {
      return new SelectHandlesGesture();
    }

    return new HoverGesture(this.selectedEditPath);
  }

  private onMouseUp(event: paper.ToolEvent) {
    this.currentGesture.onMouseUp(event);
    if (this.selectedEditPath && this.currentGesture instanceof BatchSelectSegmentsGesture) {
      // TODO: only exit segment selection mode if the selection box
      // gesture resulted in no items being selected
      this.selectedEditPath = undefined;
    }
    this.currentGesture = new HoverGesture(this.selectedEditPath);
  }

  // @Override
  protected onKeyEvent(event: paper.KeyEvent) {
    if (event.type === 'keydown') {
      this.currentGesture.onKeyDown(event);
    } else if (event.type === 'keyup') {
      this.currentGesture.onKeyUp(event);
    }
  }
}
