import { Path } from 'app/model/paths';

import { AutoAwesome } from '.';

fdescribe('AutoAwesome', () => {
  describe('#findOptimalSubPathMapping', () => {
    const TESTS = [
      {
        from: 'M 0 0 h10v10h-10v-10 M 20 20 h10v10h-10v-10',
        to: 'M 20 20 h10v10h-10v-10 M 0 0 h10v10h-10v-10',
        expected: [1, 0],
      },
      {
        from: 'M 40 40 h10v10h-10v-10 M 20 20 h10v10h-10v-10 M 0 0 h10v10h-10v-10',
        to: 'M 0 0 h10v10h-10v-10 M 20 20 h10v10h-10v-10',
        expected: [2, 1],
      },
      {
        from: 'M 40 40 h10v10h-10v-10 M 20 20 h10v10h-10v-10 v-10 M 0 0 h10v10h-10v-10',
        to: 'M 0 0 h10v10h-10v-10 M 20 20 h10v10h-10v-10 M 40 40 h10v10h-10v-10',
        expected: [2, 1, 0],
      },
      {
        from: 'M 20 20 h10v10h-10v-10 M 0 0 h10v10h-10v-10 M 40 40 h10v10h-10v-10',
        to: 'M 0 0 h10v10h-10v-10 M 20 20 h10v10h-10v-10',
        expected: [1, 0],
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
    TESTS.forEach(({ from: f, to: t, expected }) => {
      it(`from: ${f}, to: ${t}, expected: ${expected}`, () => {
        expect(AutoAwesome.findOptimalSubPathMapping(new Path(f), new Path(t))).toEqual(expected);
      });
    });
  });
});
