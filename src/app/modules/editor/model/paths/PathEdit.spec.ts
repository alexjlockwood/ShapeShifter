import { Path } from 'app/modules/editor/model/paths';
import * as PathEdit from 'app/modules/editor/model/paths/PathEdit';
import { Point } from 'app/modules/editor/scripts/common';

const {
  addSubPath,
  appendAnchor,
  bendSegment,
  closeSubPath,
  deleteAnchors,
  duplicateAnchor,
  getAdjacentAnchorId,
  getAnchorCount,
  getAnchors,
  getPointOnSegment,
  getSubPathEnds,
  getSegments,
  insertAnchor,
  isSubPathClosed,
  moveAnchors,
  moveHandle,
  openSubPath,
  projectOntoSegments,
  reverseSubPath,
  setPointType,
} = PathEdit;

// A circle of radius 5 around (5, 5), starting on the left, with mirrored handles.
const CIRCLE =
  'M 0 5 C 0 2.239 2.239 0 5 0 C 7.761 0 10 2.239 10 5 C 10 7.761 7.761 10 5 10 C 2.239 10 0 7.761 0 5 Z';

function ids(path: Path) {
  return getAnchors(path).map(a => a.id);
}

function points(path: Path) {
  return getAnchors(path).map(({ point: { x, y } }) => [x, y]);
}

function expectClose(actual: Point, expected: Point, digits = 3) {
  expect(actual.x).toBeCloseTo(expected.x, digits);
  expect(actual.y).toBeCloseTo(expected.y, digits);
}

