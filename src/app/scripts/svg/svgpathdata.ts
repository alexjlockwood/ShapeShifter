import * as _ from 'lodash';
import { MathUtil, Bezier, Projection, Point, Matrix, Rect } from '../common';
import { ICommand, IPathCommand, ISubPathCommand, IDrawCommand } from '../model';
import * as SvgUtil from './svgutil';
import * as PathParser from './pathparser';

export function createPathCommand(path: string): IPathCommand {
  return new SvgPathData(path);
}

/**
 * Provides all of the information associated with a vector drawable's path data.
 */
class SvgPathData implements IPathCommand {
  private originalDrawCommands_: DrawCommand[];
  private drawCommandWrappers_: DrawCommandWrapper[];
  private commands_: SubPathCommand[] = [];
  private path_: string;
  private length_ = 0;
  private bounds_: Rect = null;

  // TODO(alockwood): need to dynamically update the length/bounds/pathstring
  constructor(path: string) {
    this.path_ = path;
    this.originalDrawCommands_ = PathParser.parseCommands(this.path_);

    const {length, bounds, drawCommandWrappers} =
      initInternalState(this, this.originalDrawCommands_);
    this.length_ = length;
    this.bounds_ = bounds;
    this.drawCommandWrappers_ = drawCommandWrappers;

    this.rebuildInternalState();
  }

  // Overrides ICommand interface.
  get id() {
    return this.path_;
  }

  // Overrides IPathCommand interface.
  get commands() {
    return this.commands_;
  }

  // Overrides IPathCommand interface.
  get pathLength() {
    return this.length_;
  }

  // TODO(alockwood): make this private
  rebuildInternalState(rebuildPathString = false) {
    const drawCommands = [].concat.apply([], this.drawCommandWrappers_.map(cw => cw.commands));
    if (rebuildPathString) {
      this.path_ = PathParser.commandsToString(drawCommands);
    }
    this.commands_ = createSubPathCommands(drawCommands);
  }

  // Overrides IPathCommand interface.
  isMorphableWith(cmd: SvgPathData) {
    return this.commands.length === cmd.commands.length
      && this.commands.every((s, i) => {
        return s.commands.length === cmd.commands[i].commands.length
          && s.commands.every((d, j) => {
            const drawCmd = cmd.commands[i].commands[j];
            return d.constructor === drawCmd.constructor
              && d.points.length === drawCmd.points.length;
          });
      });
  }

  // Overrides IPathCommand interface.
  interpolate(start: SvgPathData, end: SvgPathData, fraction: number) {
    if (!this.isMorphableWith(start) || !this.isMorphableWith(end)) {
      return;
    }
    this.commands.forEach((s, i) => {
      s.commands.forEach((d, j) => {
        if (d instanceof EllipticalArcCommand) {
          // TODO(alockwood): confirm this is how we should interpolate arcs?
          const d1 = start.commands[i].commands[j] as EllipticalArcCommand;
          const d2 = end.commands[i].commands[j] as EllipticalArcCommand;
          d.args.forEach((_, x) => {
            if (x === 5 || x === 6) {
              // Doesn't make sense to interpolate the large arc and sweep flags.
              d.args[x] = fraction === 0 ? d1.args[x] : d2.args[x];
              return;
            }
            d.args[x] = MathUtil.lerp(d1.args[x], d2.args[x], fraction);
          });
        } else {
          const d1 = start.commands[i].commands[j];
          const d2 = end.commands[i].commands[j];
          for (let x = 0; x < d1.points.length; x++) {
            const startPoint = d1.points[x];
            const endPoint = d2.points[x];
            if (startPoint && endPoint) {
              const px = MathUtil.lerp(startPoint.x, endPoint.x, fraction);
              const py = MathUtil.lerp(startPoint.y, endPoint.y, fraction);
              d.points[x] = new Point(px, py);
            }
          }
        }
      });
    });
    this.rebuildInternalState();
  }

