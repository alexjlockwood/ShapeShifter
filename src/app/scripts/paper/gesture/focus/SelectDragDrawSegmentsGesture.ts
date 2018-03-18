import { ToolMode } from 'app/model/paper';
import { MathUtil } from 'app/scripts/common';
import { Gesture } from 'app/scripts/paper/gesture';
import { PaperLayer } from 'app/scripts/paper/item';
import { Cursor, CursorUtil, PaperUtil, SnapUtil } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import { Line } from 'app/store/paper/actions';
import * as paper from 'paper';

/**
 * A gesture that performs selection and drag operations
 * on one or more path segments. It also supports adding
 * a segment to an existing path's curve, as well as extending
 * an open path by appending segments to its end points.
 *
 * Preconditions:
 * - The user is in focused path mode.
 * - The user either hit a segment, a curve, or missed entirely.
 *   The last case occurs when the user is in pen mode (in which
 *   the user can create new segments by clicking on the canvas).
 */
export class SelectDragDrawSegmentsGesture extends Gesture {
  private readonly pl = paper.project.activeLayer as PaperLayer;

  // Maps segment indices to each segment's starting position.
  private mouseDownSelectedSegmentIndexMap: ReadonlyMap<number, paper.Point>;
  // The location of the last mouse event in the focused path's local coordinates.
  private localLastPoint: paper.Point;
  // True if we should exit focused path mode on the next mouse up event.
  private exitFocusedPathModeOnMouseUp = false;
  // If this gesture was used to split a curve, this tells us the index of the
  // new segment that was created in onMouseDown().
  private newSplitCurveSegmentIndex: number;

  /** Static factory method to use when the user's mouse down hits a segment. */
  static hitSegment(ps: PaperService, focusedPathId: string, segmentIndex: number) {
    return new SelectDragDrawSegmentsGesture(ps, focusedPathId, { segmentIndex });
  }

  /** Static factory method to use when the user's mouse down hits a curve. */
  static hitCurve(ps: PaperService, focusedPathId: string, curveIndex: number, time: number) {
    return new SelectDragDrawSegmentsGesture(ps, focusedPathId, undefined, { curveIndex, time });
  }

  /** Static factory method to use when the user misses the focused path. */
  static miss(ps: PaperService, focusedPathId: string) {
    return new SelectDragDrawSegmentsGesture(ps, focusedPathId);
  }

  private constructor(
    private readonly ps: PaperService,
    private readonly focusedPathId: string,
    private readonly hitSegmentInfo?: Readonly<{ segmentIndex: number }>,
    private readonly hitCurveInfo?: Readonly<{ curveIndex?: number; time: number }>,
  ) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    const fpi = this.ps.getFocusedPathInfo();
    const beforeSelectedSegmentIndices = fpi.selectedSegments;
    const afterSelectedSegmentIndices = new Set(beforeSelectedSegmentIndices);
    const focusedPath = this.pl.findItemByLayerId(this.focusedPathId) as paper.Path;

    if (this.hitSegmentInfo) {
      const isEndPointFn = (i: number) => i === 0 || i === focusedPath.segments.length - 1;
      const { segmentIndex } = this.hitSegmentInfo;
      const singleSelectedSegmentIndex = beforeSelectedSegmentIndices.size
        ? beforeSelectedSegmentIndices.values().next().value
        : undefined;
      if (
        !focusedPath.closed &&
        singleSelectedSegmentIndex !== undefined &&
        isEndPointFn(segmentIndex) &&
        isEndPointFn(singleSelectedSegmentIndex) &&
        segmentIndex !== singleSelectedSegmentIndex
      ) {
        // If the path is open, one of the end points is selected, and the
        // user clicked the other end point segment, then close the path
        // and end the gesture on the next mouse up event.
        focusedPath.closed = true;
        this.exitFocusedPathModeOnMouseUp = true;
        PaperUtil.replacePathInStore(this.ps, this.focusedPathId, focusedPath.pathData);
      }
      if (event.modifiers.shift || event.modifiers.command) {
        // If shift or command is pressed, toggle the segment's selection state.
        if (beforeSelectedSegmentIndices.has(segmentIndex)) {
          afterSelectedSegmentIndices.delete(segmentIndex);
        } else {
          afterSelectedSegmentIndices.add(segmentIndex);
        }
      } else {
        // Otherwise, select the hit segment and deselect all others.
        afterSelectedSegmentIndices.clear();
        afterSelectedSegmentIndices.add(segmentIndex);
      }
    } else if (this.hitCurveInfo) {
      // If there is no hit segment, then create one along the curve
      // at the given location and select the new segment.
      const { curveIndex, time } = this.hitCurveInfo;
      const curve = focusedPath.curves[curveIndex];
      const newSegment = event.modifiers.command
        ? curve.divideAt(curve.getLocationAt(curve.length / 2))
        : curve.divideAtTime(time).segment1;
      PaperUtil.replacePathInStore(this.ps, this.focusedPathId, focusedPath.pathData);
      afterSelectedSegmentIndices.clear();
      afterSelectedSegmentIndices.add(newSegment.index);
      this.newSplitCurveSegmentIndex = newSegment.index;
    } else {
      // Otherwise, we are either (1) extending an existing open path (beginning
      // at one of its selected end points), or (2) beginning to create a new path
      // from scratch.
      const localPoint = focusedPath.globalToLocal(event.point);
      let addedSegment: paper.Segment;
      if (focusedPath.segments.length === 0) {
        addedSegment = focusedPath.add(localPoint);
      } else {
        // Note that there will always be a single selected end point segment in this case
        // (otherwise we would have used a batch select segments gesture instead).
        const singleSelectedSegmentIndex = beforeSelectedSegmentIndices.values().next().value;
        const selectedSegment = focusedPath.segments[singleSelectedSegmentIndex];
        addedSegment = selectedSegment.isLast()
          ? focusedPath.add(localPoint)
          : focusedPath.insert(0, localPoint);
        afterSelectedSegmentIndices.delete(singleSelectedSegmentIndex);
      }
      afterSelectedSegmentIndices.add(addedSegment.index);
      PaperUtil.replacePathInStore(this.ps, this.focusedPathId, focusedPath.pathData);
    }

