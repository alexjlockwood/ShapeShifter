import { MathUtil } from 'app/scripts/common';
import { Guides, Items, Pivots, Selections } from 'app/scripts/paper/util';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that performs scaling operations.
 */
export class ScaleItemsGesture extends Gesture {
  private initialMatrices: ReadonlyArray<paper.Matrix>;
  private initialPivot: paper.Point;
  private initialSize: paper.Point;
  private centeredInitialSize: paper.Point;
  private initialCenter: paper.Point;
  private currentPivot: paper.Point;

  constructor(
    private readonly hitSegment: paper.Segment,
    private readonly selectedItems: ReadonlyArray<paper.Item>,
  ) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    Guides.hideHoverPath();

    this.initialMatrices = this.selectedItems.map(i => i.matrix.clone());
    const scalingBounds = Items.computeBoundingBox(this.selectedItems);
    const pivotType = Pivots.getPivotType(this.hitSegment.index);
    const oppPivotType = Pivots.getOppositePivotType(this.hitSegment.index);
    this.initialPivot = scalingBounds[oppPivotType].clone();
    this.currentPivot = scalingBounds[pivotType].clone();
    this.initialSize = this.currentPivot.subtract(this.initialPivot);
    this.centeredInitialSize = this.initialSize.divide(2);
    this.initialCenter = scalingBounds.center.clone();

    // Don't show the selection bounds while transforming the shape.
    Guides.hideSelectionBoundsPath();
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    // Transform about the center if alt is pressed. Otherwise trasform about
    // the pivot opposite of the currently active pivot.
    const currentPivot = event.modifiers.alt ? this.initialCenter : this.initialPivot;
    this.currentPivot = this.currentPivot.add(event.delta);
    const currentSize = this.currentPivot.subtract(currentPivot);
    const initialSize = event.modifiers.alt ? this.centeredInitialSize : this.initialSize;
    let sx = 1;
    let sy = 1;
    if (!MathUtil.isNearZero(initialSize.x)) {
      sx = currentSize.x / initialSize.x;
    }
    if (!MathUtil.isNearZero(initialSize.y)) {
      sy = currentSize.y / initialSize.y;
    }
    if (event.modifiers.shift) {
      const signx = sx > 0 ? 1 : -1;
      const signy = sy > 0 ? 1 : -1;
      sx = sy = Math.max(Math.abs(sx), Math.abs(sy));
      sx *= signx;
      sy *= signy;
    }
    // TODO: set strokeScaling to false?
    this.selectedItems.forEach((i, index) => {
      i.matrix = this.initialMatrices[index].clone().scale(sx, sy, currentPivot);
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