  // Overrides IPathCommand interface.
  execute(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    this.commands.forEach(s => s.commands.forEach(d => {
      if (d instanceof MoveCommand) {
        ctx.moveTo(d.end.x, d.end.y);
      } else if (d instanceof LineCommand) {
        ctx.lineTo(d.end.x, d.end.y);
      } else if (d instanceof QuadraticCurveCommand) {
        ctx.quadraticCurveTo(
          d.points[1].x, d.points[1].y,
          d.points[2].x, d.points[2].y);
      } else if (d instanceof BezierCurveCommand) {
        ctx.bezierCurveTo(
          d.points[1].x, d.points[1].y,
          d.points[2].x, d.points[2].y,
          d.points[3].x, d.points[3].y);
      } else if (d instanceof ClosePathCommand) {
        ctx.closePath();
      } else if (d instanceof EllipticalArcCommand) {
        SvgUtil.executeArc(ctx, d.args);
      }
    }));
  }

  // Overrides IPathCommand interface.
  project(point: Point): { projection: Projection, split: () => void } | null {
    return this.drawCommandWrappers_.map(cw => {
      const projection = cw.project(point);
      return {
        projection,
        split: () => {
          cw.split(projection.t);
          this.rebuildInternalState(true);
        }
      };
    }).filter(item => !!item.projection)
      .reduce((prev, curr) => {
        return prev && prev.projection.d < curr.projection.d ? prev : curr;
      }, null);
  }

  toString() {
    return this.path_;
  }
}

function initInternalState(svgPathData: SvgPathData, commands: DrawCommand[]) {
  let length = 0;
  const bounds = new Rect(Infinity, Infinity, -Infinity, -Infinity);

  const expandBounds_ = (x: number, y: number) => {
    bounds.l = Math.min(x, bounds.l);
    bounds.t = Math.min(y, bounds.t);
    bounds.r = Math.max(x, bounds.r);
    bounds.b = Math.max(y, bounds.b);
  };

  const expandBoundsToBezier_ = (bez: Bezier) => {
    const bbox = bez.bbox();
    expandBounds_(bbox.x.min, bbox.y.min);
    expandBounds_(bbox.x.max, bbox.y.min);
    expandBounds_(bbox.x.min, bbox.y.max);
    expandBounds_(bbox.x.max, bbox.y.max);
  };

  let firstPoint = null;
  let currentPoint = new Point(0, 0);

  const drawCommandWrappers: DrawCommandWrapper[] = [];
  commands.forEach(cmd => {
    if (cmd instanceof MoveCommand) {
      const nextPoint = cmd.points[1];
      if (!firstPoint) {
        firstPoint = nextPoint;
      }
      currentPoint = nextPoint;
      expandBounds_(nextPoint.x, nextPoint.y);
      drawCommandWrappers.push(new DrawCommandWrapper(svgPathData, cmd));
    } else if (cmd instanceof LineCommand) {
      const nextPoint = cmd.points[1];
      length += MathUtil.distance(currentPoint, nextPoint);
      drawCommandWrappers.push(new DrawCommandWrapper(svgPathData,
        cmd, new Bezier(currentPoint, currentPoint, nextPoint, nextPoint)));
      currentPoint = nextPoint;
      expandBounds_(nextPoint.x, nextPoint.y);
    } else if (cmd instanceof ClosePathCommand) {
      if (firstPoint) {
        length += MathUtil.distance(firstPoint, currentPoint);
        drawCommandWrappers.push(new DrawCommandWrapper(svgPathData,
          cmd, new Bezier(currentPoint, currentPoint, firstPoint, firstPoint)));
      }
      firstPoint = null;
    } else if (cmd instanceof BezierCurveCommand) {
      const points = cmd.points;
      const bez = new Bezier(currentPoint, points[1], points[2], points[3]);
      drawCommandWrappers.push(new DrawCommandWrapper(svgPathData, cmd, bez));
      length += bez.length();
      currentPoint = points[3];
      expandBoundsToBezier_(bez);
    } else if (cmd instanceof QuadraticCurveCommand) {
      const points = cmd.points;
      const bez = new Bezier(currentPoint, points[1], points[2]);
      drawCommandWrappers.push(new DrawCommandWrapper(svgPathData, cmd, bez));
      length += bez.length();
      currentPoint = points[2];
      expandBoundsToBezier_(bez);
    } else if (cmd instanceof EllipticalArcCommand) {
      const args = cmd.args;
      const [currentPointX, currentPointY,
        rx, ry, xAxisRotation,
        largeArcFlag, sweepFlag,
        tempPoint1X, tempPoint1Y] = args;

      if (currentPointX === tempPoint1X && currentPointY === tempPoint1Y) {
        // degenerate to point (0 length)
        drawCommandWrappers.push(new DrawCommandWrapper(svgPathData, cmd));
        return;
      }

      if (rx === 0 || ry === 0) {
        // degenerate to line
        const nextPoint = new Point;
        length += MathUtil.distance(
          { x: currentPointX, y: currentPointY },
          { x: tempPoint1X, y: tempPoint1Y });
        expandBounds_(tempPoint1X, tempPoint1Y);
        drawCommandWrappers.push(new DrawCommandWrapper(svgPathData,
          cmd, new Bezier(currentPoint, currentPoint, nextPoint, nextPoint)));
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
          { x: currentPoint.x, y: currentPoint.y },
          { x: bezierCoords[i + 2], y: bezierCoords[i + 3] },
          { x: bezierCoords[i + 4], y: bezierCoords[i + 5] },
          { x: bezierCoords[i + 6], y: bezierCoords[i + 7] });
        arcBeziers.push(bez);
        length += bez.length();
        currentPoint = new Point(bezierCoords[i + 6], bezierCoords[i + 7]);
        expandBoundsToBezier_(bez);
      }
      drawCommandWrappers.push(new DrawCommandWrapper(svgPathData, cmd, ...arcBeziers));
      currentPoint = new Point(tempPoint1X, tempPoint1Y);
    }
  });

  return { length, bounds, drawCommandWrappers };
}


