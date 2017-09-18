import { LayerUtil, PathLayer, VectorLayer } from 'app/model/layers';
import { Path } from 'app/model/paths';
import { MathUtil } from 'app/scripts/common';
import { PaperLayer } from 'app/scripts/paper/item';
import { Cursor, CursorUtil, PaperUtil } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import * as _ from 'lodash';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that performs selection and drag operations
 * on one or more path segments. It also supports adding
 * a segment to an existing path's curve, as well as extending
 * an open path by appending segments to its end points.
 *
 * Preconditions:
 * - The user is in focused path mode (i.e. there is a valid focused
 *   path that the user is operating on).
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
  static hitCurve(ps: PaperService, curveIndex: number, curveTime: number) {
    return new SelectDragDrawSegmentsGesture(ps, undefined, { curveIndex, time: curveTime });
  }

  /** Static factory method to use when the user misses the focused path. */
  static miss(ps: PaperService) {
    return new SelectDragDrawSegmentsGesture(ps);
  }

  private readonly paperLayer = paper.project.activeLayer as PaperLayer;
  private readonly focusedPathItemId: string;
  private readonly initialSelectedSegments: ReadonlySet<number>;
  private lastPoint: paper.Point;

  // Maps segment indices to each segment's starting position.
  private selectedSegmentMap: ReadonlyMap<number, paper.Point>;

  private constructor(
    private readonly ps: PaperService,
    private readonly segmentInfo?: Readonly<{ segmentIndex: number }>,
    private readonly curveInfo?: Readonly<{ curveIndex?: number; time: number }>,
  ) {
    super();
    const focusedPathInfo = this.ps.getFocusedPathInfo();
    this.focusedPathItemId = focusedPathInfo.layerId;
    this.initialSelectedSegments = focusedPathInfo.selectedSegments;
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    const focusedPathInfo = this.ps.getFocusedPathInfo();
    const initialSelected = focusedPathInfo.selectedSegments;
    let updatedSelected = new Set(initialSelected);

    const focusedPath = this.paperLayer
      .findItemByLayerId(focusedPathInfo.layerId)
      .clone() as paper.Path;

    const singleSelectedSegmentIndex =
      initialSelected.size === 1 ? initialSelected.values().next().value : undefined;
    if (this.segmentInfo) {
      const { segmentIndex } = this.segmentInfo;
      const hasSingleSelectedEndPoint =
        !focusedPath.closed &&
        initialSelected.size === 1 &&
        (singleSelectedSegmentIndex === 0 ||
          singleSelectedSegmentIndex === focusedPath.segments.length - 1);
      if (hasSingleSelectedEndPoint && segmentIndex !== singleSelectedSegmentIndex) {
        // If the path is open, one of the end points is selected, and the
        // user is hovering over the other end point, then close the path.
        focusedPath.closed = true;
        PaperUtil.replacePathInStore(this.ps, focusedPathInfo.layerId, focusedPath.pathData);
      }
      if (event.modifiers.shift || event.modifiers.command) {
        // If shift or command is pressed, toggle the segment's selection state.
        if (initialSelected.has(segmentIndex)) {
          updatedSelected.delete(segmentIndex);
        } else {
          updatedSelected.add(segmentIndex);
        }
      } else {
        // Otherwise, select the hit segment and deselect all others.
        updatedSelected = new Set([segmentIndex]);
      }
    } else if (this.curveInfo) {
      // If there is no hit segment, then create one along the curve
      // at the given location and select the new segment.
      // TODO: select the curve instead?
      // TODO: deselect any currently selected handles as well?
      const { curveIndex, time } = this.curveInfo;
      const newSegment = focusedPath.curves[curveIndex].divideAtTime(time).segment1;
      PaperUtil.replacePathInStore(this.ps, focusedPathInfo.layerId, focusedPath.pathData);
      updatedSelected = new Set([newSegment.index]);
    } else {
      // Otherwise, we are either (1) extending an existing open path (beginning
      // at one of its selected end points), or (2) beginning to create a new path
      // from scratch.
      let addedSegment: paper.Segment;
      const point = focusedPath.globalToLocal(event.point);
      if (focusedPath.segments.length === 0) {
        addedSegment = focusedPath.add(point);
      } else {
        const selectedSegment = focusedPath.segments[singleSelectedSegmentIndex];
        addedSegment = selectedSegment.isLast()
          ? focusedPath.add(point)
          : focusedPath.insert(0, point);
        updatedSelected.delete(singleSelectedSegmentIndex);
      }
      updatedSelected.add(addedSegment.index);
      PaperUtil.replacePathInStore(this.ps, focusedPathInfo.layerId, focusedPath.pathData);
    }

    this.selectedSegmentMap = new Map(
      Array.from(updatedSelected).map(segmentIndex => {
        return [segmentIndex, focusedPath.segments[segmentIndex].point.clone()] as [
          number,
          paper.Point
        ];
      }),
    );

    this.ps.setFocusedPathInfo({
      ...focusedPathInfo,
      ...PaperUtil.selectCurves(this.ps, focusedPath, updatedSelected),
    });
    CursorUtil.set(Cursor.PointSelect);
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    const focusedPath = this.paperLayer
      .findItemByLayerId(this.focusedPathItemId)
      .clone() as paper.Path;
    const downPoint = focusedPath.globalToLocal(event.downPoint);
    this.lastPoint = this.lastPoint ? this.lastPoint : downPoint;
    const currentPoint = focusedPath.globalToLocal(event.point);
    const delta = currentPoint.subtract(this.lastPoint);
    const dragVector = currentPoint.subtract(focusedPath.globalToLocal(event.downPoint));
    const snapPoint = event.modifiers.shift
      ? new paper.Point(MathUtil.snapVectorToAngle(dragVector, 90))
      : undefined;
    if (this.segmentInfo || this.curveInfo) {
      // Then drag the one or more currently selected segments.
      this.selectedSegmentMap.forEach((initialSegmentPoint, segmentIndex) => {
        const segment = focusedPath.segments[segmentIndex];
        segment.point = event.modifiers.shift
          ? initialSegmentPoint.add(snapPoint)
          : segment.point.add(delta);
      });
    } else {
      // Then we have just added a segment to the path in onMouseDown()
      // and should thus move the segment's handles onMouseDrag().
      // Note that there will only ever be one selected segment in this case.
      const segmentIndex = this.selectedSegmentMap.keys().next().value;
      const segmentPosition = this.selectedSegmentMap.get(segmentIndex);
      const selectedSegment = focusedPath.segments[segmentIndex];
      if (event.modifiers.shift) {
        selectedSegment.handleIn = segmentPosition.subtract(snapPoint);
        selectedSegment.handleOut = segmentPosition.add(snapPoint);
      } else {
        // TODO: need to retain this handle info... saving the pathData to the store isnt enough.
        // TODO: need to retain this handle info... saving the pathData to the store isnt enough.
        // TODO: need to retain this handle info... saving the pathData to the store isnt enough.
        // TODO: need to retain this handle info... saving the pathData to the store isnt enough.
        // TODO: need to retain this handle info... saving the pathData to the store isnt enough.
        selectedSegment.handleIn = selectedSegment.handleIn.subtract(delta);
        selectedSegment.handleOut = selectedSegment.handleOut.add(delta);
      }
    }
    this.lastPoint = currentPoint;

    PaperUtil.replacePathInStore(this.ps, this.focusedPathItemId, focusedPath.pathData);
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    CursorUtil.clear();
  }
}
