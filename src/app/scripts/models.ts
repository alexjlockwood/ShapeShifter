import { SvgPathData } from './svgpathdata';

export interface Layer {
  children: Layer[] | null;
  id: string;
  clone<T extends Layer>(): T;
  findLayerById(id: string): Layer | null;
}

abstract class AbstractLayer implements Layer {
  constructor(
    public children: Layer[] | null,
    public id: string,
  ) { }

  abstract clone<T extends Layer>(): T;

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
}

export class PathLayer extends AbstractLayer {
  constructor(
    public id: string,
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

  clone<T extends Layer>(): PathLayer {
    return new PathLayer(
      this.id,
      new SvgPathData(this.pathData),
      this.fillColor,
      this.fillAlpha,
      this.strokeColor,
      this.strokeAlpha,
      this.strokeWidth,
      this.strokeLinecap,
      this.strokeLinejoin,
      this.strokeMiterLimit,
      this.trimPathStart,
      this.trimPathEnd,
      this.trimPathOffset);
  }
}

export class ClipPathLayer extends AbstractLayer {
  constructor(
    public id: string,
    public pathData: SvgPathData,
  ) {
    super(null, id);
  }

  clone<T extends Layer>() {
    return new ClipPathLayer(
      this.id,
      this.pathData);
  }
}

export class GroupLayer extends AbstractLayer {
  constructor(
    public children: Layer[] | null,
    public id: string,
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

  clone<T extends Layer>() {
    return new GroupLayer(
      this.children.map(c => c.clone()),
      this.id,
      this.pivotX,
      this.pivotY,
      this.rotation,
      this.scaleX,
      this.scaleY,
      this.translateX,
      this.translateY);
  }
}

export class VectorLayer extends AbstractLayer {
  constructor(
    public children: Layer[] | null,
    public id: string,
    public width = 0,
    public height = 0,
    public alpha = 1,
  ) {
    super(children || [], id);
  }

  clone<T extends Layer>() {
    return new VectorLayer(
      this.children.map(c => c.clone()),
      this.id,
      this.width,
      this.height,
      this.alpha);
  }
}
