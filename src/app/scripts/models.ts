export interface Layer {
  children: Layer[] | null;
  id: string;
}

export abstract class AbstractLayer implements Layer {
  children: Layer[] | null;
  id: string;

  constructor(children: Layer[], id = '') { }
}

export class PathLayer extends AbstractLayer {
  pathData: string;
  fillColor: string | null;
  fillAlpha: number;
  strokeColor: string | null;
  strokeAlpha: number;
  strokeWidth: number;
  strokeLinecap: string;
  strokeLinejoin: string;
  strokeMiterLimit: number;

  constructor({
    id = '',
    pathData = '',
    fillColor,
    fillAlpha = 1,
    strokeColor,
    strokeAlpha = 1,
    strokeWidth = 0,
    strokeLinecap = 'butt',
    strokeLinejoin = 'miter',
    strokeMiterLimit = 4,
  }) {
    super(null, id);
  }
}

export class ClipPathLayer extends AbstractLayer {
  pathData: string;

  constructor({id = '', pathData = ''}) {
    super(null, id);
  }
}

export class GroupLayer extends AbstractLayer {

  constructor(children: Layer[] = [], {
    id = '',
  }) {
    super(children, id);
  }
}

export class VectorLayer extends AbstractLayer {
  width: number;
  height: number;
  alpha: number;

  constructor(children: Layer[] = [], {
    id = '',
    width = 0,
    height = 0,
    alpha = 1,
  }) {
    super(children, id);
  }
}
