import * as Bezier from 'bezier-js';
import { Point, Matrix, Rect } from './mathutil';
import {
  DrawCommand, MoveCommand, LineCommand, QuadraticCurveCommand,
  BezierCurveCommand, EllipticalArcCommand, ClosePathCommand, SubPathCommand, PathCommand
} from './svgcommands';
import * as SvgUtil from './svgutil';
import * as PathParser from './pathparser';


export class SvgPathData implements PathCommand {
  private pathString_: string = '';
  private subPathCommands_: SubPathCommand[] = [];
  private length_ = 0;
  private bounds_: Rect = null;
  private bezierWrappersMap_: BezierWrapper[][];

  constructor();
  constructor(obj: string);
  constructor(obj: SvgPathData);
  constructor(obj?: any) {
    if (obj) {
      if (typeof obj === 'string') {
        this.pathString = obj;
      } else if (obj instanceof SvgPathData) {
        this.pathString = obj.pathString;
      }
    }
  }

  set pathString(path: string) {
    this.pathString_ = path;
    this.subPathCommands_ = PathParser.parseCommands(path);
    this.updatePathCommand(false);
  }

  set subPathCommands(subPathCommands: SubPathCommand[]) {
    this.subPathCommands_ = subPathCommands;
    this.updatePathCommand(true);
  }

  private updatePathCommand(shouldUpdatePathString: boolean) {
    if (shouldUpdatePathString) {
      this.pathString_ = PathParser.commandsToString(this.subPathCommands_);
    }
    const {length, bounds, bezierWrappersMap} = computeCommandProperties(this.subPathCommands_);
    this.length_ = length;
    this.bounds_ = bounds;
    this.bezierWrappersMap_ = bezierWrappersMap;
  }

  interpolate(start: SvgPathData, end: SvgPathData, fraction: number) {
    if (!this.isMorphableWith(start, end)) {
      return;
    }
    this.subPathCommands_.forEach((c, i) =>
      c.interpolate(start.subPathCommands_[i], end.subPathCommands_[i], fraction));
    this.subPathCommands = this.subPathCommands_;
  }

  // TODO(alockwood): only recalculate bounds and length when necessary
  transform(transforms: Matrix[]) {
    this.subPathCommands_.forEach(c => c.transform(transforms));
    this.subPathCommands = this.subPathCommands_;
  }

  reverse() {
    this.subPathCommands_.forEach(c => c.reverse());
    this.subPathCommands = this.subPathCommands_;
  }

  shiftBack() {
    this.subPathCommands_.forEach(c => c.shiftBack());
    this.subPathCommands = this.subPathCommands_;
  }

  shiftForward() {
    this.subPathCommands_.forEach(c => c.shiftForward());
    this.subPathCommands = this.subPathCommands_;
  }

  get subPathCommands() {
    return this.subPathCommands_;
  }

  // TODO(alockwood): get rid of this method...
  get commands() {
    const drawCommands = [];
    this.subPathCommands_.forEach(c => drawCommands.push(...c.commands));
    return drawCommands;
  }

  get pathString() {
    return this.pathString_;
  }

  get length() {
    return this.length_;
  }

  toString() {
    return this.pathString;
  }

  /** Draw the path using the specified canvas context. */
  execute(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    this.subPathCommands_.forEach(c => c.execute(ctx));
  }

  isMorphableWith(start: SvgPathData, end: SvgPathData) {
    if (start.subPathCommands.length !== this.subPathCommands.length
      || this.subPathCommands.length !== end.subPathCommands.length) {
      return false;
    }
    return this.subPathCommands.every((c, i) => {
      return c.isMorphableWith(start.subPathCommands[i], end.subPathCommands[i]);
    });
  }

  project(point: Point): ProjectionInfo | null {
    const bezierWrappers: { subPathCommandIndex: number, commandIndex: number, bw: BezierWrapper }[] = [];
    this.bezierWrappersMap_.forEach((bws, subPathCommandIndex) => {
      bws.forEach((bw, commandIndex) => {
        bezierWrappers.push({ subPathCommandIndex, commandIndex, bw });
      });
    });
    return bezierWrappers.map(({subPathCommandIndex, commandIndex, bw}) => {
      return { subPathCommandIndex, commandIndex, projection: bw.project(point) };
    }).filter(({ subPathCommandIndex, commandIndex, projection }) => !!projection)
      .reduce((prev, curr) => {
        if (!prev || !curr) {
          return prev ? prev : curr;
        }
        return curr.projection.d < prev.projection.d ? curr : prev;
      }, null);
  }

