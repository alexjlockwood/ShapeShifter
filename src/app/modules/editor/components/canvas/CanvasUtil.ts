import { Command } from 'app/modules/editor/model/paths';
import { MathUtil, Matrix, Point } from 'app/modules/editor/scripts/common';

type Context = CanvasRenderingContext2D;

/**
 * Executes a series of canvas commands for a given path.
 */
export function executeCommands(ctx: Context, commands: ReadonlyArray<Command>, transform: Matrix) {
  ctx.save();
  const { a, b, c, d, e, f } = transform;
  ctx.transform(a, b, c, d, e, f);
  ctx.beginPath();

  if (commands.length === 1 && commands[0].type !== 'M') {
    ctx.moveTo(commands[0].start.x, commands[0].start.y);
  }

  let previousEndPoint: Point;
  commands.forEach(cmd => {
    const start = cmd.start;
    const end = cmd.end;

    if (start && !MathUtil.arePointsEqual(start, previousEndPoint)) {
      // This is to support the case where the list of commands
      // is size fragmented.
      ctx.moveTo(start.x, start.y);
    }

    if (cmd.type === 'M') {
      ctx.moveTo(end.x, end.y);
    } else if (cmd.type === 'L') {
      ctx.lineTo(end.x, end.y);
    } else if (cmd.type === 'Q') {
      ctx.quadraticCurveTo(cmd.points[1].x, cmd.points[1].y, cmd.points[2].x, cmd.points[2].y);
    } else if (cmd.type === 'C') {
      ctx.bezierCurveTo(
        cmd.points[1].x,
        cmd.points[1].y,
        cmd.points[2].x,
        cmd.points[2].y,
        cmd.points[3].x,
        cmd.points[3].y,
      );
    } else if (cmd.type === 'Z') {
      if (MathUtil.arePointsEqual(start, previousEndPoint)) {
        ctx.closePath();
      } else {
        // This is to support the case where the list of commands
        // is size fragmented.
        ctx.lineTo(end.x, end.y);
      }
    }
    previousEndPoint = end;
  });
  ctx.restore();
}
