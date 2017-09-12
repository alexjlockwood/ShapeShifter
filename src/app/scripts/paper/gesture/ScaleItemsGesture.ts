import { MathUtil } from 'app/scripts/common';
import { PaperLayer } from 'app/scripts/paper/PaperLayer';
import { Guides, Items, PivotType, Selections } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that performs scaling operations.
 */
export class ScaleItemsGesture extends Gesture {
  private readonly paperLayer = paper.project.activeLayer as PaperLayer;
  private selectedItems: ReadonlyArray<paper.Item>;
  private initialMatrices: ReadonlyArray<paper.Matrix>;
  private initialPivot: paper.Point;
  private initialSize: paper.Point;
  private centeredInitialSize: paper.Point;
  private initialCenter: paper.Point;
  private currentPivot: paper.Point;

  constructor(private readonly ps: PaperService, private readonly hitPivotType: PivotType) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    this.ps.setHoveredLayer(undefined);

    this.selectedItems = Array.from(this.ps.getSelectedLayers()).map(id =>
      this.paperLayer.findItemByLayerId(id),
    );

    this.initialMatrices = this.selectedItems.map(i => i.matrix.clone());
    const scalingBounds = Items.computeBoundingBox(this.selectedItems);
    const pivotType = this.hitPivotType;
    // TODO: implement this
    // TODO: implement this
    // TODO: implement this
    // TODO: implement this
    // TODO: implement this
    const oppPivotType = this.hitPivotType; // Pivots.getOppositePivotType(this.hitSegment.index);
    this.initialPivot = scalingBounds[oppPivotType].clone();
    this.currentPivot = scalingBounds[pivotType].clone();
    this.initialSize = this.currentPivot.subtract(this.initialPivot);
    this.centeredInitialSize = this.initialSize.divide(2);
    this.initialCenter = scalingBounds.center.clone();
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