  split(subPathCommandIndex: number, commandIndex: number, t: number) {
    const bezierWrapper = this.bezierWrappersMap_[subPathCommandIndex][commandIndex];
    const {left, right} = bezierWrapper.split(t);
    const leftStartPoint = new Point(left.points[0].x, left.points[0].y);
    const leftEndPoint = new Point(left.points[left.points.length - 1].x, left.points[left.points.length - 1].y);
    const rightStartPoint = new Point(right.points[0].x, right.points[0].y);
    const rightEndPoint = new Point(right.points[right.points.length - 1].x, right.points[right.points.length - 1].y);
    const cmd = bezierWrapper.command;
    let leftCmd: DrawCommand;
    let rightCmd: DrawCommand;
    if (cmd instanceof LineCommand) {
      leftCmd = new LineCommand(leftStartPoint, leftEndPoint);
      rightCmd = new LineCommand(rightStartPoint, rightEndPoint);
    } else if (cmd instanceof ClosePathCommand) {
      leftCmd = new LineCommand(leftStartPoint, leftEndPoint);
      rightCmd = new ClosePathCommand(rightStartPoint, rightEndPoint);
    } else if (cmd instanceof QuadraticCurveCommand) {
      leftCmd = new QuadraticCurveCommand(
        new Point(left.points[0].x, left.points[0].y),
        new Point(left.points[1].x, left.points[1].y),
        new Point(left.points[2].x, left.points[2].y));
      rightCmd = new QuadraticCurveCommand(
        new Point(right.points[0].x, right.points[0].y),
        new Point(right.points[1].x, right.points[1].y),
        new Point(right.points[2].x, right.points[2].y));
    } else if (cmd instanceof BezierCurveCommand) {
      leftCmd = new BezierCurveCommand(
        new Point(left.points[0].x, left.points[0].y),
        new Point(left.points[1].x, left.points[1].y),
        new Point(left.points[2].x, left.points[2].y),
        new Point(left.points[3].x, left.points[3].y));
      rightCmd = new BezierCurveCommand(
        new Point(right.points[0].x, right.points[0].y),
        new Point(right.points[1].x, right.points[1].y),
        new Point(right.points[2].x, right.points[2].y),
        new Point(right.points[3].x, right.points[3].y));
    } else if (cmd instanceof EllipticalArcCommand) {
      throw new Error('TODO: implement split for ellpitical arcs');
    }
    const commands: DrawCommand[] = this.subPathCommands[subPathCommandIndex].commands;
    commands.splice(commandIndex, 1, leftCmd, rightCmd);
    this.subPathCommands = this.subPathCommands_;
  }
}

