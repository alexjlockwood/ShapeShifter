import { Path } from 'app/modules/editor/model/paths';

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

      it('leaves two moves alone', () => {
        const [from, to] = AutoAwesome.autoFix(new Path('M 6 5'), new Path('M 1 2'));
        expect(from.getPathString()).toEqual('M 6 5');
        expect(to.getPathString()).toEqual('M 1 2');
      });
    });
  });
});
