import { LayerUtil, PathLayer, VectorLayer } from 'app/model/layers';
import { Path } from 'app/model/paths';
import { MathUtil } from 'app/scripts/common';
import { PaperLayer } from 'app/scripts/paper/item';
import { PivotType, SelectionBoundsRaster } from 'app/scripts/paper/item';
import { PaperUtil } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import * as _ from 'lodash';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that performs scaling operations.
 */
export class ScaleItemsGesture extends Gesture {
  private readonly paperLayer = paper.project.activeLayer as PaperLayer;
  private selectedItems: ReadonlyArray<paper.Item>;
  private localToViewportMatrices: ReadonlyArray<paper.Matrix>;
  private initialPivot: paper.Point;
  private initialSize: paper.Point;
  private centeredInitialSize: paper.Point;
  private initialCenter: paper.Point;
  private draggedSegment: paper.Point;
  private initialVectorLayer: VectorLayer;
  private lastPoint: paper.Point;
  private point: paper.Point;

  constructor(
    private readonly ps: PaperService,
    private readonly selectionBoundsRaster: SelectionBoundsRaster,
  ) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    this.ps.setHoveredLayer(undefined);
    this.selectedItems = Array.from(this.ps.getSelectedLayers()).map(id =>
      this.paperLayer.findItemByLayerId(id),
    );
    const invertedPaperLayerMatrix = this.paperLayer.matrix.inverted();
    this.localToViewportMatrices = this.selectedItems.map(item => {
      // Compute the matrices to directly transform while performing rotations.
      return item.globalMatrix.prepended(invertedPaperLayerMatrix).inverted();
    });
    const bounds = PaperUtil.transformRectangle(
      PaperUtil.computeGlobalBounds(this.selectedItems),
      this.paperLayer.matrix.inverted(),
    );
    this.initialPivot = bounds[this.selectionBoundsRaster.oppositePivotType];
    this.draggedSegment = bounds[this.selectionBoundsRaster.pivotType];
    this.lastPoint = this.draggedSegment;
    this.initialSize = this.draggedSegment.subtract(this.initialPivot);
    this.centeredInitialSize = this.initialSize.divide(2);
    this.initialCenter = bounds.center.clone();
    this.initialVectorLayer = this.ps.getVectorLayer();
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    this.point = this.paperLayer.globalToLocal(event.point);
    const { x, y } = this.point;
    this.ps.setTooltipInfo({
      point: { x, y },
      // TODO: display the current width/height of the shape
      label: `${_.round(x, 1)} ⨯ ${_.round(y, 1)}`,
    });
    this.processEvent(event);
    this.lastPoint = this.point;
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    this.ps.setTooltipInfo(undefined);
  }

  // @Override
  onKeyDown(event: paper.KeyEvent) {
    this.processKeyEvent(event);
  }

  // @Override
  onKeyUp(event: paper.KeyEvent) {
    this.processKeyEvent(event);
  }

  private processKeyEvent(event: paper.KeyEvent) {
    if (event.key === 'alt' || event.key === 'shift') {
      this.processEvent(event);
    }
  }

  private processEvent(event: paper.Event) {
    // Transform about the center if alt is pressed. Otherwise trasform about
    // the pivot opposite of the currently active pivot.
    const fixedPivot = event.modifiers.alt ? this.initialCenter : this.initialPivot;
    this.draggedSegment = this.draggedSegment.add(this.point.subtract(this.lastPoint));
    const currentSize = this.draggedSegment.subtract(fixedPivot);
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
      // TODO: make this stuff works for groups as well
      const path = item.clone() as paper.Path;
      path.applyMatrix = true;
      const localToViewportMatrix = this.localToViewportMatrices[index];
      const matrix = localToViewportMatrix.clone();
      matrix.scale(sx, sy, fixedPivot);
      matrix.append(localToViewportMatrix.inverted());
      path.matrix = matrix;
      const newPl = newVl.findLayerById(item.data.id).clone() as PathLayer;
      newPl.pathData = new Path(path.pathData);
      newVl = LayerUtil.replaceLayer(newVl, item.data.id, newPl);
    });
    this.ps.setVectorLayer(newVl);
  }
}
