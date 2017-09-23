declare module 'paper' {
  export interface SizeProps {
    /**
     * The width of the size
     */
    width: number;

    /**
     * The height of the size
     */
    height: number;
  }
  export interface Size extends SizeProps {}
  /**
   * The Size object is used to describe the size or dimensions of something, through its width and height properties.
   */
  export class Size {
    /**
     * Returns a new size object with the smallest width and height of the supplied sizes.
     * @param size1 - the first size
     * @param size2 - the second size
     */
    static min(size1: Size, size2: Size): Size;

    /**
     * Returns a new size object with the largest width and height of the supplied sizes.
     * @param size1 - the first size
     * @param size2 - the second size
     */
    static max(size1: Size, size2: Size): Size;

    /**
     * Returns a size object with random width and height values between 0 and 1.
     */
    static random(): Size;

    /**
     * Creates a Size object with the given width and height values.
     * @param width - the width
     * @param height - the height
     */
    constructor(width: number, height: number);

    /**
     * Creates a Size object using the numbers in the given array as dimensions.
     * @param array - an array of numbers
     */
    constructor(array: [number, number]);

    /**
     * Creates a Size object using the properties in the given object.
     * @param object - the object literal containing properies (width:10, height:10 etc)
     */
    constructor(object?: Partial<SizeProps>);

    /**
     * Creates a Size object using the coordinates of the given Size object.
     * @param size - the size to duplicate from
     */
    constructor(size: Size);

    /**
     * Creates a Size object using the point.x and point.y values of the given Point object.
     * @param point - the point from which to create a size
     */
    constructor(point: Point);

    set(width: number, height: number): void;
    set(array: [number, number]): void;
    set(object?: Partial<SizeProps>): void;
    set(size: Size): void;
    set(point: Point): void;

    /**
     * Returns a copy of the size.
     */
    clone(): Size;

    /**
     * A string representation of the size.
     */
    toString(): string;

    /**
     * Checks if this size has both the width and height set to 0.
     */
    isZero(): boolean;

    /**
     * Checks if the width or the height of the size are NaN.
     */
    isNaN(): boolean;

    /**
     * Returns a new size with rounded width and height values. The object itself is not modified!
     */
    round(): Size;

    /**
     * Returns a new size with the nearest greater non-fractional values to the specified width and height values. The object itself is not modified!
     */
    ceil(): Size;

    /**
     * Returns a new size with the nearest smaller non-fractional values to the specified width and height values. The object itself is not modified!
     */
    floor(): Size;

    /**
     * Returns a new size with the absolute values of the specified width and height values. The object itself is not modified!
     */
    abs(): Size;

    add(point: Size): Size;
    add(point: number): Size;

    subtract(point: Size): Size;
    subtract(point: number): Size;

    /*
     * Returns the new multiplied size
     * @param point - The size you want to multiply with
     */
    multiply(point: Size): Size;
    multiply(point: number): Size;

    /*
     * Returns the new divided size
     * @param point - The size you want to divide with
     */
    divide(point: Size): Size;
    divide(point: number): Size;
  }
}
