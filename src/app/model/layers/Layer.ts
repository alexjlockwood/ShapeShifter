import { Path } from 'app/model/paths';
import {
  Animatable,
  ColorProperty,
  EnumProperty,
  FractionProperty,
  Inspectable,
  NameProperty,
  NumberProperty,
  PathProperty,
  Property,
} from 'app/model/properties';
import { MathUtil, Matrix, Rect } from 'app/scripts/common';
import * as _ from 'lodash';

type Type = 'vector' | 'group' | 'mask' | 'path';

/**
 * Interface that is shared by all vector drawable layer models below.
 */
@Property.register(new NameProperty('name'))
export abstract class Layer implements Inspectable, Animatable {
  /**
   * A non-user-visible string that uniquely identifies this layer in the tree.
   */
  id?: string;

  /**
   * A user-visible string uniquely identifying this layer in the tree. This value
   * can be renamed, as long as it doesn't conflict with other layers in the tree.
   */
  name: string;

  /**
   * This layers children layers, or undefined if none exist.
   */
  children: ReadonlyArray<Layer>;

  /**
   * Returns the Layer type. This string value should not change,
   * as it is used to identify the layer type and icon.
   */
  abstract type: Type;

  /**
   * Returns the bounding box for this Layer (or undefined if none exists).
   */
  abstract bounds: Rect | undefined;

  constructor(obj: LayerConstructorArgs) {
    this.id = obj.id || _.uniqueId();
    this.name = obj.name || '';
    this.children = (obj.children || []).map(child => load(child));
  }

  /**
   * Returns the first descendent layer with the specified id.
   */
  findLayerById(id: string): Layer | undefined {
    if (this.id === id) {
      return this;
    }
    for (const child of this.children) {
      const layer = child.findLayerById(id);
      if (layer) {
        return layer;
      }
    }
    return undefined;
  }

  /**
   * Returns the first descendent layer with the specified name.
   */
  findLayerByName(name: string): Layer | undefined {
    if (this.name === name) {
      return this;
    }
    for (const child of this.children) {
      const layer = child.findLayerByName(name);
      if (layer) {
        return layer;
      }
    }
    return undefined;
  }

  /**
   * Walks the layer tree, executing beforeFunc on each node using a
   * preorder traversal.
   */
  walk(beforeFn: (layer: Layer) => void) {
    const visitFn = (layer: Layer) => {
      beforeFn(layer);
      layer.children.forEach(l => visitFn(l));
    };
    visitFn(this);
  }

  /**
   * Returns the JSON representation of this layer.
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
    };
  }

  /**
   * Returns a shallow clone of this Layer.
   */
  abstract clone(): Layer;

  /**
   * Returns a deep clone of this Layer.
   */
  abstract deepClone(): Layer;
}

// TODO: share this interface with Layer?
interface LayerArgs {
  id?: string;
  name: string;
  children: ReadonlyArray<Layer>;
}

export interface Layer extends LayerArgs, Inspectable, Animatable {}
export interface LayerConstructorArgs extends LayerArgs {}

function load(obj: Layer | any): Layer {
  if (obj instanceof Layer) {
    return obj;
  }
  if (obj.type === 'vector') {
    return new VectorLayer(obj);
  }
  if (obj.type === 'group') {
    return new GroupLayer(obj);
  }
  if (obj.type === 'path') {
    return new PathLayer(obj);
  }
  if (obj.type === 'mask') {
    return new ClipPathLayer(obj);
  }
  console.error('Attempt to load layer with invalid object: ', obj);
  throw new Error('Attempt to load layer with invalid object');
}

const VECTOR_DEFAULTS = {
  canvasColor: '',
  width: 24,
  height: 24,
  alpha: 1,
};

/**
 * Model object that mirrors the VectorDrawable's '<vector>' element.
 */
@Property.register(
  new ColorProperty('canvasColor'),
  new NumberProperty('width', { isAnimatable: false, min: 1, isInteger: true }),
  new NumberProperty('height', { isAnimatable: false, min: 1, isInteger: true }),
  new FractionProperty('alpha', { isAnimatable: true }),
)
export class VectorLayer extends Layer {
  // @Override
  readonly type = 'vector';

