import { Path } from 'app/model/paths';
import {
  ColorProperty,
  EnumProperty,
  FractionProperty,
  NumberProperty,
  PathProperty,
  Property,
} from 'app/model/properties';
import * as _ from 'lodash';

import { Layer, ConstructorArgs as LayerConstructorArgs } from './Layer';
import { MorphableLayer } from './MorphableLayer';

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

const DEFAULTS = {
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

  constructor(obj: ConstructorArgs) {
    super(obj);
    const setterFn = (num: number, def: number) => (_.isNil(num) ? def : num);
    this.pathData = obj.pathData;
    this.fillColor = obj.fillColor || DEFAULTS.fillColor;
    this.fillAlpha = setterFn(obj.fillAlpha, DEFAULTS.fillAlpha);
    this.strokeColor = obj.strokeColor || DEFAULTS.strokeColor;
    this.strokeAlpha = setterFn(obj.strokeAlpha, DEFAULTS.strokeAlpha);
    this.strokeWidth = setterFn(obj.strokeWidth, DEFAULTS.strokeWidth);
    this.strokeLinecap = obj.strokeLinecap || DEFAULTS.strokeLinecap;
    this.strokeLinejoin = obj.strokeLinejoin || DEFAULTS.strokeLinejoin;
    this.strokeMiterLimit = setterFn(obj.strokeMiterLimit, DEFAULTS.strokeMiterLimit);
    this.trimPathStart = setterFn(obj.trimPathStart, DEFAULTS.trimPathStart);
    this.trimPathEnd = setterFn(obj.trimPathEnd, DEFAULTS.trimPathEnd);
    this.trimPathOffset = setterFn(obj.trimPathOffset, DEFAULTS.trimPathOffset);
    this.fillType = obj.fillType || DEFAULTS.fillType;
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
    Object.entries(DEFAULTS).forEach(([key, value]) => {
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
export interface ConstructorArgs extends LayerConstructorArgs, PathLayerArgs {}

export type StrokeLineCap = 'butt' | 'square' | 'round';
export type StrokeLineJoin = 'miter' | 'round' | 'bevel';
export type FillType = 'nonZero' | 'evenOdd';
