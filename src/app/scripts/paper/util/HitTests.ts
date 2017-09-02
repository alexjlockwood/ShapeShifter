import * as paper from 'paper';

import * as Items from './Items';

/**
 * Executes a hit test in search of selection bound pivots.
 */
export function selectionBoundsPivot(selectionBounds: paper.Path.Rectangle, point: paper.Point) {
  return selectionBounds.hitTest(point, {
    segments: true,
    tolerance: 8 / paper.view.zoom,
  });
}

/**
 * Executes a standard selection mode hit test.
 */
export function selectionMode(point: paper.Point, matchFn?: (result: paper.HitResult) => boolean) {
  return paper.project.activeLayer.hitTest(point, {
    stroke: true,
    fill: true,
    tolerance: 8 / paper.view.zoom,
    match: matchFn,
  });
}

/**
 * Executes a standard edit path mode hit test.
 */
export function editPathMode(selectedEditPath: paper.Path, point: paper.Point) {
  return selectedEditPath.hitTest(point, {
    segments: true,
    curves: true,
    handles: true,
    stroke: true,
    tolerance: 8 / paper.view.zoom,
    match: (hitResult: paper.HitResult) => {
      // Don't return hits for handles belonging to un-selected segments.
      return !(
        (hitResult.type === 'handle-in' || hitResult.type === 'handle-out') &&
        !hitResult.segment.selected
      );
    },
  });
}
