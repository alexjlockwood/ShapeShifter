declare module 'paper' {
  export interface PointProps {
    /**
     * The x coordinate of the point
     */
    x: number;

    /**
     * The y coordinate of the point
     */
    y: number;

    /**
     * The length of the vector that is represented by this point's coordinates.
     * Each point can be interpreted as a vector that points from the origin (x = 0, y = 0) to the point's location.
     * Setting the length changes the location but keeps the vector's angle.
     */
    length: number;

    /**
     * The vector's angle in degrees, measured from the x-axis to the vector.
     */
    angle: number;

    /**
     * The vector's angle in radians, measured from the x-axis to the vector.
     */
    angleInRadians: number;

    /**
     * This property is only present if the point is an anchor or control point of a Segment or a Curve. In this case, it returns true it is selected, false otherwise
     */
    selected: boolean;
  }

  export interface Point extends PointProps {}

  /**
   * The Point object represents a point in the two dimensional space of the Paper.js project. It is also used to represent two dimensional vector objects.
   */
  export class Point {
    /**
     * Returns a new point object with the smallest x and y of the supplied points.
     * @param point1 -
     * @param point2 -
     */
    static min(point1: Point, point2: Point): Point;

    /**
     * Returns a new point object with the largest x and y of the supplied points.
     * @param point1 -
     * @param point2 -
     */
    static max(point1: Point, point2: Point): Point;

    /**
     * Returns a point object with random x and y values between 0 and 1.
     */
    static random(): Point;

    /**
     * Creates a Point object with the given x and y coordinates.
     * @param x - the x coordinate
     * @param y - the y coordinate
     */
    constructor(x: number, y: number);

    /**
     * Creates a Point object using the numbers in the given array as coordinates.
     * @param array - an array of numbers to use as coordinates
     */
    constructor(values: [number, number]);

    /**
     * Creates a Point object using the properties in the given object.
     * @param object - the object describing the point's properties
     */
    constructor(object?: Partial<PointProps>);

    /**
     * Creates a Point object using the width and height values of the given Size object.
     * @param size - the size width and height to use
     */
    constructor(size: Size);

    /**
     * Creates a Point object using the coordinates of the given Point object.
     * @param point - the point to copy
     */
    constructor(point: Point);

    /**
     * The quadrant of the angle of the point.
     * Angles between 0 and 90 degrees are in quadrant 1. Angles between 90 and 180 degrees are
     * in quadrant 2, angles between 180 and 270 degrees are in quadrant 3 and
     * angles between 270 and 360 degrees are in quadrant 4.
     */
    readonly quadrant: 1 | 2 | 3 | 4;

    set(x: number, y: number): void;

    set(values: [number, number]): void;

    set(object?: Partial<PointProps>): void;

    set(size: Size): void;

    set(point: Point): void;

    /**
     * Checks whether the coordinates of the point are equal to that of the supplied point.
     * @param point - the point to check against
     */
    equals(point: Point): boolean;

    /**
     * Returns a copy of the point.
     */
    clone(): Point;

    /**
     * a string representation of the point
     */
    toString(): string;

    /**
     * Returns the smaller angle between two vectors. The angle is unsigned, no information about rotational direction is given.
     * @param point -
     */
    getAngle(Point: Point): number;

    /**
     * Returns the smaller angle between two vectors in radians. The angle is unsigned, no information about rotational direction is given.
     * @param point: Point
     */
    getAngleInRadians(point: Point): number;

    /**
     * Returns the angle between two vectors. The angle is directional and signed, giving information about the rotational direction.
     * Read more about angle units and orientation in the description of the angle property.
     * @param point -
     */
    getDirectedAngle(point: Point): number;

    /**
     * Returns the distance between the point and another point.
     * @param point -
     * @param squared [optional] - Controls whether the distance should remain squared, or its square root should be calculated. default: false
     */
    getDistance(point: Point, squared?: boolean): number;

    /**
     * Normalize modifies the length of the vector to 1 without changing its angle and returns it as a new point. The optional length parameter defines the length to normalize to.
     * The object itself is not modified!
     * @param length [optional] - The length of the normalized vector, default: 1
     */
    normalize(length?: number): Point;

    /**
     * Rotates the point by the given angle around an optional center point.
     * The object itself is not modified.
     * Read more about angle units and orientation in the description of the angle property.
     * @param angle - the rotation angle
     * @param center - the center point of the rotation
     */
    rotate(angle: number, center?: Point): Point;

    /**
     * Transforms the point by the matrix as a new point. The object itself is not modified!
     * @param matrix -
     */
    transform(matrix: Matrix): Point;

    /**
     * Checks whether the point is inside the boundaries of the rectangle.
     * @param rect - the rectangle to check against
     */
    isInside(rect: Rectangle): boolean;

    /**
     * Checks if the point is within a given distance of another point.
     * @param point - the point to check against
     * @param tolerance - the maximum distance allowed
     */
    isClose(point: Point, tolerance: number): boolean;

    /**
     * Checks if the vector represented by this point is colinear (parallel) to another vector.
     * @param point - the vector to check against
     */
    isColinear(point: Point): boolean;

    /**
     * Checks if the vector represented by this point is orthogonal (perpendicular) to another vector.
     * @param point - the vector to check against
     */
    isOrthogonal(point: Point): boolean;

    /**
     * Checks if this point has both the x and y coordinate set to 0.
     */
    isZero(): boolean;

    /**
     * Checks if this point has an undefined value for at least one of its coordinates.
     */
    isNaN(): boolean;

    /**
     * Checks if the vector is within the specified quadrant. Note that if the vector lies on the
     * boundary between two quadrants, true will be returned for both quadrants.
     */
    isInQuadrant(quadrant: 1 | 2 | 3 | 4): boolean;

    /**
     * Returns the dot product of the point and another point.
     * @param point -
     */
    dot(point: Point): number;

    /**
     * Returns the cross product of the point and another point.
     * @param point -
     */
    cross(point: Point): number;

    /**
     * Returns the projection of the point on another point.
     * Both points are interpreted as vectors.
     * @param point -
     */
    project(point: Point): Point;

    /**
     * Returns a new point with rounded x and y values. The object itself is not modified!
     */
    round(): Point;

    /**
     * Returns a new point with the nearest greater non-fractional values to the specified x and y values. The object itself is not modified!
     */
    ceil(): Point;

    /**
     * Returns a new point with the nearest smaller non-fractional values to the specified x and y values. The object itself is not modified!
     */
    floor(): Point;

    /**
     * Returns a new point with the absolute values of the specified x and y values. The object itself is not modified!
     */
    abs(): Point;

    /*
     * Returns a new point
     * @param point - The point you want to add with
     */
    add(point: Point): Point;
    add(point: number): Point;

    /*
     * Returns a new point
     * @param point - The point you want to subtract with
     */
    subtract(point: Point): Point;
    subtract(point: number): Point;

    /*
     * Returns the new multiplied point
     * @param point - The point you want to multiply with
     */
    multiply(point: Point): Point;
    multiply(point: number[]): Point;
    multiply(point: number): Point;

    /*
     * Returns the new divided point
     * @param point - The point you want to divide with
     */
    divide(point: Point): Point;
    divide(point: number[]): Point;
    divide(point: number): Point;
  }
}
