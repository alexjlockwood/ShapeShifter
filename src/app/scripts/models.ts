import { SvgPathData } from './svgpathdata';

export interface Layer {
  children: Layer[] | null;
  id: string;
}

abstract class AbstractLayer implements Layer {
  constructor(
    public children: Layer[] | null,
    public id = '',
  ) { }
}

export class PathLayer extends AbstractLayer {
  constructor(
    public id = '',
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
    public id = '',
    public pathData: SvgPathData,
  ) {
    super(null, id);
  }
}

export class GroupLayer extends AbstractLayer {
  constructor(
    public children: Layer[] = [],
    public id = '',
    public pivotX = 0,
    public pivotY = 0,
    public rotation = 0,
    public scaleX = 1,
    public scaleY = 1,
    public translateX = 0,
    public translateY = 0,
  ) {
    super(children, id);
  }
}

export class VectorLayer extends AbstractLayer {
  constructor(
    public children: Layer[] = [],
    public id = '',
    public width = 0,
    public height = 0,
    public alpha = 1,
  ) {
    super(children, id);
  }
}
