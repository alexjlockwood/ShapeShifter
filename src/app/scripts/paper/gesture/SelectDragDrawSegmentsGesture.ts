import { LayerUtil, PathLayer, VectorLayer } from 'app/model/layers';
import { Path } from 'app/model/paths';
import { MathUtil } from 'app/scripts/common';
import { PaperLayer } from 'app/scripts/paper/item';
import { Cursor, Cursors } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
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
  static hitSegment(ps: PaperService, segmentIndex: number) {
    return new SelectDragDrawSegmentsGesture(ps, segmentIndex);
  }

  static hitCurve(ps: PaperService, curveIndex: number, curveTime: number) {
    return new SelectDragDrawSegmentsGesture(ps, undefined, curveIndex, curveTime);
  }

  static hitNothing(ps: PaperService) {
    return new SelectDragDrawSegmentsGesture(ps);
  }

  private readonly paperLayer = paper.project.activeLayer as PaperLayer;
  private selectedSegmentIndices: ReadonlyArray<number>;
  private initialVectorLayer: VectorLayer;
  private updateHandlePositionsOnDrag: boolean;
  private lastPoint: paper.Point;

  // Maps segment indices to their initial mouse down position points.
  private selectedSegmentMap: ReadonlyMap<number, paper.Point>;

  private constructor(
    private readonly ps: PaperService,
    private readonly segmentIndex?: number,
    private readonly curveIndex?: number,
    private readonly curveTime?: number,
  ) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    // TODO: what about when alt/shift is pressed
    const focusedEditPath = this.ps.getFocusedEditPath();
    const prevSelectedSegments = focusedEditPath.selectedSegments;
    const newSelectedSegments = new Set(focusedEditPath.selectedSegments);

    // Save a copy of the initial vector layer and handle position so that
    // we can make changes to them as we drag.
    this.initialVectorLayer = this.ps.getVectorLayer();

    const editPath = this.paperLayer
      .findItemByLayerId(focusedEditPath.layerId)
      .clone() as paper.Path;
    let isEditPathModified = false;
    // this.initialHandlePosition = editPath.segments[this.segmentIndex][this.hitHandleType].clone();

    const singleSelectedSegmentIndex =
      prevSelectedSegments.size === 1 ? Array.from(prevSelectedSegments)[0] : undefined;
    if (this.segmentIndex !== undefined) {
      const hasSingleSelectedEndPointSegment =
        !editPath.closed &&
        prevSelectedSegments.size === 1 &&
        (singleSelectedSegmentIndex === 0 ||
          singleSelectedSegmentIndex === editPath.segments.length - 1);
      if (hasSingleSelectedEndPointSegment && this.segmentIndex !== singleSelectedSegmentIndex) {
        // If the path is open, one of the end points is selected, and the
        // user is hovering over the other end point, then close the path.
        editPath.closed = true;
        newSelectedSegments.delete(prevSelectedSegments[0]);
        newSelectedSegments.add(this.segmentIndex);
        isEditPathModified = true;
      } else if (event.modifiers.shift || event.modifiers.command) {
        // If shift or command is pressed, toggle the segment's selection state.
        if (prevSelectedSegments.has(this.segmentIndex)) {
          newSelectedSegments.delete(this.segmentIndex);
        } else {
          newSelectedSegments.add(this.segmentIndex);
        }
      } else {
        // If shift isn't pressed, select the hit segment and deselect all others.
        newSelectedSegments.clear();
        newSelectedSegments.add(this.segmentIndex);
      }
      this.updateHandlePositionsOnDrag = false;
    } else if (this.curveIndex !== undefined && this.curveTime !== undefined) {
      // If there is no hit segment, then create one along the curve
      // at the given location and select the new segment.
      // TODO: select the curve instead?
      // TODO: deselect any currently selected handles as well?
      const newSegment = editPath.curves[this.curveIndex].divideAtTime(this.curveTime).segment1;
      newSelectedSegments.clear();
      newSelectedSegments.add(newSegment.index);
      this.updateHandlePositionsOnDrag = false;
      isEditPathModified = true;
    } else {
      // Otherwise, we are either (1) extending an existing open path (beginning
      // at one of its selected end points), or (2) beginning to create a new path
      // from scratch.
      let addedSegment: paper.Segment;
      const point = editPath.globalToLocal(event.point);
      if (editPath.segments.length === 0) {
        addedSegment = editPath.add(point);
      } else {
        const selectedSegment = editPath.segments[singleSelectedSegmentIndex];
        addedSegment = selectedSegment.isLast() ? editPath.add(point) : editPath.insert(0, point);
        newSelectedSegments.delete(singleSelectedSegmentIndex);
      }
      newSelectedSegments.add(addedSegment.index);

      this.updateHandlePositionsOnDrag = true;
      isEditPathModified = true;
    }

    if (isEditPathModified) {
      let newVl = this.ps.getVectorLayer().clone();
      const pl = newVl.findLayerById(focusedEditPath.layerId).clone() as PathLayer;
      pl.pathData = new Path(editPath.pathData);
      newVl = LayerUtil.replaceLayer(newVl, pl.id, pl);
      this.ps.setVectorLayer(newVl);
    }

    this.selectedSegmentMap = new Map(
      Array.from(newSelectedSegments).map(segmentIndex => {
        return [segmentIndex, editPath.segments[segmentIndex].point.clone()] as [
          number,
          paper.Point
        ];
      }),
    );

    this.ps.setFocusedEditPath({
      ...focusedEditPath,
      selectedSegments: newSelectedSegments,
      visibleHandleIns: newSelectedSegments,
      visibleHandleOuts: newSelectedSegments,
    });
    // this.selectedSegments = newSelectedS
    // this.initialSegmentPositions = this.selectedSegments.map(s => s.point.clone());
    // Guides.hidePenPathPreviewPath();
    Cursors.set(Cursor.PointSelect);

    this.lastPoint = editPath.globalToLocal(event.downPoint);
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    // Guides.hideAddSegmentToCurveHoverGroup();
    const focusedEditPath = this.ps.getFocusedEditPath();
    const editPath = this.paperLayer
      .findItemByLayerId(focusedEditPath.layerId)
      .clone() as paper.Path;
    const dragVector = editPath
      .globalToLocal(event.point)
      .subtract(editPath.globalToLocal(event.downPoint));
    const snapPoint = event.modifiers.shift
      ? new paper.Point(MathUtil.snapVectorToAngle(dragVector, 15))
      : undefined;
    if (this.updateHandlePositionsOnDrag) {
      // Then we have just added a segment to the path in onMouseDown()
      // and should thus move the segment's handles onMouseDrag().
      // Note that there will only ever be one selected segment in this case.
      const segmentIndex = this.selectedSegmentMap.keys().next().value;
      const segmentPosition = this.selectedSegmentMap.get(segmentIndex);
      const selectedSegment = editPath.segments[segmentIndex];
      if (event.modifiers.shift) {
        selectedSegment.handleIn = segmentPosition.subtract(snapPoint);
        selectedSegment.handleOut = segmentPosition.add(snapPoint);
      } else {
        // TODO: need to retain this handle info... saving the pathData to the store isnt enough.
        const delta = editPath.globalToLocal(event.point).subtract(this.lastPoint);
        selectedSegment.handleIn = selectedSegment.handleIn.subtract(delta);
        selectedSegment.handleOut = selectedSegment.handleOut.add(delta);
      }
    } else {
      // Then we selected an existing segment in onMouseDown() and should
      // move the segment according to the new mouse position.
      this.selectedSegmentMap.forEach((segmentPosition, segmentIndex) => {
        const segment = editPath.segments[segmentIndex];
        if (event.modifiers.shift) {
          segment.point = segmentPosition.add(snapPoint);
        } else {
          const delta = editPath.globalToLocal(event.point).subtract(this.lastPoint);
          segment.point = segment.point.add(delta);
        }
      });
    }
    this.lastPoint = editPath.globalToLocal(event.point);

    let newVl = this.ps.getVectorLayer().clone();
    const pl = newVl.findLayerById(focusedEditPath.layerId).clone() as PathLayer;
    pl.pathData = new Path(editPath.pathData);
    newVl = LayerUtil.replaceLayer(newVl, pl.id, pl);
    this.ps.setVectorLayer(newVl);
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    Cursors.clear();
  }
}
