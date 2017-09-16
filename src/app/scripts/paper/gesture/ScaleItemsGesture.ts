import { LayerUtil, PathLayer, VectorLayer } from 'app/model/layers';
import { Path } from 'app/model/paths';
import { MathUtil } from 'app/scripts/common';
import { PaperLayer } from 'app/scripts/paper/item';
import { PivotType, SelectionBoundsRaster } from 'app/scripts/paper/item';
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
  private initialVectorLayer: VectorLayer;
  private lastPoint: paper.Point;

  constructor(
    private readonly ps: PaperService,
    private readonly selectionBoundsRaster: SelectionBoundsRaster,
  ) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    this.ps.setHoveredLayer(undefined);
    this.selectedItems = Array.from(this.ps.getSelectedLayers()).map(id => {
      // TODO: do we need to clone these?
      return this.paperLayer.findItemByLayerId(id).clone();
    });
    this.initialMatrices = this.selectedItems.map(i => i.matrix.clone());

    // TODO: reuse this code with PaperLayer.ts
    const flattenedItems: paper.Item[] = [];
    this.selectedItems.forEach(function recurseFn(i: paper.Item) {
      if (i.hasChildren()) {
        i.children.forEach(c => recurseFn(c));
      } else {
        flattenedItems.push(i);
      }
    });
    const transformRectFn = (rect: paper.Rectangle, m: paper.Matrix) => {
      return new paper.Rectangle(rect.topLeft.transform(m), rect.bottomRight.transform(m));
    };
    const bounds = flattenedItems
      .map(i => transformRectFn(i.bounds, localToViewportMatrix(i)))
      .reduce((p, c) => p.unite(c));

    const pivotType = this.selectionBoundsRaster.pivotType;
    const oppPivotType = this.selectionBoundsRaster.oppositePivotType;
    this.initialPivot = bounds[oppPivotType].clone();
    this.currentPivot = bounds[pivotType].clone();
    this.lastPoint = this.currentPivot;
    this.initialSize = this.currentPivot.subtract(this.initialPivot);
    this.centeredInitialSize = this.initialSize.divide(2);
    this.initialCenter = bounds.center.clone();
    this.initialVectorLayer = this.ps.getVectorLayer();
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    // Transform about the center if alt is pressed. Otherwise trasform about
    // the pivot opposite of the currently active pivot.
    const currentPivot = event.modifiers.alt ? this.initialCenter : this.initialPivot;
    const point = this.paperLayer.globalToLocal(event.point);
    const delta = point.subtract(this.lastPoint);
    this.lastPoint = point;
    this.currentPivot = this.currentPivot.add(delta);
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
    // TODO: this doesn't work yet for paths that are contained in scaled groups

    let newVl = this.initialVectorLayer.clone();
    this.selectedItems.forEach((item, index) => {
      const matrices: paper.Matrix[] = [];
      let curr = item;
      while (curr) {
        matrices.push(curr.matrix);
        curr = curr.parent;
      }
      const matrix = this.initialMatrices[index].clone();
      for (const m of matrices) {
        matrix.append(m.inverted());
      }
      matrix.scale(sx, sy, currentPivot);
      for (let i = matrices.length - 1; i >= 0; i--) {
        matrix.append(matrices[i]);
      }
      item.matrix = matrix;
      // TODO: make this work for groups as well
      // TODO: make this efficient
      const path = item.clone() as paper.Path;
      path.applyMatrix = true;
      const newPl = newVl.findLayerById(item.data.id).clone() as PathLayer;
      newPl.pathData = new Path(path.pathData);
      newVl = LayerUtil.replaceLayer(newVl, item.data.id, newPl);
    });
    this.ps.setVectorLayer(newVl);
  }
}

/**
 * Computes the transform matrix that will transform the specified item to its
 * viewport coordinates.
 */
function localToViewportMatrix(item: paper.Item) {
  // TODO: reuse this with PaperLayer.ts
  return item.globalMatrix.prepended(paper.project.activeLayer.matrix.inverted());
}
