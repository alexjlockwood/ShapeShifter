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
    if (current.name === layerId) {
      return _.flatMap(parents, layer => {
        if (layer instanceof GroupLayer) {
          const l = layer as GroupLayer;
          return [
            Matrix.fromTranslation(l.pivotX, l.pivotY),
            Matrix.fromTranslation(l.translateX, l.translateY),
            Matrix.fromRotation(l.rotation),
            Matrix.fromScaling(l.scaleX, l.scaleY),
            Matrix.fromTranslation(-l.pivotX, -l.pivotY),
          ];
        }
        return [];
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

  vl1 = vl1.deepClone();
  vl2 = vl2.deepClone();

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
        ids.push(layer.name);
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

export function addLayerToTree(
  root: VectorLayer,
  addedLayerParentId: string,
  addedLayer: Layer,
  childIndex: number,
) {
  return (function recurseFn(curr: Layer) {
    if (curr.id === addedLayerParentId) {
      // If we have reached the added layer's parent, then
      // clone the parent, insert the new layer into its list
      // of children, and return the new parent node.
      const children = curr.children.slice();
      children.splice(childIndex, 0, addedLayer);
      curr = curr.clone();
      curr.children = children;
      return curr;
    }
    for (let i = 0; i < curr.children.length; i++) {
      const clonedChild = recurseFn(curr.children[i]);
      if (clonedChild) {
        // Then clone the current layer, insert the cloned child
        // into its list of children, and return the cloned current layer.
        const children = curr.children.slice();
        children[i] = clonedChild;
        curr = curr.clone();
        curr.children = children;
        return curr;
      }
    }
    return undefined;
  })(root) as VectorLayer;
}

export function removeLayerFromTree(vl: VectorLayer, removedLayerId: string) {
  return (function recurseFn(curr: Layer) {
    if (curr.id === removedLayerId) {
      return undefined;
    }
    const children = _.flatMap(curr.children, child => {
      const clonedChild = recurseFn(child);
      return clonedChild ? [clonedChild] : [];
    });
    curr = curr.clone();
    curr.children = children;
    return curr;
  })(vl) as VectorLayer;
}

export function replaceLayerInTree(
  root: VectorLayer,
  replacement: Layer,
) {
  return (function recurseFn(curr: Layer) {
    if (curr.id === replacement.id) {
      return replacement;
    }
    curr = curr.clone();
    curr.children = curr.children.map(child => recurseFn(child));
    return curr;
  })(root) as VectorLayer;
}

export function findLayerById(vls: ReadonlyArray<VectorLayer>, layerId: string) {
  for (const vl of vls) {
    const layer = vl.findLayerById(layerId);
    if (layer) {
      return layer;
    }
  }
  return undefined;
}

export function findLayerByName(vls: ReadonlyArray<VectorLayer>, layerName: string) {
  for (const vl of vls) {
    const layer = vl.findLayerByName(layerName);
    if (layer) {
      return layer;
    }
  }
  return undefined;
}

export function findParent(vls: ReadonlyArray<VectorLayer>, layerId: string) {
  for (const vl of vls) {
    const result =
      (function recurseFn(curr: Layer, parent?: Layer): Layer {
        if (curr.id === layerId) {
          return parent;
        }
        for (const child of curr.children) {
          const p = recurseFn(child, curr);
          if (p) {
            return p;
          }
        }
        return undefined;
      })(vl);
    if (result) {
      return result;
    }
  }
  return undefined;
}

export function findParentVectorLayer(vls: ReadonlyArray<VectorLayer>, layerId: string) {
  for (const vl of vls) {
    if (vl.findLayerById(layerId)) {
      return vl;
    }
  }
  return undefined;
}

export function findNextSibling(vls: ReadonlyArray<VectorLayer>, layerId: string) {
  const parent = findParent(vls, layerId);
  return findSibling(layerId, parent, 1);
}

export function findPreviousSibling(vls: ReadonlyArray<VectorLayer>, layerId: string) {
  const parent = findParent(vls, layerId);
  return findSibling(layerId, parent, -1);
}

function findSibling(layerId: string, parent: Layer, offset: number) {
  if (!parent || !parent.children) {
    return undefined;
  }
  let index = _.findIndex(parent.children, c => c.id === layerId);
  if (index < 0) {
    return undefined;
  }
  index += offset;
  if (index < 0 || parent.children.length <= index) {
    return undefined;
  }
  return parent.children[index];
}
