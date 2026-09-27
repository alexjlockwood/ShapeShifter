import { Command } from 'app/modules/editor/model/paths';
import { MathUtil, Matrix, Point } from 'app/modules/editor/scripts/common';

import { CanvasCamera } from './CanvasCamera';

type Context = CanvasRenderingContext2D;

/**
 * Executes a series of canvas commands for a given path.
 */
export function executeCommands(ctx: Context, commands: ReadonlyArray<Command>, transform: Matrix) {
  ctx.save();
  const { a, b, c, d, e, f } = transform;
  ctx.transform(a, b, c, d, e, f);
  ctx.beginPath();

  if (commands.length === 1 && commands[0].type !== 'M' && commands[0].start) {
    ctx.moveTo(commands[0].start.x, commands[0].start.y);
  }

  let previousEndPoint: Point | undefined;
  commands.forEach(cmd => {
    const start = cmd.start;
    const end = cmd.end;

    if (start && (!previousEndPoint || !MathUtil.arePointsEqual(start, previousEndPoint))) {
      // This is to support the case where the list of commands
      // is size fragmented.
      ctx.moveTo(start.x, start.y);
    }

    if (cmd.type === 'M') {
      ctx.moveTo(end.x, end.y);
    } else if (cmd.type === 'L') {
      ctx.lineTo(end.x, end.y);
    } else if (cmd.type === 'Q') {
      const cp = cmd.points[1];
      if (cp) {
        ctx.quadraticCurveTo(cp.x, cp.y, end.x, end.y);
      }
    } else if (cmd.type === 'C') {
      const cp1 = cmd.points[1];
      const cp2 = cmd.points[2];
      if (cp1 && cp2) {
        ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
      }
    } else if (cmd.type === 'Z') {
      if (start && previousEndPoint && MathUtil.arePointsEqual(start, previousEndPoint)) {
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

/**
 * Sizes the canvas to cover the camera's panel. Resizing a canvas clears it and reallocates its
 * memory, so it's skipped when the size is the same, e.g. after a zoom.
 */
export function setCanvasSize(canvas: HTMLCanvasElement, camera: CanvasCamera) {
  const { w, h } = camera.getDeviceSize();
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  // The CSS size is rounded like the backing store, so that each device pixel in it maps to
  // exactly one on the screen.
  canvas.style.width = `${w / camera.pixelRatio}px`;
  canvas.style.height = `${h / camera.pixelRatio}px`;
}

/**
 * Clips the context to the artboard. The context must have no transform. The clip is rounded to
 * whole device pixels, so that the artboard's edges are sharp, like the edges of the canvas were
 * when it was the size of the artboard.
 */
export function clipToArtboard(ctx: Context, camera: CanvasCamera) {
  const { x, y, w, h } = camera.getArtboardRect();
  const { pixelRatio } = camera;
  ctx.beginPath();
  ctx.rect(
    Math.round(x * pixelRatio),
    Math.round(y * pixelRatio),
    Math.round(w * pixelRatio),
    Math.round(h * pixelRatio),
  );
  ctx.clip();
}
