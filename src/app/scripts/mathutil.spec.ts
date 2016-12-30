import {} from 'jasmine';
import { Point, Matrix } from './mathutil';

describe('Point', () => {
  it('transform', () => {
    const point = new Point(1, 1);
    const matrix = new Matrix(1, 0, 0, 1, 0, 0);
    const transformed = point.transform(matrix);
    expect(transformed).toEqual(new Point(1, 1));
  });
});
