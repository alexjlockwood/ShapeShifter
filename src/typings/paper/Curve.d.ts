declare module 'paper' {
  /**
   * The Curve object represents the parts of a path that are connected by two
   * following Segment objects. The curves of a path can be accessed through
   * its path.curves array.
   *
   * While a segment describe the anchor point and its incoming and outgoing
   * handles, a Curve object describes the curve passing between two such
   * segments. Curves and segments represent two different ways of looking
   * at the same thing, but focusing on different aspects. Curves for example
   * offer many convenient ways to work with parts of the path, finding
   * lengths, positions or tangents at given offsets.
   */
  export class Curve {
    /**
     * Creates a new curve object.
     */
    constructor(segment1: Segment, segment2: Segment);

    /**
     * Creates a new curve object.
     */
    constructor(point1: Point, handle1: Point, handle2: Point, point2: Point);

    /**
     * The first anchor point of the curve.
     */
    point1: Point;

    /**
     * The second anchor point of the curve.
     */
    point2: Point;

    /**
     * The handle point that describes the tangent in the first anchor point.
     */
    handle1: Point;

    /**
     * The handle point that describes the tangent in the second anchor point.
     */
    handle2: Point;

    /**
     * The first segment of the curve.
     */
    readonly segment1: Segment;

    /**
     * The second segment of the curve.
     */
    readonly segment2: Segment;

    /**
     * The path that the curve belongs to.
     */
    readonly path: Path;

    /**
     * The index of the curve in the path.curves array.
     */
    readonly index: number;

    /**
     * The next curve in the path.curves array that the curve belongs to.
     */
    readonly next: Curve;

    /**
     * The previous curve in the path.curves array that the curve belongs to.
     */
    readonly previous: Curve;

    /**
     * Specifies whether the points and handles of the curve are selected.
     */
    selected: boolean;

    /**
     * The approximated length of the curve in points.
     */
    readonly length: number;

    /**
     * The bounding rectangle of the curve excluding stroke width.
     */
    bounds: Rectangle;

    /**
     * The bounding rectangle of the curve including stroke width.
     */
    strokeBounds: Rectangle;

    /**
     * The bounding rectangle of the curve including handles.
     */
    handleBounds: Rectangle;

    /**
     * Checks if this curve is linear, meaning it does not define any curve handle.
     */
    isLinear(): boolean;

    /**
     * Divides the curve into two curves at the given offset. The curve itself is modified and becomes the first part, the second part is returned as a new curve. If the modified curve belongs to a path item, the second part is also added to the path.
     * @param offset [optional] - the offset on the curve at which to split, or the curve time parameter if isParameter is true  default: 0.5
     * @param isParameter [optional] - pass true if offset is a curve time parameter. default: false
     */
    divide(offset?: number, isParameter?: boolean): Curve;

    /**
     * Splits the path this curve belongs to at the given offset. After splitting, the path will be open. If the path was open already, splitting will result in two paths.
     * @param offset [optional] - the offset on the curve at which to split, or the curve time parameter if isParameter is true default: 0.5
     * @param isParameter [optional] - pass true if offset is a curve time parameter. default: false
     */
    split(offset?: number, isParameter?: boolean): Path;

    /**
     * Returns a reversed version of the curve, without modifying the curve itself.
     */
    reverse(): Curve;

    /**
     * Removes the curve from the path that it belongs to, by merging its two path segments.
     * returns true if the curve was removed, false otherwise
     */
    remove(): boolean;

    /**
     * Returns a copy of the curve.
     */
    clone(): Curve;

    /**
     * returns a string representation of the curve
     */
    toString(): string;

    /**
     * Calculates the curve time parameter of the specified offset on the path, relative to the provided start parameter. If offset is a negative value, the parameter is searched to the left of the start parameter. If no start parameter is provided, a default of 0 for positive values of offset and 1 for negative values of offset.
     * @param offset -
     * @param start [optional] -
     */
    getParameterAt(offset: Point, start?: number): number;

    /**
     * Returns the curve time parameter of the specified point if it lies on the curve, null otherwise.
     * @param point - the point on the curve.
     */
    getParameterOf(point: Point): number;

    /**
     * Calculates the curve location at the specified offset or curve time parameter.
     * @param offset - the offset on the curve, or the curve time parameter if isParameter is true
     * @param isParameter [optional] - pass true if offset is a curve time parameter.  default: false
     */
    getLocationAt(offset: number, isParameter?: boolean): CurveLocation;

    /**
     * Returns the curve location of the specified point if it lies on the curve, null otherwise.
     * @param point - the point on the curve
     */
    getLocationOf(point: Point): CurveLocation;

    /**
     * Returns the length of the path from its beginning up to up to the specified point if it lies on the path, null otherwise.
     * @param point - the point on the path.
     */
    getOffsetOf(point: Point): number;

    /**
     * Calculates the point on the curve at the given offset.
     * @param location - the offset or location on the curve.
     */
    getPointAt(location: number | CurveLocation): Point;

    /**
     * Calculates the point on the curve at the given location.
     * @param time - the curve-time parameter on the curve
     */
    getPointAtTime(time: number): Point;

    divideAt(location: CurveLocation | number): Curve;

    divideAtTime(time: number): Curve;
  }
}