    this.mouseDownSelectedSegmentIndexMap = new Map(
      Array.from(afterSelectedSegmentIndices).map(segmentIndex => {
        const point = focusedPath.segments[segmentIndex].point.clone();
        return [segmentIndex, point] as [number, paper.Point];
      }),
    );

    this.ps.setFocusedPathInfo({
      ...fpi,
      ...PaperUtil.selectCurves(this.ps, focusedPath, afterSelectedSegmentIndices),
    });
    CursorUtil.set(Cursor.PointSelect);
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    const focusedPath = this.pl.findItemByLayerId(this.focusedPathId) as paper.Path;

    const localDownPoint = focusedPath.globalToLocal(event.downPoint);
    if (!this.localLastPoint) {
      this.localLastPoint = localDownPoint;
    }
    const localPoint = focusedPath.globalToLocal(event.point);
    const localDownPointDelta = localPoint.subtract(localDownPoint);
    const localLastPointDelta = localPoint.subtract(this.localLastPoint);
    const localSnappedDownPointDelta = new paper.Point(
      MathUtil.snapVectorToAngle(localDownPointDelta, 90),
    );

    if (this.hitSegmentInfo || this.hitCurveInfo) {
      // A segment was created on mouse down and is still being grabbed,
      // so continue to drag the currently selected segments.
      const selectedSegmentIndices = new Set(this.mouseDownSelectedSegmentIndexMap.keys());
      const nonSelectedSegmentIndices = focusedPath.segments
        .map((s, i) => i)
        .filter((s, i) => !selectedSegmentIndices.has(i));
      this.mouseDownSelectedSegmentIndexMap.forEach((initialSegmentPoint, i) => {
        const segment = focusedPath.segments[i];
        segment.point = event.modifiers.shift
          ? initialSegmentPoint.add(localSnappedDownPointDelta)
          : segment.point.add(localLastPointDelta);
      });
      const draggedSegmentIndex = this.hitSegmentInfo
        ? this.hitSegmentInfo.segmentIndex
        : this.newSplitCurveSegmentIndex;
      const dragSnapPoint = focusedPath.localToGlobal(
        focusedPath.segments[draggedSegmentIndex].point,
      );
      const { topLeft, center, bottomRight } = Array.from(
        this.mouseDownSelectedSegmentIndexMap.values(),
      ).reduce((rect: paper.Rectangle, p: paper.Point) => {
        p = focusedPath.localToGlobal(p);
        return rect ? rect.include(p) : new paper.Rectangle(p, new paper.Size(0, 0));
      }, undefined);
      const siblingSnapPointsTable = [
        [topLeft, center, bottomRight],
        ...nonSelectedSegmentIndices.map(i => {
          return [focusedPath.localToGlobal(focusedPath.segments[i].point)];
        }),
      ];

      // TODO: snap this stuff like we do in the other gestures!
      const snapInfo = SnapUtil.computeSnapInfo([dragSnapPoint], siblingSnapPointsTable);
      if (snapInfo) {
        this.ps.setSnapGuideInfo({
          guides: snapInfo.guides.map(({ from, to }: Line) => {
            from = this.pl.globalToLocal(new paper.Point(from));
            to = this.pl.globalToLocal(new paper.Point(to));
            return { from, to };
          }),
          rulers: [],
        });
      }
    } else {
      // Then we have just added a segment to the path in onMouseDown()
      // and should thus move the segment's handles onMouseDrag().
      // Note that there will only ever be one selected segment in this case.
      const selectedSegmentIndex = this.mouseDownSelectedSegmentIndexMap.keys().next().value;
      const selectedSegment = focusedPath.segments[selectedSegmentIndex];
      // TODO: dragging a handle belonging to an endpoint doesn't work! handle info is lost!
      // TODO: snap the dragged segment handle with the newly created segment
      if (event.modifiers.shift) {
        const index = selectedSegmentIndex;
        const initialSelectedSegmentPosition = this.mouseDownSelectedSegmentIndexMap.get(index);
        const delta = localSnappedDownPointDelta;
        selectedSegment.handleIn = initialSelectedSegmentPosition.subtract(delta);
        selectedSegment.handleOut = initialSelectedSegmentPosition.add(delta);
      } else {
        selectedSegment.handleIn = selectedSegment.handleIn.subtract(localLastPointDelta);
        selectedSegment.handleOut = selectedSegment.handleOut.add(localLastPointDelta);
      }
    }
    this.localLastPoint = localPoint;

    PaperUtil.replacePathInStore(this.ps, this.focusedPathId, focusedPath.pathData);
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    CursorUtil.clear();
    this.ps.setSnapGuideInfo(undefined);
    if (this.exitFocusedPathModeOnMouseUp) {
      this.ps.setToolMode(ToolMode.Selection);
      this.ps.setSelectedLayerIds(new Set([this.focusedPathId]));
    }
  }

  // TODO: handle escape key event?
}
