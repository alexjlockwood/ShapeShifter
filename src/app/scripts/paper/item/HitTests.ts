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
  const localPoint = focusedPath.globalToLocal(projPoint);
  return focusedPath.hitTest(localPoint, {
    fill: true,
    stroke: true,
    class: paper.Path,
  });
}

/**
 * Performs a hit test on the current focused path's curves.
 */
export function focusedPathModeCurves(projPoint: paper.Point, focusedPath: paper.Path) {
  const localPoint = focusedPath.globalToLocal(projPoint);
  return focusedPath.hitTest(localPoint, {
    // TODO: remove 'stroke' (it won't work with paths with no stroke widths)
    stroke: true,
    // TODO: this currently doesnt work for some reason... investigate
    curves: true,
    // TODO: reenable this or no?
    // class: paper.Path,
  });
}

/**
 * Performs a hit test on the current focused path's segments and handles.
 */
export function focusedPathModeSegmentsAndHandles(projPoint: paper.Point) {
  const pl = paper.project.activeLayer as PaperLayer;
  return pl.hitTest(projPoint, { class: FocusedPathRaster });
}
