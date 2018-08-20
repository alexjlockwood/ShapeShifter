import { Gesture } from 'app/modules/editor/scripts/paper/gesture';
import { PaperLayer } from 'app/modules/editor/scripts/paper/item';
import { PaperUtil } from 'app/modules/editor/scripts/paper/util';
import { PaperService } from 'app/modules/editor/services';
import * as paper from 'paper';

/**
 * A gesture that allows the user to mould a curve by dragging a point on its path.
 *
 * Based on math from here: https://pomax.github.io/bezierinfo/#moulding
 *
 * Preconditions:
 * - The user is in edit path mode.
 * - The user hit one of the edit path's curves.
 */
export class MouldCurveGesture extends Gesture {
  private readonly pl = paper.project.activeLayer as PaperLayer;

  private points: CubicPoints;
  private B: paper.Point;
  private C: paper.Point;
  private ratio: number;
  private t: number;

  // TODO: update HoverSegmentsCurvesGesture to *not* display a split path dot when command is held down
  // TODO: handle cases where t === 0 and t === 1?
  constructor(
    private readonly ps: PaperService,
    private readonly editPathId: string,
    private readonly hitCurveInfo: Readonly<{ curveIndex: number; time: number }>,
  ) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    const editPath = this.pl.findItemByLayerId(this.editPathId) as paper.Path;
    const curve = editPath.curves[this.hitCurveInfo.curveIndex];
    const start = curve.segment1.point;
    const end = curve.segment2.point;
    const cp1 = start.add(curve.handle1);
    const cp2 = end.add(curve.handle2);
    const points: CubicPoints = [start, cp1, cp2, end];

    const t = this.hitCurveInfo.time;
    const A = hull(points, t)[5];
    const B = curve.getPointAtTime(t);
    const C = lli(A, B, start, end);
    const bottom = t ** 3 + (1 - t) ** 3;
    const top = bottom - 1;
    const ratio = Math.abs(top / bottom);

    // Cache these for later use.
    this.points = points;
    this.B = B;
    this.C = C;
    this.ratio = ratio;
    this.t = t;
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    const editPath = this.pl.findItemByLayerId(this.editPathId) as paper.Path;
    const localDownPoint = editPath.globalToLocal(event.downPoint);
    const localDragPoint = editPath.globalToLocal(event.point);

    const { points, B, C, ratio, t } = this;
    const newB = B.add(localDragPoint.subtract(localDownPoint));

    // Preserve struts for B when repositioning.
    const hullPoints = hull(this.points, t);
    const Bl = hullPoints[7];
    const Br = hullPoints[8];
    const dbl = Bl.subtract(B);
    const dbr = Br.subtract(B);
    // Now that we know A, B, C and the AB:BC ratio, we can compute the new A' based on the desired B'.
    const newA = newB.subtract(C.subtract(newB).divide(ratio));
    // Find new point on s--c1.
    const p1 = newB.add(dbl);
    const sc1 = newA.subtract(newA.subtract(p1).divide(1 - t));
    // Find new point on c2--e.
    const p2 = newB.add(dbr);
    const sc2 = newA.add(p2.subtract(newA).divide(t));
    // Construct new c1` based on the fact that s--sc1 is s--c1 * t.
    const nc1 = points[0].add(sc1.subtract(points[0]).divide(t));
    // Construct new c2` based on the fact that e--sc2 is e--c2 * (1-t).
    const nc2 = points[3].subtract(points[3].subtract(sc2).divide(1 - t));

    const curve = editPath.curves[this.hitCurveInfo.curveIndex];
    curve.handle1 = nc1.subtract(points[0]);
    curve.handle2 = nc2.subtract(points[3]);
    PaperUtil.replacePathInStore(this.ps, this.editPathId, editPath.pathData);
  }

  // @Override
  onKeyDown(event: paper.KeyEvent) {
    // TODO: react to escape key presses?
  }
}

// TODO: rename this...
function lli(
  { x: x1, y: y1 }: paper.Point,
  { x: x2, y: y2 }: paper.Point,
  { x: x3, y: y3 }: paper.Point,
  { x: x4, y: y4 }: paper.Point,
) {
  const nx = (x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4);
  const ny = (x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4);
  const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (d === 0) {
    return undefined;
  }
  return new paper.Point(nx / d, ny / d);
}

function hull(points: CubicPoints, t: number): CubicHull {
  let p = points as paper.Point[];
  let _p: paper.Point[] = [];
  let pt: paper.Point;
  const q = [...p];
  // We lerp between all points at each iteration, until we have 1 point left.
  while (p.length > 1) {
    _p = [];
    for (let i = 0, l = p.length - 1; i < l; i++) {
      pt = p[i].add(p[i + 1].subtract(p[i]).multiply(t));
      q.push(pt);
      _p.push(pt);
    }
    p = _p;
  }
  return q as CubicHull;
}

type CubicPoints = [paper.Point, paper.Point, paper.Point, paper.Point];
type CubicHull = [
  paper.Point,
  paper.Point,
  paper.Point,
  paper.Point,
  paper.Point,
  paper.Point,
  paper.Point,
  paper.Point,
  paper.Point,
  paper.Point
];
