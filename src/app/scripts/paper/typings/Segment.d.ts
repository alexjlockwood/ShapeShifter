declare module 'paper' {
  abstract class SegmentProps {
    /**
     * The anchor point of the segment.
     */
    point: Point;

    /**
     * The handle point relative to the anchor point of the segment that describes the in tangent of the segment.
     */
    handleIn: Point;

    /**
     * The handle point relative to the anchor point of the segment that describes the out tangent of the segment.
     */
    handleOut: Point;

    /**
     * Specifies whether the segment has no handles defined, meaning it connects two straight lines.
     */
    linear: boolean;

    /**
     * Specifies whether the point of the segment is selected.
     */
    selected: boolean;

    /**
     * The index of the segment in the path.segments array that the segment belongs to.
     * Read Only
     */
    index: number;

    /**
     * The path that the segment belongs to.
     * Read Only
     */
    path: Path;

    /**
     * The curve that the segment belongs to. For the last segment of an open
     * path, the previous segment is returned.
     * Read only.
     */
    curve: Curve;

    /**
     * The curve location that describes this segment's position ont the path.
     * Read Only.
     */
    location: CurveLocation;

    /**
     * The next segment in the path.segments array that the segment belongs to.
     * If the segments belongs to a closed path, the first segment is returned
     * for the last segment of the path.
     * Read Only.
     */
    next: Segment;

    /**
     * The previous segment in the path.segments array that the segment belongs to.
     * If the segments belongs to a closed path, the last segment is returned
     * for the first segment of the path.
     * Read Only.
     */
    previous: Segment;
  }

  /**
   * The Segment object represents the points of a path through which its
   * Curve objects pass. The segments of a path can be accessed through
   * its path.segments array.
   * Each segment consists of an anchor point (segment.point) and
   * optionaly an incoming and an outgoing handle (segment.handleIn
   * and segment.handleOut), describing the tangents of the two Curve
   * objects that are connected by this segment.
   */
  export class Segment extends SegmentProps {
    /**
     * Creates a new Segment object.
     * @param point [optional] - the anchor point of the segment default: {x: 0, y: 0}
     * @param handleIn [optional] - the handle point relative to the anchor point of
     * the segment that describes the in tangent of the segment default: {x: 0, y: 0}
     * @param handleOut [optional] - the handle point relative to the anchor point
     * of the segment that describes the out tangent of the segment default: {x: 0, y: 0}
     */
    constructor(point?: Point, handleIn?: Point, handleOut?: Point);

    /**
     * Creates a new Segment object.
     * @param object - an object literal containing properties to be set on the segment.
     */
    constructor(object?: Partial<SegmentProps>);

    /**
     * Checks if the this is the first segment in the path.segments array.
     */
    isFirst(): boolean;

    /**
     * Checks if the this is the last segment in the path.segments array.
     */
    isLast(): boolean;

    /**
     * Returns true if the the two segments are the beginning of two lines and if these two lines are running parallel.
     * @param segment
     */
    isColinear(segment: Segment): boolean;

    /**
     * Returns true if the segment at the given index is the beginning of an
     * orthogonal arc segment. The code looks at the length of the handles and
     * their relation to the distance to the imaginary corner point. If the
     * relation is kappa, then it's an arc.
     */
    isArc(): boolean;

    /**
     * Returns the reversed the segment, without modifying the segment itself.
     */
    reverse(): Segment;

    /**
     * Removes the segment from the path that it belongs to.
     */
    remove(): boolean;

    /**
     * A string representation of the segment
     */
    toString(): string;

    /**
     * Transform the segment by the specified matrix.
     * @param matrix - the matrix to transform the segment by
     */
    transform(matrix: Matrix): void;

    hasHandles(): boolean;

    /**
     * Checks if the segment connects two curves smoothly, meaning that
     * its two handles are collinear and segment does not form a corner.
     */
    isSmooth(): boolean;

    clearHandles(): void;

    /**
     * Smooths the bezier curves that pass through this segment by taking
     * into account the segment’s position and distance to the neighboring
     * segments and changing the direction and length of the segment’s handles
     * accordingly without moving the segment itself.
     *
     * Two different smoothing methods are available:
     *
     * - 'catmull-rom' uses the Catmull-Rom spline to smooth the segment.
     * The optionally passed factor controls the knot parametrization of the algorithm:
     *
     * 0.0: the standard, uniform Catmull-Rom spline
     * 0.5: the centripetal Catmull-Rom spline, guaranteeing no self-intersections
     * 1.0: the chordal Catmull-Rom spline
     *
     * - 'geometric' use a simple heuristic and empiric geometric method to
     * smooth the segment’s handles. The handles were weighted, meaning that
     * big differences in distances between the segments will lead to probably
     * undesired results.
     *
     * The optionally passed factor defines the tension parameter (0…1),
     * controlling the amount of smoothing as a factor by which to scale each handle.
     *
     * @param options
     * options.type: String — the type of smoothing method: ‘catmull-rom’,
     * ‘geometric’ — default: ‘catmull-rom’
     *
     * options.factor: Number — the factor parameterizing the smoothing
     * method — default: 0.5 for 'catmull-rom', 0.4 for 'geometric'
     */
    smooth(options?: { type?: 'catmull-rom' | 'geometric'; factor?: number }): void;
  }
}
