import * as paper from 'paper';

export function selectionBoundsPivot(selectionBounds: paper.Path.Rectangle, point: paper.Point) {
  return selectionBounds.hitTest(point, {
    segments: true,
    tolerance: 8 / paper.view.zoom,
  });
}
