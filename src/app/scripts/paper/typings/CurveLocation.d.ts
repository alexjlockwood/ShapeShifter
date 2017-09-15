declare module 'paper' {
  /**
   * CurveLocation objects describe a location on Curve objects, as defined by
   * the curve parameter, a value between 0 (beginning of the curve) and 1 (end
   * of the curve). If the curve is part of a Path item, its index inside the
   * path.curves array is also provided.
   */
  export class CurveLocation {
    /**
     * Creates a new CurveLocation object.
     */
    constructor(curve: Curve, parameter: number, point: Point);

    /**
     * The segment of the curve which is closer to the described location.
     */
    readonly segment: Segment;

    /**
     * The curve that this location belongs to.
     */
    readonly curve: Curve;

    /**
     * The curve location on the intersecting curve, if this location is the result of a
     * call to pathItem.getIntersections(path) / Curve#getIntersections(curve).
     */
    readonly intersection: CurveLocation;

    /**
     * The path this curve belongs to, if any.
     */
    readonly path: Path;

    /**
     * The index of the curve within the path.curves list, if the curve is part of a Path item.
     */
    readonly index: number;

    /**
     * The length of the path from its beginning up to the location described by this object.
     * If the curve is not part of a path, then the length within the curve is returned instead.
     */
    readonly offset: number;

    /**
     * The length of the curve from its beginning up to the location described by this object.
     */
    readonly curveOffset: number;

    /**
     * The curve parameter, as used by various bezier curve calculations. It is value between
     * 0 (beginning of the curve) and 1 (end of the curve).
     */
    readonly time: number;

    /**
     * The point which is defined by the curve and parameter.
     */
    readonly point: Point;

    /**
     * The distance from the queried point to the returned location.
     */
    readonly distance: number;

    /**
     * Checks whether tow CurveLocation objects are describing the same location on a path, by applying
     * the same tolerances as elsewhere when dealing with curve time parameters.
     * @param location CurveLocation
     */
    equals(location: CurveLocation): boolean;

    /**
     * Returns a string representation of the curve location
     */
    toString(): string;

    isTouching(): boolean;

    isCrossing(): boolean;

    hasOverlap(): boolean;
  }
}
