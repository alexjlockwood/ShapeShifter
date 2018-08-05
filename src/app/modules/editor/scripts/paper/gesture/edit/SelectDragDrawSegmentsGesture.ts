import { CursorType } from 'app/modules/editor/model/paper';
import { MathUtil } from 'app/modules/editor/scripts/common';
import { Gesture } from 'app/modules/editor/scripts/paper/gesture';
import { PaperLayer } from 'app/modules/editor/scripts/paper/item';
import { PaperUtil, SnapUtil } from 'app/modules/editor/scripts/paper/util';
import { PaperService } from 'app/modules/editor/services';
import { Line } from 'app/modules/editor/store/paper/actions';
import * as paper from 'paper';

/**
 * A gesture that performs selection and drag operations on one or more path
 * segments. It also supports adding a segment to an existing path's curve,
 * as well as extending an open path by appending segments to its end points.
 *
 * Preconditions:
 * - The user is in edit path mode.
 * - The user either hit a segment, a curve, or missed entirely
 *   (the 'missed entirely' case occurs when the user is in vector
 *   mode, in which the user can create new segments by clicking
 *   on the canvas).
 */
export class SelectDragDrawSegmentsGesture extends Gesture {
  private readonly pl = paper.project.activeLayer as PaperLayer;

  // Maps segment indices to each segment's location at the beginning of the gesture.
  // The initial locations are expressed in the
  private selectedSegmentIndexToInitialLocationMap: ReadonlyMap<number, paper.Point>;
  // The location of the last mouse event in the edit path's local coordinates.
  private localLastPoint: paper.Point;
  // True if we should exit edit path mode on the next mouse up event.
  private exitEditPathModeOnMouseUp = false;
  // If this gesture was used to split a curve, this tells us the index of the
  // new segment that was created in onMouseDown().
  private newSplitCurveSegmentIndex: number;

  /** Static factory method to use when the user's mouse down hits a segment. */
  static hitSegment(ps: PaperService, editPathId: string, segmentIndex: number) {
    return new SelectDragDrawSegmentsGesture(ps, editPathId, { segmentIndex });
  }

  /** Static factory method to use when the user's mouse down hits a curve. */
  static hitCurve(ps: PaperService, editPathId: string, curveIndex: number, time: number) {
    return new SelectDragDrawSegmentsGesture(ps, editPathId, undefined, { curveIndex, time });
  }

  /** Static factory method to use when the user misses the edit path. */
  static miss(ps: PaperService, editPathId: string) {
    return new SelectDragDrawSegmentsGesture(ps, editPathId);
  }

  private constructor(
    private readonly ps: PaperService,
    private readonly editPathId: string,
    private readonly hitSegmentInfo?: Readonly<{ segmentIndex: number }>,
    private readonly hitCurveInfo?: Readonly<{ curveIndex?: number; time: number }>,
  ) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    const fpi = this.ps.getEditPathInfo();
    const beforeSelectedSegmentIndices = fpi.selectedSegments;
    const afterSelectedSegmentIndices = new Set(beforeSelectedSegmentIndices);
    const editPath = this.pl.findItemByLayerId(this.editPathId) as paper.Path;

