import { MathUtil, Point } from 'app/scripts/common';

import { Command } from './Command';
import { Path } from './Path';

/**
 * Interpolates between a start and end path using the specified fraction.
 *
 * TODO: make it possible to create 'stateless' paths (to save memory on animation frames).
 */
export function interpolate(start: Path, end: Path, fraction: number) {
  if (!start.isMorphableWith(end)) {
    throw new Error('Attempt to interpolate two unmorphable paths');
  }
  const newCommands: Command[] = [];
  start.getCommands().forEach((startCmd, i) => {
    const endCmd = end.getCommands()[i];
    const points: Point[] = [];
    for (let j = 0; j < startCmd.getPoints().length; j++) {
      const p1 = startCmd.getPoints()[j];
      const p2 = endCmd.getPoints()[j];
      if (p1 && p2) {
        // The 'start' point of the first Move command in a path
        // will be undefined. Skip it.
        const px = MathUtil.lerp(p1.x, p2.x, fraction);
        const py = MathUtil.lerp(p1.y, p2.y, fraction);
        points.push({ x: px, y: py });
      } else {
        points.push(undefined);
      }
    }
    // TODO: avoid re-generating unique ids on each animation frame.
    newCommands.push(new Command(startCmd.getSvgChar(), points));
  });
  return new Path(newCommands);
}

/**
 * Sorts a list of path ops in descending order.
 */
export function sortPathOps(ops: Array<{ subIdx: number; cmdIdx: number }>) {
  return ops.sort(({ subIdx: s1, cmdIdx: c1 }, { subIdx: s2, cmdIdx: c2 }) => {
    // Perform higher index splits first so that we don't alter the
    // indices of the lower index split operations.
    return s1 !== s2 ? s2 - s1 : c2 - c1;
  });
}

export function toStrokeDashArray(
  trimPathStart: number,
  trimPathEnd: number,
  trimPathOffset: number,
  pathLength: number,
) {
  // Calculate the visible fraction of the trimmed path. If trimPathStart
  // is greater than trimPathEnd, then the result should be the combined
  // length of the two line segments: [trimPathStart,1] and [0,trimPathEnd].
  let shownFraction = trimPathEnd - trimPathStart;
  if (trimPathStart > trimPathEnd) {
    shownFraction += 1;
  }
  // Calculate the dash array. The first array element is the length of
  // the trimmed path and the second element is the gap, which is the
  // difference in length between the total path length and the visible
  // trimmed path length.
  return [shownFraction * pathLength, (1 - shownFraction + 0.001) * pathLength];
}

export function toStrokeDashOffset(
  trimPathStart: number,
  trimPathEnd: number,
  trimPathOffset: number,
  pathLength: number,
) {
  // The amount to offset the path is equal to the trimPathStart plus
  // trimPathOffset. We mod the result because the trimmed path
  // should wrap around once it reaches 1.
  return pathLength * (1 - (trimPathStart + trimPathOffset) % 1);
}
