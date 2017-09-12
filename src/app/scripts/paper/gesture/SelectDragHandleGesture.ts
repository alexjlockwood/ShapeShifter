import { MathUtil } from 'app/scripts/common';
import { PaperService } from 'app/services';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that performs selection and drag operations on
 * a single segment handle. This gesture is only used during
 * edit path mode.
 */
export class SelectDragHandleGesture extends Gesture {
  private readonly hitHandleType: 'handleIn' | 'handleOut';
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
    // this.selectedEditPath.segments.forEach(s => (s.selected = false));
    // this.mouseDownHitSegment[this.hitHandleType].selected = true;
    // this.initialHandlePosition = this.mouseDownHitSegment[this.hitHandleType].clone();
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    // TODO: change this snapping behavior so it behaves the same as in sketch?
    // const dragVector = event.point.subtract(event.downPoint);
    // const snapPoint = event.modifiers.shift
    //   ? new paper.Point(MathUtil.snapDeltaToAngle(dragVector, 15))
    //   : undefined;
    // const hitSegment = this.mouseDownHitSegment;
    // if (event.modifiers.shift) {
    //   hitSegment[this.hitHandleType] = this.initialHandlePosition.add(snapPoint);
    // } else {
    //   hitSegment[this.hitHandleType] = hitSegment[this.hitHandleType].add(event.delta);
    // }
  }
}