function computeCommandProperties(subPathCommands: SubPathCommand[]) {
  let length = 0;
  const bounds = new Rect(Infinity, Infinity, -Infinity, -Infinity);
  const bezierWrappersMap: BezierWrapper[][] = [];

  const expandBounds_ = (x: number, y: number) => {
    bounds.l = Math.min(x, bounds.l);
    bounds.t = Math.min(y, bounds.t);
    bounds.r = Math.max(x, bounds.r);
    bounds.b = Math.max(y, bounds.b);
  };

  const expandBoundsToBezier_ = bez => {
    const bbox = bez.bbox();
    expandBounds_(bbox.x.min, bbox.y.min);
    expandBounds_(bbox.x.max, bbox.y.min);
    expandBounds_(bbox.x.min, bbox.y.max);
    expandBounds_(bbox.x.max, bbox.y.max);
  };

  let firstPoint = null;
  let currentPoint = new Point(0, 0);

  subPathCommands.forEach(subPathCommand => {
    const bezierWrappers = [];
    subPathCommand.commands.forEach(command => {
      if (command instanceof MoveCommand) {
        const nextPoint = command.points[1];
        if (!firstPoint) {
          firstPoint = nextPoint;
        }
        currentPoint = nextPoint;
        expandBounds_(nextPoint.x, nextPoint.y);
        bezierWrappers.push(new BezierWrapper(command));
      } else if (command instanceof LineCommand) {
        const nextPoint = command.points[1];
        length += nextPoint.distanceTo(currentPoint);
        bezierWrappers.push(new BezierWrapper(command, new Bezier(currentPoint, currentPoint, nextPoint, nextPoint)));
        currentPoint = nextPoint;
        expandBounds_(nextPoint.x, nextPoint.y);
      } else if (command instanceof ClosePathCommand) {
        if (firstPoint) {
          length += firstPoint.distanceTo(currentPoint);
          bezierWrappers.push(new BezierWrapper(command, new Bezier(currentPoint, currentPoint, firstPoint, firstPoint)));
        }
        firstPoint = null;
      } else if (command instanceof BezierCurveCommand) {
        const points = command.points;
        const bez = new Bezier(currentPoint, points[1], points[2], points[3]);
        bezierWrappers.push(new BezierWrapper(command, bez));
        length += bez.length();
        currentPoint = points[3];
        expandBoundsToBezier_(bez);
      } else if (command instanceof QuadraticCurveCommand) {
        const points = command.points;
        const bez = new Bezier(currentPoint, points[1], points[2]);
        bezierWrappers.push(new BezierWrapper(command, bez));
        length += bez.length();
        currentPoint = points[2];
        expandBoundsToBezier_(bez);
      } else if (command instanceof EllipticalArcCommand) {
        const args = command.args;
        const [currentPointX, currentPointY,
          rx, ry, xAxisRotation,
          largeArcFlag, sweepFlag,
          tempPoint1X, tempPoint1Y] = args;

        if (currentPointX === tempPoint1X && currentPointY === tempPoint1Y) {
          // degenerate to point (0 length)
          bezierWrappers.push(new BezierWrapper(command));
          return;
        }

        if (rx === 0 || ry === 0) {
          // degenerate to line
          const nextPoint = new Point(tempPoint1X, tempPoint1Y);
          length += new Point(currentPointX, currentPointY).distanceTo(nextPoint);
          expandBounds_(tempPoint1X, tempPoint1Y);
          bezierWrappers.push(new BezierWrapper(command, new Bezier(currentPoint, currentPoint, nextPoint, nextPoint)));
          currentPoint = nextPoint;
          return;
        }

        const bezierCoords = SvgUtil.arcToBeziers(
          currentPointX, currentPointY,
          rx, ry, xAxisRotation,
          largeArcFlag, sweepFlag,
          tempPoint1X, tempPoint1Y);

        const arcBeziers: Bezier[] = [];
        for (let i = 0; i < bezierCoords.length; i += 8) {
          const bez = new Bezier(
            currentPoint.x, currentPoint.y,
            bezierCoords[i + 2], bezierCoords[i + 3],
            bezierCoords[i + 4], bezierCoords[i + 5],
            bezierCoords[i + 6], bezierCoords[i + 7]);
          arcBeziers.push(bez);
          length += bez.length();
          currentPoint = new Point(bezierCoords[i + 6], bezierCoords[i + 7]);
          expandBoundsToBezier_(bez);
        }
        bezierWrappers.push(new BezierWrapper(command, ...arcBeziers));
        currentPoint = new Point(tempPoint1X, tempPoint1Y);
      }
    });
    bezierWrappersMap.push(bezierWrappers);
  });

  return { length, bounds, bezierWrappersMap };
}

// TODO(alockwood): figure out a better way to declare these types...

/** Wraps around the bezier curves associated with a command. */
class BezierWrapper {
  readonly command: DrawCommand;
  readonly beziers: Bezier[];

  constructor(command: DrawCommand, ...beziers: Bezier[]) {
    this.command = command;
    this.beziers = beziers;
  }

  project(point: Point): Projection | null {
    let minProj = null;
    for (let i = 0; i < this.beziers.length; i++) {
      const proj = this.beziers[i].project(point);
      if (proj && (!minProj || proj.d < minProj.d)) {
        minProj = proj;
      }
    }
    if (!minProj) {
      return null;
    }
    return { x: minProj.x, y: minProj.y, t: minProj.t, d: minProj.d };
  }

  split(t: number): Split | null {
    if (this.command instanceof EllipticalArcCommand) {
      throw new Error('TODO: implement split support for elliptical arcs');
    }
    if (this.beziers.length) {
      const result = this.beziers[0].split(t);
      return { left: result.left, right: result.right };
    }
    return null;
  }
}

export type Projection = {
  x: number;
  y: number;
  t: number;
  d: number;
};

export type ProjectionInfo = {
  subPathCommandIndex: number;
  commandIndex: number;
  projection: Projection;
};

interface Split {
  left: Bezier;
  right: Bezier;
}

type Bezier = {
  constructor(points: Point[]);
  constructor(coords: number[]);
  constructor(
    x1: number, y1: number,
    x2: number, y2: number,
    x3: number, y3: number,
    x4?: number, y4?: number);
  constructor(p1: Point, p2: Point, p3: Point, p4?: Point);
  points: Point[];
  length(): number;
  project(point: Point): Projection;
  split(t: number): Split;
};
