import { LayerUtil, PathLayer, VectorLayer } from 'app/model/layers';
import { Path } from 'app/model/paths';
import { MathUtil } from 'app/scripts/common';
import { PaperLayer } from 'app/scripts/paper/item';
import { PivotType, SelectionBoundsRaster } from 'app/scripts/paper/item';
import { PaperService } from 'app/services';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that performs rotation operations.
 *
 * TODO: make it possible to move the pivot position
 * TODO: avoid jank at beginning of rotation (when angle is near 0)
 */
export class RotateItemsGesture extends Gesture {
  private readonly paperLayer = paper.project.activeLayer as PaperLayer;
  private selectedItems: ReadonlyArray<paper.Item>;
  private initialMatrices: ReadonlyArray<paper.Matrix>;
  private pivot: paper.Point;
  private initialVectorLayer: VectorLayer;
  private originalAngle: number;

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

    this.pivot = bounds.center.clone();
    console.log(this.pivot);

    const pivotType = this.selectionBoundsRaster.pivotType;
    this.initialVectorLayer = this.ps.getVectorLayer();

    const delta = this.paperLayer.globalToLocal(event.point).subtract(this.pivot);
    this.originalAngle = Math.atan2(delta.y, delta.x) / Math.PI * 180;
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    const delta = this.paperLayer.globalToLocal(event.point).subtract(this.pivot);
    let angle = Math.atan2(delta.y, delta.x) / Math.PI * 180 - this.originalAngle;
    if (event.modifiers.shift) {
      angle = Math.round(angle / 15) * 15;
    }

    // TODO: set strokeScaling to false?
    // TODO: this doesn't work yet for paths that are contained in scaled groups

    let newVl = this.initialVectorLayer.clone();
    this.selectedItems.forEach((item, index) => {
      // TODO: make this efficient
      const path = item.clone() as paper.Path;
      path.applyMatrix = true;

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
      matrix.rotate(angle, this.pivot);
      for (let i = matrices.length - 1; i >= 0; i--) {
        matrix.append(matrices[i]);
      }
      item.matrix = matrix;
      // TODO: make this work for groups as well
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
