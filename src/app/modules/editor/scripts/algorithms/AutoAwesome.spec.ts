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

    // A lone move command has no segment to split, so its subpath can't be aligned.
    it.each([
      ['M 5 5', 'M 0 0 L 10 10 L 20 0'],
      ['M 0 0 L 10 10 L 20 0', 'M 5 5'],
      ['M 5 5 M 0 0 L 10 0 L 10 10 Z', 'M 0 0 L 10 10 L 20 0 M 0 0 L 10 0 L 10 10 Z'],
    ])('leaves single command subpaths alone (%s to %s)', (f, t) => {
      const [from, to] = AutoAwesome.autoFix(new Path(f), new Path(t));
      const numCommands = (p: Path) => p.getSubPaths().map(s => s.getCommands().length);
      expect(numCommands(from)[0]).toBe(numCommands(new Path(f))[0]);
      expect(numCommands(to)[0]).toBe(numCommands(new Path(t))[0]);
    });
  });
});