describe('PathEdit', () => {
  describe('getAnchors', () => {
    it('lists the ends of an open path', () => {
      const path = new Path('M 0 0 L 10 0 L 10 10');
      expect(points(path)).toEqual([
        [0, 0],
        [10, 0],
        [10, 10],
      ]);
      expect(ids(path)).toEqual(path.getCommands().map(c => c.id));
    });

    it('lists the first anchor of a closed path once', () => {
      for (const pathData of ['M 0 0 L 10 0 L 10 10 Z', 'M 0 0 L 10 0 L 10 10 L 0 0 Z']) {
        expect(points(new Path(pathData))).toEqual([
          [0, 0],
          [10, 0],
          [10, 10],
        ]);
      }
    });

    it('lists every subpath', () => {
      const path = new Path('M 0 0 L 10 0 Z M 20 20 L 30 30');
      expect(getAnchors(path).map(a => [a.subIdx, a.index])).toEqual([
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
      ]);
    });

    it('finds the handles on both sides of the first anchor of a closed curve', () => {
      const [first] = getAnchors(new Path(CIRCLE));
      expect(first.in).toEqual({ x: 0, y: 7.761 });
      expect(first.out).toEqual({ x: 0, y: 2.239 });
      expect(first.type).toBe('mirrored');
    });

    it('tells the point types apart', () => {
      const types = getAnchors(
        new Path('M 0 0 C 0 5 5 10 10 10 C 15 10 20 10 20 0 C 20 -5 30 0 30 0 L 40 0'),
      ).map(a => a.type);
      // The first anchor only has one handle, and the one between a curve with no handle there
      // and a line has none.
      expect(types).toEqual(['disconnected', 'mirrored', 'asymmetric', 'straight', 'straight']);
    });

    it('gives a quadratic curve one handle for both of its anchors', () => {
      const [start, end] = getAnchors(new Path('M 0 0 Q 5 5 10 0'));
      expect(start.out).toEqual({ x: 5, y: 5 });
      expect(end.in).toEqual({ x: 5, y: 5 });
    });
  });

  it('tells that short handles line up, after rounding to 3 decimals', () => {
    for (let degrees = 0; degrees < 360; degrees += 0.5) {
      const radians = (degrees * Math.PI) / 180;
      const [dx, dy] = [0.25 * Math.cos(radians), 0.25 * Math.sin(radians)];
      const pathData = `M -5 0 C -5 0 ${-dx} ${-dy} 0 0 C ${dx} ${dy} 5 0 5 0`;
      expect(getAnchors(new Path(pathData))[1].type).toBe('mirrored');
    }
  });

  describe('getSegments', () => {
    it('leaves out the Z with no length after a closing curve', () => {
      const path = new Path(CIRCLE);
      expect(getSegments(path)).toHaveLength(4);
      const anchorIds = ids(path);
      expect(getSegments(path)[3].startAnchorId).toBe(anchorIds[3]);
      expect(getSegments(path)[3].endAnchorId).toBe(anchorIds[0]);
    });

    it('includes the line that a closing Z draws', () => {
      const segments = getSegments(new Path('M 0 0 L 10 0 L 10 10 Z'));
      expect(segments.map(s => s.points)).toEqual([
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
        [
          { x: 10, y: 0 },
          { x: 10, y: 10 },
        ],
        [
          { x: 10, y: 10 },
          { x: 0, y: 0 },
        ],
      ]);
    });
  });

  describe('moveAnchors', () => {
    it('keeps the path and its ids when nothing moves', () => {
      for (const pathData of [CIRCLE, 'M 0 0 L 10 0 L 10 10 L 0 0 Z M 5 5 Q 6 6 7 5']) {
        const path = new Path(pathData);
        const moved = moveAnchors(path, new Set(), { x: 1, y: 1 });
        expect(moved.getPathString()).toBe(path.getPathString());
        expect(moved.getCommands().map(c => c.id)).toEqual(path.getCommands().map(c => c.id));
      }
    });

    it('moves the start and end of a closed subpath together', () => {
      const path = new Path('M 0 0 L 10 0 L 10 10 L 0 0 Z');
      const moved = moveAnchors(path, new Set([ids(path)[0]]), { x: 1, y: 2 });
      expect(moved.getPathString()).toBe('M 1 2 L 10 0 L 10 10 L 1 2 Z');
    });

    it('moves the handles with the anchor', () => {
      const path = new Path(CIRCLE);
      const moved = moveAnchors(path, new Set([ids(path)[1]]), { x: 0, y: -1 });
      expect(moved.getPathString()).toBe(
        'M 0 5 C 0 2.239 2.239 -1 5 -1 C 7.761 -1 10 2.239 10 5 C 10 7.761 7.761 10 5 10 C 2.239 10 0 7.761 0 5 Z',
      );
    });

    it("only moves a quadratic curve's control point with both of its anchors", () => {
      const path = new Path('M 0 0 Q 5 5 10 0');
      const [start, end] = ids(path);
      expect(moveAnchors(path, new Set([start]), { x: 1, y: 0 }).getPathString()).toBe(
        'M 1 0 Q 5 5 10 0',
      );
      expect(moveAnchors(path, new Set([start, end]), { x: 1, y: 0 }).getPathString()).toBe(
        'M 1 0 Q 6 5 11 0',
      );
    });

    it('moves the start of the next subpath with the end of the last', () => {
      const path = new Path('M 0 0 L 10 0 M 20 0 L 30 0');
      const moved = moveAnchors(path, new Set([ids(path)[1]]), { x: 0, y: 5 });
      expect(moved.getCommands()[2].start).toEqual({ x: 10, y: 5 });
      expect(moved.getCommands()[0].start).toBeUndefined();
    });
  });

  describe('moveHandle', () => {
    const path = new Path('M 0 0 C 0 5 5 10 10 10 C 15 10 20 5 20 0');
    const middle = () => getAnchors(path)[1].id;

    it('moves the handle on its own', () => {
      // Even though the point's handles are mirrored.
      const circle = new Path(CIRCLE);
      const moved = moveHandle(circle, ids(circle)[1], 'out', { x: 9, y: -1 });
      expect(getAnchors(moved)[1].in).toEqual({ x: 2.239, y: 0 });
      expect(getAnchors(moved)[1].out).toEqual({ x: 9, y: -1 });
      const other = moveHandle(path, middle(), 'in', { x: 10, y: 0 });
      expect(getAnchors(other)[1].out).toEqual({ x: 15, y: 10 });
    });

    it('mirrors the other handle, with the same length in the opposite direction', () => {
      const moved = moveHandle(path, middle(), 'out', { x: 10, y: 14 }, true);
      expect(getAnchors(moved)[1].in).toEqual({ x: 10, y: 6 });
      expect(getAnchors(moved)[1].out).toEqual({ x: 10, y: 14 });
      // The handles weren't lined up before, and they are now.
      const turned = moveHandle(path, middle(), 'in', { x: 7, y: 6 }, true);
      expect(getAnchors(turned)[1].out).toEqual({ x: 13, y: 14 });
      expect(getAnchors(turned)[1].type).toBe('mirrored');
    });

    it("moves a closed curve's handles across the start", () => {
      const circle = new Path(CIRCLE);
      const moved = moveHandle(circle, ids(circle)[0], 'in', { x: 0, y: 9 }, true);
      expect(getAnchors(moved)[0].out).toEqual({ x: 0, y: 1 });
      expect(moveHandle(circle, ids(circle)[0], 'in', { x: 0, y: 9 }).getPathString()).toBe(
        CIRCLE.replace('2.239 10 0 7.761', '2.239 10 0 9'),
      );
    });

    it("doesn't turn a quadratic curve's control point, which the next point shares", () => {
      const quadratic = new Path('M 0 0 Q 5 5 10 0 C 12 -2 18 -2 20 0');
      const moved = moveHandle(quadratic, ids(quadratic)[1], 'out', { x: 12, y: 2 }, true);
      expect(moved.getPathString()).toBe('M 0 0 Q 5 5 10 0 C 12 2 18 -2 20 0');
      // The curve after it still mirrors a quadratic curve's control point.
      const back = moveHandle(quadratic, ids(quadratic)[1], 'in', { x: 6, y: 6 }, true);
      expect(back.getPathString()).toBe('M 0 0 Q 6 6 10 0 C 14 -6 18 -2 20 0');
    });

    it("throws for a handle that a line doesn't have", () => {
      const line = new Path('M 0 0 L 10 0');
      expect(() => moveHandle(line, ids(line)[1], 'in', { x: 0, y: 0 }, true)).toThrow();
    });
  });

  describe('insertAnchor', () => {
    it('splits a line', () => {
      const path = new Path('M 0 0 L 10 0');
      const { path: split, anchorId } = insertAnchor(path, ids(path)[1], 0.25);
      expect(split.getPathString()).toBe('M 0 0 L 2.5 0 L 10 0');
      expect(ids(split)).toEqual([ids(path)[0], anchorId, ids(path)[1]]);
    });

    it("doesn't put a point on top of an end", () => {
      const path = new Path('M 0 0 L 10 0');
      const { path: split } = insertAnchor(path, ids(path)[1], 0);
      expect(getSegments(split)).toHaveLength(2);
    });

    it('splits the line that a Z draws', () => {
      const path = new Path('M 0 0 L 10 0 L 10 10 Z');
      const z = path.getCommands()[3].id;
      const { path: split } = insertAnchor(path, z, 0.5);
      expect(split.getPathString()).toBe('M 0 0 L 10 0 L 10 10 L 5 5 Z');
      expect(split.getCommands()[4].id).toBe(z);
    });

    it('splits a curve without changing its shape', () => {
      const path = new Path(CIRCLE);
      const segment = getSegments(path)[0];
      const { path: split, anchorId } = insertAnchor(path, segment.id, 0.5);
      const anchor = getAnchors(split).find(a => a.id === anchorId);
      expectClose(anchor?.point ?? { x: NaN, y: NaN }, getPointOnSegment(path, segment.id, 0.5));
      const [left, right] = getSegments(split);
      expectClose(
        getPointOnSegment(split, left.id, 0.5),
        getPointOnSegment(path, segment.id, 0.25),
      );
      expectClose(
        getPointOnSegment(split, right.id, 0.5),
        getPointOnSegment(path, segment.id, 0.75),
      );
      // Half of a quarter circle is symmetrical, so the new anchor is too.
      expect(anchor?.type).toBe('mirrored');
    });
  });

  describe('duplicateAnchor', () => {
    it('puts a copy after a point, which takes its out handle and keeps the ids', () => {
      const path = new Path('M 0 0 C 0 5 5 10 10 10 C 15 10 20 5 20 0');
      const [a, b, c] = ids(path);
      const { path: copied, anchorId } = duplicateAnchor(path, b);
      expect(copied.getPathString()).toBe('M 0 0 C 0 5 5 10 10 10 L 10 10 C 15 10 20 5 20 0');
      expect(ids(copied)).toEqual([a, b, anchorId, c]);
      const [, original, copy] = getAnchors(copied);
      expect(original.in).toEqual({ x: 5, y: 10 });
      expect(original.out).toBeUndefined();
      expect(copy.in).toBeUndefined();
      expect(copy.out).toEqual({ x: 15, y: 10 });
      // Moving the copy moves the handle it took.
      const moved = moveAnchors(copied, new Set([anchorId]), { x: 0, y: 5 });
      expect(moved.getPathString()).toBe('M 0 0 C 0 5 5 10 10 10 L 10 15 C 15 15 20 5 20 0');
    });

    it('keeps quadratic curves', () => {
      const path = new Path('M 0 0 Q 5 5 10 0 Q 15 -5 20 0');
      const { path: copied } = duplicateAnchor(path, ids(path)[1]);
      expect(copied.getPathString()).toBe('M 0 0 Q 5 5 10 0 L 10 0 Q 15 -5 20 0');
    });

    it('keeps the Z of a closed subpath', () => {
      const path = new Path('M 0 0 L 10 0 L 10 10 Z');
      const [a, b, c] = ids(path);
      const z = path.getCommands()[3].id;
      const last = duplicateAnchor(path, c);
      expect(last.path.getPathString()).toBe('M 0 0 L 10 0 L 10 10 L 10 10 Z');
      expect(ids(last.path)).toEqual([a, b, c, last.anchorId]);
      expect(last.path.getCommands()[4].id).toBe(z);
      const first = duplicateAnchor(path, a);
      expect(first.path.getPathString()).toBe('M 0 0 L 0 0 L 10 0 L 10 10 Z');
      expect(ids(first.path)).toEqual([a, first.anchorId, b, c]);
      expect(isSubPathClosed(first.path, 0)).toBe(true);
    });

    it("keeps the closing curve of a closed subpath, and its first point's in handle", () => {
      const path = new Path(CIRCLE);
      const { path: copied, anchorId } = duplicateAnchor(path, ids(path)[0]);
      expect(copied.getCommands().map(c => c.type)).toEqual(['M', 'L', 'C', 'C', 'C', 'C', 'Z']);
      const [first, copy] = getAnchors(copied);
      expect(first.in).toEqual({ x: 0, y: 7.761 });
      expect(copy.id).toBe(anchorId);
      expect(copy.out).toEqual({ x: 0, y: 2.239 });
      expect(ids(copied)).toEqual([ids(path)[0], anchorId, ...ids(path).slice(1)]);
    });

    it('extends the last point of an open subpath', () => {
      const path = new Path('M 0 0 L 10 0 C 12 2 12 8 10 10');
      const { path: copied, anchorId } = duplicateAnchor(path, ids(path)[2]);
      expect(copied.getPathString()).toBe('M 0 0 L 10 0 C 12 2 12 8 10 10 L 10 10');
      expect(ids(copied)).toEqual([...ids(path), anchorId]);
      expect(getAnchors(copied)[2].in).toEqual({ x: 12, y: 8 });
    });

    it('puts a copy before the first point of an open subpath, as its new start', () => {
      const path = new Path('M 0 0 C 2 2 8 2 10 0 L 20 0 M 30 0 L 40 0');
      const { path: copied, anchorId } = duplicateAnchor(path, ids(path)[0]);
      expect(copied.getPathString()).toBe('M 0 0 L 0 0 C 2 2 8 2 10 0 L 20 0 M 30 0 L 40 0');
      expect(ids(copied)).toEqual([anchorId, ...ids(path)]);
      // The original keeps its handle.
      expect(getAnchors(copied)[1].out).toEqual({ x: 2, y: 2 });
      // Also in a later subpath, and for a subpath that's one point.
      const second = duplicateAnchor(path, ids(path)[3]);
      expect(second.path.getPathString()).toBe('M 0 0 C 2 2 8 2 10 0 L 20 0 M 30 0 L 30 0 L 40 0');
      const dot = new Path('M 5 5');
      const copiedDot = duplicateAnchor(dot, ids(dot)[0]);
      expect(copiedDot.path.getPathString()).toBe('M 5 5 L 5 5');
      expect(ids(copiedDot.path)).toEqual([ids(dot)[0], copiedDot.anchorId]);
    });
  });

  describe('deleteAnchors', () => {
    it('joins two lines', () => {
      const path = new Path('M 0 0 L 5 5 L 10 0');
      expect(deleteAnchors(path, new Set([ids(path)[1]]))?.getPathString()).toBe('M 0 0 L 10 0');
    });

    it('deletes the ends of an open path', () => {
      const path = new Path('M 0 0 L 5 5 L 10 0');
      const [first, , last] = ids(path);
      expect(deleteAnchors(path, new Set([first]))?.getPathString()).toBe('M 5 5 L 10 0');
      expect(deleteAnchors(path, new Set([last]))?.getPathString()).toBe('M 0 0 L 5 5');
    });

    it('keeps the ids of the anchors that are left', () => {
      const path = new Path('M 0 0 L 5 5 L 10 0 L 15 5');
      const [a, b, c, d] = ids(path);
      expect(ids(deleteAnchors(path, new Set([a, c])) as Path)).toEqual([b, d]);
    });

    it('deletes the first anchor of a closed path', () => {
      const path = new Path('M 0 0 L 10 0 L 10 10 L 0 10 Z');
      const [a, b, c, d] = ids(path);
      const deleted = deleteAnchors(path, new Set([a])) as Path;
      expect(deleted.getPathString()).toBe('M 10 0 L 10 10 L 0 10 Z');
      expect(ids(deleted)).toEqual([b, c, d]);
    });

    it('deletes the last anchor of a closed path', () => {
      const path = new Path('M 0 0 L 10 0 L 10 10 L 0 10 Z');
      expect(deleteAnchors(path, new Set([ids(path)[3]]))?.getPathString()).toBe(
        'M 0 0 L 10 0 L 10 10 Z',
      );
    });

    it('joins two curves along the same line into a line', () => {
      const path = new Path('M 0 0 C 1 0 2 0 3 0 C 5 0 8 0 10 0');
      expect(deleteAnchors(path, new Set([ids(path)[1]]))?.getPathString()).toBe('M 0 0 L 10 0');
    });

    it('fits a curve to the two it replaces', () => {
      const path = new Path(CIRCLE);
      const deleted = deleteAnchors(path, new Set([ids(path)[1]])) as Path;
      const [merged] = getSegments(deleted);
      expect(merged.points).toHaveLength(4);
      // The tangents at the ends stay the same: straight up from the left, and straight down to
      // the right.
      expect(merged.points[1].x).toBeCloseTo(0);
      expect(merged.points[1].y).toBeLessThan(5);
      expect(merged.points[2].x).toBeCloseTo(10);
      expect(merged.points[2].y).toBeLessThan(5);
      // And it passes close to where the deleted anchor was.
      expect(getPointOnSegment(deleted, merged.id, 0.5).y).toBeLessThan(1);
    });

    it('deletes the first anchor of a closed curve', () => {
      const path = new Path(CIRCLE);
      const deleted = deleteAnchors(path, new Set([ids(path)[0]])) as Path;
      expect(ids(deleted)).toEqual(ids(path).slice(1));
      expect(deleted.getPathString()).toMatch(/^M 5 0 C .* Z$/);
      expect(getSegments(deleted)).toHaveLength(3);
    });

    it('closes with a Z after a curve that replaces a Z', () => {
      const path = new Path('M 0 0 C 5 -5 10 -5 10 0 L 10 10 Z');
      const deleted = deleteAnchors(path, new Set([ids(path)[0]])) as Path;
      expect(deleted.getCommands().map(c => c.type)).toEqual(['M', 'L', 'C', 'Z']);
    });

    it('keeps the subpaths that were only ever one point', () => {
      const path = new Path('M 0 0 L 10 0 L 10 10 M 20 20 Z');
      expect(deleteAnchors(path, new Set([ids(path)[1]]))?.getPathString()).toBe(
        'M 0 0 L 10 10 M 20 20 Z',
      );
    });

    it('deletes subpaths with one anchor left, and returns undefined for no path', () => {
      const path = new Path('M 0 0 L 10 0 M 20 0 L 30 0');
      const [a, b, c] = ids(path);
      expect(deleteAnchors(path, new Set([a]))?.getPathString()).toBe('M 20 0 L 30 0');
      expect(deleteAnchors(path, new Set([a, b, c]))).toBeUndefined();
    });
  });

  describe('setPointType', () => {
    it('makes a smooth point straight, and a curve with no handles a line', () => {
      const path = new Path('M 0 0 C 0 5 5 10 10 10 C 15 10 20 5 20 0');
      const straight = setPointType(path, new Set(ids(path)), 'straight');
      expect(straight.getPathString()).toBe('M 0 0 L 10 10 L 20 0');
    });

    it("leaves the curves that aren't next to a straightened point alone", () => {
      // The first curve has no handles, which may be on purpose, e.g. to morph with a curve.
      const path = new Path('M 0 0 C 0 0 10 0 10 0 L 20 5 L 30 0');
      expect(setPointType(path, new Set([ids(path)[2]]), 'straight').getPathString()).toBe(
        path.getPathString(),
      );
    });

    it('puts a missing handle across from the other one', () => {
      // The middle point's in handle is on the point, and its out handle is 6 long.
      const path = new Path('M 0 0 C 0 5 10 10 10 10 C 16 10 20 5 20 0');
      const mirrored = getAnchors(setPointType(path, new Set([ids(path)[1]]), 'mirrored'))[1];
      expect(mirrored.type).toBe('mirrored');
      expect(mirrored.in).toEqual({ x: 4, y: 10 });
      expect(mirrored.out).toEqual({ x: 16, y: 10 });
      const asymmetric = getAnchors(setPointType(path, new Set([ids(path)[1]]), 'asymmetric'))[1];
      expect(asymmetric.type).toBe('asymmetric');
    });

    it('lines up handles that point the same way along the line between the neighbors', () => {
      const path = new Path('M 0 0 C 0 5 5 5 10 10 C 5 5 20 5 20 0');
      expect(getAnchors(setPointType(path, new Set([ids(path)[1]]), 'mirrored'))[1].type).toBe(
        'mirrored',
      );
    });

    it("leaves points alone that can't be smooth", () => {
      // The ends of an open path only have one handle, and the neighbors of the middle point of
      // a closed path with two points are the same point.
      for (const [pathData, index] of [
        ['M 0 0 L 10 0 L 20 5', 0],
        ['M 0 0 L 10 0 L 20 5', 2],
        ['M 0 0 L 10 0 Z', 1],
      ] as const) {
        const path = new Path(pathData);
        expect(setPointType(path, new Set([ids(path)[index]]), 'mirrored').getPathString()).toBe(
          path.getPathString(),
        );
      }
    });

    it('makes a straight point mirrored, along the line between its neighbors', () => {
      const path = new Path('M 0 0 L 10 0 L 10 10 L 0 10 Z');
      const anchorId = ids(path)[1];
      const mirrored = setPointType(path, new Set([anchorId]), 'mirrored');
      const anchor = getAnchors(mirrored)[1];
      expect(anchor.type).toBe('mirrored');
      // The neighbors are (0, 0) and (10, 10), so the handles point down and to the left.
      expectClose(anchor.out ?? { x: NaN, y: NaN }, {
        x: 10 + 10 / 3 / Math.SQRT2,
        y: 10 / 3 / Math.SQRT2,
      });
      expect(mirrored.getCommands().map(c => c.type)).toEqual(['M', 'C', 'C', 'L', 'Z']);
      // The ids stay, so the anchor stays selected.
      expect(ids(mirrored)).toEqual(ids(path));
    });

    it('makes the first point of a closed path smooth across the Z', () => {
      const path = new Path('M 0 0 L 10 0 L 10 10 Z');
      const smooth = setPointType(path, new Set([ids(path)[0]]), 'asymmetric');
      expect(smooth.getCommands().map(c => c.type)).toEqual(['M', 'C', 'L', 'C', 'Z']);
      expect(getAnchors(smooth)[0].type).toBe('asymmetric');
    });

    it('lines up disconnected handles and evens them out', () => {
      const path = new Path('M 0 0 C 0 5 8 10 10 10 C 14 12 20 5 20 0');
      const asymmetric = getAnchors(setPointType(path, new Set([ids(path)[1]]), 'asymmetric'))[1];
      expect(asymmetric.type).toBe('asymmetric');
      const mirrored = getAnchors(setPointType(path, new Set([ids(path)[1]]), 'mirrored'))[1];
      expect(mirrored.type).toBe('mirrored');
    });

    it('turns quadratic curves into cubic ones', () => {
      const path = new Path('M 0 0 Q 5 5 10 0 Q 15 -5 20 0');
      const straight = setPointType(path, new Set([ids(path)[1]]), 'straight');
      expect(straight.getPathString()).toBe(
        'M 0 0 C 3.333 3.333 10 0 10 0 C 10 0 16.667 -3.333 20 0',
      );
    });
  });

  describe('bendSegment', () => {
    it('bends near an end without swinging the other way', () => {
      const path = new Path('M 0 0 L 10 0');
      const segmentId = ids(path)[1];
      const bent = bendSegment(path, segmentId, 0.1, { x: 0, y: 5 });
      expectClose(getPointOnSegment(bent, segmentId, 0.1), { x: 1, y: 5 });
      for (let t = 0; t <= 1; t += 0.05) {
        expect(getPointOnSegment(bent, segmentId, t).y).toBeGreaterThanOrEqual(-1e-9);
      }
    });

    it('bends a line so that the point that was dragged follows', () => {
      const path = new Path('M 0 0 L 10 0');
      const segmentId = ids(path)[1];
      const bent = bendSegment(path, segmentId, 0.5, { x: 0, y: 4 });
      expect(bent.getCommands()[1].type).toBe('C');
      expectClose(getPointOnSegment(bent, segmentId, 0.5), { x: 5, y: 4 });
    });

    it('bends a curve away from the middle', () => {
      const path = new Path(CIRCLE);
      const [segment] = getSegments(path);
      const before = getPointOnSegment(path, segment.id, 0.3);
      const bent = bendSegment(path, segment.id, 0.3, { x: -1, y: -1 });
      expectClose(getPointOnSegment(bent, segment.id, 0.3), { x: before.x - 1, y: before.y - 1 });
      expect(getAnchors(bent).map(a => a.point)).toEqual(getAnchors(path).map(a => a.point));
    });
  });

  describe('projectOntoSegments', () => {
    it('finds the closest point', () => {
      const path = new Path('M 0 0 L 10 0 L 10 10');
      const projection = projectOntoSegments(path, { x: 12, y: 4 });
      expect(projection?.segmentId).toBe(ids(path)[2]);
      expectClose(projection?.point ?? { x: NaN, y: NaN }, { x: 10, y: 4 });
      expect(projection?.t).toBeCloseTo(0.4);
      expect(projection?.distance).toBeCloseTo(2);
    });
  });

  describe('getAdjacentAnchorId', () => {
    it('goes on to the next subpath, and around at the end of the path', () => {
      const path = new Path('M 0 0 L 10 0 L 10 10 Z M 20 20 L 30 30');
      const [a, b, c, d, e] = ids(path);
      expect(getAdjacentAnchorId(path, a, 1)).toBe(b);
      expect(getAdjacentAnchorId(path, c, 1)).toBe(d);
      expect(getAdjacentAnchorId(path, d, -1)).toBe(c);
      expect(getAdjacentAnchorId(path, e, 1)).toBe(a);
      expect(getAdjacentAnchorId(path, a, -1)).toBe(e);
    });
  });

  describe('drawing', () => {
    it('starts a path with one point, and adds lines and curves to it', () => {
      const start = addSubPath(undefined, { x: 1, y: 2 });
      expect(start.path.getPathString()).toBe('M 1 2');
      expect(ids(start.path)).toEqual([start.anchorId]);
      const line = appendAnchor(start.path, 0, { x: 5, y: 2 });
      expect(line.path.getPathString()).toBe('M 1 2 L 5 2');
      const curve = appendAnchor(line.path, 0, { x: 5, y: 6 }, { c2: { x: 7, y: 6 } });
      expect(curve.path.getPathString()).toBe('M 1 2 L 5 2 C 5 2 7 6 5 6');
      expect(ids(curve.path)).toEqual([start.anchorId, line.anchorId, curve.anchorId]);
      expect(getAnchorCount(curve.path, 0)).toBe(3);
    });

    it('adds a subpath to an existing path', () => {
      const { path, subIdx } = addSubPath(new Path('M 0 0 L 10 0 Z'), { x: 20, y: 20 });
      expect(subIdx).toBe(1);
      expect(appendAnchor(path, subIdx, { x: 30, y: 20 }).path.getPathString()).toBe(
        'M 0 0 L 10 0 Z M 20 20 L 30 20',
      );
    });

    it('closes a subpath with a line or a curve', () => {
      const path = new Path('M 0 0 L 10 0 L 10 10');
      expect(closeSubPath(path, 0).getPathString()).toBe('M 0 0 L 10 0 L 10 10 Z');
      const curved = closeSubPath(path, 0, { c2: { x: -2, y: 4 } });
      expect(curved.getPathString()).toBe('M 0 0 L 10 0 L 10 10 C 10 10 -2 4 0 0 Z');
      expect(getAnchors(curved)).toHaveLength(3);
      expect(() => closeSubPath(curved, 0)).toThrow();
      // A drag on the first point pulls out its handle into the first segment too.
      expect(closeSubPath(path, 0, { c2: { x: -2, y: 4 } }, { x: 2, y: -4 }).getPathString()).toBe(
        'M 0 0 C 2 -4 6.667 0 10 0 L 10 10 C 10 10 -2 4 0 0 Z',
      );
    });

    it('merges a last point on top of the first one when it closes, but not for the pen', () => {
      const path = new Path('M 0 0 L 10 0 L 10 10 L 0 0');
      expect(closeSubPath(path, 0).getPathString()).toBe('M 0 0 L 10 0 L 10 10 Z');
      const curve = new Path('M 0 0 L 10 0 C 10 5 5 5 0 0');
      expect(closeSubPath(curve, 0).getPathString()).toBe('M 0 0 L 10 0 C 10 5 5 5 0 0 Z');
      expect(getAnchors(closeSubPath(curve, 0))).toHaveLength(2);
      // A curve back from the pen is its own segment.
      expect(closeSubPath(path, 0, { c2: { x: 2, y: 2 } }).getPathString()).toBe(
        'M 0 0 L 10 0 L 10 10 L 0 0 C 0 0 2 2 0 0 Z',
      );
      // Two points in the same place still make a subpath.
      expect(closeSubPath(new Path('M 0 0 L 0 0'), 0).getPathString()).toBe('M 0 0 L 0 0 Z');
    });

    it('opens a closed subpath at its first point, keeping the shape and the ids', () => {
      const path = new Path('M 0 0 L 10 0 L 10 10 Z M 20 20 L 30 20 L 30 30 Z');
      const opened = openSubPath(path, 0);
      expect(opened.getPathString()).toBe('M 0 0 L 10 0 L 10 10 L 0 0 M 20 20 L 30 20 L 30 30 Z');
      expect(opened.getCommands().map(c => c.id)).toEqual(path.getCommands().map(c => c.id));
      expect(isSubPathClosed(opened, 0)).toBe(false);
      expect(isSubPathClosed(opened, 1)).toBe(true);
      // The first point and the new last one are the ends.
      expect(getSubPathEnds(opened).map(end => end.point)).toEqual([
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ]);
      // Close undoes it.
      const closed = closeSubPath(opened, 0);
      expect(closed.getPathString()).toBe(path.getPathString());
      expect(closed.getCommands().map(c => c.id)).toEqual(path.getCommands().map(c => c.id));
      expect(openSubPath(path, 1).getPathString()).toBe(
        'M 0 0 L 10 0 L 10 10 Z M 20 20 L 30 20 L 30 30 L 20 20',
      );
    });

    it('opens a subpath whose last segment goes back to the start by dropping the Z', () => {
      const path = new Path(CIRCLE);
      const opened = openSubPath(path, 0);
      expect(opened.getPathString()).toBe(CIRCLE.slice(0, -2));
      expect(ids(opened)).toEqual([...ids(path), path.getCommands()[4].id]);
      expect(getAnchors(opened)[4].in).toEqual({ x: 0, y: 7.761 });
      expect(closeSubPath(opened, 0).getPathString()).toBe(CIRCLE);
      const line = new Path('M 0 0 L 10 0 L 10 10 L 0 0 Z');
      expect(openSubPath(line, 0).getPathString()).toBe('M 0 0 L 10 0 L 10 10 L 0 0');
    });

    it("doesn't open a subpath that isn't closed", () => {
      expect(() => openSubPath(new Path('M 0 0 L 10 0 L 0 0'), 0)).toThrow();
      expect(() => openSubPath(new Path('M 0 0 L 10 0 Z'), 1)).toThrow();
    });

    it('tells a subpath closed by a Z from one that only ends where it starts', () => {
      const path = new Path('M 0 0 L 10 0 L 0 0 M 20 20 L 30 30 Z M 40 40 Z');
      expect([0, 1, 2, 3].map(i => isSubPathClosed(path, i))).toEqual([false, true, true, false]);
    });

    it('reverses an open subpath, keeping the ids of its anchors', () => {
      const path = new Path('M 0 0 L 10 0 C 12 2 12 8 10 10');
      const reversed = reverseSubPath(path, 0);
      expect(reversed.getPathString()).toBe('M 10 10 C 12 8 12 2 10 0 L 0 0');
      expect(ids(reversed)).toEqual([...ids(path)].reverse());
    });

    it('finds the ends of the open subpaths', () => {
      const path = new Path('M 0 0 L 10 0 Z M 20 0 L 30 0 M 40 40');
      const [, , c, d, e] = ids(path);
      expect(getSubPathEnds(path).map(end => [end.anchorId, end.isStart])).toEqual([
        [c, true],
        [d, false],
        [e, false],
      ]);
    });
  });
});

