import * as Bezier from 'bezier-js';
import { Point, Matrix, Rect } from './mathutil';
import {
  Command, MoveCommand, LineCommand, QuadraticCurveCommand,
  BezierCurveCommand, EllipticalArcCommand, ClosePathCommand
} from './svgcommands';
import * as SvgUtil from './svgutil';
import * as SvgParser from './svgparser';


export class SvgPathData {
  private pathString_: string;
  private commands_: Command[];
  private length_ = 0;
  private bounds_: Rect = null;

  static interpolate(start: SvgPathData, end: SvgPathData, fraction: number) {
    if (!end || !start || !end.commands || !start.commands
      || end.commands.length !== start.commands.length) {
      // TODO: show a warning
      return null;
    }

    let interpolatedCommands = [];

    let i, j;
    for (i = 0; i < start.commands.length; i++) {
      let si = start.commands[i], ei = end.commands[i];
      if (!ei.args || !si.args || ei.args.length !== si.args.length) {
        console.warn('Incompatible path interpolation');
        return null;
      }
      interpolatedCommands.push(si.interpolateTo(ei, fraction));
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
    this.commands_.forEach(command => {
      const args = command.args;
      if (command instanceof EllipticalArcCommand) {
        const start = new Point(args[0], args[1]).transform(...transforms);
        args[0] = start.x;
        args[1] = start.y;
        const arc = SvgUtil.transformArc({
          rx: args[2],
          ry: args[3],
          xAxisRotation: args[4],
          largeArcFlag: args[5],
          sweepFlag: args[6],
          endX: args[7],
          endY: args[8],
        }, transforms);
        args[2] = arc.rx;
        args[3] = arc.ry;
        args[4] = arc.xAxisRotation;
        args[5] = arc.largeArcFlag;
        args[6] = arc.sweepFlag;
        args[7] = arc.endX;
        args[8] = arc.endY;
        return;
      }

      for (let i = 0; i < args.length; i += 2) {
        let transformed = new Point(args[i], args[i + 1]).transform(...transforms);
        args[i] = transformed.x;
        args[i + 1] = transformed.y;
      }
    });

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
  let currentPoint = { x: 0, y: 0 };

  let dist_ = (x1: number, y1: number, x2: number, y2: number) => {
    return Math.sqrt(Math.pow(y2 - y1, 2) + Math.pow(x2 - x1, 2));
  };

  commands.forEach(command => {
    const args = command.args;
    if (command instanceof MoveCommand) {

      if (!firstPoint) {
        firstPoint = { x: args[0], y: args[1] };
      }
      currentPoint.x = args[0];
      currentPoint.y = args[1];
      expandBounds_(args[0], args[1]);
    }

    else if (command instanceof LineCommand) {
      length += dist_(args[0], args[1], currentPoint.x, currentPoint.y);
      currentPoint.x = args[0];
      currentPoint.y = args[1];
      expandBounds_(args[0], args[1]);
    }

    else if (command instanceof ClosePathCommand) {
      if (firstPoint) {
        length += dist_(firstPoint.x, firstPoint.y, currentPoint.x, currentPoint.y);
      }
      firstPoint = null;
    }

    else if (command instanceof BezierCurveCommand) {
      let bez = new Bezier(
        currentPoint.x, currentPoint.y,
        args[0], args[1],
        args[2], args[3],
        args[4], args[5]);
      length += bez.length();
      currentPoint.x = args[4];
      currentPoint.y = args[5];
      expandBoundsToBezier_(bez);
    }

    else if (command instanceof QuadraticCurveCommand) {
      let bez = new Bezier(
        currentPoint.x, currentPoint.y,
        args[0], args[1],
        args[2], args[3]);
      length += bez.length();
      currentPoint.x = args[2];
      currentPoint.y = args[3];
      expandBoundsToBezier_(bez);
    }

    else if (command instanceof EllipticalArcCommand) {
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
        length += dist_(currentPointX, currentPointY, tempPoint1X, tempPoint1Y);
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
