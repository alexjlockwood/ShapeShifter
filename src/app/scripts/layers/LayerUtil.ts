import * as _ from 'lodash';
import { Layer, VectorLayer, GroupLayer, PathLayer } from '.';
import { Matrix } from '../common';

/**
 * Returns a list of parent transforms for the specified layer ID. The transforms
 * are returned in top-down order (i.e. the transform for the layer's
 * immediate parent will be the very last matrix in the returned list). This
 * function returns undefined if the layer is not found in the vector layer.
 */
export function getTransformsForLayer(vectorLayer: VectorLayer, layerId: string) {
  const getTransformsFn = (parents: Layer[], current: Layer): Matrix[] => {
    if (current.id === layerId) {
      return _.flatMap(parents, layer => {
        if (!(layer instanceof GroupLayer)) {
          return [];
        }
        return [
          Matrix.fromTranslation(layer.pivotX, layer.pivotY),
          Matrix.fromTranslation(layer.translateX, layer.translateY),
          Matrix.fromRotation(layer.rotation),
          Matrix.fromScaling(layer.scaleX, layer.scaleY),
          Matrix.fromTranslation(-layer.pivotX, -layer.pivotY),
        ];
      });
    }
    if (current.children) {
      for (const child of current.children) {
        const transforms = getTransformsFn(parents.concat([current]), child);
        if (transforms) {
          return transforms;
        }
      }
    }
    return undefined;
  };
  return getTransformsFn([], vectorLayer);
}

/**
 * Returns a list of all path IDs in this VectorLayer.
 */
export function findExistingPathIds(vectorLayer: VectorLayer) {
  const ids: string[] = [];
  (function recurseFn(layer: Layer) {
    if (layer instanceof PathLayer) {
      ids.push(layer.id);
      return;
    }
    if (layer.children) {
      layer.children.forEach(l => recurseFn(l));
    }
  })(vectorLayer);
  return ids;
}
