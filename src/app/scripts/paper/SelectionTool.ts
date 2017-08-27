import { MathUtil } from 'app/scripts/common';
import * as $ from 'jquery';
import * as paper from 'paper';

import { AbstractTool } from './AbstractTool';
import {
  Gesture,
  HoverGesture,
  ItemSelectionGesture,
  RotateGesture,
  ScaleGesture,
  SegmentSelectionGesture,
  SelectionBoxGesture,
} from './gesture';
import { Guides, Items, Selections } from './util';

enum Mode {
  None,
  Scale,
  Rotate,
  MoveShapes,
  CloneShapes,
  SelectionBox,
}

/**
 * A simple selection tool for moving, scaling, rotating, and selecting shapes.
 * TODO: figure out how to deal with right mouse clicks
 */
export class SelectionTool extends AbstractTool {
  private currentGesture: Gesture = new HoverGesture();
  private segmentSelectedPath: paper.Path;
  private hitResult: paper.HitResult;

  // @Override
  protected onMouseDown(event: paper.ToolEvent) {
    // If a segment selected item is set, then we are in segment selection mode.
    if (this.segmentSelectedPath) {
      this.hitResult = this.segmentSelectedPath.hitTest(event.point, {
        segments: true,
        stroke: true,
        curves: true,
        handles: true,
        fill: true,
        tolerance: 3 / paper.view.zoom,
      });
      if (this.hitResult) {
        // Process the segment selection gesture for the hit item.
        this.currentGesture = new SegmentSelectionGesture(this.segmentSelectedPath, this.hitResult);
      } else {
        // TODO: Only enter selection box mode when we are certain that a drag
        // has occurred. If a drag does not occur, then we should interpret the
        // gesture as a click. If a click occurs and shift is not pressed, then
        // we should exit segment selection mode.

        // If there is no hit item and we are in segment selection mode, then
        // enter selection box mode for the segment selected item so we can
        // batch select its individual properties.
        this.currentGesture = new SelectionBoxGesture(true);
      }
    } else {
      this.hitResult = paper.project.hitTest(event.point, {
        segments: true,
        stroke: true,
        curves: true,
        fill: true,
        tolerance: 8 / paper.view.zoom,
      });
      if (this.hitResult) {
        const hitItem = this.hitResult.item;
        if (Guides.isScaleHandle(hitItem)) {
          // If the hit item is a scale handle, then perform a scale gesture.
          this.currentGesture = new ScaleGesture(hitItem);
        } else if (Guides.isRotationHandle(hitItem)) {
          // If the hit item is a rotate handle, then perform a rotate gesture.
          this.currentGesture = new RotateGesture();
        } else if (this.isDoubleClickEvent()) {
          // TODO: It should only be possible to enter segment selection mode
          // for an editable item (i.e. a path, but not a group). Double clicking
          // on a non-selected and editable item that is contained inside a selected
          // parent layer should result in the editable item being selected (it is
          // actually a tiny bit more complicated than that but you get the idea).

          // TODO: possible to double click on a non-Path object? (missing types below!)

          // If a double click event occurs on top of a hit item, then enter
          // segment selection mode.
          this.segmentSelectedPath = hitItem as paper.Path;
          this.currentGesture = new class extends Gesture {
            onMouseDown(e: paper.ToolEvent) {
              Selections.deselectAll();
              hitItem.selected = true;
              hitItem.fullySelected = true;
            }
          }();
        } else if (
          event.modifiers.shift &&
          hitItem.selected &&
          Selections.getSelectedItems().length > 1
        ) {
          // TODO: After the item is deselected, it should still be possible
          // to drag/clone any other selected items in subsequent mouse events

          // If the hit item is selected, shift is pressed, and there is at least
          // one other selected item, then deselect the hit item.
          this.currentGesture = new class extends Gesture {
            onMouseDown(e: paper.ToolEvent) {
              Selections.setSelection(hitItem, false);
            }
          }();
        } else {
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
          this.currentGesture = new ItemSelectionGesture(hitItem, event.modifiers.alt);
        }
      } else {
        // If there is no hit item, then enter selection box mode.
        this.currentGesture = new SelectionBoxGesture(false);
      }
    }
    this.currentGesture.onMouseDown(event);
  }

  // @Override
  protected onMouseDrag(event: paper.ToolEvent) {
    this.currentGesture.onMouseDrag(event);
  }

  // @Override
  protected onMouseMove(event: paper.ToolEvent) {
    this.currentGesture.onMouseMove(event);
  }

  // @Override
  protected onMouseUp(event: paper.ToolEvent) {
    this.currentGesture.onMouseUp(event);
    if (this.segmentSelectedPath && !this.hitResult) {
      // TODO: only exit segment selection mode if the selection box
      // gesture resulted in no items being selected
      this.segmentSelectedPath = undefined;
    }
    this.currentGesture = new HoverGesture();
  }

  // @Override
  protected onKeyDown(event: paper.KeyEvent) {
    this.currentGesture.onKeyDown(event);
  }

  // @Override
  protected onKeyUp(event: paper.KeyEvent) {
    this.currentGesture.onKeyUp(event);
  }
}
