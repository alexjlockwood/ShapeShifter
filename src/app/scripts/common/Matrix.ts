import { MathUtil, Point } from '.';

/**
 * An immutable Matrix class that uses the standard SVG transformation
 * matrix notation.
 */
export class Matrix {
  static flatten(...matrices: Matrix[]) {
    return matrices.reduce((prev, curr) => curr.dot(prev), new Matrix());
  }

  static fromRotation(degrees: number) {
    const cosr = Math.cos(degrees * Math.PI / 180);
    const sinr = Math.sin(degrees * Math.PI / 180);
    return new Matrix(cosr, sinr, -sinr, cosr, 0, 0);
  }

  static fromScaling(scaleX: number, scaleY: number) {
    return new Matrix(scaleX, 0, 0, scaleY, 0, 0);
  }

  static fromTranslation(translateX: number, translateY: number) {
    return new Matrix(1, 0, 0, 1, translateX, translateY);
  }

  /**
   * Note that the default no-args constructor creates the identity matrix.
   */
  constructor(
    public readonly a = 1,
    public readonly b = 0,
    public readonly c = 0,
    public readonly d = 1,
    public readonly e = 0,
    public readonly f = 0,
  ) {}

  /**
   * Returns the dot product of this 2D transformation matrices with m.
   */
  dot(m: Matrix) {
    // [a c e]   [a' c' e']
    // [b d f] * [b' d' f']
    // [0 0 1]   [0  0  1 ]
    return new Matrix(
      this.a * m.a + this.c * m.b || 0,
      this.b * m.a + this.d * m.b || 0,
      this.a * m.c + this.c * m.d || 0,
      this.b * m.c + this.d * m.d || 0,
      this.a * m.e + this.c * m.f + this.e || 0,
      this.b * m.e + this.d * m.f + this.f || 0,
    );
  }

  /**
   * Returns the inverse of this transformation matrix or undefined if the
   * matrix is not invertible.
   */
  invert(): Matrix | undefined {
    const m = this;
    let det = m.a * m.d - m.b * m.c;
    if (!det) {
      return undefined;
    }
    det = 1 / det;
    return new Matrix(
      m.d * det || 0,
      -m.b * det || 0,
      -m.c * det || 0,
      m.a * det || 0,
      (m.c * m.f - m.d * m.e) * det || 0,
      (m.b * m.e - m.a * m.f) * det || 0,
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
    const vecA = MathUtil.transformPoint({ x: 0, y: 1 }, matrix);
    const vecB = MathUtil.transformPoint({ x: 1, y: 0 }, matrix);
    const scaleX = Math.hypot(vecA.x, vecA.y);
    const scaleY = Math.hypot(vecB.x, vecB.y);
    const crossProduct = vecA.y * vecB.x - vecA.x * vecB.y;
    const maxScale = Math.max(scaleX, scaleY);
    return maxScale > 0 ? Math.abs(crossProduct) / maxScale : 0;
  }

  /**
   * Returns true if the matrix is approximately equal to this matrix.
   */
  equals(m: Matrix) {
    return (
      Math.abs(this.a - m.a) < 1e-9 &&
      Math.abs(this.b - m.b) < 1e-9 &&
      Math.abs(this.c - m.c) < 1e-9 &&
      Math.abs(this.d - m.d) < 1e-9 &&
      Math.abs(this.e - m.e) < 1e-9 &&
      Math.abs(this.f - m.f) < 1e-9
    );
  }
}
