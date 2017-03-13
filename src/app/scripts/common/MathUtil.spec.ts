import 'jasmine';
import { Point, Matrix, MathUtil } from '.';

describe('MathUtil', () => {
  it('Point transform', () => {
    const point = new Point(1, 1);
    const matrix = new Matrix(1, 0, 0, 1, 0, 0);
    const transformed = MathUtil.transformPoint(point, matrix);
    expect(transformed).toEqual(new Point(1, 1));
  });
});
