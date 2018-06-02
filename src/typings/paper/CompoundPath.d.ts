declare module 'paper' {
  export interface CompoundPathProps extends PathItemProps {
    /**
     * Specifies whether the compound path is oriented clock-wise.
     */
    clockwise: boolean;
  }

  export interface CompoundPath extends CompoundPathProps {}

  /**
   * A compound path contains two or more paths, holes are drawn where
   * the paths overlap. All the paths in a compound path take on the
   * style of the backmost path and can be accessed through its item.children list.
   */
  export class CompoundPath extends PathItem {
    /**
     * Creates a new compound path item from an object description and places it at the top of the active layer.
     * @param object - an object literal containing properties to be set on the path
     */
    constructor(object?: Partial<CompoundPathProps>);

    /**
     * Creates a new compound path item from SVG path-data and places it at the top of the active layer.
     * @param pathData - the SVG path-data that describes the geometry of this path.
     */
    constructor(pathData: string);

    /**
     * The first Segment contained within the path.
     */
    readonly firstSegment: Segment;

    /**
     * The last Segment contained within the path.
     */
    readonly lastSegment: Segment;

    /**
     * All the curves contained within the compound-path, from all its child Path items.
     * Read Only
     */
    readonly curves: ReadonlyArray<Curve>;

    /**
     * The first Curve contained within the path.
     */
    readonly firstCurve: Curve;

    /**
     * The last Curve contained within the path.
     * Read only.
     */
    readonly lastCurve: Curve;

    /**
     * The area of the path in square points. Self-intersecting paths
     * can contain sub-areas that cancel each other out.
     */
    readonly area: number;

    /**
     * Reverses the orientation of all nested paths.
     */
    reverse(): void;
  }
}
