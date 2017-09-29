import * as paper from 'paper';

import { FocusedPathRaster } from './FocusedPathRaster';
import { PaperLayer } from './PaperLayer';
import { SelectionBoundsRaster } from './SelectionBoundsRaster';

/**
 * Performs the default selection mode hit test.
 */
export function selectionMode(
  projPoint: paper.Point,
  extraOptions: Pick<paper.HitOptions, 'class' | 'match'> = {},
) {
  const pl = paper.project.activeLayer as PaperLayer;
  return pl.hitTest(projPoint, { fill: true, stroke: true, ...extraOptions });
}

/**
 * Performs a hit test on the currently selected selection bound handles.
 */
export function selectionModeSegments(projPoint: paper.Point) {
  const pl = paper.project.activeLayer as PaperLayer;
  return pl.hitTest(projPoint, { class: SelectionBoundsRaster });
}

/**
 * Performs a hit test on the current focused path.
 */
export function focusedPathMode(projPoint: paper.Point, focusedPath: paper.Path) {
  const { x: sx, y: sy } = focusedPath.globalMatrix.scaling;
  const result = focusedPath.hitTest(focusedPath.globalToLocal(projPoint), {
    fill: true,
    stroke: true,
    curves: true,
    // TODO: also test that this works when zoomed in/out?
    // TODO: are we correctly handling negative scales?
    tolerance: 8 / Math.max(Math.abs(sx), Math.abs(sy)),
    class: paper.Path,
  });
  return result;
}

/**
 * Performs a hit test on the current focused path's segments and handles.
 */
export function focusedPathModeSegmentsAndHandles(projPoint: paper.Point) {
  const pl = paper.project.activeLayer as PaperLayer;
  return pl.hitTest(projPoint, { class: FocusedPathRaster });
}
