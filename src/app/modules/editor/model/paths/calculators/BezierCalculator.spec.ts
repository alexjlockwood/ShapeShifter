import { Path } from 'app/modules/editor/model/paths';

import { newCalculator } from '.';

describe('BezierCalculator', () => {
  // This curve covers most of its length near its end. The search used to start at t = fraction
  // and couldn't get more than a quarter away from it, so it gave up and returned the fraction.
  it.each([0.1, 0.3, 0.5, 0.7, 0.9])('finds the time at %f of its length', fraction => {
    const calculator = newCalculator(new Path('M 11 8 C 15 15 7 1 19 18').getCommands()[1]);
    const t = calculator.findTimeByDistance(fraction);
    const length = calculator.split(0, t).getPathLength();
    expect(length / calculator.getPathLength()).toBeCloseTo(fraction, 4);
  });
});
