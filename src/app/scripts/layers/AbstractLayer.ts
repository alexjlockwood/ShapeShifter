import { PathCommand } from '../commands';
import { Layer, GroupLayer, ClipPathLayer, PathLayer } from '.';
import { Matrix } from '../common';

/**
 * Root class for all layer model classes. Primarily for code reuse.
 */
export abstract class AbstractLayer implements Layer {
  constructor(
    public children: (GroupLayer | ClipPathLayer | PathLayer)[] | undefined,
    public id: string,
  ) { }

  // Implements the Layer interface.
  findLayerById(id: string): Layer | undefined {
    if (this.id === id) {
      return this;
    }
    if (this.children) {
      for (const child of this.children) {
        const layer = child.findLayerById(id);
        if (layer) {
          return layer;
        }
      }
    }
    return undefined;
  }

  // Implements the Layer interface.
  isStructurallyIdenticalWith(layer: Layer) {
    if (this.constructor !== layer.constructor) {
      return false;
    }
    if (this.id !== layer.id) {
      // TODO: update svgloader to remove already existing SVG ids? important!!!
      return false;
    }
    // TODO: what about vector layers with differently sized viewports?
    if (!this.children) {
      return true;
    }
    return this.children.length === layer.children.length
      && this.children.every((c, i) =>
        c.isStructurallyIdenticalWith(layer.children[i]));
  }

  // Implements the Layer interface.
  isMorphableWith(layer: Layer) {
    if (this.constructor !== layer.constructor) {
      return false;
    }
    if (this.id !== layer.id) {
      // TODO: update svgloader to remove already existing SVG ids? important!!!
      return false;
    }
    if (this instanceof PathLayer) {
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