  constructor(obj = { children: [], name: 'vector' } as VectorConstructorArgs) {
    super(obj);
    const setterFn = (num: number, def: number) => (_.isNil(num) ? def : num);
    this.canvasColor = obj.canvasColor || VECTOR_DEFAULTS.canvasColor;
    this.width = setterFn(obj.width, VECTOR_DEFAULTS.width);
    this.height = setterFn(obj.height, VECTOR_DEFAULTS.height);
    this.alpha = setterFn(obj.alpha, VECTOR_DEFAULTS.alpha);
  }

  // @Override
  get bounds() {
    return { l: 0, t: 0, r: this.width, b: this.height };
  }

  // @Override
  clone() {
    const clone = new VectorLayer(this);
    clone.children = [...this.children];
    return clone;
  }

  // @Override
  deepClone() {
    const clone = this.clone();
    clone.children = this.children.map(c => c.deepClone());
    return clone;
  }

  // @Override
  toJSON() {
    const obj = Object.assign(super.toJSON(), {
      canvasColor: this.canvasColor,
      width: this.width,
      height: this.height,
      alpha: this.alpha,
      children: this.children.map(child => child.toJSON()),
    });
    Object.entries(VECTOR_DEFAULTS).forEach(([key, value]) => {
      if (obj[key] === value) {
        delete obj[key];
      }
    });
    return obj;
  }
}

interface VectorLayerArgs {
  canvasColor?: string;
  width?: number;
  height?: number;
  alpha?: number;
}

export interface VectorLayer extends Layer, VectorLayerArgs {}
export interface VectorConstructorArgs extends LayerConstructorArgs, VectorLayerArgs {}

const GROUP_DEFAULTS = {
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  pivotX: 0,
  pivotY: 0,
  translateX: 0,
  translateY: 0,
};

/**
 * Model object that mirrors the VectorDrawable's '<group>' element.
 */
@Property.register(
  new NumberProperty('rotation', { isAnimatable: true }),
  new NumberProperty('scaleX', { isAnimatable: true }),
  new NumberProperty('scaleY', { isAnimatable: true }),
  new NumberProperty('pivotX', { isAnimatable: true }),
  new NumberProperty('pivotY', { isAnimatable: true }),
  new NumberProperty('translateX', { isAnimatable: true }),
  new NumberProperty('translateY', { isAnimatable: true }),
)
export class GroupLayer extends Layer {
  // @Override
  readonly type = 'group';

  constructor(obj: GroupConstructorArgs) {
    super(obj);
    const setterFn = (num: number, def: number) => (_.isNil(num) ? def : num);
    this.pivotX = setterFn(obj.pivotX, GROUP_DEFAULTS.pivotX);
    this.pivotY = setterFn(obj.pivotY, GROUP_DEFAULTS.pivotY);
    this.rotation = setterFn(obj.rotation, GROUP_DEFAULTS.rotation);
    this.scaleX = setterFn(obj.scaleX, GROUP_DEFAULTS.scaleX);
    this.scaleY = setterFn(obj.scaleY, GROUP_DEFAULTS.scaleY);
    this.translateX = setterFn(obj.translateX, GROUP_DEFAULTS.translateX);
    this.translateY = setterFn(obj.translateY, GROUP_DEFAULTS.translateY);
  }

  // @Override
  get bounds() {
    let bounds: { l: number; t: number; r: number; b: number };
    this.children.forEach(child => {
      const childBounds = child.bounds;
      if (!childBounds) {
        return;
      }
      if (bounds) {
        bounds.l = Math.min(childBounds.l, bounds.l);
        bounds.t = Math.min(childBounds.t, bounds.t);
        bounds.r = Math.max(childBounds.r, bounds.r);
        bounds.b = Math.max(childBounds.b, bounds.b);
      } else {
        bounds = { ...childBounds };
      }
    });
    if (!bounds) {
      return undefined;
    }
    bounds.l -= this.pivotX;
    bounds.t -= this.pivotY;
    bounds.r -= this.pivotX;
    bounds.b -= this.pivotY;
    const transforms = [
      Matrix.scaling(this.scaleX, this.scaleY),
      Matrix.rotation(this.rotation),
      Matrix.translation(this.translateX, this.translateY),
    ];
    const topLeft = MathUtil.transformPoint({ x: bounds.l, y: bounds.t }, ...transforms);
    const bottomRight = MathUtil.transformPoint({ x: bounds.r, y: bounds.b }, ...transforms);
    return {
      l: topLeft.x + this.pivotX,
      t: topLeft.y + this.pivotY,
      r: bottomRight.x + this.pivotX,
      b: bottomRight.y + this.pivotY,
    };
  }

