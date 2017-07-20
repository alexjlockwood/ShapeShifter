import { Path } from 'app/model/paths';

import { AutoAwesome } from '.';

describe('AutoAwesome', () => {
  describe('#findOptimalSubPathMapping', () => {
    const TESTS = [
      {
        from: 'M 0 0 h10v10h-10v-10 M 20 20 h10v10h-10v-10',
        to: 'M 20 20 h10v10h-10v-10 M 0 0 h10v10h-10v-10',
        expectedFrom: 'M 20 20 h10v10h-10v-10 M 0 0 h10v10h-10v-10',
        expectedTo: 'M 20 20 h10v10h-10v-10 M 0 0 h10v10h-10v-10',
      },
      {
        from: 'M 40 40 h10v10h-10v-10 M 20 20 h10v10h-10v-10 M 0 0 h10v10h-10v-10',
        to: 'M 0 0 h10v10h-10v-10 M 20 20 h10v10h-10v-10',
        expectedFrom: 'M 0 0 h10v10h-10v-10 M 20 20 h10v10h-10v-10 M 40 40 h10v10h-10v-10',
        expectedTo: 'M 0 0 h10v10h-10v-10 M 20 20 h10v10h-10v-10',
      },
      {
        from: 'M 40 40 h10v10h-10v-10 M 20 20 h10v10h-10v-10 v-10 M 0 0 h10v10h-10v-10',
        to: 'M 0 0 h10v10h-10v-10 M 20 20 h10v10h-10v-10 M 40 40 h10v10h-10v-10',
        expectedFrom: 'M 0 0 h10v10h-10v-10 M 20 20 h10v10h-10v-10 v-10 M 40 40 h10v10h-10v-10',
        expectedTo: 'M 0 0 h10v10h-10v-10 M 20 20 h10v10h-10v-10 M 40 40 h10v10h-10v-10',
      },
      {
        from: 'M 2 2 h 4 v 4 h -4 v -4 M 8 8 h 4 v 4 h -4 v -4 M 16 16 h 4 v 4 h -4 v -4',
        to: 'M 16 16 h 4 v 4 h -4 v -4 M 8 8 h 4 v 4 h -4 v -4',
        expectedFrom: 'M 16 16 h 4 v 4 h -4 v -4 M 8 8 h 4 v 4 h -4 v -4 M 2 2 h 4 v 4 h -4 v -4',
        expectedTo: 'M 16 16 h 4 v 4 h -4 v -4 M 8 8 h 4 v 4 h -4 v -4',
      },
      // {
      //   from: 'M 0 0 h10v10h-10v-10 M 20 20 h10v10h-10v-10',
      //   to: 'M 20 20 h10v10h-10v-10 M 0 0 h10v10h-10v-10 M 40 40 h10v10h-10v-10',
      //   expected: [1, 0, undefined],
      // },
      // {
      //   from: 'M 20 20 h10v10h-10v-10 M 40 40 h10v10h-10v-10 M 0 0 h10v10h-10v-10',
      //   to: 'M 0 0 h10v10h-10v-10 M 20 20 h10v10h-10v-10',
      //   expected: [1, undefined, 0],
      // },
    ];
    TESTS.forEach(({ from: f, to: t, expectedFrom, expectedTo }) => {
      it(`from: ${f}, to: ${t}`, () => {
        const [from, to] = AutoAwesome.orderSubPaths(new Path(f), new Path(t));
        expect(from.getPathString()).toEqual(new Path(expectedFrom).getPathString());
        expect(to.getPathString()).toEqual(new Path(expectedTo).getPathString());
      });
    });
  });
});
