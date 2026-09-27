import { PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { describe, expect, it } from 'vitest';

import { getSnapTargets, snapBounds, snapPoint, SnapTargets } from './snapping';

function square(name: string, l: number, t: number, size = 4) {
  return new PathLayer({
    name,
    children: [],
    pathData: new Path(
      `M ${l} ${t} L ${l + size} ${t} L ${l + size} ${t + size} L ${l} ${t + size} Z`,
    ),
  });
}

// An artboard's edges and middle, 24 units wide and tall.
const ARTBOARD: SnapTargets = {
  x: [0, 12, 24].map(value => ({ value, from: 0, to: 24 })),
  y: [0, 12, 24].map(value => ({ value, from: 0, to: 24 })),
};

describe('snapBounds', () => {
  it('lines up the closest edge or middle with the closest target in range', () => {
    // The box's middle is at 12.5, half a unit from the artboard's.
    const snap = snapBounds({ l: 10.5, t: 3.2, r: 14.5, b: 7.2 }, ARTBOARD, 0.8);
    expect(snap.dx).toBeCloseTo(-0.5, 9);
    expect(snap.guides).toEqual([{ axis: 'x', value: 12, from: 0, to: 24 }]);
    // Nothing is in range on y, so the top snaps to the pixel grid, without a guide.
    expect(snap.dy).toBeCloseTo(-0.2, 9);
  });

  it('shows a guide for every line the box lines up with', () => {
    // As wide as the gap from the left edge to the middle, so both edges line up.
    const snap = snapBounds({ l: 0.3, t: 5, r: 12.3, b: 9 }, ARTBOARD, 0.8);
    expect(snap.dx).toBeCloseTo(-0.3, 9);
    expect(snap.guides.map(g => g.value).sort((a, b) => a - b)).toEqual([0, 12]);
  });

  it('reaches each guide from the target to where the box ends up', () => {
    const targets: SnapTargets = { x: [{ value: 20, from: 2, to: 4 }], y: [] };
    const snap = snapBounds({ l: 16.2, t: 10.4, r: 19.8, b: 14.4 }, targets, 0.8);
    expect(snap.guides).toEqual([{ axis: 'x', value: 20, from: 2, to: 14 }]);
  });

  it("doesn't snap on an axis that's turned off", () => {
    const snap = snapBounds({ l: 10.5, t: 11.6, r: 14.5, b: 12.6 }, ARTBOARD, 0.8, {
      x: false,
      y: true,
    });
    expect(snap.dx).toBe(0);
    // The middle, at 12.1, is closer to the artboard's than the top is.
    expect(snap.dy).toBeCloseTo(-0.1, 9);
  });

  it('snaps points', () => {
    expect(snapPoint({ x: 23.7, y: 5.5 }, ARTBOARD, 0.8)).toMatchObject({ dy: 0.5 });
    expect(snapPoint({ x: 23.7, y: 5 }, ARTBOARD, 0.8).dx).toBeCloseTo(0.3, 9);
  });
});

describe('getSnapTargets', () => {
  it("snaps to the artboard and the visible paths that aren't moving", () => {
    const moving = square('moving', 2, 2);
    const hidden = square('hidden', 16, 16);
    const other = square('other', 10, 2);
    const vl = new VectorLayer({
      name: 'vector',
      children: [moving, hidden, other],
      width: 24,
      height: 24,
    });
    const { x, y } = getSnapTargets(vl, [moving.id], new Set([hidden.id]));
    expect(x.map(line => line.value)).toEqual([0, 12, 24, 10, 12, 14]);
    expect(y.map(line => line.value)).toEqual([0, 12, 24, 2, 4, 6]);
    expect(x[3]).toEqual({ value: 10, from: 2, to: 6 });
  });
});
