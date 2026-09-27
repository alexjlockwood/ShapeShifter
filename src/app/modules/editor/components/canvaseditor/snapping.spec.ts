import { PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { describe, expect, it } from 'vitest';

import {
  getSnapTargets,
  snapAlongLineToGrid,
  snapBounds,
  snapPoint,
  SnapTargets,
} from './snapping';

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

// Eight pixels for lines and four for the grid, at ten pixels a unit.
const THRESHOLDS = { lines: 0.8, grid: 0.4 };

describe('snapBounds', () => {
  it('lines up the closest edge or middle with the closest target in range', () => {
    // The box's middle is at 12.5, half a unit from the artboard's.
    const snap = snapBounds({ l: 10.5, t: 3.2, r: 14.5, b: 7.2 }, ARTBOARD, THRESHOLDS);
    expect(snap.dx).toBeCloseTo(-0.5, 9);
    expect(snap.guides).toEqual([{ axis: 'x', value: 12, from: 0, to: 24 }]);
    // Nothing is in range on y, so the top snaps to the pixel grid, without a guide.
    expect(snap.dy).toBeCloseTo(-0.2, 9);
  });

  it('shows a guide for every line the box lines up with', () => {
    // As wide as the gap from the left edge to the middle, so both edges line up.
    const snap = snapBounds({ l: 0.3, t: 5, r: 12.3, b: 9 }, ARTBOARD, THRESHOLDS);
    expect(snap.dx).toBeCloseTo(-0.3, 9);
    expect(snap.guides.map(g => g.value).sort((a, b) => a - b)).toEqual([0, 12]);
  });

  it('reaches each guide from the target to where the box ends up', () => {
    const targets: SnapTargets = { x: [{ value: 20, from: 2, to: 4 }], y: [] };
    const snap = snapBounds({ l: 16.2, t: 10.2, r: 19.8, b: 14.2 }, targets, THRESHOLDS);
    expect(snap.guides).toEqual([{ axis: 'x', value: 20, from: 2, to: 14 }]);
  });

  it("doesn't snap on an axis that's turned off", () => {
    const snap = snapBounds({ l: 10.5, t: 11.6, r: 14.5, b: 12.6 }, ARTBOARD, THRESHOLDS, {
      x: false,
      y: true,
    });
    expect(snap.dx).toBe(0);
    // The middle, at 12.1, is closer to the artboard's than the top is.
    expect(snap.dy).toBeCloseTo(-0.1, 9);
  });

  it('snaps to targets between whole units, before the pixel grid', () => {
    const targets: SnapTargets = { x: [{ value: 7.25, from: 0, to: 4 }], y: [] };
    // The left edge, at 6.6, is closer to the grid, but the target is in range.
    const snap = snapBounds({ l: 6.6, t: 10, r: 10.6, b: 12 }, targets, THRESHOLDS);
    expect(snap.dx).toBeCloseTo(0.65, 9);
    expect(snap.guides).toEqual([{ axis: 'x', value: 7.25, from: 0, to: 12 }]);
  });

  it('only snaps to the pixel grid when an edge is closer to it', () => {
    const none: SnapTargets = { x: [], y: [] };
    // Half a unit from the grid, which is in range of a line, but not of the grid.
    expect(snapBounds({ l: 3.5, t: 3.5, r: 5.5, b: 5.5 }, none, THRESHOLDS)).toEqual({
      dx: 0,
      dy: 0,
      guides: [],
    });
  });

  it('snaps points', () => {
    // To the artboard's right edge, and on y, to the pixel grid.
    const snap = snapPoint({ x: 23.7, y: 5.3 }, ARTBOARD, THRESHOLDS);
    expect(snap.dx).toBeCloseTo(0.3, 9);
    expect(snap.dy).toBeCloseTo(-0.3, 9);
    expect(snap.guides).toEqual([{ axis: 'x', value: 24, from: 0, to: 24 }]);
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

describe('snapAlongLineToGrid', () => {
  it('rounds the free coordinate of a horizontal or vertical line', () => {
    expect(snapAlongLineToGrid({ x: 2, y: 2.5 }, { x: 6.3, y: 2.5 }, 0.4)).toEqual({
      x: 6,
      y: 2.5,
    });
    expect(snapAlongLineToGrid({ x: 2, y: 2 }, { x: 2, y: 5.2 }, 0.4)).toEqual({ x: 2, y: 5 });
  });

  it('slides along a diagonal to a whole x, within the threshold', () => {
    expect(snapAlongLineToGrid({ x: 2, y: 2 }, { x: 6.05, y: 6.05 }, 0.4)).toEqual({ x: 6, y: 6 });
    expect(snapAlongLineToGrid({ x: 2, y: 2 }, { x: 6.5, y: 6.5 }, 0.4)).toEqual({
      x: 6.5,
      y: 6.5,
    });
  });
});

describe('snapping to guides', () => {
  it('snaps to a guide, with a snap guide that only covers the box', () => {
    const vl = new VectorLayer({ name: 'vl', children: [], width: 24, height: 24 });
    const targets = getSnapTargets(vl, [], new Set(), [
      { id: 'g', axis: 'x', value: 7 },
      { id: 'h', axis: 'y', value: 17 },
    ]);
    const snap = snapBounds({ l: 7.4, t: 16.5, r: 9.4, b: 16.9 }, targets, THRESHOLDS);
    expect(snap.dx).toBeCloseTo(-0.4, 9);
    expect(snap.dy).toBeCloseTo(0.1, 9);
    expect(snap.guides).toContainEqual({ axis: 'x', value: 7, from: 16.6, to: 17 });
  });
});

describe('snapping to even gaps', () => {
  // Two boxes in a row, 4 units apart.
  const ROW = [
    { l: 2, t: 2, r: 6, b: 6 },
    { l: 10, t: 2, r: 14, b: 6 },
  ];
  const targets: SnapTargets = { x: [], y: [], boxes: ROW };
  const gaps = { gaps: true };

  it('snaps a box into the middle of a gap', () => {
    // 2 wide, so it goes from 7 to 9 in the gap from 6 to 10.
    const snap = snapBounds({ l: 7.5, t: 3, r: 9.5, b: 5 }, targets, THRESHOLDS, undefined, gaps);
    expect(snap.dx).toBeCloseTo(-0.5, 9);
    const measured = snap.guides.filter(g => g.isGap);
    expect(measured.map(g => [g.from, g.to])).toEqual([
      [6, 7],
      [9, 10],
    ]);
    // Across the middle of where the boxes overlap.
    expect(measured.every(g => g.axis === 'y' && g.value === 4)).toBe(true);
  });

  it('snaps a box as far past the end of a row as the row is spaced', () => {
    const after = snapBounds(
      { l: 18.3, t: 2, r: 22.3, b: 6 },
      targets,
      THRESHOLDS,
      undefined,
      gaps,
    );
    expect(after.dx).toBeCloseTo(-0.3, 9);
    expect(after.guides.map(g => [g.from, g.to])).toEqual([
      [6, 10],
      [14, 18],
    ]);
    const before = snapBounds(
      { l: -6.4, t: 2, r: -2.4, b: 6 },
      targets,
      THRESHOLDS,
      undefined,
      gaps,
    );
    expect(before.dx).toBeCloseTo(0.4, 9);
  });

  it("ignores boxes that aren't in the same row, and doesn't snap to gaps unless asked", () => {
    const below = snapBounds(
      { l: 18.3, t: 8, r: 22.3, b: 12 },
      targets,
      THRESHOLDS,
      undefined,
      gaps,
    );
    expect(below.guides).toEqual([]);
    const withoutGaps = snapBounds({ l: 18.3, t: 2, r: 22.3, b: 6 }, targets, THRESHOLDS);
    expect(withoutGaps.guides).toEqual([]);
  });

  it('picks whichever of a line and a gap is closer, and shows both when they agree', () => {
    // The gap snap is 0.3 away, and a line is 0.2 away.
    const lineCloser = snapBounds(
      { l: 18.3, t: 2, r: 22.3, b: 6 },
      { ...targets, x: [{ value: 18.5, from: 0, to: 1 }] },
      THRESHOLDS,
      undefined,
      gaps,
    );
    expect(lineCloser.dx).toBeCloseTo(0.2, 9);
    expect(lineCloser.guides.some(g => g.isGap)).toBe(false);
    const agree = snapBounds(
      { l: 18.3, t: 2, r: 22.3, b: 6 },
      { ...targets, x: [{ value: 18, from: 0, to: 1 }] },
      THRESHOLDS,
      undefined,
      gaps,
    );
    expect(agree.dx).toBeCloseTo(-0.3, 9);
    expect(agree.guides.filter(g => g.isGap)).toHaveLength(2);
    expect(agree.guides.filter(g => !g.isGap)).toHaveLength(1);
  });

  it("only spaces out from neighbors, and doesn't land on a box", () => {
    // Three boxes, 2 apart: from 0 to 2, 4 to 6, and 8 to 10.
    const three: SnapTargets = {
      x: [],
      y: [],
      boxes: [0, 4, 8].map(l => ({ l, t: 0, r: l + 2, b: 2 })),
    };
    const snapX = (l: number, width: number) =>
      snapBounds({ l, t: 0, r: l + width, b: 2 }, three, THRESHOLDS, undefined, gaps);
    const isGapSnap = (snap: { guides: ReadonlyArray<{ isGap?: boolean }> }) =>
      snap.guides.some(g => g.isGap);
    // In the middle of the gap from 2 to 8 would be on the box from 4 to 6.
    expect(isGapSnap(snapX(4.3, 1))).toBe(false);
    // 6 past the end, as far as the first and last boxes are apart, skips the one between.
    expect(isGapSnap(snapX(16.3, 2))).toBe(false);
    // 2 past the end is the row's spacing.
    const spaced = snapX(12.3, 2);
    expect(isGapSnap(spaced)).toBe(true);
    expect(spaced.dx).toBeCloseTo(-0.3, 9);
  });

  it('beats the pixel grid', () => {
    // The left edge is 0.2 from the grid, but the gap snap is 0.3 away.
    const snap = snapBounds({ l: 18.3, t: 2, r: 22.3, b: 6 }, targets, THRESHOLDS, undefined, gaps);
    expect(snap.dx).toBeCloseTo(-0.3, 9);
  });
});