  // @Override
  clone() {
    const clone = new GroupLayer(this);
    clone.children = [...this.children];
    return clone;
  }

  // @Override
  deepClone() {
    const clone = this.clone();
    clone.children = this.children.map(c => c.deepClone());
    return clone;
  }

  // @Override
  toJSON() {
    const obj = Object.assign(super.toJSON(), {
      rotation: this.rotation,
      scaleX: this.scaleX,
      scaleY: this.scaleY,
      pivotX: this.pivotX,
      pivotY: this.pivotY,
      translateX: this.translateX,
      translateY: this.translateY,
      children: this.children.map(child => child.toJSON()),
    });
    Object.entries(GROUP_DEFAULTS).forEach(([key, value]) => {
      if (obj[key] === value) {
        delete obj[key];
      }
    });
    return obj;
  }
}

interface GroupLayerArgs {
  pivotX?: number;
  pivotY?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  translateX?: number;
  translateY?: number;
}

export interface GroupLayer extends Layer, GroupLayerArgs {}
export interface GroupConstructorArgs extends LayerConstructorArgs, GroupLayerArgs {}

/**
 * Model object that mirrors the VectorDrawable's '<clip-path>' element.
 */
@Property.register(new PathProperty('pathData', { isAnimatable: true }))
export class ClipPathLayer extends Layer implements MorphableLayer {
  // @Override
  readonly type = 'mask';

  constructor(obj: ClipPathConstructorArgs) {
    super(obj);
    this.pathData = obj.pathData;
  }

  // @Override
  get bounds() {
    return this.pathData ? this.pathData.getBoundingBox() : undefined;
  }

  // @Override
  clone() {
    return new ClipPathLayer(this);
  }

  // @Override
  deepClone() {
    return this.clone();
  }

  // @Override
  toJSON() {
    return Object.assign(super.toJSON(), {
      pathData: this.pathData ? this.pathData.getPathString() : '',
    });
  }

  isStroked() {
    // TODO: this may be the case for Android... but does this limit what web/iOS devs can do?
    return false;
  }

  isFilled() {
    return true;
  }
}

interface ClipPathLayerArgs {
  pathData: Path;
}

export interface ClipPathLayer extends Layer, ClipPathLayerArgs {}
export interface ClipPathConstructorArgs extends LayerConstructorArgs, ClipPathLayerArgs {}

const ENUM_LINECAP_OPTIONS = [
  { value: 'butt', label: 'Butt' },
  { value: 'square', label: 'Square' },
  { value: 'round', label: 'Round' },
];

const ENUM_LINEJOIN_OPTIONS = [
  { value: 'miter', label: 'Miter' },
  { value: 'round', label: 'Round' },
  { value: 'bevel', label: 'Bevel' },
];

const ENUM_FILLTYPE_OPTIONS = [
  { value: 'nonZero', label: 'nonZero' },
  { value: 'evenOdd', label: 'evenOdd' },
];

const PATH_DEFAULTS = {
  fillColor: '',
  fillAlpha: 1,
  strokeColor: '',
  strokeAlpha: 1,
  strokeWidth: 0,
  strokeLinecap: 'butt' as StrokeLineCap,
  strokeLinejoin: 'miter' as StrokeLineJoin,
  strokeMiterLimit: 4,
  trimPathStart: 0,
  trimPathEnd: 1,
  trimPathOffset: 0,
  fillType: 'nonZero' as FillType,
};

/**
 * Model object that mirrors the VectorDrawable's '<path>' element.
 */
@Property.register(
  new PathProperty('pathData', { isAnimatable: true }),
  new ColorProperty('fillColor', { isAnimatable: true }),
  new FractionProperty('fillAlpha', { isAnimatable: true }),
  new ColorProperty('strokeColor', { isAnimatable: true }),
  new FractionProperty('strokeAlpha', { isAnimatable: true }),
  new NumberProperty('strokeWidth', { min: 0, isAnimatable: true }),
  new EnumProperty('strokeLinecap', ENUM_LINECAP_OPTIONS),
  new EnumProperty('strokeLinejoin', ENUM_LINEJOIN_OPTIONS),
  new NumberProperty('strokeMiterLimit', { min: 1 }),
  new FractionProperty('trimPathStart', { isAnimatable: true }),
  new FractionProperty('trimPathEnd', { isAnimatable: true }),
  new FractionProperty('trimPathOffset', { isAnimatable: true }),
  new EnumProperty('fillType', ENUM_FILLTYPE_OPTIONS),
) // TODO: need to fix enum properties so they store/return strings instead of options?
export class PathLayer extends Layer implements MorphableLayer {
  // @Override
  readonly type = 'path';

