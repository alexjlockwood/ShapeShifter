export class Point {

  static from(p: Point) {
    return new Point(p.x, p.y);
  }

  constructor(public x = 0, public y = 0) { }

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
}

export class Matrix {
  constructor(
    public a = 0,
    public b = 0,
    public c = 0,
    public d = 0,
    public e = 0,
    public f = 0) { }

  inverse(m: Matrix) {
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
  constructor(public l = 0, public t = 0, public r = 0, public b = 0) { }
}
