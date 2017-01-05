import * as Bezier from 'bezier-js';
import { Point, Matrix, Rect } from './mathutil';
import {
  Command, SimpleCommand, MoveCommand, LineCommand, QuadraticCurveCommand,
  BezierCurveCommand, EllipticalArcCommand, ClosePathCommand
} from './svgcommands';
import * as SvgUtil from './svgutil';
import * as PathParser from './pathparser';


export class SvgPathData {
  private pathString_: string;
  private commands_: Command[];
  private length_ = 0;
  private bounds_: Rect = null;
  private projectors_: Projector[];

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
    this.commands_ = PathParser.parseCommands(path);
    this.updateCommandProperties();
  }

  toString() {
    return this.pathString;
  }

  get commands() {
    return this.commands_;
  }

  set commands(commands: Command[]) {
    this.commands_ = (commands ? commands.slice() : []);
    this.pathString_ = PathParser.commandsToString(this.commands_);
    this.updateCommandProperties();
  }

  private updateCommandProperties() {
    const {length, bounds, projectors} = computeCommandProperties(this.commands_);
    this.length_ = length;
    this.bounds_ = bounds;
    this.projectors_ = projectors;
  }

  get length() {
    return this.length_;
  }

  /** Draw the path using the specified canvas context. */
  execute(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    this.commands_.forEach(c => {
      if (c instanceof MoveCommand) {
        ctx.moveTo(c.points[1].x, c.points[1].y);
      } else if (c instanceof LineCommand) {
        ctx.lineTo(c.points[1].x, c.points[1].y);
      } else if (c instanceof QuadraticCurveCommand) {
        ctx.quadraticCurveTo(
          c.points[1].x, c.points[1].y,
          c.points[2].x, c.points[2].y);
      } else if (c instanceof BezierCurveCommand) {
        ctx.bezierCurveTo(
          c.points[1].x, c.points[1].y,
          c.points[2].x, c.points[2].y,
          c.points[3].x, c.points[3].y);
      } else if (c instanceof EllipticalArcCommand) {
        SvgUtil.executeArc(ctx, c.args);
      } else if (c instanceof ClosePathCommand) {
        ctx.closePath();
      }
    });
  }

  transform(transforms: Matrix[]) {
    this.commands_.forEach(c => c.transform(transforms));
    this.commands = this.commands_;
  }

  isMorphable(start: SvgPathData, end: SvgPathData) {
    if (!start || !end
      || !this.commands || !start.commands || !end.commands
      || this.commands.length !== start.commands.length
      || start.commands.length !== end.commands.length) {
      return false;
    }
    for (let i = 0; i < start.commands.length; i++) {
      const si = start.commands[i];
      const ei = end.commands[i];
      if (this.commands[i].constructor !== si.constructor || si.constructor !== ei.constructor) {
        return false;
      }
    }
    return true;
  }

  interpolate(start: SvgPathData, end: SvgPathData, fraction: number) {
    if (!this.isMorphable(start, end)) {
      return null;
    }
    for (let i = 0; i < start.commands.length; i++) {
      const si = start.commands[i];
      const ei = end.commands[i];
      this.commands[i].interpolate(si, ei, fraction);
    }
  }

  // TODO(alockwood): add tests for zero/one length commands
  // TODO(alockwood): add a test for commands with multiple moves but no close paths
  reverse() {
    const cmdLists: Command[][] = [[]];

    let currentCmdList = cmdLists[0];
    for (let i = 0; i < this.commands.length; i++) {
      const cmd = this.commands[i];
      currentCmdList.push(cmd);
      if (cmd instanceof ClosePathCommand && i !== this.commands.length - 1) {
        currentCmdList = [];
        cmdLists.push(currentCmdList);
      }
    }

    const newCmdLists: Command[][] = [];
    for (let i = 0; i < cmdLists.length; i++) {
      const cmds = cmdLists[i];
      const newCmds = [new MoveCommand(undefined, cmds[cmds.length - 1].endPoint)];
      for (let i = cmds.length - 1; i >= 1; i--) {
        cmds[i].reverse();
        newCmds.push(cmds[i]);
      }
      const secondCmd = newCmds[1];
      if (secondCmd instanceof ClosePathCommand) {
        newCmds[1] = new LineCommand(secondCmd.startPoint, secondCmd.endPoint);
        const lastCmd = newCmds[newCmds.length - 1];
        newCmds[newCmds.length - 1] = new ClosePathCommand(lastCmd.startPoint, lastCmd.endPoint);
      }
      newCmdLists.push(newCmds);
    }

    // TODO(alockwood): this could be more efficient (no need to recalculate bounds etc.)
    this.commands = [].concat.apply([], newCmdLists);
  }

  // TODO(alockwood): add tests for zero/one length commands
  // TODO(alockwood): add a test for commands with multiple moves but no close paths
  shiftBack() {
    const cmdLists: Command[][] = [[]];

    let currentCmdList = cmdLists[0];
    for (let i = 0; i < this.commands.length; i++) {
      const cmd = this.commands[i];
      currentCmdList.push(cmd);
      if (cmd instanceof ClosePathCommand && i !== this.commands.length - 1) {
        currentCmdList = [];
        cmdLists.push(currentCmdList);
      }
    }

    // TODO(alockwood): does it make sense to shift a non-closed path? (i.e. a stroked line)
    const finalCmdLists = cmdLists.filter(cmdList => {
      return cmdList[0].endPoint === cmdList[cmdList.length - 1].endPoint;
    });
    if (!finalCmdLists.length) {
      return;
    }

    const newCmdLists: Command[][] = [];
    for (let i = 0; i < finalCmdLists.length; i++) {
      const cmds = finalCmdLists[i];
      cmds.unshift(cmds.pop());

      if (cmds[0] instanceof ClosePathCommand) {
        const lastCmd = cmds[cmds.length - 1];
        cmds[cmds.length - 1] = new ClosePathCommand(lastCmd.startPoint, lastCmd.endPoint);
        cmds[1] = new LineCommand(cmds[0].startPoint, cmds[0].endPoint);
        cmds[0] = new MoveCommand(undefined, cmds[1].startPoint);
      } else {
        cmds[1] = cmds[0];
        cmds[0] = new MoveCommand(undefined, cmds[1].startPoint);
      }

      newCmdLists.push(cmds);
    }

    // TODO(alockwood): this could be more efficient (no need to recalculate bounds etc.)
    this.commands = [].concat.apply([], newCmdLists);
  }

  // TODO(alockwood): add tests for zero/one length commands
  // TODO(alockwood): add a test for commands with multiple moves but no close paths
  shiftForward() {
    // TODO(alockwood): make this more efficient... :P
    for (let i = 0; i < this.commands.length - 2; i++) {
      this.shiftBack();
    }
  }

  project(point: Point): { point: Point, t: number, d: number } | null {
    let minProj = new MultiProjector(...this.projectors_).project(point);
    if (!minProj) {
      return null;
    }
    return { point: new Point(minProj.x, minProj.y), t: minProj.t, d: minProj.d };
  }
}

