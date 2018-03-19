import { Gesture } from 'app/scripts/paper/gesture';
import { PaperLayer } from 'app/scripts/paper/item';
import { PaperUtil } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import * as paper from 'paper';

/**
 * A gesture that allows the user to modify a curve by dragging it.
 *
 * Based on the math here: https://pomax.github.io/bezierinfo/#moulding
 *
 * Preconditions:
 * - The user is in focused path mode.
 * - The user hit one of the focused path's curves.
 */
export class DragCurveGesture extends Gesture {
  private readonly pl = paper.project.activeLayer as PaperLayer;

  private B: paper.Point;
  private C: paper.Point;
  private E1: paper.Point;
  private E2: paper.Point;
  private segment1: paper.Point;
  private segment2: paper.Point;

  // TODO: update HoverSegmentsCurvesGesture to *not* display a split path dot when command is held down
  // TODO: handle cases where t === 0 and t === 1
  // TODO: the math is a little off somewhere... dragged mouse should always be on top of curve
  constructor(
    private readonly ps: PaperService,
    private readonly focusedPathId: string,
    private readonly hitCurveInfo: Readonly<{ curveIndex: number; time: number }>,
  ) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    const { curveIndex, time } = this.hitCurveInfo;
    const focusedPath = this.pl.findItemByLayerId(this.focusedPathId).clone() as paper.Path;
    const curve = focusedPath.curves[curveIndex];

    const start = curve.segment1.point.clone();
    const end = curve.segment2.point.clone();
    this.segment1 = start;
    this.segment2 = end;
    const cp1 = start.add(curve.handle1);
    const cp2 = end.add(curve.handle2);

    this.C = getC(start, end, time);
    this.B = curve.getPointAtTime(time);
    const A = getA(this.B, this.C, time);

    const startCp1Split = start.add(cp1.subtract(start).multiply(time));
    const cp2EndSplit = cp2.add(end.subtract(cp2).multiply(time));
    this.E1 = startCp1Split.add(A.subtract(startCp1Split).multiply(time));
    this.E2 = A.add(cp2EndSplit.subtract(A).multiply(time));
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    const focusedPath = this.pl.findItemByLayerId(this.focusedPathId).clone() as paper.Path;
    const localDownPoint = focusedPath.globalToLocal(event.downPoint);
    const localDragPoint = focusedPath.globalToLocal(event.point);
    const localDelta = localDragPoint.subtract(localDownPoint);
    const { curveIndex, time } = this.hitCurveInfo;
    const start = this.segment1;
    const end = this.segment2;
    const B$ = this.B.subtract(localDelta);
    const A$ = getA(B$, this.C, time);
    const v1 = A$.subtract(A$.subtract(this.E1).divide(1 - time));
    const v2 = A$.add(this.E2.subtract(A$).divide(time));
    const cp1$ = start.add(v1.subtract(start).divide(time));
    const cp2$ = end.subtract(end.subtract(v2).divide(1 - time));
    const curve = focusedPath.curves[curveIndex];
    curve.handle1 = cp1$.subtract(start);
    curve.handle2 = cp2$.subtract(end);
    PaperUtil.replacePathInStore(this.ps, this.focusedPathId, focusedPath.pathData);
  }

  // @Override
  onKeyDown(event: paper.KeyEvent) {
    // TODO: react to escape key presses?
  }
}

// TODO: give these better names...

function u(t: number) {
  const v = 1 - t;
  return v ** 3 / (t ** 3 + v ** 3);
}

function getC(start: paper.Point, end: paper.Point, t: number) {
  const ut = u(t);
  return start.multiply(ut).add(end.multiply(1 - ut));
}

function getA(B: paper.Point, C: paper.Point, t: number) {
  return B.subtract(C.subtract(B).divide(ratio(t)));
}

// TODO: confirm this can never be 0? what about division by 0 above?
function ratio(t: number) {
  const v = 1 - t;
  return Math.abs((t ** 3 + v ** 3 - 1) / (t ** 3 + v ** 3));
}
