import { MathUtil } from 'app/scripts/common';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that performs selection operations on a path segment.
 */
export class SelectSegmentsGesture extends Gesture {
  private selectedSegments: ReadonlyArray<paper.Segment>;
  private initialSegmentPositions: ReadonlyArray<paper.Point>;

  constructor(
    private readonly selectedPath: paper.Path,
    private readonly mouseDownHitSegment: paper.Segment,
  ) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    if (!event.modifiers.shift) {
      this.selectedPath.segments.forEach(s => (s.selected = false));
    }
    this.mouseDownHitSegment.selected = true;
    this.selectedSegments = this.selectedPath.segments.filter(s => s.selected);
    this.initialSegmentPositions = this.selectedSegments.map(s => s.point);
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    const { point, downPoint, delta, modifiers } = event;
    const dragVector = point.subtract(downPoint);
    this.selectedSegments.forEach((segment, i) => {
      if (event.modifiers.shift) {
        const snapPoint = new paper.Point(MathUtil.snapDeltaToAngle(dragVector, 15));
        segment.point = this.initialSegmentPositions[i].add(snapPoint);
      } else {
        segment.point = segment.point.add(event.delta);
      }
    });
  }
}
