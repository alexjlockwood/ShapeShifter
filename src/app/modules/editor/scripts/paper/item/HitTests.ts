import { Layer } from 'app/modules/editor/model/layers';
import { PaperService } from 'app/modules/editor/services';
import * as _ from 'lodash';
import * as paper from 'paper';

import { EditPathRaster } from './EditPathRaster';
import { HitResult, PaperLayer } from './PaperLayer';
import { RotateItemsPivotRaster } from './RotateItemsPivotRaster';
import { SelectionBoundsRaster } from './SelectionBoundsRaster';

/** Performs the default default mode hit test. */
export function selectionMode(projPoint: paper.Point, ps: PaperService) {
  const pl = paper.project.activeLayer as PaperLayer;
  const { children } = pl.hitTestVectorLayer(projPoint);
  const selectionMap = getSelectedLayerMap(ps);
  return findFirstHitResult(children, selectionMap);
}

/**
 * Returns a map of layerIds to booleans. Each key-value pair indicates whether
 * the subtree rooted at layerId contains a selected layer.
 */
export function getSelectedLayerMap(ps: PaperService) {
  const map = new Map<string, boolean>();
  const selectedLayers = ps.getSelectedLayerIds();
  (function containsSelectedLayerFn(layer: Layer) {
    let result = selectedLayers.has(layer.id);
    layer.children.forEach(c => (result = containsSelectedLayerFn(c) || result));
    map.set(layer.id, result);
    return result;
  })(ps.getVectorLayer());
  return map;
}

export function findFirstHitResult(
  hitResults: ReadonlyArray<HitResult>,
  selectionMap: Map<string, boolean>,
  ignoredLayerIds = new Set<string>(),
) {
  let firstHitResult: HitResult;
  _.forEach(hitResults, function recurseFn(hitResult: HitResult) {
    if (firstHitResult) {
      return false;
    }
    const hasSelectedChildLayer = (hitResult.hitItem.children || []).some(c =>
      selectionMap.get(c.data.id),
    );
    if (!hasSelectedChildLayer && !ignoredLayerIds.has(hitResult.hitItem.data.id)) {
      firstHitResult = hitResult;
      return false;
    }
    _.forEach(hitResult.children, recurseFn);
    return true;
  });
  return firstHitResult;
}

/** Performs a hit test on the currently selected selection bound handles. */
export function selectionModeSegments(projPoint: paper.Point) {
  const pl = paper.project.activeLayer as PaperLayer;
  return pl.hitTest(projPoint, { class: SelectionBoundsRaster });
}

/** Performs a hit test on the rotate items pivot. */
export function rotateItemsPivot(projPoint: paper.Point) {
  const pl = paper.project.activeLayer as PaperLayer;
  return pl.hitTest(projPoint, { class: RotateItemsPivotRaster });
}

/** Performs a hit test on the current edit path. */
export function editPathMode(
  projPoint: paper.Point,
  editPath: paper.Path,
  hitOptions: { fill?: boolean; stroke?: boolean; curves?: boolean },
) {
  const { x: sx, y: sy } = editPath.globalMatrix.scaling;
  const result = editPath.hitTest(editPath.globalToLocal(projPoint), {
    ...(hitOptions as paper.HitOptions),
    // TODO: properly calculate scale using similar method as in Matrix.ts
    // TODO: also test that this works when zoomed in/out?
    // TODO: are we correctly handling negative scales?
    tolerance: 8 / Math.max(Math.abs(sx), Math.abs(sy)),
    class: paper.Path,
  });
  return result;
}

/** Performs a hit test on the current edit path's segments and handles. */
export function editPathModeSegmentsAndHandles(projPoint: paper.Point) {
  const pl = paper.project.activeLayer as PaperLayer;
  return pl.hitTest(projPoint, { class: EditPathRaster });
}
