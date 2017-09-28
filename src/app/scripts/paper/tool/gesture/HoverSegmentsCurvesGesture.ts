import { HitTests, PaperLayer } from 'app/scripts/paper/item';
import { Cursor, CursorUtil } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that performs hover operations over segments and curves.
 *
 * Preconditions:
 * - The user is in focused path mode.
 */
export class HoverSegmentsCurvesGesture extends Gesture {
  private readonly pl = paper.project.activeLayer as PaperLayer;

  constructor(private readonly ps: PaperService, private readonly focusedPathId: string) {
    super();
  }

  // @Override
  onMouseMove(event: paper.ToolEvent) {
    CursorUtil.clear();
    this.ps.setSplitCurveInfo(undefined);
    this.ps.setCreatePathInfo(undefined);

    const focusedPath = this.pl.findItemByLayerId(this.focusedPathId) as paper.Path;
    const segmentsAndHandlesHitResult = HitTests.focusedPathModeSegmentsAndHandles(event.point);
    if (segmentsAndHandlesHitResult) {
      // If we are hovering over a segment or a handle, then show a point select
      // cursor and return.
      CursorUtil.set(Cursor.PointSelect);
      return;
    }

    const focusedPathHitResult = HitTests.focusedPathModeCurves(event.point, focusedPath);
    if (focusedPathHitResult) {
      // Show a pen add cursor and highlight the curve the user is about to split.
      CursorUtil.set(Cursor.PenAdd);
      const hitCurve = focusedPathHitResult.location.curve;
      const location = event.modifiers.command
        ? hitCurve.getLocationAt(hitCurve.length * 0.5)
        : focusedPathHitResult.location;
      const vpSplitPoint = this.localToViewportPoint(focusedPath, location.point);
      const { point: p1, handleIn: in1, handleOut: out1 } = this.localToViewportSegment(
        focusedPath,
        location.curve.segment1,
      );
      const { point: p2, handleIn: in2, handleOut: out2 } = this.localToViewportSegment(
        focusedPath,
        location.curve.segment2,
      );
      this.ps.setSplitCurveInfo({
        splitPoint: vpSplitPoint,
        segment1: { point: p1, handleIn: in1, handleOut: out1 },
        segment2: { point: p2, handleIn: in2, handleOut: out2 },
      });
      return;
    }

    // TODO: are we performing too many hit tests in this method?
    // TODO: can we merge this hit test with the one above once we get hitOptions.curves working?
    if (HitTests.focusedPathMode(event.point, focusedPath)) {
      // If we hit the focused path (and missed its segments/handles/curves), then do nothing.
      return;
    }

    // Draw an 'extend path' preview curve if one of its end points
    // is selected and the path is still open.
    const singleSelectedSegmentIndex = this.findSingleSelectedEndSegmentIndex(focusedPath);
    if (singleSelectedSegmentIndex !== undefined) {
      CursorUtil.set(Cursor.PenAdd);
      const vpStartSegment = this.localToViewportSegment(
        focusedPath,
        focusedPath.segments[singleSelectedSegmentIndex],
      );
      const vpEndSegment = new paper.Segment(this.pl.globalToLocal(event.point));
      const { pathData } = new paper.Path([vpStartSegment, vpEndSegment]);
      this.ps.setCreatePathInfo({
        pathData,
        strokeColor: 'black',
      });
    }
  }

  /** Converts local coordinates to viewport coordinates for a point. */
  private localToViewportPoint(localItem: paper.Item, localPoint: paper.Point) {
    return localPoint ? this.pl.globalToLocal(localItem.localToGlobal(localPoint)) : undefined;
  }

  /** Converts local coordinates to viewport coordinates for a segment. */
  private localToViewportSegment(localItem: paper.Item, localSegment: paper.Segment) {
    return new paper.Segment(
      this.localToViewportPoint(localItem, localSegment.point),
      this.localToViewportPoint(localItem, localSegment.handleIn),
      this.localToViewportPoint(localItem, localSegment.handleOut),
    );
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
    const { selectedSegments } = this.ps.getFocusedPathInfo();
    if (selectedSegments.size !== 1) {
      // Return undefined if there is not a single selected segment.
      return undefined;
    }
    const lastIndex = path.segments.length - 1;
    return selectedSegments.has(0) ? 0 : selectedSegments.has(lastIndex) ? lastIndex : undefined;
  }
}
