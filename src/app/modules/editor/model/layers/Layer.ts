import { Path } from 'app/modules/editor/model/paths';
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
} from 'app/modules/editor/model/properties';
import { MathUtil, Matrix, Rect } from 'app/modules/editor/scripts/common';
import { isNil, uniqueId } from 'lodash-es';
type Type = 'vector' | 'group' | 'mask' | 'path';

/**
 * Interface that is shared by all vector drawable layer models below.
 */
export abstract class Layer implements Inspectable, Animatable {
  /**
   * A non-user-visible string that uniquely identifies this layer in the tree.
   */
  id: string;

  /**
   * A user-visible string uniquely identifying this layer in the tree. This value
   * can be renamed, as long as it doesn't conflict with other layers in the tree.
   */
  declare name: string;

  /**
   * This layers children list of layers.
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
    this.id = obj.id || uniqueId();
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
Property.register(new NameProperty('name'))(Layer);

// TODO: share this interface with Layer?
interface LayerArgs {
  id?: string;
  name: string;
  children: ReadonlyArray<Layer>;
}

export interface Layer extends Required<LayerArgs>, Inspectable, Animatable {}
export interface LayerConstructorArgs extends LayerArgs {}

/** Returns the layer, or builds one from its JSON. */
function load(obj: any): Layer {
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
  alpha: 1,
};

/**
 * Model object that mirrors the VectorDrawable's '<vector>' element.
 */
export class VectorLayer extends Layer {
  // @Override
  readonly type = 'vector';

  constructor(obj = { children: [], name: 'vector' } as VectorConstructorArgs) {
    super(obj);
    const setterFn = (num: number | undefined, def: number) => (isNil(num) ? def : num);
    this.canvasColor = obj.canvasColor || VECTOR_DEFAULTS.canvasColor;
    this.width = setterFn(obj.width, 24);
    this.height = setterFn(obj.height, 24);
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
    deleteDefaults(obj, VECTOR_DEFAULTS);
    return obj;
  }
}
Property.register(
  new ColorProperty('canvasColor'),
  new NumberProperty('width', { isAnimatable: false, min: 1, isInteger: true }),
  new NumberProperty('height', { isAnimatable: false, min: 1, isInteger: true }),
  new FractionProperty('alpha', { isAnimatable: true }),
)(VectorLayer);

interface VectorLayerArgs {
  canvasColor?: string;
  width?: number;
  height?: number;
  alpha?: number;
}

export interface VectorLayer extends Layer, Required<VectorLayerArgs> {}
export interface VectorConstructorArgs extends LayerConstructorArgs, VectorLayerArgs {}

/**
 * The transform that groups have, and paths too, in the coordinates of the layer's parent.
 */
export interface Transform {
  rotation: number;
  scaleX: number;
  scaleY: number;
  pivotX: number;
  pivotY: number;
  translateX: number;
  translateY: number;
}

/** A transform that changes nothing. */
export const TRANSFORM_DEFAULTS: Readonly<Transform> = {
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  pivotX: 0,
  pivotY: 0,
  translateX: 0,
  translateY: 0,
};

/** The names of a transform's properties, which groups and paths share. */
export const TRANSFORM_PROPERTY_NAMES = Object.keys(TRANSFORM_DEFAULTS) as ReadonlyArray<
  keyof Transform
>;

/** The transform's properties, to register on a layer type that has them. */
function transformProperties() {
  return [
    new NumberProperty('rotation', { isAnimatable: true }),
    new NumberProperty('scaleX', { isAnimatable: true }),
    new NumberProperty('scaleY', { isAnimatable: true }),
    new NumberProperty('pivotX', { isAnimatable: true }),
    new NumberProperty('pivotY', { isAnimatable: true }),
    new NumberProperty('translateX', { isAnimatable: true }),
    new NumberProperty('translateY', { isAnimatable: true }),
  ];
}

/**
 * Sets the layer's transform from its constructor's arguments, with defaults for what's missing or
 * isn't a number (e.g. in a hand-edited file), since one bad value would hide the whole layer.
 */
function initTransform(layer: Transform, obj: Partial<Transform>) {
  for (const key of TRANSFORM_PROPERTY_NAMES) {
    layer[key] = obj[key] ?? TRANSFORM_DEFAULTS[key];
    if (!Number.isFinite(layer[key])) {
      layer[key] = TRANSFORM_DEFAULTS[key];
    }
  }
}

/**
 * Returns the transform's matrices, which map the layer's coordinates to its parent's, in the order
 * they're multiplied: first the negative pivot, then the scale, the rotation, the translation, and
 * the pivot. A point is transformed by the last one first, which is why they appear reversed.
 */
export function getTransformMatrices(t: Readonly<Transform>) {
  return [
    Matrix.translation(t.pivotX, t.pivotY),
    Matrix.translation(t.translateX, t.translateY),
    Matrix.rotation(t.rotation),
    Matrix.scaling(t.scaleX, t.scaleY),
    Matrix.translation(-t.pivotX, -t.pivotY),
  ];
}

/** Returns the matrix that maps the layer's coordinates to its parent's. */
export function getTransformMatrix(t: Readonly<Transform>) {
  return Matrix.flatten(getTransformMatrices(t));
}

/**
 * Returns whether the transform's values move anything: its rotation, scale, or translation isn't
 * the default. A pivot alone doesn't, since it only says where the others happen.
 */
export function isTransformed(t: Readonly<Transform>) {
  return (
    t.rotation !== TRANSFORM_DEFAULTS.rotation ||
    t.scaleX !== TRANSFORM_DEFAULTS.scaleX ||
    t.scaleY !== TRANSFORM_DEFAULTS.scaleY ||
    t.translateX !== TRANSFORM_DEFAULTS.translateX ||
    t.translateY !== TRANSFORM_DEFAULTS.translateY
  );
}

/** Returns the box around the rect's corners, transformed by the matrix. */
function transformRect({ l, t, r, b }: Rect, matrix: Matrix): Rect {
  // All four corners, since a rotated box's extremes can be at any of them.
  const corners = [
    { x: l, y: t },
    { x: r, y: t },
    { x: r, y: b },
    { x: l, y: b },
  ].map(corner => MathUtil.transformPoint(corner, matrix));
  const xs = corners.map(c => c.x);
  const ys = corners.map(c => c.y);
  return { l: Math.min(...xs), t: Math.min(...ys), r: Math.max(...xs), b: Math.max(...ys) };
}

/** Removes the values that are the defaults from a layer's JSON, since loading puts them back. */
function deleteDefaults(obj: object, defaults: object) {
  Object.entries(defaults).forEach(([key, value]) => {
    if ((obj as any)[key] === value) {
      delete (obj as any)[key];
    }
  });
}

/**
 * Model object that mirrors the VectorDrawable's '<group>' element.
 */
export class GroupLayer extends Layer {
  // @Override
  readonly type = 'group';

