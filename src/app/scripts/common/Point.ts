import { Matrix } from '.';

/** An immutable point class. */
export class Point {
  constructor(public readonly x = 0, public readonly y = 0) { }

  equals(p: Point) {
    const diffX = Math.abs(this.x - p.x);
    const diffY = Math.abs(this.y - p.y);
    return diffX < 1e-8 && diffY < 1e-8;
  }

  toString() {
    return `(${this.x}, ${this.y})`;
  }
}