describe('reversing a closed subpath', () => {
  it('goes around the other way from the same first point, keeping the ids', () => {
    const path = new Path('M 0 0 L 10 0 L 10 10 Z');
    const reversed = reverseSubPath(path, 0);
    expect(reversed.getPathString()).toBe('M 0 0 L 10 10 L 10 0 Z');
    expect(new Set(ids(reversed))).toEqual(new Set(ids(path)));
    expect(ids(reversed)[0]).toBe(ids(path)[0]);
    // Twice is back where it started.
    expect(reverseSubPath(reversed, 0).getPathString()).toBe(path.getPathString());
  });

  it('reverses curves, including the one back to the start', () => {
    const reversed = reverseSubPath(new Path(CIRCLE), 0);
    expect(points(reversed)).toEqual([
      [0, 5],
      [5, 10],
      [10, 5],
      [5, 0],
    ]);
    expect(reverseSubPath(reversed, 0).getPathString()).toBe(new Path(CIRCLE).getPathString());
  });
});

describe('setFirstAnchor', () => {
  function commandIds(path: Path) {
    return path.getCommands().map(c => c.id);
  }

  function expectUniqueIds(path: Path) {
    expect(new Set(commandIds(path)).size).toBe(commandIds(path).length);
  }

  it('rotates a closed subpath, keeping its shape, its Z, and its ids', () => {
    const path = new Path('M 0 0 L 10 0 L 10 10 L 0 10 Z');
    const [a0, a1, a2, a3] = ids(path);
    const rotated = PathEdit.setFirstAnchor(path, a2);
    expect(rotated.getPathString()).toBe('M 10 10 L 0 10 L 0 0 L 10 0 Z');
    expect(ids(rotated)).toEqual([a2, a3, a0, a1]);
    expect(isSubPathClosed(rotated, 0)).toBe(true);
    expectUniqueIds(rotated);
    // Going back to the old first point gives back the same path.
    const back = PathEdit.setFirstAnchor(rotated, a0);
    expect(back.getPathString()).toBe(path.getPathString());
    expect(ids(back)).toEqual([a0, a1, a2, a3]);
    expectUniqueIds(back);
  });

  it('keeps curves, including the one back to the start', () => {
    const path = new Path(CIRCLE);
    const [a0, a1, a2, a3] = ids(path);
    const rotated = PathEdit.setFirstAnchor(path, a1);
    expect(points(rotated)).toEqual([
      [5, 0],
      [10, 5],
      [5, 10],
      [0, 5],
    ]);
    expect(ids(rotated)).toEqual([a1, a2, a3, a0]);
    expect(isSubPathClosed(rotated, 0)).toBe(true);
    expectUniqueIds(rotated);
    expect(rotated.getBoundingBox()).toEqual(path.getBoundingBox());
    expect(PathEdit.setFirstAnchor(rotated, a0).getPathString()).toBe(path.getPathString());
  });

  it('keeps a line back to the start that the Z follows, and the command count', () => {
    const path = new Path('M 0 0 L 10 0 L 10 10 L 0 0 Z');
    const [a0, a1, a2] = ids(path);
    const rotated = PathEdit.setFirstAnchor(path, a1);
    expect(rotated.getPathString()).toBe('M 10 0 L 10 10 L 0 0 L 10 0 Z');
    expect(ids(rotated).slice(0, 3)).toEqual([a1, a2, a0]);
    expect(rotated.getCommands().length).toBe(path.getCommands().length);
    expectUniqueIds(rotated);
    expect(PathEdit.setFirstAnchor(rotated, a0).getPathString()).toBe(path.getPathString());
  });

  it('only changes the subpath the point is in', () => {
    const path = new Path('M 0 0 L 4 0 L 4 4 Z M 10 0 L 14 0 L 14 4 Z');
    const [, , , b0, b1, b2] = ids(path);
    const rotated = PathEdit.setFirstAnchor(path, b2);
    expect(rotated.getPathString()).toBe('M 0 0 L 4 0 L 4 4 Z M 14 4 L 10 0 L 14 0 Z');
    expect(ids(rotated).slice(3)).toEqual([b2, b0, b1]);
    expectUniqueIds(rotated);
  });

  it("refuses open subpaths and the point that's first already", () => {
    const open = new Path('M 0 0 L 10 0 L 10 10');
    expect(PathEdit.getSetFirstAnchorRefusal(open, ids(open)[1])).toBe(
      'An open subpath starts at one of its ends',
    );
    expect(() => PathEdit.setFirstAnchor(open, ids(open)[1])).toThrow();
    const closed = new Path('M 0 0 L 10 0 L 10 10 Z');
    expect(PathEdit.getSetFirstAnchorRefusal(closed, ids(closed)[0])).toBe(
      "It's the first point already",
    );
    expect(PathEdit.getSetFirstAnchorRefusal(closed, ids(closed)[1])).toBeUndefined();
    expect(PathEdit.setFirstAnchor(closed, ids(closed)[0])).toBe(closed);
  });
});

