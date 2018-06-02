declare module 'paper' {
  export interface PathProps extends PathItemProps {
    /**
     * The segments contained within the path.
     * Array of Segment objects
     */
    segments: Segment[];

    /**
     * The first Segment contained within the path.
     * Read only.
     */
    readonly firstSegment: Segment;

    /**
     * The last Segment contained within the path
     * Read only.
     */
    readonly lastSegment: Segment;

    /**
     * The curves contained within the path.
     * Array of Curve objects
     */
    readonly curves: ReadonlyArray<Curve>;

    /**
     * The first Curve contained within the path.
     * Read only.
     */
    readonly firstCurve: Curve;

    /**
     * The last Curve contained within the path.
     * Read only.
     */
    readonly lastCurve: Curve;

    /**
     * Specifies whether the path is closed. If it is closed, Paper.js connects the first and last segments.
     */
    closed: boolean;

    /**
     * The approximate length of the path in points.
     * Read only.
     */
    readonly length: number;

    /**
     * The area of the path in square points. Self-intersecting paths can contain sub-areas that cancel each other out.
     * Read only.
     */
    readonly area: number;

    /**
     * Specifies whether the path and all its segments are selected. Cannot be true on an empty path.
     */
    fullySelected: boolean;

    /**
     * Specifies whether the path is oriented clock-wise.
     */
    clockwise: boolean;

    /**
     * Returns a point that is guaranteed to be inside the path.
     * Read only.
     */
    readonly interiorPoint: Point;
  }

  export interface Path extends PathProps {}

  /**
   * The path item represents a path in a Paper.js project.
   */
  export class Path extends PathItem {
    /**
     * Creates a new path item and places it at the top of the active layer.
     * @param segments [optional] - An array of segments (or points to be
     * converted to segments) that will be added to the path
     */
    constructor(segments?: Segment[] | Point[]);

    /**
     * Creates a new path item from an object description and places it at the top of the active layer.
     * @param object - an object literal containing properties describing the path's attributes
     */
    constructor(object?: Partial<PathProps>);

    /**
     * Creates a new path item from SVG path-data and places it at the top of the active layer.
     * @param pathData - the SVG path-data that describes the geometry of this path.
     */
    constructor(pathData?: string);

    /**
     * Adds one or more segments to the end of the segments array of this path.
     * @param segment - the segment or point to be added.
     * Returns the added segment. This is not necessarily the same object,
     * e.g. if the segment to be added already belongs to another path.
     */
    add(segment: Segment | Point): Segment;

    /**
     * Inserts one or more segments at a given index in the list of this path's segments.
     * @param index - the index at which to insert the segment.
     * @param segment - the segment or point to be inserted.
     * Returns the added segment. This is not necessarily the same object, e.g.
     * if the segment to be added already belongs to another path.
     */
    insert(index: number, segment: Segment | Point): Segment;

    /**
     * Adds an array of segments (or types that can be converted to segments)
     * to the end of the segments array.
     * @param segments - Array of Segment objects
     * Returns an array of the added segments. These segments are not necessarily
     * the same objects, e.g. if the segment to be added already belongs to another path.
     */
    addSegments(segments: Segment[]): Segment[];

    /**
     * Inserts an array of segments at a given index in the path's segments array.
     * @param index - the index at which to insert the segments.
     * @param segments - the segments to be inserted.
     * Returns an array of the added segments. These segments are not necessarily
     * the same objects, e.g. if the segment to be added already belongs to another path.
     */
    insertSegments(index: number, segments: Segment[]): Segment[];

    /**
     * Removes the segment at the specified index of the path's segments array.
     * @param index - the index of the segment to be removed
     * Returns the removed segment
     */
    removeSegment(index: number): Segment;

    /**
     * Removes all segments from the path's segments array.
     * Returns an array containing the removed segments
     */
    removeSegments(): Segment[];

    /**
     * Removes the segments from the specified from index to the to index
     * from the path's segments array.
     * @param from - the beginning index, inclusive
     * @param to [optional = segments.length] - the ending index
     * Returns an array containing the removed segments
     */
    removeSegments(from: number, to?: number): Segment[];

    /**
     * Converts the curves in a path to straight lines with an even distribution of points.
     * The distance between the produced segments is as close as possible to the value
     * specified by the maxDistance parameter.
     * @param maxDistance - the maximum distance between the points
     */
    flatten(maxDistance: number): void;

    /**
     * Smooths a path by simplifying it. The path.segments array is analyzed and replaced
     * by a more optimal set of segments, reducing memory usage and speeding up drawing.
     * @param tolerance [optional = 2.5] -
     */
    simplify(tolerance?: number): void;

    /**
     * Splits the path at the given offset. After splitting, the path will be open.
     * If the path was open already, splitting will result in two paths.
     * @param offset - the offset at which to split the path as a number between 0 and path.length
     * Returns the newly created path after splitting, if any
     */
    split(offset: number): Path;

    /**
     * Splits the path at the given curve location. After splitting, the path will be open.
     * If the path was open already, splitting will result in two paths.
     * @param location - the curve location at which to split the path
     * Returns the newly created path after splitting, if any
     */
    split(location: CurveLocation): Path;

    /**
     * Splits the path at the given curve index and parameter. After splitting, the path
     * will be open. If the path was open already, splitting will result in two paths.
     * @param index - the index of the curve in the path.curves array at which to split
     * @param parameter - the parameter at which the curve will be split
     * Returns the newly created path after splitting, if any
     */
    split(index: number, parameter: number): Path;

    /**
     * Reverses the orientation of the path, by reversing all its segments.
     */
    reverse(): void;

    /**
     * Joins the path with the specified path, which will be removed in the process.
     * @param path - the path to join this path with
     * Returns the joined path
     */
    join(path: Path): Path;

    /**
     * Returns the curve location of the specified point if it lies on the path, null otherwise.
     * @param point - the point on the path.
     */
    getLocationOf(point: Point): CurveLocation;

    /**
     * Returns the length of the path from its beginning up to up to the specified point if it lies on the path, null otherwise.
     * @param point - the point on the path.
     */
    getOffsetOf(point: Point): number;

    /**
     * Returns the curve location of the specified offset on the path.
     * @param offset - the offset on the path, where 0 is at the beginning of the path and path.length at the end.
     * @param isParameter [optional=false] -
     */
    getLocationAt(offset: number, isParameter?: boolean): CurveLocation;

    /**
     * Calculates the point on the path at the given offset. Returns the point at the given offset
     * @param offset - the offset on the path, where 0 is at the beginning of the path and path.length at the end.
     * @param isParameter [optional=false] -
     */
    getPointAt(offset: number, isPatameter?: boolean): Point;

    /**
     * Calculates the tangent vector of the path at the given offset. Returns the tangent vector at the given offset
     * @param offset - the offset on the path, where 0 is at the beginning of the path and path.length at the end.
     * @param isParameter [optional=false] -
     */
    getTangentAt(offset: number, isPatameter?: boolean): Point;

    /**
     * Calculates the normal vector of the path at the given offset. Returns the normal vector at the given offset
     * @param offset - the offset on the path, where 0 is at the beginning of the path and path.length at the end.
     * @param isParameter [optional=false] -
     */
    getNormalAt(offset: number, isParameter?: boolean): Point;

    /**
     * Calculates the curvature of the path at the given offset. Curvatures indicate how sharply a path changes direction. A straight line has zero curvature, where as a circle has a constant curvature. The path's radius at the given offset is the reciprocal value of its curvature.
     * @param offset - the offset on the path, where 0 is at the beginning of the path and path.length at the end.
     * @param isParameter [optional=false] -
     * @param point - the point for which we search the nearest location
     */
    getCurvatureAt(offset: number, isParameter?: boolean, point?: Point): number;

    /**
     * Returns the nearest point on the path to the specified point.
     * @param point - the point for which we search the nearest point
     */
    getNearestPoint(point: Point): Point;
  }

  type PaperRectangle = Rectangle;

  namespace Path {
    export class Line extends Path {
      /**
       * Creates a linear path item from two points describing a line.
       * @param from - the line's starting point
       * @param to - the line's ending point
       */
      constructor(from: Point, to: Point);

      /**
       * Creates a linear path item from the properties described by an object literal.
       * @param object - an object literal containing properties describing the path's attributes
       */
      constructor(object?: Partial<PathProps>);
    }

    export class Circle extends Path {
      /**
       * Creates a circular path item.
       * @param center - the center point of the circle
       * @param radius - the radius of the circle
       */
      constructor(center: Point, radius: number);

      /**
       * Creates a circular path item from the properties described by an object literal.
       * @param object - an object literal containing properties describing the path's attributes
       */
      constructor(object?: Partial<PathProps>);
    }

    export class Rectangle extends Path {
      /**
       * Creates a rectangular path item, with optionally rounded corners.
       * @param rectangle - the rectangle object describing the geometry of the rectangular path to be created.
       * @param radius [optional] - the size of the rounded corners default: null
       */
      constructor(rectangle: PaperRectangle, radius?: Size);

      /**
       * Creates a rectangular path item from a point and a size object.
       * @param point - the rectangle's top-left corner.
       * @param size - the rectangle's size.
       */
      constructor(topLeft: Point, size: Size);

      /**
       * Creates a rectangular path item from the passed points. These do not necessarily need to be the top left and bottom right corners, the constructor figures out how to fit a rectangle between them.
       * @param from - the first point defining the rectangle
       * @param to - the second point defining the rectangle
       */
      constructor(from: Point, to: Point);

      /**
       * Creates a rectangular path item from the properties described by an object literal.
       * @param object - an object literal containing properties describing the path's attributes
       */
      constructor(object?: Partial<PathProps>);
    }

    export class Ellipse extends Path {
      /**
       * Creates an elliptical path item.
       * @param rectangle - the rectangle circumscribing the ellipse
       */
      constructor(rectangle: PaperRectangle);

      /**
       * Creates an elliptical path item from the properties described by an object literal.
       * @param object - an object literal containing properties describing the path's attributes
       */
      constructor(object?: Partial<PathProps>);
    }

    export class Arc extends Path {
      /**
       * Creates a circular arc path item
       * @param from - the starting point of the circular arc
       * @param through - the point the arc passes through
       * @param to - the end point of the arc
       */
      constructor(from: Point, through: Point, to: Point);

      /**
       * Creates an circular arc path item from the properties described by an object literal.
       * @param object - an object literal containing properties describing the path's attributes
       */
      constructor(object?: Partial<PathProps>);
    }

    export class RegularPolygon extends Path {
      /**
       * Creates a regular polygon shaped path item.
       * @param center - the center point of the polygon
       * @param sides - the number of sides of the polygon
       * @param radius - the radius of the polygon
       */
      constructor(center: Point, sides: number, radius: number);

      /**
       * Creates a regular polygon shaped path item from the properties described by an object literal.
       * @param object - an object literal containing properties describing the path's attributes
       */
      constructor(object?: Partial<PathProps>);
    }

    export class Star extends Path {
      /**
       * Creates a star shaped path item. The largest of radius1 and radius2 will be the outer radius of the star. The smallest of radius1 and radius2 will be the inner radius.
       * @param center - the center point of the star
       * @param points - the number of points of the star
       * @param radius1
       * @param radius2
       */
      constructor(center: Point, points: number, radius1: number, radius2: number);

      /**
       * Creates a star shaped path item from the properties described by an object literal.
       * @param object - an object literal containing properties describing the path's attributes
       */
      constructor(object?: Partial<PathProps>);
    }
  }
}
