import { Layer, GroupLayer, ClipPathLayer, PathLayer } from '.';
import { Matrix } from '../common';

/**
 * Root class for all layer model classes.
 */
export abstract class AbstractLayer implements Layer {
  constructor(
    public readonly children: Array<GroupLayer | ClipPathLayer | PathLayer> | undefined,
    public readonly id: string,
  ) { }

  // Implements the Layer interface.
  findLayer(id: string): Layer | undefined {
    if (this.id === id) {
      return this;
    }
    if (this.children) {
      for (const child of this.children) {
        const layer = child.findLayer(id);
        if (layer) {
          return layer;
        }
      }
    }
    return undefined;
  }

  // Implements the Layer interface.
  abstract interpolate<T extends Layer>(start: T, end: T, fraction: number): void;

  // Implements the Layer interface.
  isMorphableWith(layer: Layer) {
    if (this.constructor !== layer.constructor) {
      return false;
    }
    if (this instanceof PathLayer || this instanceof ClipPathLayer) {
      return this.pathData.isMorphableWith((layer as PathLayer).pathData);
    }
    if (!this.children) {
      return true;
    }
    return this.children.length === layer.children.length
      && this.children.every((c, i) => c.isMorphableWith(layer.children[i]));
  }

  // Implements the Layer interface.
  walk(beforeFn: (layer: Layer, transforms?: Matrix[]) => void) {
    const visitFn = (layer: Layer, transforms: Matrix[] = []) => {
      transforms = transforms.slice();
      if (layer instanceof GroupLayer) {
        const cosr = Math.cos(layer.rotation * Math.PI / 180);
        const sinr = Math.sin(layer.rotation * Math.PI / 180);
        transforms.push(...[
          new Matrix(1, 0, 0, 1, layer.pivotX, layer.pivotY),
          new Matrix(1, 0, 0, 1, layer.translateX, layer.translateY),
          new Matrix(cosr, sinr, -sinr, cosr, 0, 0),
          new Matrix(layer.scaleX, 0, 0, layer.scaleY, 0, 0),
          new Matrix(1, 0, 0, 1, -layer.pivotX, -layer.pivotY)
        ]);
      }
      beforeFn(layer, transforms);
      if (layer.children) {
        layer.children.forEach(l => visitFn(l, transforms));
      }
    };
    visitFn(this);
  }
}
