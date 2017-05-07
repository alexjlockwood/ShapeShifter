import * as _ from 'lodash';
import { Path, PathUtil } from '../paths';
import { AbstractLayer, ConstructorArgs as AbstractConstructorArgs } from './AbstractLayer';
import { ColorUtil, MathUtil } from '../common';
import {
  Property, PathProperty, ColorProperty,
  FractionProperty, NumberProperty, EnumProperty,
} from '../properties';
import { Type } from './Layer';

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

  getType(): Type {
    return 'pathlayer';
  }

  clone<PathLayer>() {
    return new PathLayer({
      id: this.id,
      children: [],
      pathData: this.pathData.clone(),
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

  isStroked() {
    return !!this.strokeColor;
  }

  isFilled() {
    return !!this.fillColor;
  }

  interpolate(start: PathLayer, end: PathLayer, fraction: number) {
    this.pathData = PathUtil.interpolate(start.pathData, end.pathData, fraction);
    if (start.fillColor && end.fillColor) {
      this.fillColor = this.lerpColor(start.fillColor, end.fillColor, fraction);
    }
    this.fillAlpha = MathUtil.lerp(start.fillAlpha, end.fillAlpha, fraction);
    if (start.strokeColor && end.strokeColor) {
      this.strokeColor = this.lerpColor(start.strokeColor, end.strokeColor, fraction);
    }
    this.strokeAlpha = MathUtil.lerp(start.strokeAlpha, end.strokeAlpha, fraction);
    this.strokeWidth = MathUtil.lerp(start.strokeWidth, end.strokeWidth, fraction);
    this.trimPathStart = MathUtil.lerp(start.trimPathStart, end.trimPathStart, fraction);
    this.trimPathEnd = MathUtil.lerp(start.trimPathEnd, end.trimPathEnd, fraction);
    this.trimPathOffset = MathUtil.lerp(start.trimPathOffset, end.trimPathOffset, fraction);
  }

  private lerpColor(start: string, end: string, fraction: number) {
    const startColor = ColorUtil.parseAndroidColor(start);
    const endColor = ColorUtil.parseAndroidColor(end);
    return ColorUtil.toAndroidString({
      r: _.clamp(Math.round(MathUtil.lerp(startColor.r, endColor.r, fraction)), 0, 255),
      g: _.clamp(Math.round(MathUtil.lerp(startColor.g, endColor.g, fraction)), 0, 255),
      b: _.clamp(Math.round(MathUtil.lerp(startColor.b, endColor.b, fraction)), 0, 255),
      a: _.clamp(Math.round(MathUtil.lerp(startColor.a, endColor.a, fraction)), 0, 255)
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

