const EPSILON = 1e-8;

/**
 * An immutable point class.
 */
export class Point {
  constructor(
    public readonly x = 0,
    public readonly y = 0) { }

  /**
   * Returns true if the point is approximately equal to this point.
   */
  equals(p: Point) {
    const diffX = Math.abs(this.x - p.x);
    const diffY = Math.abs(this.y - p.y);
    return diffX < EPSILON && diffY < EPSILON;
  }

  toString() {
    return `(${this.x}, ${this.y})`;
  }
}
