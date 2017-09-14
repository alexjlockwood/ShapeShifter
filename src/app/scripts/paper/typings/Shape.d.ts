declare module 'paper' {
  export interface ShapeProps extends ItemProps {
    /**
     * The type of shape of the item as a string.
     */
    type: string;

    /**
     * The size of the shape.
     */
    size: Size;

    /**
     * The radius of the shape, as a number if it is a circle, or a size object for ellipses and rounded rectangles.
     */
    radius: number | Size;
  }

  export interface Shape extends ShapeProps {}

  export class Shape extends Item {
    /**
     * Creates a circular shape item.
     * @param center - the center point of the circle
     * @param radius - the radius of the circle
     */
    static Circle(center: Point, radius: number): Shape;

    /**
     * Creates a circular shape item from the properties described by an object literal.
     * @param object - an object literal containing properties descriving the shapes attributes
     */
    static Circle(object?: Partial<ShapeProps>): Shape;

    /**
     * Creates a rectangular shape item, with optionally rounded corners.
     * @param rectangle - the rectangle object describing the geometry of the rectangular shape to be created.
     * @param radius [optional] - the size of the rounded corners, default: null
     */
    static Rectangle(rectangle: Rectangle, radius?: number): Shape;

    /**
     * Creates a rectangular shape item from a point and a size object.
     * @param point - the rectangle's top-left corner
     * @param size - the rectangle's size.
     */
    static Rectangle(point: Point, size: Size): Shape;

    /**
     * Creates a rectangular shape item from the passed points. These do not necessarily need to be the top left and bottom right corners, the constructor figures out how to fit a rectangle between them.
     * @param from - the first point defining the rectangle
     * @param to - the second point defining the rectangle
     */
    static Rectangle(from: Point, to: Point): Shape;

    /**
     * Creates a rectangular shape item from the properties described by an object literal.
     * @param object - an object literal containing properties describing the shape's attributes
     */
    static Rectangle(object?: Partial<ShapeProps>): Shape;

    /**
     * Creates an elliptical shape item.
     * @param rectangle - the rectangle circumscribing the ellipse
     */
    static Ellipse(rectangle: Rectangle): Shape;

    /**
     * Creates an elliptical shape item from the properties described by an object literal.
     * @param object - an object literal containing properties describing the shape's attributes
     */
    static Ellipse(object?: Partial<ShapeProps>): Shape;

    toPath(insert: boolean): Path;
  }
}