/**
 * Contains additional information about each individual draw command.
 */
class DrawCommandWrapper {
  // TODO(alockwood): possible to have more than one bezier for elliptical arcs
  private readonly sourceBeziers: Bezier[];
  private readonly splits: number[] = [];
  private splitCommands: DrawCommand[] = [];

  constructor(
    private readonly svgPathData: SvgPathData,
    public readonly sourceCommand: DrawCommand,
    ...sourceBeziers: Bezier[]) {
    this.sourceBeziers = sourceBeziers;
  }

  project(point: Point): Projection | null {
    return this.sourceBeziers
      .map(bez => bez.project(point))
      .reduce((prev, curr) => prev && prev.d < curr.d ? prev : curr, null);
  }

  split(t: number) {
    if (!this.sourceBeziers.length) {
      return;
    }
    if (this.sourceCommand instanceof EllipticalArcCommand) {
      throw new Error('TODO: implement split support for elliptical arcs');
    }
    this.splits.splice(_.sortedIndex(this.splits, t), 0, t);
    this.rebuildSplitCommands();
  }

  private rebuildSplitCommands() {
    this.splitCommands = [];
    if (!this.splits.length) {
      return;
    }
    const splits = [...this.splits, 1];
    let prevT = 0;
    for (let currT of splits) {
      // TODO(alockwood): possible to have more than one bezier for elliptical arcs
      const bez = this.sourceBeziers[0].split(prevT, currT);
      this.splitCommands.push(this.bezierToDrawCommand(bez));
      prevT = currT;
    }
  }

