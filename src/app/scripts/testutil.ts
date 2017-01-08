import { Point } from './mathutil';
import { DrawCommand, MoveCommand, LineCommand, BezierCurveCommand } from './svgcommands';


export class CommandListBuilder {
  private commands: DrawCommand[] = [];
  private lastPoint: Point;

  moveTo(x, y) {
    const currPoint = new Point(x, y);
    this.commands.push(new MoveCommand(this.lastPoint, currPoint));
    this.lastPoint = currPoint;
    return this;
  }

  lineTo(x, y) {
    const currPoint = new Point(x, y);
    this.commands.push(new LineCommand(this.lastPoint, currPoint));
    this.lastPoint = currPoint;
    return this;
  }

  bezierTo(x0, y0, x1, y1, x2, y2) {
    const currPoint = new Point(x2, y2);
    this.commands.push(
      new BezierCurveCommand(
        this.lastPoint,
        new Point(x0, y0),
        new Point(x1, y1),
        currPoint));
    this.lastPoint = currPoint;
    return this;
  }

  build() {
    return this.commands;
  }
}

