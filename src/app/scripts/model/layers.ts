import { PathCommand } from './commands';
import { Matrix } from '../common';

/**
 * Interface that is shared by all vector drawable layer models below.
 */
export interface Layer {

  /** This layers children layers, or undefined if none exist. */
  children: (GroupLayer | ClipPathLayer | PathLayer)[] | undefined;

  /** A string uniquely identifying this layer in its tree. */
  id: string;

  /** Returns the first descendent layer with the specified ID. */
  findLayerById(id: string): Layer | undefined;

  /**
   * Returns true iff this layer is structurally identical with the
   * specified layer. Two layers are 'structurally identical' if they
   * have the same structure (i.e. each path has the same number of
   * parent group layers, each path has a corresponding path with the
   * same id in the other layer, etc.).
   */
  isStructurallyIdenticalWith(layer: Layer): boolean;

  /**
   * Returns true iff this layer is morphable with the specified layer. Two
   * paths are 'morphable' if they have the same number of SVG commands,
   * each in the same order and with the same number of point parameters.
   * Two layers are morphable if they are structurally identical and if
   * each pair of paths are morphable with each other.
   */
  isMorphableWith(layer: Layer): boolean;

  /**
   * Walks the layer tree, executing beforeFunc on each node using a
   * preorder traversal.
   */
  walk(
    beforeFn: (layer: Layer, transforms?: Matrix[]) => void,
    startingTransforms?: Matrix[]): void;
}

/**
 * Root class for all layer model classes. Primarily for code reuse.
 */
abstract class AbstractLayer implements Layer {
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
  walk(
    beforeFn: (layer: Layer, transforms?: Matrix[]) => void,
    startingTransforms: Matrix[] = []) {

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
    visitFn(this, startingTransforms);
  }
}

/**
 * Model object that mirrors the VectorDrawable's '<path>' element.
 */
export class PathLayer extends AbstractLayer {
  constructor(
    id: string,
    public pathData: PathCommand,
    public fillColor?: string,
    public fillAlpha = 1,
    public strokeColor?: string,
    public strokeAlpha = 1,
    public strokeWidth = 0,
    public strokeLinecap = 'butt',
    public strokeLinejoin = 'miter',
    public strokeMiterLimit = 4,
    // Trim paths are not currently used, but may be useful in the future.
    public trimPathStart = 0,
    public trimPathEnd = 1,
    public trimPathOffset = 0,
  ) {
    super(undefined, id);
  }
}

/**
 * Model object that mirrors the VectorDrawable's '<clip-path>' element.
 */
export class ClipPathLayer extends AbstractLayer {
  constructor(
    id: string,
    public pathData: PathCommand,
  ) {
    super(undefined, id);
  }
}

/**
 * Model object that mirrors the VectorDrawable's '<group>' element.
 */
export class GroupLayer extends AbstractLayer {
  constructor(
    children: Array<GroupLayer | ClipPathLayer | PathLayer>,
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
    children: Array<GroupLayer | ClipPathLayer | PathLayer>,
    id: string,
    public width = 0,
    public height = 0,
    public alpha = 1,
  ) {
    super(children || [], id);
  }

  clone(): VectorLayer {
    const cloneFn =
      (layer: GroupLayer | ClipPathLayer | PathLayer | VectorLayer) => {
        if (layer instanceof GroupLayer) {
          return new GroupLayer(
            layer.children.map(child => cloneFn(child)),
            layer.id,
            layer.pivotX,
            layer.pivotY,
            layer.rotation,
            layer.scaleX,
            layer.scaleY,
            layer.translateX,
            layer.translateY);
        }
        if (layer instanceof ClipPathLayer) {
          return new ClipPathLayer(layer.id, layer.pathData.clone());
        }
        if (layer instanceof PathLayer) {
          return new PathLayer(
            layer.id,
            layer.pathData.clone(),
            layer.fillColor,
            layer.fillAlpha,
            layer.strokeColor,
            layer.strokeAlpha,
            layer.strokeWidth,
            layer.strokeLinecap,
            layer.strokeLinejoin,
            layer.strokeMiterLimit,
            layer.trimPathStart,
            layer.trimPathEnd,
            layer.trimPathOffset);
        }
        return new VectorLayer(
          layer.children.map(child => cloneFn(child)),
          layer.id,
          layer.width,
          layer.height,
          layer.alpha);
      };
    return cloneFn(this);
  }
}
