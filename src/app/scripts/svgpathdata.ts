import * as Bezier from 'bezier-js';
import { Point, Matrix, Rect } from './mathutil';
import {
  Command, SimpleCommand, MoveCommand, LineCommand, QuadraticCurveCommand,
  BezierCurveCommand, EllipticalArcCommand, ClosePathCommand
} from './svgcommands';
import * as SvgUtil from './svgutil';
import * as SvgParser from './svgparser';


export class SvgPathData {
  private pathString_: string;
  private commands_: Command[];
  private length_ = 0;
  private bounds_: Rect = null;

  static arePathsMorphable(start: SvgPathData, end: SvgPathData) {
    if (!start || !end
      || !start.commands || !end.commands
      || start.commands.length !== end.commands.length) {
      return false;
    }
    for (let i = 0; i < start.commands.length; i++) {
      const si = start.commands[i], ei = end.commands[i];
      if (si.constructor !== ei.constructor) {
        return false;
      }
    }
    return true;
  }

  static interpolatePaths(start: SvgPathData, end: SvgPathData, fraction: number) {
    if (!end || !start || !end.commands || !start.commands
      || end.commands.length !== start.commands.length) {
      // TODO: show a warning
      return null;
    }

    let interpolatedCommands = [];

    let i, j;
    for (i = 0; i < start.commands.length; i++) {
      let si = start.commands[i], ei = end.commands[i];
      //if (!ei.points || !si.args || ei.args.length !== si.args.length) {
      //  console.warn('Incompatible path interpolation');
      //  return null;
      //}
      interpolatedCommands.push(si.interpolate(ei, fraction));
    }

    return new SvgPathData(interpolatedCommands);
  }

  constructor();
  constructor(obj: string);
  constructor(obj: Command[]);
  constructor(obj: SvgPathData);
  constructor(obj?: any) {
    if (obj) {
      if (typeof obj === 'string') {
        this.pathString = obj;
      } else if (Array.isArray(obj)) {
        this.commands = obj;
      } else if (obj instanceof SvgPathData) {
        this.pathString = obj.pathString;
      }
    }
  }

  get pathString() {
    return this.pathString_ || '';
  }

  set pathString(path: string) {
    this.pathString_ = path;
    this.commands_ = SvgParser.parseCommands(path);
    let {length, bounds} = computePathLengthAndBounds_(this.commands_);
    this.length_ = length;
    this.bounds_ = bounds;
  }

  toString() {
    return this.pathString;
  }

  get commands() {
    return this.commands_;
  }

  set commands(value) {
    this.commands_ = (value ? value.slice() : []);
    this.pathString_ = SvgParser.commandsToString(this.commands_);
    let {length, bounds} = computePathLengthAndBounds_(this.commands_);
    this.length_ = length;
    this.bounds_ = bounds;
  }

  get length() {
    return this.length_;
  }

  /** Draw the path using the specified canvas context. */
  execute(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    this.commands_.forEach(c => c.execute(ctx));
  }

  transform(transforms: Matrix[]) {
    this.commands_.forEach(c => c.transform(transforms));
    this.pathString_ = SvgParser.commandsToString(this.commands_);
    let { length, bounds } = computePathLengthAndBounds_(this.commands_);
    this.length_ = length;
    this.bounds_ = bounds;
  }
}


function computePathLengthAndBounds_(commands: Command[]) {
  let length = 0;
  let bounds = new Rect(Infinity, Infinity, -Infinity, -Infinity);

  let expandBounds_ = (x: number, y: number) => {
    bounds.l = Math.min(x, bounds.l);
    bounds.t = Math.min(y, bounds.t);
    bounds.r = Math.max(x, bounds.r);
    bounds.b = Math.max(y, bounds.b);
  };

  let expandBoundsToBezier_ = bez => {
    let bbox = bez.bbox();
    expandBounds_(bbox.x.min, bbox.y.min);
    expandBounds_(bbox.x.max, bbox.y.min);
    expandBounds_(bbox.x.min, bbox.y.max);
    expandBounds_(bbox.x.max, bbox.y.max);
  };

  let firstPoint = null;
  let currentPoint = new Point(0, 0);

  let dist_ = (p1: Point, p2: Point) => {
    return Math.sqrt(Math.pow(p2.y - p1.y, 2) + Math.pow(p2.x - p1.x, 2));
  };

  commands.forEach(command => {
    if (command instanceof MoveCommand) {
      const nextPoint = command.points[1];
      if (!firstPoint) {
        firstPoint = nextPoint;
      }
      currentPoint = nextPoint;
      expandBounds_(nextPoint.x, nextPoint.y);
    }

    else if (command instanceof LineCommand) {
      const nextPoint = command.points[1];
      length += dist_(nextPoint, currentPoint);
      currentPoint = nextPoint;
      expandBounds_(nextPoint.x, nextPoint.y);
    }

    else if (command instanceof ClosePathCommand) {
      if (firstPoint) {
        length += dist_(firstPoint, currentPoint);
      }
      firstPoint = null;
    }

    else if (command instanceof BezierCurveCommand) {
      const points = command.points;
      let bez = new Bezier(currentPoint, points[1], points[2], points[3]);
      length += bez.length();
      currentPoint = points[3];
      expandBoundsToBezier_(bez);
    }

    else if (command instanceof QuadraticCurveCommand) {
      const points = command.points;
      let bez = new Bezier(currentPoint, points[1], points[2]);
      length += bez.length();
      currentPoint = points[2];
      expandBoundsToBezier_(bez);
    }

    else if (command instanceof EllipticalArcCommand) {
      const args = command.args;
      let [currentPointX, currentPointY,
        rx, ry, xAxisRotation,
        largeArcFlag, sweepFlag,
        tempPoint1X, tempPoint1Y] = args;

      if (currentPointX === tempPoint1X && currentPointY === tempPoint1Y) {
        // degenerate to point (0 length)
        return;
      }

      if (rx === 0 || ry === 0) {
        // degenerate to line
        length += dist_(new Point(currentPointX, currentPointY), new Point(tempPoint1X, tempPoint1Y));
        expandBounds_(tempPoint1X, tempPoint1Y);
        return;
      }

      let bezierCoords = SvgUtil.arcToBeziers(
        currentPointX, currentPointY,
        rx, ry, xAxisRotation,
        largeArcFlag, sweepFlag,
        tempPoint1X, tempPoint1Y);

      for (let i = 0; i < bezierCoords.length; i += 8) {
        let bez = new Bezier(
          currentPoint.x, currentPoint.y,
          bezierCoords[i + 2], bezierCoords[i + 3],
          bezierCoords[i + 4], bezierCoords[i + 5],
          bezierCoords[i + 6], bezierCoords[i + 7]);
        length += bez.length();
        currentPoint.x = bezierCoords[i + 6];
        currentPoint.y = bezierCoords[i + 7];
        expandBoundsToBezier_(bez);
      }
      currentPoint.x = tempPoint1X;
      currentPoint.y = tempPoint1Y;
    }
  });

  return { length, bounds };
}
