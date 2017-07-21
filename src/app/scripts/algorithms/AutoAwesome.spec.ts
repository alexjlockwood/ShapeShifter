import { Path } from 'app/model/paths';

import { AutoAwesome } from '.';

fdescribe('AutoAwesome', () => {
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
          from: 'M 0 0 h10v10h-10v-10 M 20 20 h10v10h-10v-10',
          to: 'M 20 20 h10v10h-10v-10 M 0 0 h10v10h-10v-10',
        },
        expected: {
          from: 'M 20 20 h10v10h-10v-10 M 0 0 h10v10h-10v-10',
          to: 'M 20 20 h10v10h-10v-10 M 0 0 h10v10h-10v-10',
        },
      },
      {
        actual: {
          from: 'M 0 0 h10v10h-10v-10 M 20 20 h10v10h-10v-10',
          to: 'M 20 20 h10v10h-10v-10 M 0 0 h10v10h-10v-10',
        },
        expected: {
          from: 'M 20 20 h10v10h-10v-10 M 0 0 h10v10h-10v-10',
          to: 'M 20 20 h10v10h-10v-10 M 0 0 h10v10h-10v-10',
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
  });
});