    if (this.hitSegmentInfo) {
      const isEndPointFn = (i: number) => i === 0 || i === editPath.segments.length - 1;
      const { segmentIndex } = this.hitSegmentInfo;
      const singleSelectedSegmentIndex = beforeSelectedSegmentIndices.size
        ? beforeSelectedSegmentIndices.values().next().value
        : undefined;
      if (
        !editPath.closed &&
        singleSelectedSegmentIndex !== undefined &&
        isEndPointFn(segmentIndex) &&
        isEndPointFn(singleSelectedSegmentIndex) &&
        segmentIndex !== singleSelectedSegmentIndex
      ) {
        // If the path is open, one of the end points is selected, and the
        // user clicked the other end point segment, then close the path
        // and end the gesture on the next mouse up event.
        editPath.closed = true;
        this.exitEditPathModeOnMouseUp = true;
        PaperUtil.replacePathInStore(this.ps, this.editPathId, editPath.pathData);
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
      const curve = editPath.curves[curveIndex];
      const newSegment = event.modifiers.shift
        ? curve.divideAt(curve.getLocationAt(curve.length / 2))
        : curve.divideAtTime(time).segment1;
      PaperUtil.replacePathInStore(this.ps, this.editPathId, editPath.pathData);
      afterSelectedSegmentIndices.clear();
      afterSelectedSegmentIndices.add(newSegment.index);
      this.newSplitCurveSegmentIndex = newSegment.index;
    } else {
      // Otherwise, we are either (1) extending an existing open path (beginning
      // at one of its selected end points), or (2) beginning to create a new path
      // from scratch.
      const localPoint = editPath.globalToLocal(event.point);
      let addedSegment: paper.Segment;
      if (editPath.segments.length === 0) {
        addedSegment = editPath.add(localPoint);
      } else {
        // Note that there will always be a single selected end point segment in this case
        // (otherwise we would have used a batch select segments gesture instead).
        const singleSelectedSegmentIndex = beforeSelectedSegmentIndices.values().next().value;
        const selectedSegment = editPath.segments[singleSelectedSegmentIndex];
        addedSegment = selectedSegment.isLast()
          ? editPath.add(localPoint)
          : editPath.insert(0, localPoint);
        afterSelectedSegmentIndices.delete(singleSelectedSegmentIndex);
      }
      afterSelectedSegmentIndices.add(addedSegment.index);
      PaperUtil.replacePathInStore(this.ps, this.editPathId, editPath.pathData);
    }

    this.selectedSegmentIndexToInitialLocationMap = new Map(
      Array.from(afterSelectedSegmentIndices).map(segmentIndex => {
        const point = editPath.segments[segmentIndex].point.clone();
        return [segmentIndex, point] as [number, paper.Point];
      }),
    );

    this.ps.setEditPathInfo({
      ...fpi,
      ...PaperUtil.selectCurves(editPath, afterSelectedSegmentIndices),
    });
    this.ps.setCursorType(CursorType.PointSelect);
    this.ps.setCreatePathInfo(undefined);
    this.ps.setSplitCurveInfo(undefined);
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    const editPath = this.pl.findItemByLayerId(this.editPathId) as paper.Path;

    const localDownPoint = editPath.globalToLocal(event.downPoint);
    if (!this.localLastPoint) {
      this.localLastPoint = localDownPoint;
    }
    const localPoint = editPath.globalToLocal(event.point);
    const localDownPointDelta = localPoint.subtract(localDownPoint);
    const localLastPointDelta = localPoint.subtract(this.localLastPoint);
    const localSnappedDownPointDelta = new paper.Point(
      MathUtil.snapVectorToAngle(localDownPointDelta, 90),
    );

    if (this.hitSegmentInfo || this.hitCurveInfo) {
      // A segment was created on mouse down and is still being grabbed,
      // so continue to drag the currently selected segments.
      const selectedSegmentIndices = new Set(this.selectedSegmentIndexToInitialLocationMap.keys());
      const nonSelectedSegmentIndices = editPath.segments
        .map((s, i) => i)
        .filter((s, i) => !selectedSegmentIndices.has(i));
      this.selectedSegmentIndexToInitialLocationMap.forEach((initialSegmentPoint, i) => {
        const segment = editPath.segments[i];
        segment.point = event.modifiers.shift
          ? initialSegmentPoint.add(localSnappedDownPointDelta)
          : segment.point.add(localLastPointDelta);
      });
      const draggedSegmentIndex = this.hitSegmentInfo
        ? this.hitSegmentInfo.segmentIndex
        : this.newSplitCurveSegmentIndex;
      const dragSnapPoint = editPath.localToGlobal(editPath.segments[draggedSegmentIndex].point);
      const { topLeft, center, bottomRight } = Array.from(
        this.selectedSegmentIndexToInitialLocationMap.values(),
      ).reduce((rect: paper.Rectangle, p: paper.Point) => {
        p = editPath.localToGlobal(p);
        return rect ? rect.include(p) : new paper.Rectangle(p, new paper.Size(0, 0));
      }, undefined);
      const siblingSnapPointsTable = [
        [topLeft, center, bottomRight],
        ...nonSelectedSegmentIndices.map(i => {
          return [editPath.localToGlobal(editPath.segments[i].point)];
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
      const selectedSegmentIndex = this.selectedSegmentIndexToInitialLocationMap.keys().next()
        .value;
      const selectedSegment = editPath.segments[selectedSegmentIndex];
      // TODO: dragging a handle belonging to an endpoint doesn't work! handle info is lost!
      // TODO: snap the dragged segment handle with the newly created segment
      if (event.modifiers.shift) {
        const index = selectedSegmentIndex;
        const initialSelectedSegmentPosition = this.selectedSegmentIndexToInitialLocationMap.get(
          index,
        );
        const delta = localSnappedDownPointDelta;
        selectedSegment.handleIn = initialSelectedSegmentPosition.subtract(delta);
        selectedSegment.handleOut = initialSelectedSegmentPosition.add(delta);
      } else {
        selectedSegment.handleIn = selectedSegment.handleIn.subtract(localLastPointDelta);
        selectedSegment.handleOut = selectedSegment.handleOut.add(localLastPointDelta);
      }
    }
    this.localLastPoint = localPoint;

    PaperUtil.replacePathInStore(this.ps, this.editPathId, editPath.pathData);
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    this.ps.setCursorType(CursorType.Default);
    this.ps.setSnapGuideInfo(undefined);
    if (this.exitEditPathModeOnMouseUp) {
      this.ps.setEditPathInfo(undefined);
    }
  }

  // TODO: handle escape key event?
}
