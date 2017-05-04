import { Path, PathUtil } from '../paths';
import { AbstractLayer } from './AbstractLayer';
import { ColorUtil, MathUtil } from '../common';
import {
  Property, PathProperty, ColorProperty,
  FractionProperty, NumberProperty,
} from '../properties';

/**
 * Model object that mirrors the VectorDrawable's '<path>' element.
 */
@Property.register(
  new PathProperty('pathData', { animatable: true }),
  new ColorProperty('fillColor', { animatable: true }),
  new FractionProperty('fillAlpha', { animatable: true }),
  new ColorProperty('strokeColor', { animatable: true }),
  new FractionProperty('strokeAlpha', { animatable: true }),
  new NumberProperty('strokeWidth', { animatable: true }),
  // new EnumProperty('strokeLinecap', ENUM_LINECAP_OPTIONS),
  // new EnumProperty('strokeLinejoin', ENUM_LINEJOIN_OPTIONS),
  new NumberProperty('strokeMiterLimit', { animatable: true, min: 1 }),
  new FractionProperty('trimPathStart', { animatable: true }),
  new FractionProperty('trimPathEnd', { animatable: true }),
  new FractionProperty('trimPathOffset', { animatable: true }),
  // TODO: create enum property for 'fill type'
)
export class PathLayer extends AbstractLayer {
  constructor(
    readonly id: string,
    public pathData: Path,
    public fillColor?: string,
    public fillAlpha = 1,
    public strokeColor?: string,
    public strokeAlpha = 1,
    public strokeWidth = 0,
    public strokeLinecap = 'butt',
    public strokeLinejoin = 'miter',
    public strokeMiterLimit = 4,
    public fillType = 'nonZero',
    public trimPathStart = 0,
    public trimPathEnd = 1,
    public trimPathOffset = 0,
  ) {
    super(undefined, id);
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
      r: MathUtil.clamp(Math.round(MathUtil.lerp(startColor.r, endColor.r, fraction)), 0, 255),
      g: MathUtil.clamp(Math.round(MathUtil.lerp(startColor.g, endColor.g, fraction)), 0, 255),
      b: MathUtil.clamp(Math.round(MathUtil.lerp(startColor.b, endColor.b, fraction)), 0, 255),
      a: MathUtil.clamp(Math.round(MathUtil.lerp(startColor.a, endColor.a, fraction)), 0, 255)
    });
  }
}
