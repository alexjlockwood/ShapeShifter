import { MathUtil } from 'app/scripts/common';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that performs selection and drag operations
 * on one or more path segments. This gesture is only used
 * during edit path mode.
 */
export class SelectDragSegmentsGesture extends Gesture {
  private selectedSegments: ReadonlyArray<paper.Segment>;
  private initialSegmentPositions: ReadonlyArray<paper.Point>;

  constructor(
    private readonly selectedEditPath: paper.Path,
    private readonly mouseDownHitSegment: paper.Segment,
  ) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    if (event.modifiers.shift || event.modifiers.command) {
      // If shift or command is pressed, toggle the segment's selection state.
      this.mouseDownHitSegment.selected = !this.mouseDownHitSegment.selected;
    } else {
      // If shift isn't pressed, select the hit segment and deselect all others.
      this.selectedEditPath.segments.forEach(s => (s.selected = false));
      this.mouseDownHitSegment.selected = true;
    }
    this.selectedSegments = this.selectedEditPath.segments.filter(s => s.selected);
    this.initialSegmentPositions = this.selectedSegments.map(s => s.point.clone());
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    const dragVector = event.point.subtract(event.downPoint);
    const snapPoint = event.modifiers.shift
      ? new paper.Point(MathUtil.snapDeltaToAngle(dragVector, 15))
      : undefined;
    this.selectedSegments.forEach((segment, i) => {
      if (event.modifiers.shift) {
        segment.point = this.initialSegmentPositions[i].add(snapPoint);
      } else {
        segment.point = segment.point.add(event.delta);
      }
    });
  }
}
