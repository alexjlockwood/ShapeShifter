import * as paper from 'paper';

/**
 * Executes a standard selection mode hit test.
 */
export function selectionMode(point: paper.Point, matchFn?: (result: paper.HitResult) => boolean) {
  return paper.project.hitTest(point, {
    fill: true,
    stroke: true,
    match: matchFn,
  });
}
