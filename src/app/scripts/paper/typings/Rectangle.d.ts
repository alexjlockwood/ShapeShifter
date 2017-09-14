declare module 'paper' {
  export interface RectangleProps {
    /**
     * The x position of the rectangle.
     */
    x: number;

    /**
     * The y position of the rectangle.
     */
    y: number;

    /**
     * The width of the rectangle.
     */
    width: number;

    /**
     * The height of the rectangle.
     */
    height: number;

    /**
     * The top-left point of the rectangle
     */
    point: Point;

    /**
     * The size of the rectangle
     */
    size: Size;

    /**
     * The position of the left hand side of the rectangle. Note that this doesn't move the whole rectangle; the right hand side stays where it was.
     */
    left: number;

    /**
     * The top coordinate of the rectangle. Note that this doesn't move the whole rectangle: the bottom won't move.
     */
    top: number;

    /**
     * The position of the right hand side of the rectangle. Note that this doesn't move the whole rectangle; the left hand side stays where it was.
     */
    right: number;

    /**
     * The bottom coordinate of the rectangle. Note that this doesn't move the whole rectangle: the top won't move.
     */
    bottom: number;

    /**
     * The center point of the rectangle.
     */
    center: Point;

    /**
     * The top-left point of the rectangle.
     */
    topLeft: Point;

    /**
     * The top-right point of the rectangle.
     */
    topRight: Point;

    /**
     * The bottom-left point of the rectangle.
     */
    bottomLeft: Point;

    /**
     * The bottom-right point of the rectangle.
     */
    bottomRight: Point;

    /**
     * The left-center point of the rectangle.
     */
    leftCenter: Point;

    /**
     * The top-center point of the rectangle.
     */
    topCenter: Point;

    /**
     * The right-center point of the rectangle.
     */
    rightCenter: Point;

    /**
     * The bottom-center point of the rectangle.
     */
    bottomCenter: Point;

    /**
     * The area of the rectangle in square points.
     * Read only.
     */
    area: number;

    /**
     * Specifies whether an item's bounds are selected and will also mark the item as selected.
     * Paper.js draws the visual bounds of selected items on top of your project. This can be useful for debugging.
     */
    selected: boolean;
  }
  export interface Rectangle extends RectangleProps {}
  /**
   * A Rectangle specifies an area that is enclosed by it's top-left point (x, y), its width, and its height. It should not be confused with a rectangular path, it is not an item.
   */
  export class Rectangle {
    /**
     * Creates a Rectangle object.
     * @param point - the top-left point of the rectangle
     * @param size - the size of the rectangle
     */
    constructor(point: Point, size: Size);

    /**
     * Creates a rectangle object.
     * @param x - the left coordinate
     * @param y - the top coordinate
     * @param width - the width
     * @param height - the height
     */
    constructor(x: number, y: number, width: number, height: number);

    /**
     * Creates a Rectangle object.
     * @param object - an object containing properties to be set on the rectangle.
     */
    constructor(object?: Partial<RectangleProps>);

    /**
     * Creates a rectangle object from the passed points. These do not necessarily need to be the top left and bottom right corners, the constructor figures out how to fit a rectangle between them.
     * @param from - The first point defining the rectangle
     * @param to - The second point defining the rectangle
     */
    constructor(from: Point, to: Point);

    /**
     * Creates a new rectangle object from the passed rectangle object.
     * @param rt - the rectangle to copy from
     */
    constructor(rt: Rectangle);

    /**
     * Returns a copy of the rectangle.
     */
    clone(): Rectangle;

    /**
     * Checks whether the coordinates and size of the rectangle are equal to that of the supplied rectangle.
     * @param rect - the rectangle to check against
     */
    equals(rect: Rectangle): boolean;

    /**
     * a string representation of this rectangle
     */
    toString(): string;

    /**
     * Returns true if the rectangle is empty, false otherwise
     */
    isEmpty(): boolean;

    /**
     * Tests if the specified point is inside the boundary of the rectangle.
     * @param point - the specified point
     */
    contains(point: Point): boolean;

    /**
     * Tests if the interior of the rectangle entirely contains the specified rectangle.
     * @param rect - The specified rectangle
     */
    contains(rect: Rectangle): boolean;

    /**
     * Tests if the interior of this rectangle intersects the interior of another rectangle. Rectangles just touching each other are considered as non-intersecting.
     * @param rect - the specified rectangle
     */
    intersects(rect: Rectangle): boolean;

    /**
     * Returns a new rectangle representing the intersection of this rectangle with the specified rectangle.
     * @param rect - The rectangle to be intersected with this rectangle
     */
    intersect(rect: Rectangle): Rectangle;

    /**
     * Returns a new rectangle representing the union of this rectangle with the specified rectangle.
     * @param rect - the rectangle to be combined with this rectangle
     */
    unite(rect: Rectangle): Rectangle;

    /**
     * Adds a point to this rectangle. The resulting rectangle is the smallest rectangle that contains both the original rectangle and the specified point.
     * After adding a point, a call to contains(point) with the added point as an argument does not necessarily return true.
     * The rectangle.contains(point) method does not return true for points on the right or bottom edges of a rectangle. Therefore, if the added point falls on the left or bottom edge of the enlarged rectangle, rectangle.contains(point) returns false for that point.
     * @param point - the point to add to the rectangle
     */
    include(point: Point): Rectangle;

    /**
     * Expands the rectangle by the specified amount in horizontal and vertical directions.
     * @param amount - the amount to expand the rectangle in both directions
     */
    expand(amount: number | Size | Point): Rectangle;

    /**
     * Expands the rectangle by the specified amounts in horizontal and vertical directions.
     * @param hor - the amount to expand the rectangle in horizontal direction
     * @param ver - the amount to expand the rectangle in vertical direction
     */
    expand(hor: number, ver: number): Rectangle;

    /**
     * Scales the rectangle by the specified amount from its center.
     * @param amount - the amount to scale by
     */
    scale(amount: number): Rectangle;

    /**
     * Scales the rectangle in horizontal direction by the specified hor amount and in vertical direction by the specified ver amount from its center.
     * @param hor - the amount to scale the rectangle in horizontal direction
     * @param ver - the amount to scale the rectangle in vertical direction
     */
    scale(hor: number, ver: number): Rectangle;
  }
}
