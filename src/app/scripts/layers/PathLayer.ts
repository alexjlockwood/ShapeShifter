import { Path } from '../paths';
import {
  ColorProperty,
  EnumProperty,
  FractionProperty,
  NumberProperty,
  PathProperty,
  Property,
} from '../properties';
import {
  ConstructorArgs as AbstractConstructorArgs,
  AbstractLayer,
} from './AbstractLayer';

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
)
// TODO: need to fix enum properties so they store/return strings instead of options?
export class PathLayer extends AbstractLayer {

  constructor(obj: ConstructorArgs) {
    super(obj);
    this.pathData = obj.pathData;
    this.fillColor = obj.fillColor || '';
    this.fillAlpha = obj.fillAlpha || 1;
    this.strokeColor = obj.strokeColor || '';
    this.strokeAlpha = obj.strokeAlpha || 1;
    this.strokeWidth = obj.strokeWidth || 0;
    this.strokeLinecap = obj.strokeLinecap || 'butt';
    this.strokeLinejoin = obj.strokeLinejoin || 'miter';
    this.strokeMiterLimit = obj.strokeMiterLimit || 4;
    this.trimPathStart = obj.trimPathStart || 0;
    this.trimPathEnd = obj.trimPathEnd || 1;
    this.trimPathOffset = obj.trimPathOffset || 0;
    this.fillType = obj.fillType || 'nonZero';
  }

  getIconName() {
    return 'pathlayer';
  }

  getPrefix() {
    return 'path';
  }

  clone() {
    return new PathLayer(this);
  }

  deepClone() {
    return this.clone();
  }

  isStroked() {
    return !this.isFilled();
  }

  isFilled() {
    return !!this.fillColor;
  }

  getBoundingBox() {
    return this.pathData ? this.pathData.getBoundingBox() : undefined;
  }

  toJSON() {
    return Object.assign(super.toJSON(), {
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

export interface PathLayer extends AbstractLayer, PathLayerArgs { }
export interface ConstructorArgs extends AbstractConstructorArgs, PathLayerArgs { }

export type StrokeLineCap = 'butt' | 'square' | 'round';
export type StrokeLineJoin = 'miter' | 'round' | 'bevel';
export type FillType = 'nonZero' | 'evenOdd';
