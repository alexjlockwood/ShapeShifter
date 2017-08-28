import { Guides, Items, Selections } from 'app/scripts/paper/util';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/** A gesture that performs rotation operations. */
export class RotateGesture extends Gesture {
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
    Guides.hideSelectionBounds();
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
    Guides.hideSelectionBounds();
    const selectedItems = Selections.getSelectedItems();
    if (selectedItems.length) {
      Guides.showSelectionBounds(Items.computeBoundingBox(selectedItems));
    }
  }
}
