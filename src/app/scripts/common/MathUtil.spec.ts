import { MathUtil, Matrix } from '.';

describe('MathUtil', () => {
  it('#transformPoint', () => {
    const point = { x: 1, y: 1 };
    const matrix = Matrix.identity();
    const transformed = MathUtil.transformPoint(point, matrix);
    expect(transformed).toEqual({ x: 1, y: 1 });
  });

  it('#areCollinear', () => {
    expect(MathUtil.areCollinear({ x: 16, y: 6 }, { x: 14, y: 5 }, { x: 19, y: 20 })).toEqual(
      false,
    );
  });
});
