import * as MathUtil from './MathUtil';

/**
 * An immutable Matrix class that uses the standard SVG transformation
 * matrix notation.
 */
export class Matrix {
  static identity() {
    return new Matrix(1, 0, 0, 1, 0, 0);
  }

  /**
   * Flattens the matrices into a single matrix by performing matrix multiplication
   * on each in left to right order.
   */
  static flatten(matrices: ReadonlyArray<Matrix>) {
    return matrices.reduce((prev, curr) => prev.dot(curr), Matrix.identity());
  }

  /**
   * Creates a scaling transformation matrix.
   */
  static scaling(sx: number, sy: number) {
    return new Matrix(sx, 0, 0, sy, 0, 0);
  }

  /**
   * Creates a counter clockwise rotation transformation matrix.
   */
  static rotation(degrees: number) {
    const cosr = Math.cos(degrees * Math.PI / 180);
    const sinr = Math.sin(degrees * Math.PI / 180);
    return new Matrix(cosr, sinr, -sinr, cosr, 0, 0);
  }

  /**
   * Creates a translation transformation matrix.
   */
  static translation(tx: number, ty: number) {
    return new Matrix(1, 0, 0, 1, tx, ty);
  }

  constructor(
    public readonly a,
    public readonly b,
    public readonly c,
    public readonly d,
    public readonly e,
    public readonly f,
  ) {}

  /**
   * Returns the dot product of this 2D transformation matrices with m.
   */
  dot(m: Matrix) {
    // [a c e]   [a' c' e']
    // [b d f] * [b' d' f']
    // [0 0 1]   [0  0  1 ]
    return new Matrix(
      MathUtil.round(this.a * m.a + this.c * m.b),
      MathUtil.round(this.b * m.a + this.d * m.b),
      MathUtil.round(this.a * m.c + this.c * m.d),
      MathUtil.round(this.b * m.c + this.d * m.d),
      MathUtil.round(this.a * m.e + this.c * m.f + this.e),
      MathUtil.round(this.b * m.e + this.d * m.f + this.f),
    );
  }

  /**
   * Returns the inverse of this transformation matrix or undefined if the
   * matrix is not invertible.
   */
  invert(): Matrix | undefined {
    const m = this;
    let det = MathUtil.round(m.a * m.d - m.b * m.c);
    if (!det) {
      return undefined;
    }
    det = 1 / det;
    return new Matrix(
      MathUtil.round(m.d * det),
      MathUtil.round(-m.b * det),
      MathUtil.round(-m.c * det),
      MathUtil.round(m.a * det),
      MathUtil.round((m.c * m.f - m.d * m.e) * det),
      MathUtil.round((m.b * m.e - m.a * m.f) * det),
    );
  }

  /**
   * Extracts the x/y scaling from the transformation matrix.
   */
  getScaling() {
    const { a, b, c, d } = this;
    const sx = (a >= 0 ? 1 : -1) * Math.hypot(a, c);
    const sy = (d >= 0 ? 1 : -1) * Math.hypot(b, d);
    return { sx: MathUtil.round(sx), sy: MathUtil.round(sy) };
  }
  /**
   * Extracts the rotation in degrees from the transformation matrix.
   */
  getRotation() {
    return MathUtil.round(180 / Math.PI * Math.atan2(-this.c, this.a));
  }

  /**
   * Extracts the x/y translation from the transformation matrix.
   */
  getTranslation() {
    return { tx: MathUtil.round(this.e), ty: MathUtil.round(this.f) };
  }

  /**
   * Returns a single scale factor (to use for scaling a path's stroke width, etc.).
   */
  getScaleFactor() {
    // Given unit vectors u0 = (0, 1) and v0 = (1, 0).
    //
    // After matrix mapping, we get u1 and v1. Let Θ be the angle between u1 and v1.
    // Then the final scale we want is:
    //
    // Math.min(|u1|sin(Θ),|v1|sin(Θ)) = |u1||v1|sin(Θ) / Math.max(|u1|,|v1|)
    //
    // If Math.max(|u1|,|v1|) = 0, that means either x or y has a scale of 0.
    //
    // For the non-skew case, which is most of the cases, matrix scale is
    // computing exactly the scale on x and y axis, and take the minimal of these two.
    //
    // For the skew case, an unit square will mapped to a parallelogram,
    // and this function will return the minimal height of the 2 bases.
    const m = new Matrix(this.a, this.b, this.c, this.d, 0, 0);
    const u0 = { x: 0, y: 1 };
    const v0 = { x: 1, y: 0 };
    const u1 = MathUtil.transformPoint(u0, m);
    const v1 = MathUtil.transformPoint(v0, m);
    const sx = Math.hypot(u1.x, u1.y);
    const sy = Math.hypot(v1.x, v1.y);
    const dotProduct = u1.y * v1.x - u1.x * v1.y;
    const maxScale = Math.max(sx, sy);
    return maxScale > 0 ? Math.abs(dotProduct) / maxScale : 0;
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
