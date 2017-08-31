import { Guides, Items, Selections } from 'app/scripts/paper/util';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that performs rotation operations.
 *
 * - This gesture begins with a mouse down and ends with a mouse up.
 * - This gesture is created in selection mode.
 * - This gesture implies that one or more items were previously selected
 *   and that its selection bounds are currently being shown.
 */
export class RotateItemsGesture extends Gesture {
  private selectedItems: ReadonlyArray<paper.Item>;
  private initialMatrices: ReadonlyArray<paper.Matrix>;
  private pivot: paper.Point;

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    Guides.hideHoverPath();

    this.selectedItems = Selections.getSelectedItems();
    this.initialMatrices = this.selectedItems.map(i => i.matrix.clone());
    this.pivot = Items.computeBoundingBox(this.selectedItems).center.clone();

    // While transforming object, never show the bounds.
    Guides.hideSelectionBoundsPath();
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    let angle = event.point.subtract(this.pivot).angle;
    if (event.modifiers.shift) {
      angle = Math.round(angle / 15) * 15;
    }
    this.selectedItems.forEach((i, index) => {
      i.matrix = this.initialMatrices[index].clone().rotate(angle, this.pivot);
    });
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    Guides.hideSelectionBoundsPath();
    const selectedItems = Selections.getSelectedItems();
    if (selectedItems.length) {
      Guides.showSelectionBoundsPath(Items.computeBoundingBox(selectedItems));
    }
  }
}
