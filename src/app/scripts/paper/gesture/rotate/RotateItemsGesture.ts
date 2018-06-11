import { LayerUtil, PathLayer, VectorLayer } from 'app/model/layers';
import { Path } from 'app/model/paths';
import { Gesture } from 'app/scripts/paper/gesture';
import { PaperLayer } from 'app/scripts/paper/item';
import { PaperUtil } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import * as paper from 'paper';

/**
 * A gesture that performs rotation operations.
 *
 * Preconditions:
 * - The user is in default mode.
 * - One or more layers are selected.
 * - A mouse down event occurred on a selection bounds handle.
 *
 * TODO: make it possible to move the pivot with the mouse
 * TODO: avoid jank at beginning of rotation (when angle is near 0)
 * TODO: don't allow user to rotate empty groups?
 * TODO: make sure the 'empty group' logic we add also matches what we have in PaperLayer.ts
 * TODO: rotating groups not implemented yet
 * TODO: show a tool tip during rotations
 */
export class RotateItemsGesture extends Gesture {
  private readonly pl = paper.project.activeLayer as PaperLayer;
  private selectedItems: ReadonlyArray<paper.Item>;
  private localToVpItemMatrices: ReadonlyArray<paper.Matrix>;
  private initialVectorLayer: VectorLayer;
  private vpPivot: paper.Point;
  private vpDownPoint: paper.Point;
  private vpPoint: paper.Point;

  constructor(private readonly ps: PaperService) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    this.ps.setHoveredLayerId(undefined);
    // TODO: reuse this code with PaperLayer (filter out empty groups)
    this.selectedItems = Array.from(this.ps.getSelectedLayerIds())
      .map(id => this.pl.findItemByLayerId(id))
      .filter(i => !(i instanceof paper.Group) || i.children.length);
    const invertedPaperLayerMatrix = this.pl.matrix.inverted();
    this.localToVpItemMatrices = this.selectedItems.map(item => {
      // Compute the matrices to directly transform during drag events.
      return item.globalMatrix.prepended(invertedPaperLayerMatrix).inverted();
    });
    const rii = this.ps.getRotateItemsInfo();
    if (rii.pivot) {
      this.vpPivot = new paper.Point(rii.pivot);
    } else {
      this.vpPivot = PaperUtil.transformRectangle(
        PaperUtil.computeBounds(this.selectedItems),
        invertedPaperLayerMatrix,
      ).center;
    }
    this.initialVectorLayer = this.ps.getVectorLayer();
    this.vpDownPoint = this.pl.globalToLocal(event.downPoint);
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    this.vpPoint = this.pl.globalToLocal(event.point);
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

  // TODO: determine if we should be baking transforms into the children layers when rotating a group?
  // TODO: this doesn't work yet for paths that are contained in scaled groups
  private processEvent(event: paper.Event) {
    if (!this.vpPoint) {
      return;
    }
    const rotationAngle = this.getRotationAngle(event);
    let newVl = this.initialVectorLayer.clone();
    this.selectedItems.forEach((item, index) => {
      // TODO: make this stuff works for groups as well
      const path = item.clone() as paper.Path;
      path.applyMatrix = true;
      const localToViewportMatrix = this.localToVpItemMatrices[index];
      const matrix = localToViewportMatrix.clone();
      matrix.rotate(rotationAngle, this.vpPivot);
      matrix.append(localToViewportMatrix.inverted());
      path.matrix = matrix;
      const newPl = newVl.findLayerById(item.data.id).clone() as PathLayer;
      newPl.pathData = new Path(path.pathData);
      newVl = LayerUtil.replaceLayer(newVl, item.data.id, newPl);
    });
    this.ps.setVectorLayer(newVl);
  }

  private getRotationAngle(event: paper.Event) {
    const initialDelta = this.vpDownPoint.subtract(this.vpPivot);
    const initialAngle = (Math.atan2(initialDelta.y, initialDelta.x) * 180) / Math.PI;
    const delta = this.vpPoint.subtract(this.vpPivot);
    const angle = (Math.atan2(delta.y, delta.x) * 180) / Math.PI - initialAngle;
    // TODO: this doesn't round properly if the angle was previously changed
    return event.modifiers.shift ? Math.round(angle / 15) * 15 : angle;
  }
}
