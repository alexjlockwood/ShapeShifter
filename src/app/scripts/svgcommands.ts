import { Point } from './mathutil';
import * as SvgUtil from './svgutil';


export abstract class Command {
  constructor(public args: number[]) { }

  abstract execute(ctx: CanvasRenderingContext2D);

  abstract interpolateTo<T extends Command>(target: T, fraction: number): T;

  // TODO(alockwood): figure out what to do with elliptical arcs
  get points(): Point[] {
    const points = [];
    for (let i = 0; i < this.args.length; i += 2) {
      points.push(new Point(this.args[i], this.args[i + 1]));
    }
    return points;
  }
}

export class MoveCommand extends Command {
  constructor(public args: number[]) {
    super(args);
  }

  execute(ctx: CanvasRenderingContext2D) {
    ctx.moveTo(this.args[0], this.args[1]);
  }

  interpolateTo(target: MoveCommand, fraction: number): MoveCommand {
    return new MoveCommand(interpolateArgs(this, target, fraction));
  }
}

export class LineCommand extends Command {
  constructor(public args: number[]) {
    super(args);
  }

  execute(ctx: CanvasRenderingContext2D) {
    ctx.lineTo(this.args[0], this.args[1]);
  }

  interpolateTo(target: LineCommand, fraction: number): LineCommand {
    return new LineCommand(interpolateArgs(this, target, fraction));
  }
}

export class QuadraticCurveCommand extends Command {
  constructor(public args: number[]) {
    super(args);
  }

  execute(ctx: CanvasRenderingContext2D) {
    ctx.quadraticCurveTo(this.args[0], this.args[1], this.args[2], this.args[3]);
  }

  interpolateTo(target: QuadraticCurveCommand, fraction: number): QuadraticCurveCommand {
    return new QuadraticCurveCommand(interpolateArgs(this, target, fraction));
  }
}

export class BezierCurveCommand extends Command {
  constructor(public args: number[]) {
    super(args);
  }

  execute(ctx: CanvasRenderingContext2D) {
    ctx.bezierCurveTo(this.args[0], this.args[1], this.args[2], this.args[3], this.args[4], this.args[5]);
  }

  interpolateTo(target: BezierCurveCommand, fraction: number): BezierCurveCommand {
    return new BezierCurveCommand(interpolateArgs(this, target, fraction));
  }
}

export class ClosePathCommand extends Command {
  constructor() {
    super([]);
  }

  execute(ctx: CanvasRenderingContext2D) {
    ctx.closePath();
  }

  interpolateTo(target: ClosePathCommand, fraction: number): ClosePathCommand {
    return this;
  }
}

export class EllipticalArcCommand extends Command {
  constructor(public args: number[]) {
    super(args);
  }

  execute(ctx: CanvasRenderingContext2D) {
    SvgUtil.executeArc(ctx, this.args);
  }

  // TODO(alockwood): implement this?
  interpolateTo(target: EllipticalArcCommand, fraction: number): EllipticalArcCommand {
    return this;
  }
}

function interpolateArgs(start: Command, end: Command, fraction: number): number[] {
  const interpolatedArgs = [];
  for (let i = 0; i < start.args.length; i++) {
    interpolatedArgs.push(start.args[i] + (end.args[i] - start.args[i]) * fraction);
  }
  return interpolatedArgs;
}


