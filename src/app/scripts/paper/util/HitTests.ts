import * as paper from 'paper';

import * as Items from './Items';

export function selectionBoundsPivot(selectionBounds: paper.Path.Rectangle, point: paper.Point) {
  return selectionBounds.hitTest(point, {
    segments: true,
    tolerance: 8 / paper.view.zoom,
  });
}

export function selectionMode(point: paper.Point, matchFn?: (result: paper.HitResult) => boolean) {
  return paper.project.activeLayer.hitTest(point, {
    stroke: true,
    fill: true,
    tolerance: 8 / paper.view.zoom,
    match: matchFn,
  });
}

export function editPathMode(selectedEditPath: paper.Path, point: paper.Point) {
  return selectedEditPath.hitTest(point, {
    segments: true,
    curves: true,
    handles: true,
    stroke: true,
    tolerance: 8 / paper.view.zoom,
  });
}
