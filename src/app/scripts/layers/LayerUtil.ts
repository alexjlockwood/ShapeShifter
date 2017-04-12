import * as _ from 'lodash';
import { Layer, VectorLayer, GroupLayer, PathLayer, ClipPathLayer } from '.';
import { newPath } from '../paths';
import { Matrix } from '../common';

const PRECISION = 8;

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
 * Makes two vector layers with possibly different viewports compatible with each other.
 */
export function adjustVectorLayerDimensions(vl1: VectorLayer, vl2: VectorLayer) {
  if (!vl1 || !vl2) {
    return { vl1, vl2 };
  }

  vl1 = vl1.clone();
  vl2 = vl2.clone();

  let { width: w1, height: h1 } = vl1;
  let { width: w2, height: h2 } = vl2;
  const isMaxDimenFn = (n: number) => {
    return Math.max(w1, h1, w2, h2, n) === n;
  };

  let scale1 = 1, scale2 = 1;
  if (isMaxDimenFn(w1)) {
    scale2 = w1 / w2;
  } else if (isMaxDimenFn(h1)) {
    scale2 = h1 / h2;
  } else if (isMaxDimenFn(w2)) {
    scale1 = w2 / w1;
  } else {
    scale1 = h2 / h1;
  }

  if (isMaxDimenFn(w1) || isMaxDimenFn(h1)) {
    w1 = _.round(w1, PRECISION);
    h1 = _.round(h1, PRECISION);
    w2 = _.round(w2 * scale2, PRECISION);
    h2 = _.round(h2 * scale2, PRECISION);
  } else {
    w1 = _.round(w1 * scale1, PRECISION);
    h1 = _.round(h1 * scale1, PRECISION);
    w2 = _.round(w2, PRECISION);
    h2 = _.round(h2, PRECISION);
  }

  let tx1 = 0, ty1 = 0, tx2 = 0, ty2 = 0;
  if (w1 > w2) {
    tx2 = (w1 - w2) / 2;
  } else if (w1 < w2) {
    tx1 = (w2 - w1) / 2;
  } else if (h1 > h2) {
    ty2 = (h1 - h2) / 2;
  } else if (h1 < h2) {
    ty1 = (h2 - h1) / 2;
  }

  const transformLayerFn =
    (vl: VectorLayer, scale: number, tx: number, ty: number) => {
      const transforms = [
        Matrix.fromScaling(scale, scale),
        Matrix.fromTranslation(tx, ty),
      ];
      (function recurseFn(layer: Layer) {
        if (layer instanceof PathLayer || layer instanceof ClipPathLayer) {
          if (layer instanceof PathLayer && layer.isStroked()) {
            layer.strokeWidth *= scale;
          }
          layer.pathData = newPath(layer.pathData.getCommands().map(cmd => {
            return cmd.mutate().transform(transforms).build();
          }));
          return;
        }
        if (layer.children) {
          layer.children.forEach(l => {
            recurseFn(l);
          });
        }
      })(vl);
    };

  transformLayerFn(vl1, scale1, tx1, ty1);
  transformLayerFn(vl2, scale2, tx2, ty2);

  const newWidth = Math.max(w1, w2);
  const newHeight = Math.max(h1, h2);
  vl1.width = newWidth;
  vl2.width = newWidth;
  vl1.height = newHeight;
  vl2.height = newHeight;
  return { vl1, vl2 };
}

/**
 * Returns a list of all path IDs in this VectorLayer.
 * TODO: make this ignore deleted path IDs that are still in the vector layer
 */
export function getAllIds(
  vls: VectorLayer[],
  predicateFn = (layer: Layer) => { return true; }) {

  const ids: string[] = [];
  vls.forEach(vl => {
    (function recurseFn(layer: Layer) {
      if (predicateFn(layer)) {
        ids.push(layer.id);
      }
      if (layer.children) {
        layer.children.forEach(l => recurseFn(l));
      }
    })(vl);
  });
  return ids;
};

/**
 * Interpolates the properties of the specified layer and all of its children.
 * The specified layers are assumed to be structurally compatible with each other.
 */
export function deepInterpolate<T extends Layer>(start: T, preview: T, end: T, fraction: number) {
  if (!start.isMorphableWith(preview) || !preview.isMorphableWith(end)) {
    console.warn('Attempt to interpolate incompatible layers', start, preview, end);
    return;
  }
  const layers = [start, preview, end];
  if (layers.every(l => l instanceof PathLayer)
    || layers.every(l => l instanceof ClipPathLayer)
    || layers.every(l => l instanceof GroupLayer)
    || layers.every(l => l instanceof VectorLayer)) {
    preview.interpolate(start, end, fraction);
  }
  if (layers.every(l => !!l.children)) {
    preview.children.forEach((p, i) => {
      return deepInterpolate(start.children[i], p, end.children[i], fraction);
    });
  }
}