  private bezierToDrawCommand(bezier: Bezier) {
    const cmd = this.sourceCommand;
    if (cmd instanceof LineCommand) {
      return new LineCommand(bezier.start, bezier.end);
    } else if (cmd instanceof ClosePathCommand) {
      return new ClosePathCommand(bezier.start, bezier.end);
    } else if (cmd instanceof QuadraticCurveCommand) {
      return new QuadraticCurveCommand(bezier.start, bezier.cp1, bezier.end);
    } else if (cmd instanceof BezierCurveCommand) {
      return new BezierCurveCommand(bezier.start, bezier.cp1, bezier.cp2, bezier.end);
    } else {// if (cmd instanceof EllipticalArcCommand) {
      throw new Error('TODO: implement split for ellpitical arcs');
    }
  }

  get commands() {
    if (this.splitCommands.length) {
      for (let i = 0; i < this.splitCommands.length - 1; i++) {
        const cmd = this.splitCommands[i];
        cmd.onDeleteCommandClick = () => {
          this.splits.splice(i, 1);
          this.rebuildSplitCommands();
          this.svgPathData.rebuildInternalState();
        };
      }
      return this.splitCommands;
    }
    return [this.sourceCommand];
  }
}

class SubPathCommand implements ISubPathCommand {
  private id_: string;
  private commands_: DrawCommand[];

  constructor(...commands: DrawCommand[]) { this.commands_ = commands; }

  // Overrides ICommand interface.
  set id(id: string) { this.id_ = id; }

  // Overrides ICommand interface.
  get id() { return this.id_; }

  get commands() { return this.commands_; }

  isClosed() {
    const start = this.commands[0].end;
    const end = _.last(this.commands).end;
    return start.x === end.x && start.y === end.y;
  }

  // TODO(alockwood): add a test for commands with multiple moves but no close paths
  reverse() {
    const firstMoveCommand = this.commands[0];
    if (this.commands.length === 1) {
      this.reverseDrawCommand(firstMoveCommand);
      return;
    }
    const cmds = this.commands;
    const newCmds: DrawCommand[] = [
      new MoveCommand(firstMoveCommand.start, _.last(cmds).end)
    ];
    for (let i = cmds.length - 1; i >= 1; i--) {
      this.reverseDrawCommand(cmds[i]);
      newCmds.push(cmds[i]);
    }
    const secondCmd = newCmds[1];
    if (secondCmd instanceof ClosePathCommand) {
      newCmds[1] = new LineCommand(secondCmd.start, secondCmd.end);
      const lastCmd = _.last(newCmds);
      newCmds[newCmds.length - 1] =
        new ClosePathCommand(lastCmd.start, lastCmd.end);
    }
    this.commands_ = newCmds;
  }

  // TODO(alockwood): add a test for commands with multiple moves but no close paths
  shiftForward() {
    if (this.commands.length === 1 || !this.isClosed()) {
      return;
    }

    // TODO(alockwood): make this more efficient... :P
    for (let i = 0; i < this.commands.length - 2; i++) {
      this.shiftBack();
    }
  }

  // TODO(alockwood): add a test for commands with multiple moves but no close paths
  shiftBack() {
    if (this.commands.length === 1 || !this.isClosed()) {
      return;
    }

    const newCmdLists: DrawCommand[][] = [];
    const cmds = this.commands;
    const moveStartPoint = cmds[0].start;
    cmds.unshift(cmds.pop());

    if (cmds[0] instanceof ClosePathCommand) {
      const lastCmd = _.last(cmds);
      cmds[cmds.length - 1] = new ClosePathCommand(lastCmd.start, lastCmd.end);
      cmds[1] = new LineCommand(cmds[0].start, cmds[0].end);
    } else {
      cmds[1] = cmds[0];
    }
    // TODO(alockwood): confirm that this start point is correct for paths w/ multiple moves
    cmds[0] = new MoveCommand(moveStartPoint, cmds[1].start);
  }