  constructor(obj: GroupConstructorArgs) {
    super(obj);
    initTransform(this, obj);
  }

  // @Override
  get bounds() {
    let bounds: { l: number; t: number; r: number; b: number } | undefined;
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
    return bounds && transformRect(bounds, getTransformMatrix(this));
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
    deleteDefaults(obj, TRANSFORM_DEFAULTS);
    return obj;
  }
}
Property.register(...transformProperties())(GroupLayer);

export interface GroupLayer extends Layer, Transform {}
export interface GroupConstructorArgs extends LayerConstructorArgs, Partial<Transform> {}

/**
 * Model object that mirrors the VectorDrawable's '<clip-path>' element.
 */
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
Property.register(new PathProperty('pathData', { isAnimatable: true }))(ClipPathLayer);

interface ClipPathLayerArgs {
  // Undefined for a new layer that hasn't been given a path yet.
  pathData: Path | undefined;
}

export interface ClipPathLayer extends Layer, Required<ClipPathLayerArgs> {}
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
  ...TRANSFORM_DEFAULTS,
};

/**
 * Model object that mirrors the VectorDrawable's '<path>' element.
 */
export class PathLayer extends Layer implements MorphableLayer {
  // @Override
  readonly type = 'path';

  constructor(obj: PathConstructorArgs) {
    super(obj);
    const setterFn = (num: number | undefined, def: number) => (isNil(num) ? def : num);
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
    initTransform(this, obj);
  }

  // @Override
  get bounds() {
    if (!this.pathData) {
      return undefined;
    }
    const matrix = getTransformMatrix(this);
    // Tight, even for rotated curves, unlike the box around the path's own bounds.
    return matrix.equals(Matrix.identity())
      ? this.pathData.getBoundingBox()
      : this.pathData.mutate().transform(matrix).build().getBoundingBox();
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
      rotation: this.rotation,
      scaleX: this.scaleX,
      scaleY: this.scaleY,
      pivotX: this.pivotX,
      pivotY: this.pivotY,
      translateX: this.translateX,
      translateY: this.translateY,
    });
    deleteDefaults(obj, PATH_DEFAULTS);
    return obj;
  }

  isStroked() {
    return !!this.strokeColor;
  }

  isFilled() {
    return !!this.fillColor;
  }
}
// TODO: need to fix enum properties so they store/return strings instead of options?
Property.register(
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
  // Like a group's, so that a path can rotate and scale without being wrapped in one. The exports
  // wrap a path that uses them in a group (scripts/export/wrapPathTransforms.ts).
  ...transformProperties(),
)(PathLayer);

interface PathLayerArgs {
  // Undefined for a new layer that hasn't been given a path yet.
  pathData: Path | undefined;
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

export interface PathLayer extends Layer, Required<PathLayerArgs>, Transform {}
export interface PathConstructorArgs
  extends LayerConstructorArgs, PathLayerArgs, Partial<Transform> {}

export type StrokeLineCap = 'butt' | 'square' | 'round';
export type StrokeLineJoin = 'miter' | 'round' | 'bevel';
export type FillType = 'nonZero' | 'evenOdd';

/** Common interface for Layers with pathData properties. */
export interface MorphableLayer extends Layer {
  // Undefined for a new layer that hasn't been given a path yet.
  pathData: Path | undefined;
  isStroked(): boolean;
  isFilled(): boolean;
}
