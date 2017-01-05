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

  getScale() {
    // From getMatrixScale in
    // https://android.googlesource.com/platform/frameworks/base/+/master/libs/hwui/VectorDrawable.cpp

    // Given unit vectors A = (0, 1) and B = (1, 0).
    // After matrix mapping, we got A' and B'. Let theta = the angel b/t A' and B'.
    // Therefore, the final scale we want is min(|A'| * sin(theta), |B'| * sin(theta)),
    // which is (|A'| * |B'| * sin(theta)) / max (|A'|, |B'|);
    // If max (|A'|, |B'|) = 0, that means either x or y has a scale of 0.
    //
    // For non-skew case, which is most of the cases, matrix scale is computing exactly the
    // scale on x and y axis, and take the minimal of these two.
    // For skew case, an unit square will mapped to a parallelogram. And this function will
    // return the minimal height of the 2 bases.

    const matrix = new Matrix(this.a, this.b, this.c, this.d, 0, 0);
    const vecA = new Point(0, 1).transform(matrix);
    const vecB = new Point(1, 0).transform(matrix);
    const scaleX = Math.hypot(vecA.x, vecA.y);
    const scaleY = Math.hypot(vecB.x, vecB.y);
    const crossProduct = vecA.y * vecB.x - vecA.x * vecB.y;
    const maxScale = Math.max(scaleX, scaleY);
    return maxScale > 0 ? Math.abs(crossProduct) / maxScale : 0;
  }
}



export class Rect {
  constructor(
    public l = 0,
    public t = 0,
    public r = 0,
    public b = 0) { }
}
