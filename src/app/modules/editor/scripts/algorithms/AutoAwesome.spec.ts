import { Path } from 'app/modules/editor/model/paths';
import _ from 'lodash';

import { AutoAwesome } from '.';

describe('AutoAwesome', () => {
  describe('#autoFix', () => {
    const TESTS = [
      {
        actual: {
          from: 'M 2 2 L 12 2 L 12 12 L 2 12 L 2 2',
          to: 'M 12 12 L 2 12 L 2 2 L 12 2 L 12 12',
        },
        expected: {
          from: 'M 12 12 L 2 12 L 2 2 L 12 2 L 12 12',
          to: 'M 12 12 L 2 12 L 2 2 L 12 2 L 12 12',
        },
      },
      {
        actual: {
          from: `
            M 2 2 L 6 2 L 6 6 L 2 6 L 2 2
            M 10 3 L 20 3 L 20 5 L 10 5 L 10 3
            M 4 10 L 1 16 L 7 16 L 7 10 L 4 10
            M 20 20 L 20 15 L 18 15 L 18 20 L 20 20
          `,
          to: `
            M 10 3 L 20 3 L 20 5 L 10 5 L 10 3
            M 4 10 L 1 16 L 7 16 L 7 10 L 4 10
            M 20 20 L 20 15 L 18 15 L 18 20 L 20 20
            M 2 2 L 6 2 L 6 6 L 2 6 L 2 2
          `,
        },
        expected: {
          from: `
            M 10 3 L 20 3 L 20 5 L 10 5 L 10 3
            M 4 10 L 1 16 L 7 16 L 7 10 L 4 10
            M 20 20 L 20 15 L 18 15 L 18 20 L 20 20
            M 2 2 L 6 2 L 6 6 L 2 6 L 2 2
          `,
          to: `
            M 10 3 L 20 3 L 20 5 L 10 5 L 10 3
            M 4 10 L 1 16 L 7 16 L 7 10 L 4 10
            M 20 20 L 20 15 L 18 15 L 18 20 L 20 20
            M 2 2 L 6 2 L 6 6 L 2 6 L 2 2
          `,
        },
      },
    ];
    TESTS.forEach(({ actual: { from: f0, to: t0 }, expected: { from: f1, to: t1 } }) => {
      it(`f0: ${f0}, t0: ${t1}, f1: ${f1}, t1: ${t1}`, () => {
        const [from, to] = AutoAwesome.autoFix(new Path(f0), new Path(t0));
        expect(from.getPathString()).toEqual(new Path(f1).getPathString());
        expect(to.getPathString()).toEqual(new Path(t1).getPathString());
      });
    });

    // Reversing or shifting a subpath after its commands were converted used to leave them out of
    // step, e.g. a Z paired with an L.
    it.each([
      ['a square and a heptagon', polygon(4, 0.3), polygon(7)],
      ['two circles and one', `${circle(6, 12, 4)} ${circle(18, 12, 4)}`, circle(12, 12, 8)],
      [
        'the search and close icons',
        'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
        'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
      ],
    ])('makes %s morphable', (unused, f, t) => {
      const [from, to] = AutoAwesome.autoFix(new Path(f), new Path(t));
      expect(from.isMorphableWith(to)).toBe(true);
    });

    // Path data without a leading M, e.g. typed into a morph block, has no subpaths.
    it.each(['L 10 10', '   ', 'Z'])('grows a shape out of nothing (%j)', empty => {
      const shape = 'M 0 0 L 10 10 L 20 0 Z';
      expect(new Path(empty).getSubPaths()).toHaveLength(0);
      for (const [from, to] of [
        AutoAwesome.autoFix(new Path(empty), new Path(shape)),
        AutoAwesome.autoFix(new Path(shape), new Path(empty)).reverse(),
      ]) {
        expect(from.isMorphableWith(to)).toBe(true);
        expect(from.getSubPaths()[0].isCollapsing()).toBe(true);
        // The shape isn't reversed, though its Z is converted to match the collapsing subpath's L.
        const ends = (path: Path) => path.getCommands().map(cmd => cmd.end);
        expect(ends(to)).toEqual(ends(new Path(shape)));
      }
      const [from, to] = AutoAwesome.autoAddCollapsingSubPaths(new Path(empty), new Path(shape));
      expect(from.getSubPaths()).toHaveLength(to.getSubPaths().length);
    });

    // The alignment used to clamp distances at 1, so points less than a unit apart all scored the
    // same, and a small square got all three of a heptagon's extra points on one edge.
    it("doesn't depend on the size of the paths", () => {
      const scale = (pathString: string, factor: number) =>
        pathString.replace(/-?\d+(\.\d+)?/g, n => String(Number(n) * factor));
      const fix = (factor: number) =>
        AutoAwesome.autoFix(
          new Path(scale(polygon(4, 0.3), factor)),
          new Path(scale(polygon(7), factor)),
        ).map(p => p.getCommands().map(cmd => [cmd.end.x / factor, cmd.end.y / factor]));
      const expected = fix(1);
      for (const factor of [0.05, 20]) {
        const actual = fix(factor);
        expect(actual.map(cmds => cmds.length)).toEqual(expected.map(cmds => cmds.length));
        actual.flat(2).forEach((n, i) => expect(n).toBeCloseTo(expected.flat(2)[i], 0));
      }
    });

    // New points used to be spread evenly along the command they split.
    it.each([
      ['a line', 'M 0 12 L 24 12', ['0,12', '2,12', '20,12', '24,12']],
      ['a curve', 'M 0 12 C 8 12 16 12 24 12', ['0,12', '2,12', '20,12', '24,12']],
    ])('adds points to %s next to the ones they morph into', (unused, f, expected) => {
      const [from, to] = AutoAwesome.autoFix(new Path(f), new Path('M 0 12 L 2 8 L 20 16 L 24 12'));
      expect(from.isMorphableWith(to)).toBe(true);
      const points = from
        .getCommands()
        .map(cmd => `${_.round(cmd.end.x, 1)},${_.round(cmd.end.y, 1)}`);
      expect(points).toEqual(expected);
    });

    // With many points, only the shifts and reversals closest to the other subpath are aligned
    // in full, so this checks that they still find the one that moves nothing.
    it.each([
      ['starting from another point', 17, false],
      ['starting from another point, drawn the other way', 41, true],
    ])('lines up a polygon with many points with itself %s', (unused, start, reverse) => {
      const polygonPath = new Path(polygon(60));
      let other = polygonPath.mutate().shiftSubPathBack(0, start);
      if (reverse) {
        other = other.reverseSubPath(0);
      }
      const [from, to] = AutoAwesome.autoFix(polygonPath, new Path(other.build().getPathString()));
      expect(from.isMorphableWith(to)).toBe(true);
      from.getCommands().forEach((cmd, i) => {
        expect(cmd.end.x).toBeCloseTo(to.getCommands()[i].end.x);
        expect(cmd.end.y).toBeCloseTo(to.getCommands()[i].end.y);
      });
    });

    // The gaps at the end of the alignment and the ones before the last command both split the
    // last command, and splitting it twice cut the second batch of points out of the first piece.
    it('spreads points out along a command that two streaks of gaps split', () => {
      const [from, to] = AutoAwesome.autoFix(
        new Path('M 7 13 L 10 14'),
        new Path('M 13 21 L 20 10 L 9 23 L 18 22 L 6 23 L 22 17'),
      );
      expect(from.isMorphableWith(to)).toBe(true);
      const xs = from.getCommands().map(cmd => cmd.end.x);
      expect(xs).toEqual([...xs].sort((a, b) => a - b));
      expect(xs[xs.length - 2]).toBeGreaterThan(9);
    });

    describe('pairing subpaths', () => {
      const square = (x: number, y: number, size: number) =>
        `M ${x} ${y} L ${x + size} ${y} L ${x + size} ${y + size} L ${x} ${y + size} Z`;

      /** Returns how far apart the centers of each pair of subpaths are. */
      function distances(from: Path, to: Path) {
        expect(from.isMorphableWith(to)).toBe(true);
        return from.getSubPaths().map((unused, subIdx) => {
          const p = from.getPoleOfInaccessibility(subIdx);
          const q = to.getPoleOfInaccessibility(subIdx);
          return Math.hypot(p.x - q.x, p.y - q.y);
        });
      }

      it.each([
        ['with the far square first', `${square(14, 14, 7)} ${square(3, 3, 7)}`],
        ['with the near square first', `${square(3, 3, 7)} ${square(14, 14, 7)}`],
      ])('keeps a square in place when another one appears (%s)', (unused, t) => {
        const f = square(3, 3, 7);
        for (const [from, to] of [
          AutoAwesome.autoFix(new Path(f), new Path(t)),
          AutoAwesome.autoFix(new Path(t), new Path(f)).reverse(),
        ]) {
          // The square pairs with the one on top of it, and the far one grows from its own center.
          expect(distances(from, to)).toEqual([0, 0]);
          expect(from.getSubPaths().filter(s => s.isCollapsing())).toHaveLength(1);
          // The pairs stay the same after an edit, which adds the collapsing subpaths again.
          expect(distances(...AutoAwesome.autoAddCollapsingSubPaths(from, to))).toEqual([0, 0]);
        }
      });

      it('pairs more than eight subpaths', () => {
        const grid = (order: number[], dx: number) =>
          order.map(i => square(4 + (i % 3) * 7 + dx, 4 + Math.floor(i / 3) * 7, 2)).join(' ');
        const [from, to] = AutoAwesome.autoFix(
          new Path(grid([0, 1, 2, 3, 4, 5, 6, 7, 8], 0)),
          new Path(grid([8, 7, 6, 5, 4, 3, 2, 1, 0], 2)),
        );
        for (const d of distances(from, to)) {
          expect(d).toBeCloseTo(2);
        }
      });
    });

    // Reversing an open subpath flips a stroke end over end, so auto fix shouldn't reverse one to
    // match the other's direction, the way it does for closed subpaths.
    it.each([
      ['two corners that bend different ways', 'M 2 2 L 22 2 L 22 22', 'M 2 2 L 2 22 L 22 22'],
      ['a curve and a line', 'M 4 16 Q 12 4 20 16', 'M 4 12 L 20 12'],
    ])("doesn't reverse %s that go the same way", (unused, f, t) => {
      const [from, to] = AutoAwesome.autoFix(new Path(f), new Path(t));
      expect(from.isMorphableWith(to)).toBe(true);
      expect(from.getCommands()[0].end).toEqual(new Path(f).getCommands()[0].end);
      expect(to.getCommands()[0].end).toEqual(new Path(t).getCommands()[0].end);
    });

    // A subpath that's only a move, like a stray "M 6 5" in the path data, has no segment to split.
    describe('with a subpath that is only a move', () => {
      it.each([
        // The most common crash in Bugsnag.
        ['M 6 5', 'M 12 6 L 13 11 Z', 'M 6 5 L 6 5 Z'],
        ['M 6 5', 'M 0 0 C 0 5 5 10 10 10 Q 10 5 10 0 Z', 'M 6 5 C 6 5 6 5 6 5 Q 6 5 6 5 Z'],
        [
          'M 0 0 L 10 0 L 10 10 Z M 20 20',
          'M 0 0 L 10 0 L 10 10 Z M 20 20 L 30 20 L 30 30 Z',
          'M 0 0 L 10 0 L 10 10 Z M 20 20 L 20 20 L 20 20 Z',
        ],
      ])('grows the other subpath from the point (%s to %s)', (f, t, expected) => {
        for (const reverse of [false, true]) {
          const [from, to] = reverse
            ? AutoAwesome.autoFix(new Path(t), new Path(f)).reverse()
            : AutoAwesome.autoFix(new Path(f), new Path(t));
          expect(from.isMorphableWith(to)).toBe(true);
          expect(from.getPathString()).toEqual(new Path(expected).getPathString());
          expect(to.getPathString()).toEqual(new Path(t).getPathString());
        }
      });

      // A lone move after another subpath used to be lost, when parsing or after auto fix
      // reversed or reordered the subpaths, which left the path's subpaths out of step.
      it.each([
        [
          'M 2 19 L 20 9 L 16 16',
          'M 3 11 C 6 12 2 13 11 19 Q 1 3 9 5 Z M 19 6 M 15 14 Q 8 7 2 6 Z',
        ],
        ['M 0 18 L 15 4 Z M 10 16 M 12 6 L 10 24 Z', 'M 12 2 L 10 17 C 3 18 17 5 24 23 Z'],
      ])('keeps a lone move after another subpath (%s to %s)', (f, t) => {
        const [from, to] = AutoAwesome.autoFix(new Path(f), new Path(t));
        expect(from.isMorphableWith(to)).toBe(true);
      });

      it('leaves two moves alone', () => {
        const [from, to] = AutoAwesome.autoFix(new Path('M 6 5'), new Path('M 1 2'));
        expect(from.getPathString()).toEqual('M 6 5');
        expect(to.getPathString()).toEqual('M 1 2');
      });
    });
  });
});

/** A regular polygon around (12, 12), drawn clockwise from the given angle. */
function polygon(numSides: number, angle = 0) {
  const points = _.range(numSides).map(i => {
    const a = angle + (2 * Math.PI * i) / numSides;
    return `${_.round(12 + 9 * Math.cos(a), 3)} ${_.round(12 + 9 * Math.sin(a), 3)}`;
  });
  return `M ${points[0]} ${points
    .slice(1)
    .map(p => `L ${p}`)
    .join(' ')} Z`;
}

/** A circle made of four cubic curves. */
function circle(cx: number, cy: number, r: number) {
  const k = _.round(r * 0.5523, 3);
  return [
    `M ${cx} ${cy - r}`,
    `C ${cx + k} ${cy - r} ${cx + r} ${cy - k} ${cx + r} ${cy}`,
    `C ${cx + r} ${cy + k} ${cx + k} ${cy + r} ${cx} ${cy + r}`,
    `C ${cx - k} ${cy + r} ${cx - r} ${cy + k} ${cx - r} ${cy}`,
    `C ${cx - r} ${cy - k} ${cx - k} ${cy - r} ${cx} ${cy - r} Z`,
  ].join(' ');
}
