import { describe, expect, it } from 'vitest';

import { getMeasurements } from './measuring';

describe('getMeasurements', () => {
  it('measures the gap to a box beside the selection, across where they overlap', () => {
    const measurements = getMeasurements({ l: 2, t: 2, r: 6, b: 8 }, { l: 10, t: 4, r: 14, b: 12 });
    expect(measurements).toEqual([{ axis: 'x', from: 6, to: 10, at: 6 }]);
  });

  it('measures from each edge to the edges of a box around the selection', () => {
    const measurements = getMeasurements({ l: 4, t: 6, r: 10, b: 8 }, { l: 0, t: 0, r: 24, b: 24 });
    expect(measurements).toEqual([
      { axis: 'x', from: 0, to: 4, at: 7 },
      { axis: 'x', from: 10, to: 24, at: 7 },
      { axis: 'y', from: 0, to: 6, at: 7 },
      { axis: 'y', from: 8, to: 24, at: 7 },
    ]);
  });

  it('dashes along the target when the measurement misses it', () => {
    // Up and to the left of the target, so each measurement starts at the selection's middle.
    const measurements = getMeasurements(
      { l: 0, t: 0, r: 4, b: 4 },
      { l: 10, t: 10, r: 14, b: 14 },
    );
    expect(measurements).toEqual([
      { axis: 'x', from: 4, to: 10, at: 2, extension: { at: 10, from: 2, to: 10 } },
      { axis: 'y', from: 4, to: 10, at: 2, extension: { at: 10, from: 2, to: 10 } },
    ]);
  });

  it('leaves out edges that line up', () => {
    const measurements = getMeasurements({ l: 0, t: 4, r: 10, b: 8 }, { l: 0, t: 0, r: 24, b: 24 });
    expect(measurements.filter(m => m.axis === 'x')).toEqual([
      { axis: 'x', from: 10, to: 24, at: 6 },
    ]);
  });
});
