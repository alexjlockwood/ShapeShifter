import { getGridSpacingMs } from './TimelineGridRenderer';

describe('getGridSpacingMs', () => {
  it('returns the smallest interval that is at least 40 pixels wide', () => {
    expect(getGridSpacingMs(10)).toBe(10);
    expect(getGridSpacingMs(1)).toBe(50);
    expect(getGridSpacingMs(0.1)).toBe(500);
  });

  it('returns the largest interval when the timeline is zoomed out all the way', () => {
    // This used to loop forever.
    expect(getGridSpacingMs(0.0001)).toBe(60000);
  });
});
