import { LayerUtil, PathLayer, VectorLayer } from 'app/model/layers';
import { Path } from 'app/model/paths';
import { MathUtil } from 'app/scripts/common';
import { PaperLayer } from 'app/scripts/paper/item';
import { Cursor, CursorUtil, PaperUtil, SnapUtil } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import { Line } from 'app/store/paper/actions';
import * as _ from 'lodash';
import * as paper from 'paper';

import { Gesture } from './Gesture';

// import { Snapper } from './snap';

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
  /** Static factory method to use when the user's mouse down hits a segment. */
  static hitSegment(ps: PaperService, segmentIndex: number) {
    return new SelectDragDrawSegmentsGesture(ps, { segmentIndex });
  }

  /** Static factory method to use when the user's mouse down hits a curve. */
  static hitCurve(ps: PaperService, curveIndex: number, time: number) {
    return new SelectDragDrawSegmentsGesture(ps, undefined, { curveIndex, time });
  }

  /** Static factory method to use when the user misses the focused path. */
  static miss(ps: PaperService) {
    return new SelectDragDrawSegmentsGesture(ps);
  }

  private readonly pl = paper.project.activeLayer as PaperLayer;
  private readonly focusedPathId: string;
  // Maps segment indices to each segment's starting position.
  private mouseDownSelectedSegmentIndexMap: ReadonlyMap<number, paper.Point>;
  // The location of the last mouse event in the focused path's local coordinates.
  private localLastPoint: paper.Point;
  private exitFocusedPathModeOnMouseUp = false;

  private constructor(
    private readonly ps: PaperService,
    private readonly hitSegmentInfo?: Readonly<{ segmentIndex: number }>,
    private readonly hitCurveInfo?: Readonly<{ curveIndex?: number; time: number }>,
  ) {
    super();
    this.focusedPathId = this.ps.getFocusedPathInfo().layerId;
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    const fpi = this.ps.getFocusedPathInfo();
    const beforeSelectedSegmentIndices = fpi.selectedSegments;
    const afterSelectedSegmentIndices = new Set(beforeSelectedSegmentIndices);
    const focusedPath = this.pl.findItemByLayerId(this.focusedPathId) as paper.Path;

    if (this.hitSegmentInfo) {
      const isEndPointFn = (idx: number) => idx === 0 || idx === focusedPath.segments.length - 1;
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
      const newSegment = focusedPath.curves[curveIndex].divideAtTime(time).segment1;
      PaperUtil.replacePathInStore(this.ps, this.focusedPathId, focusedPath.pathData);
      afterSelectedSegmentIndices.clear();
      afterSelectedSegmentIndices.add(newSegment.index);
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
    const delta = localPoint.subtract(this.localLastPoint);
    const localSnapPoint = event.modifiers.shift
      ? new paper.Point(MathUtil.snapVectorToAngle(localPoint.subtract(localDownPoint), 90))
      : undefined;

    if (this.hitSegmentInfo || this.hitCurveInfo) {
      // A segment was created on mouse down and is still being grabbed,
      // so continue to drag the currently selected segments.
      const selectedSegmentIndices = new Set(this.mouseDownSelectedSegmentIndexMap.keys());
      const nonSelectedSegmentIndices = focusedPath.segments
        .map((s, segmentIndex) => segmentIndex)
        .filter((s, segmentIndex) => !selectedSegmentIndices.has(segmentIndex));
      this.mouseDownSelectedSegmentIndexMap.forEach((initialSegmentPoint, segmentIndex) => {
        const segment = focusedPath.segments[segmentIndex];
        segment.point = event.modifiers.shift
          ? initialSegmentPoint.add(localSnapPoint)
          : segment.point.add(localPoint.subtract(this.localLastPoint));
      });
      const dragSnapPoints = Array.from(selectedSegmentIndices).map(i =>
        focusedPath.localToGlobal(focusedPath.segments[i].point),
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
      // TODO: also snap segment handles below
      // TODO: should we compute the snap before or after modifying the segments?
      // TODO: only snap the primary dragged segment (even when there are multiple drag segments)?
      this.ps.setSnapGuideInfo({
        guides: SnapUtil.buildSnapGuides(
          SnapUtil.getSnapInfo(dragSnapPoints, siblingSnapPointsTable),
        ).map(({ from, to }: Line) => {
          from = this.pl.globalToLocal(new paper.Point(from));
          to = this.pl.globalToLocal(new paper.Point(to));
          return { from, to };
        }),
        rulers: [],
      });
    } else {
      // Then we have just added a segment to the path in onMouseDown()
      // and should thus move the segment's handles onMouseDrag().
      // Note that there will only ever be one selected segment in this case.
      const selectedSegmentIndex = this.mouseDownSelectedSegmentIndexMap.keys().next().value;
      const selectedSegment = focusedPath.segments[selectedSegmentIndex];
      if (event.modifiers.shift) {
        const initialSelectedSegmentPosition = this.mouseDownSelectedSegmentIndexMap.get(
          selectedSegmentIndex,
        );
        selectedSegment.handleIn = initialSelectedSegmentPosition.subtract(localSnapPoint);
        selectedSegment.handleOut = initialSelectedSegmentPosition.add(localSnapPoint);
      } else {
        // TODO: need to find a way to retain handle information reliably!
        // TODO: i.e. converting a 1 segment path to an SVG string will erase the handle info!
        selectedSegment.handleIn = selectedSegment.handleIn.subtract(delta);
        selectedSegment.handleOut = selectedSegment.handleOut.add(delta);
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
      this.ps.setFocusedPathInfo(undefined);
      this.ps.setSelectedLayers(new Set([this.focusedPathId]));
    }
  }
}
