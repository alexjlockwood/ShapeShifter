declare module 'paper' {
  /**
   * An affine transformation matrix performs a linear mapping from 2D coordinates to other 2D
   * coordinates that preserves the straightness and parallelness of lines.
   *
   * This class is optimized for speed and minimizes calculations based on its knowledge of
   * the underlying matrix (as opposed to say simply performing matrix multiplication).
   */
  export class Matrix {
    /**
     * Creates a 2D affine transformation matrix that describes the identity transformation.
     */
    constructor();

    /**
     * Creates a 2D affine transform.
     * @param a - the a property of the transform
     * @param b - the b property of the transform
     * @param c - the c property of the transform
     * @param d - the d property of the transform
     * @param tx - the tx property of the transform
     * @param ty - the ty property of the transform
     */
    constructor(a: number, b: number, c: number, d: number, tx: number, ty: number);

    constructor(values: [number, number, number, number, number, number]);

    constructor(matrix: Matrix);

    /**
     * The value that affects the transformation along the x axis when scaling or rotating,
     * positioned at (0, 0) in the transformation matrix.
     */
    a: number;

    /**
     * The value that affects the transformation along the y axis when rotating or skewing,
     * positioned at (1, 0) in the transformation matrix.
     */
    b: number;

    /**
     * The value that affects the transformation along the x axis when rotating or skewing,
     * positioned at (0, 1) in the transformation matrix.
     */
    c: number;

    /**
     * The value that affects the transformation along the y axis when scaling or rotating,
     * positioned at (1, 1) in the transformation matrix.
     */
    d: number;

    /**
     * The distance by which to translate along the x axis, positioned at (2, 0) in the
     * transformation matrix.
     */
    tx: number;

    /**
     * The distance by which to translate along the y axis, positioned at (2, 1) in the
     * transformation matrix.
     */
    ty: number;

    /**
     * The matrix values as an array, in the same sequence as they are passed to
     * initialize(a, b, c, d, tx, ty).
     */
    readonly values: number;

    /**
     * The translation of the matrix as a vector.
     */
    readonly translation: Point;

    /**
     * The scaling values of the matrix, if it can be decomposed.
     */
    readonly scaling: Point;

    /**
     * The rotation angle of the matrix, if it can be decomposed.
     */
    readonly rotation: number;

    /**
     * Sets the matrix to the identity matrix.
     */
    set(): Matrix;

    /**
     * Sets this transform to the matrix specified by the 6 values.
     * @param a - the a property of the transform
     * @param c - the c property of the transform
     * @param b - the b property of the transform
     * @param d - the d property of the transform
     * @param tx - the tx property of the transform
     * @param ty - the ty property of the transform
     */
    set(a: number, b: number, c: number, d: number, tx: number, ty: number): Matrix;

    set(values: [number, number, number, number, number, number]): Matrix;

    set(matrix: Matrix): Matrix;

    /**
     * Returns a copy of this matrix.
     */
    clone(): Matrix;

    /**
     * Checks whether the two matrices describe the same transformation.
     * @param matrix - the matrix to compare this matrix to
     */
    equals(matrix: Matrix): boolean;

    /**
     * returns a string representation of this transform
     */
    toString(): string;

    /**
     * Resets the matrix by setting its values to the ones of the
     * identity matrix that results in no transformation.
     */
    reset(): void;

    /**
     * Attempts to apply the matrix to the content of item that it belongs to,
     * meaning its transformation is baked into the item's content or children.
     * @param recursively - controls whether to apply transformations recursively on children
     */
    apply(): boolean;

    /**
     * Concatenates this transform with a translate transformation.
     * @param point - the vector to translate by
     */
    translate(point: Point): Matrix;

    /**
     * Concatenates this transform with a translate transformation.
     * @param dx - the distance to translate in the x direction
     * @param dy - the distance to translate in the y direction
     */
    translate(dx: number, dy: number): Matrix;

    /**
     * Concatenates this transform with a scaling transformation.
     * @param scale - the scaling factor
     * @param center [optional] - the center for the scaling transformation
     */
    scale(scale: number, center?: Point): Matrix;

    /**
     * Concatenates this transform with a scaling transformation.
     * @param hor - the horizontal scaling factor
     * @param ver - the vertical scaling factor
     * @param center [optional] - the center for the scaling transformation
     */
    scale(hor: number, ver: number, center?: Point): Matrix;

    /**
     * Concatenates this transform with a rotation transformation around an anchor point.
     * @param angle - the angle of rotation measured in degrees
     * @param center - the anchor point to rotate around
     */
    rotate(angle: number, center: Point): Matrix;

    /**
     * Concatenates this transform with a rotation transformation around an anchor point.
     * @param angle - the angle of rotation measured in degrees
     * @param x - the x coordinate of the anchor point
     * @param y - the y coordinate of the anchor point
     */
    rotate(angle: number, x: number, y: number): Matrix;

    /**
     * Concatenates this transform with a shear transformation.
     * @param shear - the shear factor in x and y direction
     * @param center [optional] - the center for the shear transformation
     */
    shear(shear: Point, center?: Point): Matrix;

    /**
     * Concatenates this transform with a shear transformation.
     * @param hor - the horizontal shear factor
     * @param ver - the vertical shear factor
     * @param center [optional] - the center for the shear transformation
     */
    shear(hor: number, ver: number, center?: Point): Matrix;

    /**
     * Concatenates this transform with a skew transformation.
     * @param skew - the skew angles in x and y direction in degrees
     * @param center [optional] - the center for the skew transformation
     */
    skew(skew: Point, center?: Point): Matrix;

    /**
     * Concatenates this transform with a skew transformation.
     * @param hor - the horizontal skew angle in degrees
     * @param ver - the vertical skew angle in degrees
     * @param center [optional] - the center for the skew transformation
     */
    skew(hor: number, ver: number, center?: Point): Matrix;

    /**
     * Concatenates the given affine transform to this transform.
     * @param mx - the transform to concatenate
     */
    append(mx: Matrix): Matrix;

    appended(mx: Matrix): Matrix;

    /**
     * Pre-concatenates the given affine transform to this transform.
     * @param mx - the transform to preconcatenate
     */
    prepend(mx: Matrix): Matrix;

    prepended(mx: Matrix): Matrix;

    invert(): Matrix;

    /**
     * Creates the inversion of the transformation of the matrix and returns
     * it as a new insteance. If the matrix is not invertible (in which case
     * isSingular() returns true), null is returned.
     */
    inverted(): Matrix;

    /**
     * Returns whether this transform is the identity transform
     */
    isIdentity(): boolean;

    /**
     * Returns whether the transform is invertible. A transform is not invertible if the determinant is 0 or any value is non-finite or NaN.
     */
    isInvertible(): boolean;

    /**
     * Checks whether the matrix is singular or not. Singular matrices cannot be inverted.
     */
    isSingular(): boolean;

    /**
     * Transforms a point and returns the result.
     * @param point - the point to be transformed
     */
    transform(point: Point): Point;

    /**
     * Transforms an array of coordinates by this matrix and stores the results into the destination array, which is also returned.
     * @param src - the array containing the source points as x, y value pairs
     * @param dst - the array into which to store the transformed point pairs
     * @param count - the number of points to transform
     */
    transform(src: number[], dst: number[], count: number): number[];

    /**
     * Inverse transforms a point and returns the result.
     * @param point - the point to be transformed
     */
    inverseTransform(point: Point): Point;

    /**
     * Attempts to decompose the affine transformation described by this matrix into scaling, rotation and shearing, and returns an object with these properties if it succeeded, null otherwise.
     */
    decompose(): any;

    /**
     * Applies this matrix to the specified Canvas Context.
     */
    applyToContext(ctx: CanvasRenderingContext2D): void;
  }
}
