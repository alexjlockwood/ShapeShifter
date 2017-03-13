import { Point } from '.';

/** A simple rectangle container class. */
export class Rect {
  constructor(
    public l = 0,
    public t = 0,
    public r = 0,
    public b = 0) { }

  contains(p: Point) {
    return this.l <= p.x && p.x < this.r && this.t <= p.y && p.y < this.b;
  }
}
