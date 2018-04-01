import { CursorType, ToolMode } from 'app/model/paper';
import { Gesture } from 'app/scripts/paper/gesture';
import { HitTests, PaperLayer } from 'app/scripts/paper/item';
import { PaperService } from 'app/services';
import * as paper from 'paper';

/**
 * A gesture that performs hover operations over segments and curves.
 *
 * Preconditions:
 * - The user is in edit path mode for an already existing layer id.
 */
export class HoverSegmentsCurvesGesture extends Gesture {
  private readonly pl = paper.project.activeLayer as PaperLayer;

  constructor(private readonly ps: PaperService) {
    super();
  }

  // @Override
  onMouseMove(event: paper.ToolEvent) {
    this.ps.setCursorType(CursorType.Default);
    this.ps.setSplitCurveInfo(undefined);

    // TODO: this seems kinda hacky
    // TODO: currently necessary (if the previous gesture was the create/drag/draw segments gesture)
    this.ps.setCreatePathInfo(undefined);

    const editPathId = this.ps.getEditPathInfo().layerId;
    const editPath = this.pl.findItemByLayerId(editPathId) as paper.Path;
    const segmentsAndHandlesHitResult = HitTests.editPathModeSegmentsAndHandles(event.point);
    if (segmentsAndHandlesHitResult) {
      // If we are hovering over a segment or a handle, then show a point select
      // cursor and return.
      this.ps.setCursorType(CursorType.PointSelect);
      return;
    }

    const editPathHitResult = HitTests.editPathMode(event.point, editPath, {
      curves: true,
    });
    if (editPathHitResult) {
      if (editPathHitResult.type !== 'curve') {
        // If we hit the edit path but missed its segments/handles/curves,
        // then do nothing.
        return;
      }
      // Show a pen add cursor and highlight the curve the user is about to split.
      this.ps.setCursorType(CursorType.PenAdd);
      const hitCurve = editPathHitResult.location.curve;
      const location = event.modifiers.shift
        ? hitCurve.getLocationAt(hitCurve.length / 2)
        : editPathHitResult.location;
      const vpSplitPoint = this.localToVpPoint(editPath, location.point);
      const { point: p1, handleIn: in1, handleOut: out1 } = this.localToVpSegment(
        editPath,
        location.curve.segment1,
      );
      const { point: p2, handleIn: in2, handleOut: out2 } = this.localToVpSegment(
        editPath,
        location.curve.segment2,
      );
      this.ps.setSplitCurveInfo({
        splitPoint: vpSplitPoint,
        segment1: { point: p1, handleIn: in1, handleOut: out1 },
        segment2: { point: p2, handleIn: in2, handleOut: out2 },
      });
      return;
    }

    // Draw an 'extend path' preview curve if one of its end points
    // is selected and the path is still open.
    const singleSelectedSegmentIndex = this.findSingleSelectedEndSegmentIndex(editPath);
    if (singleSelectedSegmentIndex !== undefined) {
      this.ps.setCursorType(CursorType.PenAdd);
      const vpStartSegment = this.localToVpSegment(
        editPath,
        editPath.segments[singleSelectedSegmentIndex],
      );
      const vpEndSegment = new paper.Segment(this.pl.globalToLocal(event.point));
      const { pathData } = new paper.Path([vpStartSegment, vpEndSegment]);
      this.ps.setCreatePathInfo({
        pathData,
        strokeColor: '#979797',
      });
    }
  }

  /** Converts local coordinates to viewport coordinates for a point. */
  private localToVpPoint(localItem: paper.Item, localPoint: paper.Point) {
    return localPoint ? this.pl.globalToLocal(localItem.localToGlobal(localPoint)) : undefined;
  }

  /** Converts local coordinates to viewport coordinates for a segment. */
  private localToVpSegment(localItem: paper.Item, localSegment: paper.Segment) {
    return new paper.Segment(
      this.localToVpPoint(localItem, localSegment.point),
      this.localToVpHandle(localItem, localSegment.point, localSegment.handleIn),
      this.localToVpHandle(localItem, localSegment.point, localSegment.handleOut),
    );
  }

  /** Converts local coordinates to viewport coordinates for a segment handle. */
  private localToVpHandle(
    localItem: paper.Item,
    localPoint: paper.Point,
    localHandle: paper.Point,
  ) {
    const vpPoint = this.localToVpPoint(localItem, localPoint);
    const vpHandle = this.localToVpPoint(localItem, localPoint.add(localHandle));
    return vpHandle.subtract(vpPoint);
  }

  /**
   * Returns the single selected end point segment index for the given path,
   * or undefined if one doesn't exist.
   */
  private findSingleSelectedEndSegmentIndex(path: paper.Path) {
    if (path.closed) {
      // Return undefined if the path is closed.
      return undefined;
    }
    const { selectedSegments } = this.ps.getEditPathInfo();
    if (selectedSegments.size !== 1) {
      // Return undefined if there is not a single selected segment.
      return undefined;
    }
    const lastIndex = path.segments.length - 1;
    return selectedSegments.has(0) ? 0 : selectedSegments.has(lastIndex) ? lastIndex : undefined;
  }

  // @Override
  onKeyDown(event: paper.KeyEvent) {
    // TODO: also do this in any other pen/pencil related gestures?
    if (event.key === 'escape') {
      this.ps.setCursorType(CursorType.Default);
      this.ps.setSnapGuideInfo(undefined);
      this.ps.setEditPathInfo(undefined);
    }
  }
}
