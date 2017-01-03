import { } from 'jasmine';
import * as PathParser from './pathparser';
import { VectorLayer, PathLayer } from './models';
import { Point } from './mathutil';
import { Command, MoveCommand, LineCommand, BezierCurveCommand } from './svgcommands';


describe('PathParser', () => {
  it('convert simple svg to command list', () => {
    const actual = PathParser.parseCommands("M 0 0 L 12 12 C 16 16 20 20 24 24");
    const expected = [
      move(0, 0, 0, 0),
      line(0, 0, 12, 12),
      bezier(12, 12, 16, 16, 20, 20, 24, 24),
    ];
    expect(actual).toEqual(expected);
  });
});

function move(x0, y0, x1, y1) {
  return new MoveCommand(new Point(x0, y0), new Point(x1, y1));
}

function line(x0, y0, x1, y1) {
  return new LineCommand(new Point(x0, y0), new Point(x1, y1));
}

function bezier(x0, y0, x1, y1, x2, y2, x3, y3) {
  return new BezierCurveCommand(
    new Point(x0, y0),
    new Point(x1, y1),
    new Point(x2, y2),
    new Point(x3, y3));
}
