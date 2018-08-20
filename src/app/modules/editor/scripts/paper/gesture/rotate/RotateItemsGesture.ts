import { LayerUtil, PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { Gesture } from 'app/modules/editor/scripts/paper/gesture';
import { PaperLayer } from 'app/modules/editor/scripts/paper/item';
import { PaperUtil } from 'app/modules/editor/scripts/paper/util';
import { PaperService } from 'app/modules/editor/services';
import * as paper from 'paper';

/**
 * A gesture that performs rotation operations.
 *
 * Preconditions:
 * - The user is in default mode.
 * - One or more layers are selected.
 * - A mouse down event occurred on a selection bounds handle.
 *
 * TODO: avoid jank at beginning of rotation (when angle is near 0)
 * TODO: make sure the 'empty group' logic we add also matches what we have in PaperLayer.ts
 * TODO: show a tool tip during rotations
 * TODO: make sure the pivot doesn't move during the initial drag
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

    const scaleItems: paper.Item[] = [];
    const scaleItemsSet = new Set<string>();
    Array.from(this.ps.getSelectedLayerIds())
      .map(id => this.pl.findItemByLayerId(id))
      // TODO: reuse this code with PaperLayer (filter out empty groups)
      .filter(i => !(i instanceof paper.Group) || i.children.length)
      .forEach(function recurseFn(i: paper.Item) {
        if (i instanceof paper.Group) {
          i.children.forEach(recurseFn);
        } else if (!scaleItemsSet.has(i.data.id)) {
          scaleItemsSet.add(i.data.id);
          scaleItems.push(i);
        }
      });
    this.selectedItems = scaleItems;

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
  private processEvent(event: paper.Event) {
    if (!this.vpPoint) {
      return;
    }
    const rotationAngle = this.getRotationAngle(event);
    let newVl = this.initialVectorLayer.clone();
    this.selectedItems.forEach((item, index) => {
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
