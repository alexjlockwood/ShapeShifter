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
      const p = this.paperLayer.findItemByLayerId(id).clone();
      //p.applyMatrix = true;
      return p;
    });
    this.initialMatrices = this.selectedItems.map(i => i.matrix.clone());
    const bounds = this.paperLayer.getSelectionBounds();
    const pivotType = this.selectionBoundsRaster.pivotType;
    const oppPivotType = this.selectionBoundsRaster.oppositePivotType;
    this.initialPivot = bounds[oppPivotType].clone();
    this.currentPivot = bounds[pivotType].clone();
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
    const lastPoint = paper.project.activeLayer.globalToLocal(event.lastPoint);
    const point = paper.project.activeLayer.globalToLocal(event.point);
    const delta = point.subtract(lastPoint);
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
    this.selectedItems.forEach((i, index) => {
      i.matrix = this.initialMatrices[index].clone().scale(sx, sy, currentPivot);
      // TODO: make this work for groups as well
      // TODO: make this efficient
      const path = i.clone() as paper.Path;
      path.applyMatrix = true;
      const newPl = newVl.findLayerById(i.data.id).clone() as PathLayer;
      newPl.pathData = new Path(path.pathData);
      newVl = LayerUtil.replaceLayer(newVl, i.data.id, newPl);
    });
    this.ps.setVectorLayer(newVl);
  }
}