describe('joinEnds', () => {
  it('closes a subpath whose two ends are joined', () => {
    const path = new Path('M 0 0 L 10 0 L 10 10');
    const [start, , end] = ids(path);
    expect(PathEdit.joinEnds(path, start, end)?.getPathString()).toBe('M 0 0 L 10 0 L 10 10 Z');
  });

  it('joins two subpaths with a line, turning them to meet', () => {
    const path = new Path('M 0 0 L 4 0 M 10 0 L 6 0');
    const [a0, a1, b0, b1] = ids(path);
    // The end of the first to the end of the second, which is turned around.
    const joined = PathEdit.joinEnds(path, a1, b1);
    expect(joined?.getPathString()).toBe('M 0 0 L 4 0 L 6 0 L 10 0');
    expect(ids(joined!)).toEqual([a0, a1, b1, b0]);
    // The start of the first to the start of the second.
    expect(PathEdit.joinEnds(path, a0, b0)?.getPathString()).toBe('M 4 0 L 0 0 L 10 0 L 6 0');
  });

  it('merges ends that are in the same place', () => {
    const path = new Path('M 0 0 L 4 0 M 4 0 L 8 4');
    const [, a1, b0] = ids(path);
    expect(PathEdit.joinEnds(path, a1, b0)?.getPathString()).toBe('M 0 0 L 4 0 L 8 4');
  });

  it("doesn't join points that aren't ends", () => {
    const path = new Path('M 0 0 L 4 0 L 8 0 M 10 0 L 12 0');
    const [, middle, , b0] = ids(path);
    expect(PathEdit.joinEnds(path, middle, b0)).toBeUndefined();
    const closed = new Path('M 0 0 L 4 0 L 4 4 Z M 10 0 L 12 0');
    expect(PathEdit.joinEnds(closed, ids(closed)[0], ids(closed)[3])).toBeUndefined();
  });
});
