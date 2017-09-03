import { ToolMode } from 'app/model/paper';
import { MathUtil } from 'app/scripts/common';
import { ClickDetector } from 'app/scripts/paper/detector';
import {
  AddDeleteHandlesGesture,
  BatchSelectItemsGesture,
  BatchSelectSegmentsGesture,
  CircleGesture,
  DeselectItemGesture,
  Gesture,
  HoverItemsGesture,
  HoverSegmentsCurvesGesture,
  PencilGesture,
  RectangleGesture,
  RotateItemsGesture,
  ScaleItemsGesture,
  SelectDragCloneItemsGesture,
  SelectDragDrawSegmentsGesture,
  SelectDragHandleGesture,
} from 'app/scripts/paper/gesture';
import { Guides, HitTests, Items, Selections } from 'app/scripts/paper/util';
import * as paper from 'paper';

import { Tool } from './Tool';

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
export class DefaultTool extends Tool {
  private readonly clickDetector = new ClickDetector();
  private currentGesture: Gesture = new HoverItemsGesture();
  private currentToolMode = ToolMode.Selection;

  // If this is non-nil, then we are in edit path mode. Otherwise, we are in
  // selection mode.
  private selectedEditPath: paper.Path;

  // @Override
  onToolModeChanged(toolMode: ToolMode) {
    this.currentToolMode = toolMode;
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
    if (this.currentToolMode === ToolMode.Pencil) {
      this.currentGesture = new PencilGesture();
    } else if (this.currentToolMode === ToolMode.Circle) {
      this.currentGesture = new CircleGesture();
    } else if (this.currentToolMode === ToolMode.Rectangle) {
      this.currentGesture = new RectangleGesture();
    } else {
      if (this.currentToolMode === ToolMode.Pen && !this.selectedEditPath) {
        // Then the user is in pen mode and is about to begin
        // creating a new path.
        Selections.deselectAll();
        const newPath = new paper.Path();
        newPath.strokeColor = 'black';
        newPath.strokeWidth = 10;
        this.enterEditPathMode(newPath);
      }
      if (this.selectedEditPath) {
        // If a segment selected item is set, then we are in edit path mode.
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
    if (this.selectedEditPath && this.currentGesture instanceof BatchSelectSegmentsGesture) {
      // TODO: only exit segment selection mode if the selection box
      // gesture resulted in no items being selected
      this.selectedEditPath = undefined;
    }
    if (this.selectedEditPath) {
      this.currentGesture = new HoverSegmentsCurvesGesture(this.selectedEditPath);
    } else {
      this.currentGesture = new HoverItemsGesture();
    }
  }

  // @Override
  onKeyEvent(event: paper.KeyEvent) {
    if (event.type === 'keydown') {
      this.currentGesture.onKeyDown(event);
    } else if (event.type === 'keyup') {
      this.currentGesture.onKeyUp(event);
    }
  }

  private createSelectionModeGesture(event: paper.ToolEvent) {
    const selectionBounds = Guides.getSelectionBoundsPath();
    if (selectionBounds) {
      // First perform a hit test on the selection bounds, if they exist.
      const res = HitTests.selectionBoundsPivot(selectionBounds, event.point);
      if (res) {
        // If the hit item is a selection bounds segment, then perform a scale gesture.
        return new ScaleItemsGesture(res.segment, Selections.getSelectedItems());
      }
    }

    const hitResult = HitTests.selectionMode(event.point);
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
      this.enterEditPathMode(hitPath);
      return new class extends Gesture {}();
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
    const shouldCloneSelectedItems = event.modifiers.alt;
    return new SelectDragCloneItemsGesture(hitItem, shouldCloneSelectedItems);
  }

  private createEditPathModeGesture(event: paper.ToolEvent) {
    const hitResult = HitTests.editPathMode(this.selectedEditPath, event.point);
    if (hitResult) {
      // We've hit a segment or a handle belonging to a selected segment,
      // so begin a drag gesture.
      switch (hitResult.type) {
        case 'segment':
          if (this.clickDetector.isDoubleClick()) {
            // If a double click occurred on top of a segment,
            // then either create or delete its handles.
            return new AddDeleteHandlesGesture(hitResult.segment);
          }
          return new SelectDragDrawSegmentsGesture(this.selectedEditPath, hitResult.segment);
        case 'stroke':
        case 'curve':
          return new SelectDragDrawSegmentsGesture(this.selectedEditPath, hitResult.location);
        case 'handle-in':
        case 'handle-out':
          return new SelectDragHandleGesture(
            this.selectedEditPath,
            hitResult.segment,
            hitResult.type,
          );
      }
    }

    if (
      // Then we are beginning to build a new path from scratch.
      this.selectedEditPath.segments.length === 0 ||
      // Then we are extending an existing open path.
      Selections.hasSingleSelectedEndPointSegment(this.selectedEditPath)
    ) {
      return new SelectDragDrawSegmentsGesture(this.selectedEditPath);
    }

    // TODO: Only enter selection box mode when we are certain that a drag
    // has occurred. If a drag does not occur, then we should interpret the
    // gesture as a click. If a click occurs and shift is not pressed, then
    // we should exit edit path mode.

    // If there is no hit item and we are in edit path mode, then
    // enter selection box mode for the selected item so we can
    // batch select its individual properties.
    return new BatchSelectSegmentsGesture(this.selectedEditPath);
  }

  private enterEditPathMode(hitPath: paper.Path) {
    this.selectedEditPath = hitPath;

    Selections.deselectAll();

    // Begin edit path mode by selecting the last two curves in the path.
    const startIndex = Math.max(0, this.selectedEditPath.curves.length - 2);
    const endIndex = this.selectedEditPath.curves.length;
    const lastTwoCurves = this.selectedEditPath.curves.slice(startIndex, endIndex);
    lastTwoCurves.forEach(c => (c.selected = true));
  }
}
