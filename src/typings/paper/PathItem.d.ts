declare module 'paper' {
  export interface PathItemProps extends ItemProps {
    /**
     * The path's geometry, formatted as SVG style path data.
     */
    pathData: string;
  }

  export interface PathItem extends PathItemProps {}

  /**
   * The PathItem class is the base for any items that describe paths and offer
   * standardised methods for drawing and path manipulation, such as Path and CompoundPath.
   */
  export abstract class PathItem extends Item {
    /**
     * Returns all intersections between two PathItem items as an array of
     * CurveLocation objects. CompoundPath items are also supported.
     * @param path - the other item to find the intersections with
     * @param sorted [optional] - specifies whether the returned CurveLocation
     * objects should be sorted by path and offset, default: false
     */
    getIntersections(path: PathItem, sorted?: boolean): CurveLocation[];

    /**
     * Smooths the path item without changing the amount of segments in
     * the path or moving the segments’ locations, by smoothing and adjusting the
     * angle and length of the segments’ handles based on the position and distance
     * of neighboring segments.
     *
     * Smoothing works both for open paths and closed paths, and can be applied to
     * the full path, as well as a sub-range of it. If a range is defined using
     * the options.from and options.to properties, only the curve handles inside
     * that range are touched. If one or both limits of the range are specified
     * in negative indices, the indices are wrapped around the end of the curve.
     * That way, a smoothing range in a close path can even wrap around the
     * connection between the last and the first segment.
     *
     * Four different smoothing methods are available:
     *
     * - 'continuous' smooths the path item by adjusting its curve handles so that the
     * first and second derivatives of all involved curves are continuous across their boundaries.
     * This method tends to result in the smoothest results, but does not allow for further
     * parametrization of the handles.
     *
     * - 'asymmetric' is based on the same principle as 'continuous' but uses different
     * factors so that the result is asymmetric. This used to the only method available
     * until v0.10.0, and is currently still the default when no method is specified,
     * for reasons of backward compatibility. It will eventually be removed.
     *
     * - 'catmull-rom' uses the Catmull-Rom spline to smooth the segment.
     * The optionally passed factor controls the knot parametrization of the algorithm:
     *
     * 0.0: the standard, uniform Catmull-Rom spline
     * 0.5: the centripetal Catmull-Rom spline, guaranteeing no self-intersections
     * 1.0: the chordal Catmull-Rom spline
     *
     * 'geometric' use a simple heuristic and empiric geometric method to smooth the
     * segment’s handles. The handles were weighted, meaning that big differences
     * in distances between the segments will lead to probably undesired results.
     *
     * The optionally passed factor defines the tension parameter (0…1), controlling
     * the amount of smoothing as a factor by which to scale each handle.
     *
     * @param options
     * options.type: String — the type of smoothing method: ‘continuous’,
     * ‘asymmetric’, ‘catmull-rom’, ‘geometric’ — default: ‘asymmetric’
     *
     * options.factor: Number — the factor parameterizing the smoothing
     * method — default: 0.5 for 'catmull-rom', 0.4 for 'geometric'
     *
     * options.from: Number⟋Segment⟋Curve — the segment or curve at which to
     * start smoothing, if not the full path shall be smoothed (inclusive). This
     * can either be a segment index, or a segment or curve object that is part of
     * the path. If the passed number is negative, the index is wrapped around the
     * end of the path.
     *
     * options.to: Number⟋Segment⟋Curve — the segment or curve to which the handles
     * of the path shall be processed (inclusive). This can either be a segment index,
     * or a segment or curve object that is part of the path. If the passed number
     * is negative, the index is wrapped around the end of the path.
     */
    smooth(options?: {
      type?: 'continuous' | 'asymmetric' | 'catmull-rom' | 'geometric';
      factor?: number;
      from?: number | Segment | Curve;
      to?: number | Segment | Curve;
    }): void;

    /**
     * On a normal empty Path, the point is simply added as the path's first
     * segment. If called on a CompoundPath, a new Path is created as a
     * child and the point is added as its first segment.
     * @param point - the path's first segment
     */
    moveTo(point: Point): void;

    /**
     * Draw a line from the current point to the given point
     * @param point - the end point of the line
     */
    lineTo(point: Point): void;

    /**
     * Adds a cubic bezier curve to the path, defined by two handles and a to point.
     * @param handle1 - The first control point handle for the curve
     * @param handle2 - The second control point handle for the curve
     * @param to - The end control point of the curve
     */
    cubicCurveTo(handle1: Point, handle2: Point, to: Point): void;

    /**
     * Adds a quadratic bezier curve to the path, defined by a handle and a to point.
     * @param handle - The control point for the curve
     * @param to - The end control point of the curve
     */
    quadraticCurveTo(handle: Point, to: Point): void;

    /**
     * Draws a curve from the position of the last segment point in the path
     * that goes through the specified through point, to the specified to
     * point by adding one segment to the path.
     * @param through - the point through which the curve should go
     * @param to - the point where the curve should end
     * @param parameter [optional] - default: 0.5
     */
    curveTo(through: Point, to: Point, parameter?: number): void;

    /**
     * Draws an arc from the position of the last segment point in the path that
     * goes through the specified through point, to the specified to point by adding
     * one or more segments to the path.
     * @param through - the point where the arc should pass through
     * @param to - the point where the arc should end
     */
    arcTo(through: Point, to: Point): void;

    /**
     * Draws an arc from the position of the last segment point in the path to the
     * specified point by adding one or more segments to the path.
     * @param to - the point where the arc should end
     * @param closewise [optional] - specifies whether the arc should be drawn in
     * clockwise direction. optional, default: true
     */
    arcTo(to: Point, clockwise?: boolean): void;

    /**
     * Closes the path. When closed, Paper.js connects the first and last segment
     * of the path with an additional curve.
     * @param join - controls whether the method should attempt to merge the first
     * segment with the last if they lie in the same location.
     */
    closePath(join: boolean): void;

    /**
     * If called on a CompoundPath, a new Path is created as a child and a point is
     * added as its first segment relative to the position of the last segment of the current path.
     * @param to -
     */
    moveBy(to: Point): void;

    /**
     * Adds a segment relative to the last segment point of the path.
     * @param to - the vector which is added to the position of the last segment of
     * the path, to get to the position of the new segment.
     */
    lineBy(to: Point): void;

    /**
     *
     * @param through -
     * @param to -
     * @param parameter [optional] - default 0.5
     */
    curveBy(through: Point, to: Point, parameter?: number): void;

    /**
     *
     * @param handle1 -
     * @param handle2 -
     * @param to -
     */
    cubicCurveBy(handle1: Point, handle2: Point, to: Point): void;

    /**
     *
     * @param handle -
     * @param to -
     */
    quadraticCurveBy(handle: Point, to: Point): void;

    /**
     *
     * @param through -
     * @param to -
     */
    arcBy(through: Point, to: Point): void;

    /**
     *
     * @param to -
     * @param clockwise [optional] - default: true
     */
    arcBy(to: Point, clockwise?: boolean): void;

    /**
     * Merges the geometry of the specified path from this path's geometry and returns the result as a new path item.
     * @param path - the path to unite with
     */
    unite(path: PathItem): PathItem;

    /**
     * Intersects the geometry of the specified path with this path's geometry and returns the result as a new path item.
     * @param path - the path to intersect with
     */
    intersect(path: PathItem): PathItem;

    /**
     * Subtracts the geometry of the specified path from this path's geometry and returns the result as a new path item.
     * @param - the path to subtract
     */
    subtract(path: PathItem): PathItem;

    /**
     * Excludes the intersection of the geometry of the specified path with this path's geometry and returns the result as a new group item.
     * @param - the path to exclude the intersection of
     */
    exclude(path: PathItem): PathItem;

    /**
     * Splits the geometry of this path along the geometry of the specified path returns the result as a new group item.
     * @param - the path to divide by
     */
    divide(path: PathItem): PathItem;
  }
}
