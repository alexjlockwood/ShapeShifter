import { Rect } from '.';

describe('Rect', () => {
  it('constructor', () => {
    let rect = new Rect();
    expect(rect.l).toBe(0);
    expect(rect.t).toBe(0);
    expect(rect.r).toBe(0);
    expect(rect.b).toBe(0);

    rect = new Rect(1, 2, 3, 4);
    expect(rect.l).toBe(1);
    expect(rect.t).toBe(2);
    expect(rect.r).toBe(3);
    expect(rect.b).toBe(4);
  });
});
