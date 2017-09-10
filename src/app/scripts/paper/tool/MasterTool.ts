import { ToolMode } from 'app/model/paper';
import { MathUtil } from 'app/scripts/common';
import { ClickDetector } from 'app/scripts/paper/detector';
import {
  BatchSelectItemsGesture,
  CreateEllipseGesture,
  CreateRectangleGesture,
  Gesture,
  HoverItemsGesture,
  ScaleItemsGesture,
  SelectDragCloneItemsGesture,
} from 'app/scripts/paper/gesture';
import { PaperLayer } from 'app/scripts/paper/PaperLayer';
import { Guides, HitTests, Items, PivotType, Selections } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import * as paper from 'paper';

import { Tool } from './Tool';

/**
 * TODO: describe how 'enter' and 'escape' should both behave
 * TODO: https://medium.com/sketch-app/mastering-the-bezier-curve-in-sketch-4da8fdf0dbbb
 */
export class MasterTool extends Tool {
  private readonly paperLayer = paper.project.activeLayer as PaperLayer;
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
    const toolMode = this.ps.getToolMode();
    if (toolMode === ToolMode.Circle) {
      this.currentGesture = new CreateEllipseGesture(this.ps);
    } else if (toolMode === ToolMode.Rectangle) {
      this.currentGesture = new CreateRectangleGesture(this.ps);
    } else {
      this.currentGesture = this.createSelectionModeGesture(event);
    }
    this.currentGesture.onMouseDown(event);
  }

  private onMouseUp(event: paper.ToolEvent) {
    this.currentGesture.onMouseUp(event);
    this.currentGesture = new HoverItemsGesture(this.ps);
  }

  private createSelectionModeGesture(event: paper.ToolEvent) {
    const selectedLayers = this.ps.getSelectedLayers();
    if (selectedLayers.size > 0) {
      // First perform a hit test on the selection bounds.
      const res = this.paperLayer.hitTestSelectionBounds(event.point);
      if (res) {
        // If the hit item is a selection bounds segment, then perform a scale gesture.
        // return new ScaleItemsGesture(this.ps, res.item.data.id as PivotType);

        // TODO: implement scaling!
        return new class extends Gesture {}();
      }
    }

    const hitResult = HitTests.selectionMode(event.point);
    if (!hitResult) {
      // If there is no hit item, then batch select items using a selection box box.
      return new BatchSelectItemsGesture(this.ps);
    }

    const hitItem = hitResult.item;
    if (event.modifiers.shift && selectedLayers.has(hitItem.data.id) && selectedLayers.size > 1) {
      // TODO: After the item is deselected, it should still be possible
      // to drag/clone any other selected items in subsequent mouse events

      // If the hit item is selected, shift is pressed, and there is at least
      // one other selected item, then deselect the hit item.
      const ps = this.ps;
      return new class extends Gesture {
        // @Override
        onMouseDown(e: paper.ToolEvent) {
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
    return new SelectDragCloneItemsGesture(this.ps, hitItem);
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