  private reverseDrawCommand(cmd: DrawCommand) {
    if (cmd instanceof EllipticalArcCommand) {
      const endX = cmd.args[0];
      const endY = cmd.args[1];
      cmd.args[0] = cmd.args[7];
      cmd.args[1] = cmd.args[8];
      cmd.args[6] = cmd.args[6] === 0 ? 1 : 0;
      cmd.args[7] = endX;
      cmd.args[8] = endY;
    } else if (!(cmd instanceof MoveCommand) || cmd.start) {
      cmd.points.reverse();
    }
  }
}

function createSubPathCommands(drawCommands: DrawCommand[]) {
  if (!drawCommands.length) {
    return [];
  }
  const cmdGroups: DrawCommand[][] = [];
  let currentCmdList = [];
  for (let i = drawCommands.length - 1; i >= 0; i--) {
    const cmd = drawCommands[i];
    currentCmdList.push(cmd);
    if (cmd instanceof MoveCommand) {
      cmdGroups.push(currentCmdList);
      currentCmdList = [];
    }
  }
  return cmdGroups.reverse().map(cmds => new SubPathCommand(...cmds.reverse()));
}

export abstract class DrawCommand implements IDrawCommand {
  private id_: string;
  private readonly svgChar_: string;
  private readonly points_: Point[];

  // TODO(alockwood): storing this state in here is hacky
  private onDeleteClickListener_: () => void;

  protected constructor(svgChar: string, ...points: Point[]) {
    this.svgChar_ = svgChar;
    this.points_ = points;
  }

  // Overrides ICommand interface.
  set id(id: string) { this.id_ = id; }

  // Overrides ICommand interface.
  get id() { return this.id_; }

  // Overrides IDrawCommand interface.
  get svgChar() { return this.svgChar_; }

  // Overrides IDrawCommand interface.
  get points() { return this.points_; }

  get start() { return this.points_[0]; }

  get end() { return _.last(this.points_); }

  get isModfiable() {
    return !!this.onDeleteClickListener_;
  }

  set onDeleteCommandClick(func: () => void) {
    this.onDeleteClickListener_ = func;
  }

  delete() {
    this.onDeleteClickListener_();
  }

  transform(matrices: Matrix[]) {
    for (let i = 0; i < this.points.length; i++) {
      if (this.points[i]) {
        this.points[i] = MathUtil.transform(this.points[i], ...matrices);
      }
    }
  }
}

export class MoveCommand extends DrawCommand {
  constructor(start: Point, end: Point) {
    super('M', start, end);
  }
}

export class LineCommand extends DrawCommand {
  constructor(start: Point, end: Point) {
    super('L', start, end);
  }
}

export class QuadraticCurveCommand extends DrawCommand {
  constructor(start: Point, cp: Point, end: Point) {
    super('Q', start, cp, end);
  }
}

export class BezierCurveCommand extends DrawCommand {
  constructor(start: Point, cp1: Point, cp2: Point, end: Point) {
    super('C', start, cp1, cp2, end);
  }
}

export class ClosePathCommand extends DrawCommand {
  constructor(start: Point, end: Point) {
    super('Z', start, end);
  }
}

export class EllipticalArcCommand extends DrawCommand {
  readonly args: number[];

  constructor(...args: number[]) {
    super('A', new Point(args[0], args[1]), new Point(args[7], args[8]));
    this.args = args;
  }

  transform(matrices: Matrix[]) {
    const start = MathUtil.transform({ x: this.args[0], y: this.args[1] }, ...matrices);
    this.args[0] = start.x;
    this.args[1] = start.y;
    const arc = SvgUtil.transformArc({
      rx: this.args[2],
      ry: this.args[3],
      xAxisRotation: this.args[4],
      largeArcFlag: this.args[5],
      sweepFlag: this.args[6],
      endX: this.args[7],
      endY: this.args[8],
    }, matrices);
    this.args[2] = arc.rx;
    this.args[3] = arc.ry;
    this.args[4] = arc.xAxisRotation;
    this.args[5] = arc.largeArcFlag;
    this.args[6] = arc.sweepFlag;
    this.args[7] = arc.endX;
    this.args[8] = arc.endY;
  }
}
