import { MathUtil, Point } from '.';

/** An immutable Matrix class that uses the standard SVG transformation matrix notation. */
export class Matrix {
  constructor(
    public readonly a = 1,
    public readonly b = 0,
    public readonly c = 0,
    public readonly d = 1,
    public readonly e = 0,
    public readonly f = 0) { }

  /** Returns the dot product of this 2D transformation matrices with m. */
  dot(m: Matrix) {
    // [a c e]   [a' c' e']
    // [b d f] * [b' d' f']
    // [0 0 1]   [0  0  1 ]
    return new Matrix(
      this.a * m.a + this.c * m.b,
      this.b * m.a + this.d * m.b,
      this.a * m.c + this.c * m.d,
      this.b * m.c + this.d * m.d,
      this.a * m.e + this.c * m.f + this.e,
      this.b * m.e + this.d * m.f + this.f,
    );
  }

  /** Returns the inverse of this transformation matrix. */
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
    // Given unit vectors A = (0, 1) and B = (1, 0).
    // After matrix mapping, we got A' and B'. Let theta = the angle b/t A' and B'.
    // Therefore, the final scale we want is min(|A'| * sin(theta), |B'| * sin(theta)),
    // which is (|A'| * |B'| * sin(theta)) / max (|A'|, |B'|);
    // If max (|A'|, |B'|) = 0, that means either x or y has a scale of 0.
    //
    // For non-skew case, which is most of the cases, matrix scale is computing exactly the
    // scale on x and y axis, and take the minimal of these two.
    // For skew case, an unit square will mapped to a parallelogram. And this function will
    // return the minimal height of the 2 bases.

    const matrix = new Matrix(this.a, this.b, this.c, this.d, 0, 0);
    const vecA = MathUtil.transform(new Point(0, 1), matrix);
    const vecB = MathUtil.transform(new Point(1, 0), matrix);
    const scaleX = Math.hypot(vecA.x, vecA.y);
    const scaleY = Math.hypot(vecB.x, vecB.y);
    const crossProduct = vecA.y * vecB.x - vecA.x * vecB.y;
    const maxScale = Math.max(scaleX, scaleY);
    return maxScale > 0 ? Math.abs(crossProduct) / maxScale : 0;
  }
}
