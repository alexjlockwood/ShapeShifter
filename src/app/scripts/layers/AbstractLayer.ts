import { Layer, GroupLayer, ClipPathLayer, PathLayer, VectorLayer } from '.';

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
  walk(beforeFn: (layer: Layer) => void) {
    const visitFn = (layer: Layer) => {
      beforeFn(layer);
      if (layer.children) {
        layer.children.forEach(l => visitFn(l));
      }
    };
    visitFn(this);
  }

  // Implements the Layer interface.
  isPathLayer() {
    return this instanceof PathLayer;
  }

  // Implements the Layer interface.
  isClipPathLayer() {
    return this instanceof ClipPathLayer;
  }

  // Implements the Layer interface.
  isGroupLayer() {
    return this instanceof GroupLayer;
  }

  // Implements the Layer interface.
  isVectorLayer() {
    return this instanceof VectorLayer;
  }
}
