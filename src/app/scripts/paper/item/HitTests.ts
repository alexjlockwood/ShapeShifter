import * as paper from 'paper';

import { FocusedPathRaster } from './FocusedPathRaster';
import { PaperLayer } from './PaperLayer';
import { SelectionBoundsRaster } from './SelectionBoundsRaster';

/**
 * Performs the default selection mode hit test.
 */
export function selectionMode(
  projectPoint: paper.Point,
  extraOptions: Pick<paper.HitOptions, 'class' | 'match'> = {},
) {
  const pl = paper.project.activeLayer as PaperLayer;
  return pl.hitTest(projectPoint, { fill: true, stroke: true, ...extraOptions });
}

/**
 * Performs a hit test on the currently selected selection bound handles.
 */
export function selectionModeSegments(projectPoint: paper.Point) {
  const pl = paper.project.activeLayer as PaperLayer;
  return pl.hitTest(projectPoint, { class: SelectionBoundsRaster });
}

/**
 * Performs a hit test on the current focused path.
 */
export function focusedPathMode(projectPoint: paper.Point, focusedPath: paper.Path) {
  const localPoint = focusedPath.globalToLocal(projectPoint);
  return focusedPath.hitTest(localPoint, {
    fill: true,
    stroke: true,
    curves: true,
    class: paper.Path,
  });
}

/**
 * Performs a hit test on the current focused path's segments and handles.
 */
export function focusedPathModeSegmentsAndHandles(projectPoint: paper.Point) {
  const pl = paper.project.activeLayer as PaperLayer;
  return pl.hitTest(projectPoint, { class: FocusedPathRaster });
}
