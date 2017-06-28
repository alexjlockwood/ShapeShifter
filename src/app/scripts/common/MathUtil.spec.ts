import { MathUtil, Matrix, Point } from '.';

describe('MathUtil', () => {
  it('#transformPoint', () => {
    const point = new Point(1, 1);
    const matrix = new Matrix(1, 0, 0, 1, 0, 0);
    const transformed = MathUtil.transformPoint(point, matrix);
    expect(transformed).toEqual(new Point(1, 1));
  });

  it('#areCollinear', () => {
    expect(MathUtil.areCollinear(new Point(16, 6), new Point(14, 5), new Point(19, 20))).toEqual(
      false,
    );
  });
});
