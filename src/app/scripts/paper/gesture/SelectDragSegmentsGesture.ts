import { MathUtil } from 'app/scripts/common';
import { Cursor, Cursors, Guides } from 'app/scripts/paper/util';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that performs selection and drag operations
 * on one or more path segments. This gesture is only used
 * during edit path mode.
 *
 * This gesture also supports adding a segment to the curve
 * at the beginning of the gesture.
 */
export class SelectDragSegmentsGesture extends Gesture {
  private selectedSegments: ReadonlyArray<paper.Segment>;
  private initialSegmentPositions: ReadonlyArray<paper.Point>;

  constructor(
    private readonly selectedEditPath: paper.Path,
    private readonly mouseDownHit: paper.Segment | paper.CurveLocation,
  ) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    let mouseDownHitSegment: paper.Segment;
    if (this.mouseDownHit instanceof paper.Segment) {
      mouseDownHitSegment = this.mouseDownHit;
      if (event.modifiers.shift || event.modifiers.command) {
        // If shift or command is pressed, toggle the segment's selection state.
        mouseDownHitSegment.selected = !mouseDownHitSegment.selected;
      } else {
        // If shift isn't pressed, select the hit segment and deselect all others.
        this.selectedEditPath.segments.forEach(s => (s.selected = false));
        mouseDownHitSegment.selected = true;
      }
    } else {
      // If there is no hit segment, then create one and select it.
      mouseDownHitSegment = this.mouseDownHit.curve.divideAt(this.mouseDownHit).segment1;
      this.selectedEditPath.segments.forEach(s => (s.selected = false));
      mouseDownHitSegment.curve.selected = true;
    }
    this.selectedSegments = this.selectedEditPath.segments.filter(s => s.selected);
    this.initialSegmentPositions = this.selectedSegments.map(s => s.point.clone());

    Cursors.set(Cursor.PointSelect);
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    Guides.hideAddSegmentToCurveHoverGroup();

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

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    Cursors.clear();
  }
}
