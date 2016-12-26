export class Point {
  static from(point: Point) {
    return new Point(point.x, point.y);
  }
  constructor(public x = 0, public y = 0) { }

  toString() {
    return `(${this.x},${this.y})`;
  }
}

export class TransformMatrix {
  constructor(public a = 0, public b = 0, public c = 0, public d = 0, public e = 0, public f = 0) { }
}

export class Rect {
  constructor(public l = 0, public t = 0, public r = 0, public b = 0) { }
}
