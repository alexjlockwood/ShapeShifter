import { MathUtil } from 'app/scripts/common';
import { Cursor, Cursors, Guides } from 'app/scripts/paper/util';
import * as _ from 'lodash';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that performs selection and drag operations
 * on one or more path segments. This gesture is only used
 * during edit path mode.
 *
 * This gesture also supports adding a segment to the curve,
 * as well as extending an open path by appending segments to
 * its end points.
 */
export class SelectDragDrawSegmentsGesture extends Gesture {
  private selectedSegments: ReadonlyArray<paper.Segment>;
  private initialSegmentPositions: ReadonlyArray<paper.Point>;
  private updateHandlePositionsOnDrag: boolean;

  constructor(
    private readonly selectedEditPath: paper.Path,
    private readonly mouseDownHit?: paper.Segment | paper.CurveLocation,
  ) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    const selectedSegments = this.selectedEditPath.segments.filter(s => s.selected);
    if (this.mouseDownHit instanceof paper.Segment) {
      const hasSingleSelectedEndPointSegment =
        !this.selectedEditPath.closed &&
        selectedSegments.length === 1 &&
        (selectedSegments[0].isFirst() || selectedSegments[0].isLast());
      if (hasSingleSelectedEndPointSegment && this.mouseDownHit !== selectedSegments[0]) {
        // If the path is open, one of the end points is selected, and the
        // user is hovering over the other end point, then close the path.
        this.selectedEditPath.closed = true;
        selectedSegments[0].selected = false;
        this.mouseDownHit.selected = true;
      } else if (event.modifiers.shift || event.modifiers.command) {
        // If shift or command is pressed, toggle the segment's selection state.
        this.mouseDownHit.selected = !this.mouseDownHit.selected;
      } else {
        // If shift isn't pressed, select the hit segment and deselect all others.
        this.selectedEditPath.segments.forEach(s => (s.selected = false));
        this.mouseDownHit.selected = true;
      }
    } else if (this.mouseDownHit instanceof paper.CurveLocation) {
      // If there is no hit segment, then create one along the curve
      // at the given location and select the new segment.
      const hitSegment = this.mouseDownHit.curve.divideAt(this.mouseDownHit).segment1;
      this.selectedEditPath.segments.forEach(s => (s.selected = false));
      hitSegment.curve.selected = true;
    } else {
      // Otherwise, we are either (1) extending an existing open path (beginning
      // at one of its selected end points), or (2) beginning to create a new path
      // from scratch.
      let addedSegment: paper.Segment;
      if (this.selectedEditPath.segments.length === 0) {
        addedSegment = this.selectedEditPath.add(event.point);
      } else {
        const selectedSegment = selectedSegments[0];
        addedSegment = selectedSegment.isLast()
          ? this.selectedEditPath.add(event.point)
          : this.selectedEditPath.insert(0, event.point);
        selectedSegment.selected = false;
      }
      addedSegment.selected = true;
    }

    this.updateHandlePositionsOnDrag = !this.mouseDownHit;
    this.selectedSegments = this.selectedEditPath.segments.filter(s => s.selected);
    this.initialSegmentPositions = this.selectedSegments.map(s => s.point.clone());

    Guides.hidePenPathPreviewPath();
    Cursors.set(Cursor.PointSelect);
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    Guides.hideAddSegmentToCurveHoverGroup();

    const dragVector = event.point.subtract(event.downPoint);
    const snapPoint = event.modifiers.shift
      ? new paper.Point(MathUtil.snapDeltaToAngle(dragVector, 15))
      : undefined;
    if (this.updateHandlePositionsOnDrag) {
      // Then we have just added a segment to the path in onMouseDown()
      // and should thus move the segment's handles onMouseDrag().
      const selectedSegment = this.selectedSegments[0];
      if (event.modifiers.shift) {
        selectedSegment.handleIn = this.initialSegmentPositions[0].subtract(snapPoint);
        selectedSegment.handleOut = this.initialSegmentPositions[0].add(snapPoint);
      } else {
        selectedSegment.handleIn = selectedSegment.handleIn.subtract(event.delta);
        selectedSegment.handleOut = selectedSegment.handleOut.add(event.delta);
      }
    } else {
      // Then we selected an existing segment in onMouseDown() and should
      // move the segment according to the new mouse position.
      this.selectedSegments.forEach((segment, i) => {
        if (event.modifiers.shift) {
          segment.point = this.initialSegmentPositions[i].add(snapPoint);
        } else {
          segment.point = segment.point.add(event.delta);
        }
      });
    }
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    Cursors.clear();
  }
}

function findHandle(path: paper.Path, point: paper.Point) {
  for (const segment of path.segments) {
    const types: Array<'segment' | 'handle-in' | 'handle-out'> = [
      'segment',
      'handle-in',
      'handle-out',
    ];
    for (const type of types) {
      let segmentPoint = segment.point;
      if (type === 'handle-in') {
        segmentPoint = segmentPoint.add(segment.handleIn);
      } else if (type === 'handle-out') {
        segmentPoint = segmentPoint.add(segment.handleOut);
      }
      // TODO: the '6' seems arbitrary here... investigate?
      if (point.subtract(segmentPoint).length < 6) {
        return { type, segment };
      }
    }
  }
  return undefined;
}
