import { LayerUtil, PathLayer, VectorLayer } from 'app/model/layers';
import { Path } from 'app/model/paths';
import { MathUtil } from 'app/scripts/common';
import { PaperLayer } from 'app/scripts/paper/item';
import { PaperService } from 'app/services';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that performs selection and drag operations on a segment handle.
 */
export class SelectDragHandleGesture extends Gesture {
  private readonly paperLayer = paper.project.activeLayer as PaperLayer;
  private readonly hitHandleType: 'handleIn' | 'handleOut';
  private initialVectorLayer: VectorLayer;
  private initialHandlePosition: paper.Point;

  constructor(
    private readonly ps: PaperService,
    private readonly segmentIndex: number,
    hitResultType: 'handle-in' | 'handle-out',
  ) {
    super();
    this.hitHandleType = hitResultType === 'handle-in' ? 'handleIn' : 'handleOut';
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    // TODO: what about when alt/shift is pressed
    const focusedEditPath = this.ps.getFocusedEditPath();
    const selectedHandleIns = new Set<number>();
    const selectedHandleOuts = new Set<number>();
    if (this.hitHandleType === 'handleIn') {
      selectedHandleIns.add(this.segmentIndex);
    } else if (this.hitHandleType === 'handleOut') {
      selectedHandleOuts.add(this.segmentIndex);
    }
    this.ps.setFocusedEditPath({
      ...focusedEditPath,
      selectedSegments: new Set<number>(),
      selectedHandleIns,
      selectedHandleOuts,
    });

    // Save a copy of the initial vector layer and handle position so that
    // we can make changes to them as we drag.
    this.initialVectorLayer = this.ps.getVectorLayer();

    const editPath = this.paperLayer.findItemByLayerId(focusedEditPath.layerId) as paper.Path;
    this.initialHandlePosition = editPath.segments[this.segmentIndex][this.hitHandleType].clone();
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    const focusedEditPath = this.ps.getFocusedEditPath();
    const editPath = this.paperLayer
      .findItemByLayerId(focusedEditPath.layerId)
      .clone() as paper.Path;
    const downPoint = editPath.globalToLocal(event.downPoint);
    const point = editPath.globalToLocal(event.point);
    const localDelta = point.subtract(downPoint);
    // TODO: change this snapping behavior so it behaves the same as in sketch?
    const finalDelta = event.modifiers.shift
      ? new paper.Point(MathUtil.snapDeltaToAngle(localDelta, 15))
      : localDelta;
    const finalHandlePosition = this.initialHandlePosition.add(finalDelta);
    editPath.segments[this.segmentIndex][this.hitHandleType] = finalHandlePosition;
    const initialVectorLayer = this.initialVectorLayer.clone();
    const initialPathLayer = initialVectorLayer
      .findLayerById(focusedEditPath.layerId)
      .clone() as PathLayer;
    initialPathLayer.pathData = new Path(editPath.pathData);
    const newVl = LayerUtil.replaceLayer(initialVectorLayer, initialPathLayer.id, initialPathLayer);
    this.ps.setVectorLayer(newVl);
  }
}
