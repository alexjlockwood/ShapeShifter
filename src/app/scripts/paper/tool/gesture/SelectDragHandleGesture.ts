import { PaperLayer } from 'app/scripts/paper/item';
import { PaperUtil } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that performs selection and drag operations on a segment handle.
 *
 * Preconditions:
 * - The user is in focused path mode.
 * - The user hit a selected segment's handle.
 */
export class SelectDragHandleGesture extends Gesture {
  private readonly paperLayer = paper.project.activeLayer as PaperLayer;
  private readonly hitHandleType: 'handleIn' | 'handleOut';
  private initialHandle: paper.Point;
  private lastDragEventInfo: {
    readonly localDownPoint: paper.Point;
    readonly localPoint: paper.Point;
  };

  constructor(
    private readonly ps: PaperService,
    private readonly focusedPathId: string,
    private readonly hitSegmentIndex: number,
    hitResultType: 'handle-in' | 'handle-out',
  ) {
    super();
    this.hitHandleType = hitResultType === 'handle-in' ? 'handleIn' : 'handleOut';
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    const selectedSegments = new Set<number>();
    const selectedHandleIn = this.hitHandleType === 'handleIn' ? this.hitSegmentIndex : undefined;
    const selectedHandleOut = this.hitHandleType === 'handleOut' ? this.hitSegmentIndex : undefined;
    this.ps.setFocusedPathInfo({
      ...this.ps.getFocusedPathInfo(),
      selectedSegments,
      selectedHandleIn,
      selectedHandleOut,
    });
    const focusedPath = this.paperLayer.findItemByLayerId(this.focusedPathId) as paper.Path;
    this.initialHandle = focusedPath.segments[this.hitSegmentIndex][this.hitHandleType].clone();
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    const focusedPath = this.paperLayer.findItemByLayerId(this.focusedPathId);
    this.lastDragEventInfo = {
      localDownPoint: focusedPath.globalToLocal(event.downPoint),
      localPoint: focusedPath.globalToLocal(event.point),
    };
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
    if (!this.lastDragEventInfo) {
      return;
    }
    const { localDownPoint, localPoint } = this.lastDragEventInfo;
    const handle = this.initialHandle.add(localPoint.subtract(localDownPoint));
    if (event.modifiers.shift) {
      // Project the handle onto the handle's original vector.
      const theta = -(this.initialHandle.angle - handle.angle) * Math.PI / 180;
      handle.set(this.initialHandle.normalize().multiply(handle.length * Math.cos(theta)));
    }
    const focusedPath = this.paperLayer.findItemByLayerId(this.focusedPathId) as paper.Path;
    focusedPath.segments[this.hitSegmentIndex][this.hitHandleType] = handle;
    PaperUtil.replacePathInStore(this.ps, this.focusedPathId, focusedPath.pathData);
  }
}
