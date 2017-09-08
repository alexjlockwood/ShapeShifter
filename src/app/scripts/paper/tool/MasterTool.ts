import { ToolMode } from 'app/model/paper';
import { MathUtil } from 'app/scripts/common';
import { ClickDetector } from 'app/scripts/paper/detector';
import {
  BatchSelectItemsGesture,
  DeselectItemGesture,
  Gesture,
  HoverItemsGesture,
  ScaleItemsGesture,
  SelectDragCloneItemsGesture,
} from 'app/scripts/paper/gesture';
import { Guides, HitTests, Items, Selections } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import * as paper from 'paper';

import { Tool } from './Tool';

/**
 * TODO: describe how 'enter' and 'escape' should both behave
 * TODO: https://medium.com/sketch-app/mastering-the-bezier-curve-in-sketch-4da8fdf0dbbb
 */
export class MasterTool extends Tool {
  private currentGesture: Gesture = new HoverItemsGesture(this.ps);

  constructor(private readonly ps: PaperService) {
    super();
  }

  // @Override
  onMouseEvent(event: paper.ToolEvent) {
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
    this.currentGesture = this.createSelectionModeGesture(event);
    this.currentGesture.onMouseDown(event);
  }

  private onMouseUp(event: paper.ToolEvent) {
    this.currentGesture.onMouseUp(event);
    this.currentGesture = new HoverItemsGesture(this.ps);
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
      return new BatchSelectItemsGesture(this.ps);
    }

    const hitItem = hitResult.item;
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

  // @Override
  onKeyEvent(event: paper.KeyEvent) {
    if (event.type === 'keydown') {
      this.currentGesture.onKeyDown(event);
    } else if (event.type === 'keyup') {
      this.currentGesture.onKeyUp(event);
    }
  }

  // ========================== //
  // ===== Helper methods ===== //
  // ========================== //

  private getSelectedLayersIds() {}
}