  constructor(obj: PathConstructorArgs) {
    super(obj);
    const setterFn = (num: number, def: number) => (_.isNil(num) ? def : num);
    this.pathData = obj.pathData;
    this.fillColor = obj.fillColor || PATH_DEFAULTS.fillColor;
    this.fillAlpha = setterFn(obj.fillAlpha, PATH_DEFAULTS.fillAlpha);
    this.strokeColor = obj.strokeColor || PATH_DEFAULTS.strokeColor;
    this.strokeAlpha = setterFn(obj.strokeAlpha, PATH_DEFAULTS.strokeAlpha);
    this.strokeWidth = setterFn(obj.strokeWidth, PATH_DEFAULTS.strokeWidth);
    this.strokeLinecap = obj.strokeLinecap || PATH_DEFAULTS.strokeLinecap;
    this.strokeLinejoin = obj.strokeLinejoin || PATH_DEFAULTS.strokeLinejoin;
    this.strokeMiterLimit = setterFn(obj.strokeMiterLimit, PATH_DEFAULTS.strokeMiterLimit);
    this.trimPathStart = setterFn(obj.trimPathStart, PATH_DEFAULTS.trimPathStart);
    this.trimPathEnd = setterFn(obj.trimPathEnd, PATH_DEFAULTS.trimPathEnd);
    this.trimPathOffset = setterFn(obj.trimPathOffset, PATH_DEFAULTS.trimPathOffset);
    this.fillType = obj.fillType || PATH_DEFAULTS.fillType;
  }

  // @Override
  get bounds() {
    return this.pathData ? this.pathData.getBoundingBox() : undefined;
  }

  // @Override
  clone() {
    return new PathLayer(this);
  }

  // @Override
  deepClone() {
    return this.clone();
  }

  // @Override
  toJSON() {
    const obj = Object.assign(super.toJSON(), {
      pathData: this.pathData ? this.pathData.getPathString() : '',
      fillColor: this.fillColor,
      fillAlpha: this.fillAlpha,
      strokeColor: this.strokeColor,
      strokeAlpha: this.strokeAlpha,
      strokeWidth: this.strokeWidth,
      strokeLinecap: this.strokeLinecap,
      strokeLinejoin: this.strokeLinejoin,
      strokeMiterLimit: this.strokeMiterLimit,
      trimPathStart: this.trimPathStart,
      trimPathEnd: this.trimPathEnd,
      trimPathOffset: this.trimPathOffset,
      fillType: this.fillType,
    });
    Object.entries(PATH_DEFAULTS).forEach(([key, value]) => {
      if (obj[key] === value) {
        delete obj[key];
      }
    });
    return obj;
  }

  isStroked() {
    return !!this.strokeColor;
  }

  isFilled() {
    return !!this.fillColor;
  }
}

interface PathLayerArgs {
  pathData: Path;
  fillColor?: string;
  fillAlpha?: number;
  strokeColor?: string;
  strokeAlpha?: number;
  strokeWidth?: number;
  strokeLinecap?: StrokeLineCap;
  strokeLinejoin?: StrokeLineJoin;
  strokeMiterLimit?: number;
  trimPathStart?: number;
  trimPathEnd?: number;
  trimPathOffset?: number;
  fillType?: FillType;
}

export interface PathLayer extends Layer, PathLayerArgs {}
export interface PathConstructorArgs extends LayerConstructorArgs, PathLayerArgs {}

export type StrokeLineCap = 'butt' | 'square' | 'round';
export type StrokeLineJoin = 'miter' | 'round' | 'bevel';
export type FillType = 'nonZero' | 'evenOdd';

/** Common interface for Layers with pathData properties. */
export interface MorphableLayer extends Layer {
  pathData: Path;
  isStroked(): boolean;
  isFilled(): boolean;
}
