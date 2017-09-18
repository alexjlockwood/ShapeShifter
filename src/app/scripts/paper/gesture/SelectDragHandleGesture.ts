import { LayerUtil, PathLayer, VectorLayer } from 'app/model/layers';
import { Path } from 'app/model/paths';
import { MathUtil } from 'app/scripts/common';
import { PaperLayer } from 'app/scripts/paper/item';
import { PaperUtil } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that performs selection and drag operations on a segment handle.
 */
export class SelectDragHandleGesture extends Gesture {
  private readonly paperLayer = paper.project.activeLayer as PaperLayer;
  private readonly hitHandleType: 'handleIn' | 'handleOut';
  private focusedPathItemId: string;
  private initialHandle: paper.Point;
  private lastDragEventInfo: Readonly<{ downPoint: paper.Point; point: paper.Point }>;

  constructor(
    private readonly ps: PaperService,
    private readonly segmentIndex: number,
    hitResultType: 'handle-in' | 'handle-out',
  ) {
    super();
    this.hitHandleType = hitResultType === 'handle-in' ? 'handleIn' : 'handleOut';
    this.focusedPathItemId = this.ps.getFocusedPathInfo().layerId;
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    const selectedSegments = new Set<number>();
    const selectedHandleIn = this.hitHandleType === 'handleIn' ? this.segmentIndex : undefined;
    const selectedHandleOut = this.hitHandleType === 'handleOut' ? this.segmentIndex : undefined;
    this.ps.setFocusedPathInfo({
      ...this.ps.getFocusedPathInfo(),
      selectedSegments,
      selectedHandleIn,
      selectedHandleOut,
    });
    const focusedPath = this.paperLayer.findItemByLayerId(this.focusedPathItemId) as paper.Path;
    this.initialHandle = focusedPath.segments[this.segmentIndex][this.hitHandleType].clone();
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    const focusedPath = this.paperLayer.findItemByLayerId(this.focusedPathItemId);
    const downPoint = focusedPath.globalToLocal(event.downPoint);
    const point = focusedPath.globalToLocal(event.point);
    this.lastDragEventInfo = { downPoint, point };
    this.processEvent(event);
  }

  // @Override
  onKeyDown(event: paper.KeyEvent) {
    if (event.key === 'shift') {
      this.processEvent(event);
    }
  }

  // @Override
  onKeyUp(event: paper.KeyEvent) {
    if (event.key === 'shift') {
      this.processEvent(event);
    }
  }

  private processEvent({ modifiers: { shift } }: paper.Event) {
    if (!this.lastDragEventInfo) {
      return;
    }
    const { downPoint, point } = this.lastDragEventInfo;
    const handle = this.initialHandle.add(point.subtract(downPoint));
    if (shift) {
      // Project the new handle vector onto the original handle vector.
      const theta = -(this.initialHandle.angle - handle.angle) * Math.PI / 180;
      handle.set(this.initialHandle.normalize().multiply(handle.length * Math.cos(theta)));
    }
    const focusedPath = this.paperLayer
      .findItemByLayerId(this.focusedPathItemId)
      .clone() as paper.Path;
    focusedPath.segments[this.segmentIndex][this.hitHandleType] = handle;
    PaperUtil.replacePathInStore(this.ps, this.focusedPathItemId, focusedPath.pathData);
  }
}
