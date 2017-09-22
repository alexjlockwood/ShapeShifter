declare module 'paper' {
  /**
   * Style is used for changing the visual styles of items contained within a
   * Paper.js project and is returned by item.style and project.currentStyle.
   * All properties of Style are also reflected directly in Item, i.e.: item.fillColor.
   * To set multiple style properties in one go, you can pass an object
   * to item.style. This is a convenient way to define a style once and
   * apply it to a series of items:
   */
  export class Style {
    /**
     * The view that this style belongs to.
     */
    readonly view: View;

    /**
     * The color of the stroke.
     */
    strokeColor: Color | string;

    /**
     * The width of the stroke.
     */
    strokeWidth: number;

    /**
     * The shape to be used at the beginning and end of open Path items, when they have a stroke.
     */
    strokeCap: 'round' | 'square' | 'butt';

    /**
     * The shape to be used at the segments and corners of Path items when they have a stroke.
     */
    strokeJoin: 'miter' | 'round' | 'bevel';

    /**
     * Specifies whether the stroke is to be drawn taking the current affine
     * transformation into account (the default behavior), or whether it
     * should appear as a non-scaling stroke.
     */
    strokeScaling: boolean;

    /**
     * The dash offset of the stroke.
     */
    dashOffset: number;

    /**
     * Specifies an array containing the dash and gap lengths of the stroke.
     */
    dashArray: number[];

    /**
     * The miter limit of the stroke. When two line segments meet at a sharp
     * angle and miter joins have been specified for strokeJoin, it is possible
     * for the miter to extend far beyond the strokeWidth of the path. The
     * miterLimit imposes a limit on the ratio of the miter length to the strokeWidth.
     */
    miterLimit: number;

    /**
     * The fill color.
     */
    fillColor: Color | string;

    /**
     * The shadow color.
     */
    shadowColor: Color | string;

    /**
     * The shadow's blur radius.
     */
    shadowBlur: number;

    /**
     * The shadow's offset.
     */
    shadowOffset: Point;

    /**
     * The color the item is highlighted with when selected. If the item does
     * not specify its own color, the color defined by its layer is used instead.
     */
    selectedColor: Color | string;

    /**
     * The font-family to be used in text content. default 'sans-serif'
     */
    fontFamily: string;

    /**
     * The font-weight to be used in text content.
     */
    fontWeight: string | number;

    /**
     * The font size of text content, as {@Number} in pixels, or as {@String}
     * with optional units 'px', 'pt' and 'em'.
     */
    fontSize: string | number;

    /**
     * The text leading of text content.
     */
    leading: number | string;

    /**
     * The justification of text paragraphs. default "left"
     */
    justification: string;
  }
  export interface IHSBColor {
    /**
     * the hue of the color as a value in degrees between 0 and 360
     */
    hue?: number;
    /**
     * the saturation of the color as a value between 0 and 1
     */
    saturation?: number;
    /**
     * the brightness of the color as a value between 0 and 1
     */
    brightness?: number;
    /**
     * the alpha of the color as a value between 0 and 1
     */
    alpha?: number;
  }
  export interface IHSLColor {
    /**
     * the hue of the color as a value in degrees between 0 and 360
     */
    hue?: number;
    /**
     * the saturation of the color as a value between 0 and 1
     */
    saturation?: number;
    /**
     * the brightness of the color as a value between 0 and 1
     */
    lightness?: number;
    /**
     * the alpha of the color as a value between 0 and 1
     */
    alpha?: number;
  }
  export interface IGradientColor {
    /**
     * The gradient object that describes the color stops and type of gradient to be used.
     */
    gradient?: Gradient;
    /**
     * the origin point of the gradient
     */
    origin?: Point;
    /**
     * The destination point of the gradient stops: Array of GradientStop.
     * The gradient stops describing the gradient, as an alternative to providing a gradient object.
     */
    destination?: Point;
    /**
     * Controls whether the gradient is radial, as an alternative to providing a gradient object.
     */
    radial?: boolean;
  }
  /**
   * All properties and functions that expect color values in the form of instances of Color objects,
   * also accept named colors and hex values as strings which are then converted to instances of
   * Color internally.
   */
  export class Color {
    /**
     * Creates a RGB Color object.
     * @param red - the amount of red in the color as a value between 0 and 1
     * @param green - the amount of green in the color as a value between 0 and 1
     * @param blue - the amount of blue in the color as a value between 0 and 1
     * @param alpha [optional] - the alpha of the color as a value between 0 and 1
     */
    constructor(red: number, green: number, blue: number, alpha?: number);

    /**
     * Creates a gray Color object.
     * @param gray - the amount of gray in the color as a value between 0 and 1
     * @param alpha [optional] - the alpha of the color as a value between 0 and 1
     */
    constructor(gray: number, alpha?: number);

    /**
     * Creates a HSB, HSL or gradient Color object from the properties of the provided object:
     * @param object - an object describing the components and properties of the color.
     */
    constructor(object: IHSBColor | IHSLColor | IGradientColor);

    /**
     * Creates a gradient Color object.
     */
    constructor(color: Gradient, origin: Point, destination: Point, highlight?: Point);

    /**
     * Creates a RGB Color object.
     * @param hex - the RGB color in hex, i.e. #000000
     */
    constructor(hex: string);

    /**
     * The type of the color as a string.
     */
    type: 'rgb' | 'gray' | 'hsb' | 'hsl';

    /**
     * The color components that define the color, including the alpha value if defined.
     */
    readonly components: number;

    /**
     * The color's alpha value as a number between 0 and 1.
     * All colors of the different subclasses support alpha values.
     */
    alpha: number;

    /**
     * The amount of red in the color as a value between 0 and 1.
     */
    red: number;

    /**
     * The amount of green in the color as a value between 0 and 1.
     */
    green: number;

    /**
     * The amount of blue in the color as a value between 0 and 1.
     */
    blue: number;

    /**
     * The amount of gray in the color as a value between 0 and 1.
     */
    gray: number;

    /**
     * The hue of the color as a value in degrees between 0 and 360.
     */
    hue: number;

    /**
     * The saturation of the color as a value between 0 and 1.
     */
    saturation: number;

    /**
     * The brightness of the color as a value between 0 and 1.
     */
    brightness: number;

    /**
     * The lightness of the color as a value between 0 and 1.
     * Note that all other components are shared with HSB.
     */
    lightness: number;

    /**
     * The gradient object describing the type of gradient and the stops.
     */
    gradient: Gradient;

    /**
     * The highlight point of the gradient.
     */
    highlight: Point;

    /**
     * Converts the color another type.
     * @param type - the color type to convert to.
     */
    convert(type: 'rgb' | 'gray' | 'hsb' | 'hsl'): Color;

    /**
     * Checks if the color has an alpha value.
     */
    hasAlpha(): boolean;

    /**
     * Checks if the component color values of the color are the same as those of the supplied one.
     * @param color - the color to compare with
     */
    equals(color: Color): boolean;

    /**
     * a copy of the color object
     */
    clone(): Color;

    /**
     * a string representation of the color
     */
    toString(): string;

    /**
     * Returns the color as a CSS string.
     * @param hex - whether to return the color in hexadecial representation or as a CSS RGB / RGBA string.
     */
    toCSS(hex: boolean): string;

    /**
     * Transform the gradient color by the specified matrix.
     * @param matrix - the matrix to transform the gradient color by
     */
    transform(matrix: Matrix): void;
  }
  /**
   * The Gradient object.
   */
  export class Gradient {
    /**
     * The gradient stops on the gradient ramp.
     */
    stops: GradientStop[];

    /**
     * Specifies whether the gradient is radial or linear.
     */
    radial: boolean;

    /**
     * a copy of the gradient
     */
    clone(): Gradient;

    /**
     * Checks whether the gradient is equal to the supplied gradient.
     * @param gradient - the gradient to check against
     */
    equals(gradient: Gradient): boolean;
  }
  /**
   * The GradientStop object.
   */
  export class GradientStop {
    /**
     * Creates a GradientStop object.
     * @param color [optional] - the color of the stop, default: new Color(0, 0, 0)
     * @param rampPoint [optional] - the position of the stop on the gradient ramp as a value between 0 and 1, default: 0
     */
    constructor(color?: Color, rampPoint?: number);

    /**
     * The ramp-point of the gradient stop as a value between 0 and 1.
     */
    rampPoint: number;

    /**
     * The color of the gradient stop.
     */
    color: Color;

    /**
     * Returns a copy of the gradient-stop
     */
    clone(): GradientStop;
  }
}
