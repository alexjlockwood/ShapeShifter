export class Point {

  static from(p: Point) {
    return new Point(p.x, p.y);
  }

  constructor(public readonly x = 0, public readonly y = 0) { }

  transform(...matrices: Matrix[]) {
    return matrices.reduce((p: Point, m: Matrix) => {
      return new Point(
        m.a * p.x + m.c * p.y + m.e * 1,
        m.b * p.x + m.d * p.y + m.f * 1,
      );
    }, this);
  }

  distanceTo(p: Point) {
    return Math.sqrt(Math.pow(this.y - p.y, 2) + Math.pow(this.x - p.x, 2));
  }

  toString() {
    return `(${this.x},${this.y})`;
  }
}

export class Matrix {
  constructor(
    public readonly a = 0,
    public readonly b = 0,
    public readonly c = 0,
    public readonly d = 0,
    public readonly e = 0,
    public readonly f = 0) { }

  invert() {
    const m = this;
    return new Matrix(
      m.d / (m.a * m.d - m.b * m.c),
      m.b / (m.b * m.c - m.a * m.d),
      m.c / (m.b * m.c - m.a * m.d),
      m.a / (m.a * m.d - m.b * m.c),
      (m.d * m.e - m.c * m.f) / (m.b * m.c - m.a * m.d),
      (m.b * m.e - m.a * m.f) / (m.a * m.d - m.b * m.c),
    );
  }
}

export class Rect {
  constructor(
    public l = 0,
    public t = 0,
    public r = 0,
    public b = 0) { }
}
