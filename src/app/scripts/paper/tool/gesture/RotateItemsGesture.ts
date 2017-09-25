import { LayerUtil, PathLayer, VectorLayer } from 'app/model/layers';
import { Path } from 'app/model/paths';
import { MathUtil } from 'app/scripts/common';
import { PaperLayer } from 'app/scripts/paper/item';
import { SelectionBoundsRaster } from 'app/scripts/paper/item';
import { PaperUtil, PivotType } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that performs rotation operations.
 *
 * TODO: make it possible to move the pivot with the mouse
 * TODO: avoid jank at beginning of rotation (when angle is near 0)
 */
export class RotateItemsGesture extends Gesture {
  private readonly paperLayer = paper.project.activeLayer as PaperLayer;
  private selectedItems: ReadonlyArray<paper.Item>;
  private localToViewportMatrices: ReadonlyArray<paper.Matrix>;
  private initialVectorLayer: VectorLayer;
  private pivot: paper.Point;

  private downPoint: paper.Point;
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
    this.pivot = PaperUtil.transformRectangle(
      PaperUtil.computeGlobalBounds(this.selectedItems),
      this.paperLayer.matrix.inverted(),
    ).center;
    this.initialVectorLayer = this.ps.getVectorLayer();
    this.downPoint = this.paperLayer.globalToLocal(event.downPoint);
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    this.point = this.paperLayer.globalToLocal(event.point);
    this.processEvent(event);
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
    if (event.key === 'shift') {
      this.processEvent(event);
    }
  }

  private processEvent(event: paper.Event) {
    if (!this.point) {
      return;
    }

    // TODO: set strokeScaling to false?
    // TODO: this doesn't work yet for paths that are contained in scaled groups

    const rotationAngle = this.getRotationAngle(event);
    let newVl = this.initialVectorLayer.clone();
    this.selectedItems.forEach((item, index) => {
      // TODO: make this stuff works for groups as well
      // TODO: should we pass 'false' to clone below?
      const path = item.clone() as paper.Path;
      path.applyMatrix = true;
      const localToViewportMatrix = this.localToViewportMatrices[index];
      const matrix = localToViewportMatrix.clone();
      matrix.rotate(rotationAngle, this.pivot);
      matrix.append(localToViewportMatrix.inverted());
      path.matrix = matrix;
      const newPl = newVl.findLayerById(item.data.id).clone() as PathLayer;
      newPl.pathData = new Path(path.pathData);
      newVl = LayerUtil.replaceLayer(newVl, item.data.id, newPl);
    });
    this.ps.setVectorLayer(newVl);
  }

  private getRotationAngle(event: paper.Event) {
    const initialDelta = this.downPoint.subtract(this.pivot);
    const initialAngle = Math.atan2(initialDelta.y, initialDelta.x) * 180 / Math.PI;
    const delta = this.point.subtract(this.pivot);
    const angle = Math.atan2(delta.y, delta.x) * 180 / Math.PI - initialAngle;
    // TODO: this doesn't round properly if the angle was previously changed
    return event.modifiers.shift ? Math.round(angle / 15) * 15 : angle;
  }
}
