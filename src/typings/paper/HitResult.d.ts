declare module 'paper' {
  export type HitType =
    | 'segment'
    | 'handle-in'
    | 'handle-out'
    | 'curve'
    | 'stroke'
    | 'fill'
    | 'bounds'
    | 'center'
    | 'pixel';

  export type HitName =
    | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right'
    | 'left-center'
    | 'top-center'
    | 'right-center'
    | 'bottom-center';

  /**
   * A HitResult object contains information about the results of a hit test.
   * It is returned by item.hitTest(point) and project.hitTest(point).
   */
  export class HitResult<C extends Item> {
    /**
     * Describes the type of the hit result. For example, if you hit
     * a segment point, the type would be 'segment'.
     */
    type: HitType;

    /**
     * If the HitResult has a hitResult.type of 'bounds', this property
     * describes which corner of the bounding rectangle was hit.
     */
    name: HitName;

    /**
     * The item that was hit.
     */
    item: C;

    /**
     * If the HitResult has a type of 'curve' or 'stroke', this property
     * gives more information about the exact position that was hit on the path.
     */
    location: CurveLocation;

    /**
     * If the HitResult has a type of 'pixel', this property refers to the
     * color of the pixel on the Raster that was hit.
     */
    color: Color;

    /**
     * If the HitResult has a type of 'stroke', 'segment', 'handle-in' or 'handle-out',
     * this property refers to the segment that was hit or that is closest
     * to the hitResult.location on the curve.
     */
    segment: Segment;

    /**
     * Describes the actual coordinates of the segment, handle or bounding
     * box corner that was hit.
     */
    point: Point;
  }
}
