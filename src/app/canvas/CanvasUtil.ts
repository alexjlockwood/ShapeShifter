import { Matrix, Point } from '../scripts/common';
import { Command } from '../scripts/paths'

type Context = CanvasRenderingContext2D;

/**
 * Executes a series of canvas commands for a given path.
 */
export function executeCommands(
  ctx: Context,
  commands: ReadonlyArray<Command>,
  transform: Matrix,
) {
  ctx.save();
  const { a, b, c, d, e, f } = transform;
  ctx.transform(a, b, c, d, e, f);
  ctx.beginPath();

  if (commands.length === 1 && commands[0].getSvgChar() !== 'M') {
    ctx.moveTo(commands[0].getStart().x, commands[0].getStart().y);
  }

  let previousEndPoint: Point;
  commands.forEach(cmd => {
    const start = cmd.getStart();
    const end = cmd.getEnd();

    if (start && !start.equals(previousEndPoint)) {
      // This is to support the case where the list of commands
      // is size fragmented.
      ctx.moveTo(start.x, start.y);
    }

    if (cmd.getSvgChar() === 'M') {
      ctx.moveTo(end.x, end.y);
    } else if (cmd.getSvgChar() === 'L') {
      ctx.lineTo(end.x, end.y);
    } else if (cmd.getSvgChar() === 'Q') {
      ctx.quadraticCurveTo(
        cmd.getPoints()[1].x, cmd.getPoints()[1].y,
        cmd.getPoints()[2].x, cmd.getPoints()[2].y);
    } else if (cmd.getSvgChar() === 'C') {
      ctx.bezierCurveTo(
        cmd.getPoints()[1].x, cmd.getPoints()[1].y,
        cmd.getPoints()[2].x, cmd.getPoints()[2].y,
        cmd.getPoints()[3].x, cmd.getPoints()[3].y);
    } else if (cmd.getSvgChar() === 'Z') {
      if (start.equals(previousEndPoint)) {
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
