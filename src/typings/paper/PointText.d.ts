declare module 'paper' {
  /**
   * A PointText item represents a piece of typography in your Paper.js project which starts from a certain point and extends by the amount of characters contained in it.
   */
  export class PointText extends TextItem {
    /**
     * Creates a point text item
     * @param point - the position where the text will start
     */
    constructor(point: Point);

    /**
     * Creates a point text item from the properties described by an object literal.
     * @param object - an object literal containing properties describing the path's attributes
     */
    constructor(object: any);

    /**
     * The PointText's anchor point
     */
    point: Point;
  }
}
