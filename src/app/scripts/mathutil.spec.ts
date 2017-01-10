import { Point, Matrix } from './mathutil';
import * as MathUtil from './mathutil';

describe('Point', () => {
  it('transform', () => {
    const point = new Point(1, 1);
    const matrix = new Matrix(1, 0, 0, 1, 0, 0);
    const transformed = MathUtil.transform(point, matrix);
    expect(transformed).toEqual(new Point(1, 1));
  });
});
