import { SvgPathData } from './svgpathdata';
import { Matrix } from './mathutil';


export interface Layer {
  parent: Layer | null;
  children: Layer[] | null;
  id: string;
  remove();
  replace(layer: Layer);
  findLayerById(id: string): Layer | null;
  isStructurallyIdenticalWith(layer: Layer): boolean;
  isMorphableWith(layer: Layer): boolean;
}

abstract class AbstractLayer implements Layer {
  private parent_: Layer | null;

  constructor(
    public children: Layer[] | null,
    public id: string,
  ) { }

  set parent(parent: Layer | null) {
    this.parent_ = parent;
  }

  get parent() {
    return this.parent_;
  }

  remove() {
    if (!this.parent || !this.parent.children) {
      console.warn('Attempt to remove a layer with no parent or a parent with no children');
      return;
    }
    const index = this.parent.children.indexOf(this);
    if (index < 0) {
      console.warn('Failed to remove layer');
      return;
    }
    this.parent.children.splice(index, 1);
    this.parent = null;
  }

  replace(layer: Layer) {
    if (!this.parent || !this.parent.children) {
      console.warn('Attempt to replace a layer with no parent or a parent with no children');
      return;
    }
    const index = this.parent.children.indexOf(this);
    if (index < 0) {
      console.warn('Failed to replace layer');
      return;
    }
    this.parent.children[index] = layer;
    layer.parent = this.parent;
    this.parent = null;
  }

  findLayerById(id: string): Layer | null {
    if (this.id === id) {
      return this;
    }
    if (this.children) {
      for (let i = 0; i < this.children.length; i++) {
        const layer = this.children[i].findLayerById(id);
        if (layer) {
          return layer;
        }
      }
    }
    return null;
  }

  isStructurallyIdenticalWith(layer: Layer) {
    if (this.constructor !== layer.constructor || this.id !== layer.id) {
      return false;
    }
    if (this instanceof VectorLayer || this instanceof GroupLayer) {
      return this.children.length === layer.children.length
        && this.children.every((c, i) => c.isStructurallyIdenticalWith(layer.children[i]));
    }
    return true;
  }

  isMorphableWith(layer: Layer) {
    if (this.constructor !== layer.constructor || this.id !== layer.id) {
      return false;
    }
    if (this instanceof VectorLayer || this instanceof GroupLayer) {
      return this.children.length === layer.children.length
        && this.children.every((c, i) => c.isMorphableWith(layer.children[i]));
    }
    if (this instanceof PathLayer) {
      const cmds1 = this.pathData.commands;
      const cmds2 = (layer as PathLayer).pathData.commands;
      if (cmds1.length !== cmds2.length) {
        return false;
      }
      return cmds1.every((c, i) => c.constructor === cmds2[i].constructor);
    }
    return true;
  }
}

export class PathLayer extends AbstractLayer {
  constructor(
    id: string,
    public pathData: SvgPathData,
    public fillColor: string | null,
    public fillAlpha = 1,
    public strokeColor: string | null,
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

export class ClipPathLayer extends AbstractLayer {
  constructor(
    id: string,
    public pathData: SvgPathData,
  ) {
    super(null, id);
  }
}

export class GroupLayer extends AbstractLayer {
  constructor(
    children: Layer[] | null,
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

  toMatrices() {
    const cosr = Math.cos(this.rotation * Math.PI / 180);
    const sinr = Math.sin(this.rotation * Math.PI / 180);
    return [
      new Matrix(1, 0, 0, 1, this.pivotX, this.pivotY),
      new Matrix(1, 0, 0, 1, this.translateX, this.translateY),
      new Matrix(cosr, sinr, -sinr, cosr, 0, 0),
      new Matrix(this.scaleX, 0, 0, this.scaleY, 0, 0),
      new Matrix(1, 0, 0, 1, -this.pivotX, -this.pivotY)
    ];
  }
}

export class VectorLayer extends AbstractLayer {
  constructor(
    children: Layer[] | null,
    id: string,
    public width = 0,
    public height = 0,
    public alpha = 1,
  ) {
    super(children || [], id);
  }

  get parent() {
    return null;
  }

  set parent(layer: Layer) {
    console.warn('Attempt to set a parent on a VectorLayer');
  }
}