function computeCommandProperties(commands: Command[]) {
  let length = 0;
  const bounds = new Rect(Infinity, Infinity, -Infinity, -Infinity);
  const projectors: Projector[] = [];

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

  commands.forEach(command => {
    if (command instanceof MoveCommand) {
      const nextPoint = command.points[1];
      if (!firstPoint) {
        firstPoint = nextPoint;
      }
      currentPoint = nextPoint;
      expandBounds_(nextPoint.x, nextPoint.y);
      projectors.push(new NoopProjector());
    }

    else if (command instanceof LineCommand) {
      const nextPoint = command.points[1];
      length += nextPoint.distanceTo(currentPoint);
      projectors.push(new Bezier(currentPoint, nextPoint, nextPoint));
      currentPoint = nextPoint;
      expandBounds_(nextPoint.x, nextPoint.y);
    }

    else if (command instanceof ClosePathCommand) {
      if (firstPoint) {
        length += firstPoint.distanceTo(currentPoint);
        projectors.push(new Bezier(currentPoint, firstPoint, firstPoint));
      }
      firstPoint = null;
    }

    else if (command instanceof BezierCurveCommand) {
      const points = command.points;
      const bez = new Bezier(currentPoint, points[1], points[2], points[3]);
      projectors.push(bez);
      length += bez.length();
      currentPoint = points[3];
      expandBoundsToBezier_(bez);
    }

    else if (command instanceof QuadraticCurveCommand) {
      const points = command.points;
      const bez = new Bezier(currentPoint, points[1], points[2]);
      projectors.push(bez);
      length += bez.length();
      currentPoint = points[2];
      expandBoundsToBezier_(bez);
    }

    else if (command instanceof EllipticalArcCommand) {
      const args = command.args;
      const [currentPointX, currentPointY,
        rx, ry, xAxisRotation,
        largeArcFlag, sweepFlag,
        tempPoint1X, tempPoint1Y] = args;

      if (currentPointX === tempPoint1X && currentPointY === tempPoint1Y) {
        // degenerate to point (0 length)
        projectors.push(new NoopProjector());
        return;
      }

      if (rx === 0 || ry === 0) {
        // degenerate to line
        const nextPoint = new Point(tempPoint1X, tempPoint1Y);
        length += new Point(currentPointX, currentPointY).distanceTo(nextPoint);
        expandBounds_(tempPoint1X, tempPoint1Y);
        projectors.push(new Bezier(currentPoint, currentPoint, nextPoint));
        currentPoint = nextPoint;
        return;
      }

      const bezierCoords = SvgUtil.arcToBeziers(
        currentPointX, currentPointY,
        rx, ry, xAxisRotation,
        largeArcFlag, sweepFlag,
        tempPoint1X, tempPoint1Y);

      const arcProjectors: Projector[] = [];
      for (let i = 0; i < bezierCoords.length; i += 8) {
        const bez = new Bezier(
          currentPoint.x, currentPoint.y,
          bezierCoords[i + 2], bezierCoords[i + 3],
          bezierCoords[i + 4], bezierCoords[i + 5],
          bezierCoords[i + 6], bezierCoords[i + 7]);
        arcProjectors.push(bez);
        length += bez.length();
        currentPoint = new Point(bezierCoords[i + 6], bezierCoords[i + 7]);
        expandBoundsToBezier_(bez);
      }
      projectors.push(new MultiProjector(...arcProjectors));
      currentPoint = new Point(tempPoint1X, tempPoint1Y);
    }
  });

  return { length, bounds, projectors };
}

interface Projector {
  project(point: Point): Projection | null;
}

class NoopProjector implements Projector {
  project(point: Point): Projection | null {
    return null;
  }
}

class MultiProjector implements Projector {
  private readonly projectors_: Projector[];

  constructor(...projectors: Projector[]) {
    this.projectors_ = projectors;
  }

  project(point: Point): Projection | null {
    let minProj = null;
    for (let i = 0; i < this.projectors_.length; i++) {
      const proj = this.projectors_[i].project(point);
      if (proj && (!minProj || proj.d < minProj.d)) {
        minProj = proj;
      }
    }
    if (!minProj) {
      return null;
    }
    return { x: minProj.x, y: minProj.y, t: minProj.t, d: minProj.d };
  }
}

// TODO(alockwood): figure out a better way to declare these types globally...

declare type Projection = { x: number, y: number, t: number, d: number };

declare type Bezier = {
  constructor(points: Point[]);
  constructor(coords: number[]);
  constructor(
    x1: number, y1: number,
    x2: number, y2: number,
    x3: number, y3: number,
    x4?: number, y4?: number);
  constructor(p1: Point, p2: Point, p3: Point, p4?: Point);
  length(): number;
  project(point: Point): Projection;
};

