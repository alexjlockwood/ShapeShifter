import { IPathCommand } from './commands';

/**
 * Interface that is shared amongst all vector drawable layer model types.
 */
export interface Layer {

  /** This layers children layers, or null if none exist. */
  children: Layer[] | null;

  /** A string uniquely identifying this layer in its containing tree. */
  id: string;

  /** Returns the first descendent layer with the specified ID. */
  findLayerById(id: string): Layer | null;

  /** Returns true iff this layer is structurally identical with the corresponding layer. */
  isStructurallyIdenticalWith(layer: Layer): boolean;

  /** Returns true iff this layer is morphable with the corresponding layer. */
  isMorphableWith(layer: Layer): boolean;

  /** Walks the layer tree, executing beforeFunc on each node using a preorder traversal. */
  walk(beforeFunc: (layer: Layer) => void): void;
}

/**
 * Root class for all layer model classes. Primarily used for code reuse.
 */
abstract class AbstractLayer implements Layer {
  constructor(
    public children: Layer[] | null,
    public id: string,
  ) { }

  // Overrides the Layer interface.
  findLayerById(id: string): Layer | null {
    if (this.id === id) {
      return this;
    }
    if (this.children) {
      for (let child of this.children) {
        const layer = child.findLayerById(id);
        if (layer) {
          return layer;
        }
      }
    }
    return null;
  }

  // Overrides the Layer interface.
  isStructurallyIdenticalWith(layer: Layer) {
    if (this.constructor !== layer.constructor || this.id !== layer.id) {
      return false;
    }
    if (!this.children) {
      return true;
    }
    return this.children.length === layer.children.length
      && this.children.every((c, i) => c.isStructurallyIdenticalWith(layer.children[i]));
  }

  // Overrides the Layer interface.
  isMorphableWith(layer: Layer) {
    if (this.constructor !== layer.constructor || this.id !== layer.id) {
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

  // Overrides the Layer interface.
  walk(beforeFunc: (layer: Layer) => void) {
    const visit = (layer: Layer) => {
      beforeFunc(layer);
      if (layer.children) {
        layer.children.forEach(l => visit(l));
      }
    };
    visit(this);
  }
}

/**
 * Model object that mirrors the VectorDrawable's '<path>' element.
 */
export class PathLayer extends AbstractLayer {
  constructor(
    id: string,
    public pathData: IPathCommand,
    public fillColor: string | null = null,
    public fillAlpha = 1,
    public strokeColor: string | null = null,
    public strokeAlpha = 1,
    public strokeWidth = 0,
    public strokeLinecap = 'butt',
    public strokeLinejoin = 'miter',
    public strokeMiterLimit = 4,
    public trimPathStart = 0,
    public trimPathEnd = 1,
    public trimPathOffset = 0,
  ) {
    super(null, id);
  }
}

/**
 * Model object that mirrors the VectorDrawable's '<clip-path>' element.
 */
export class ClipPathLayer extends AbstractLayer {
  constructor(
    id: string,
    public pathData: IPathCommand,
  ) {
    super(null, id);
  }
}

/**
 * Model object that mirrors the VectorDrawable's '<group>' element.
 */
export class GroupLayer extends AbstractLayer {
  constructor(
    children: Layer[],
    id: string,
    public pivotX = 0,
    public pivotY = 0,
    public rotation = 0,
    public scaleX = 1,
    public scaleY = 1,
    public translateX = 0,
    public translateY = 0,
  ) {
    super(children || [], id);
  }
}

/**
 * Model object that mirrors the VectorDrawable's '<vector>' element.
 */
export class VectorLayer extends AbstractLayer {
  constructor(
    children: Layer[],
    id: string,
    public width = 0,
    public height = 0,
    public alpha = 1,
  ) {
    super(children || [], id);
  }
}
