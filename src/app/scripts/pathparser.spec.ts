import { } from 'jasmine';
import * as PathParser from './pathparser';
import { VectorLayer, PathLayer } from './models';
import { Point } from './mathutil';
import { Command, MoveCommand, LineCommand, BezierCurveCommand } from './svgcommands';


describe('PathParser', () => {
  it('M 0 0 M 10 10 M 20 20 M 30 30', () => {
    let actual = PathParser.parseCommands("M 0 0 M 10 10 M 20 20 M 30 30");
    let expected = new CommandListBuilder()
      .moveTo(0, 0).moveTo(10, 10).moveTo(20, 20).moveTo(30, 30).build();
    expect(actual).toEqual(expected);
  });

  it('M 0 0 L 10 10 L 20 20 L 30 30', () => {
    const actual = PathParser.parseCommands("M 0 0 L 10 10 L 20 20 L 30 30");
    const expected = new CommandListBuilder()
      .moveTo(0, 0).lineTo(10, 10).lineTo(20, 20).lineTo(30, 30).build();
    expect(actual).toEqual(expected);
  });

  it('M 0 0 10 10 20 20 30 30', () => {
    const actual = PathParser.parseCommands("M 0 0 10 10 20 20 30 30");
    const expected = new CommandListBuilder()
      .moveTo(0, 0).lineTo(10, 10).lineTo(20, 20).lineTo(30, 30).build();
    expect(actual).toEqual(expected);
  });

  it('M 0 0 L 10 10 20 20 L 30 30', () => {
    const actual = PathParser.parseCommands("M 0 0 L 10 10 20 20 L 30 30");
    const expected = new CommandListBuilder()
      .moveTo(0, 0).lineTo(10, 10).lineTo(20, 20).lineTo(30, 30).build();
    expect(actual).toEqual(expected);
  });

  it('M 0 0 L 12 12 C 16 16 20 20 24 24', () => {
    const actual = PathParser.parseCommands("M 0 0 L 12 12 C 16 16 20 20 24 24");
    const expected = new CommandListBuilder()
      .moveTo(0, 0)
      .lineTo(12, 12)
      .bezierTo(16, 16, 20, 20, 24, 24)
      .build();
    expect(actual).toEqual(expected);
  });
});

class CommandListBuilder {
  private commands: Command[] = [];
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

