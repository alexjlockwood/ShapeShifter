import { describe, expect, it } from 'vitest';

import { guidesToJSON, parseGuides } from './Guide';

describe('parseGuides', () => {
  it('reads the guides, with new ids, and skips the ones that are invalid', () => {
    const guides = parseGuides([
      { axis: 'x', value: 12 },
      { axis: 'y', value: 3.14159 },
      { axis: 'z', value: 1 },
      { axis: 'x', value: '4' },
      { axis: 'y', value: Infinity },
      null,
      7,
    ]);
    expect(guides.map(({ axis, value }) => ({ axis, value }))).toEqual([
      { axis: 'x', value: 12 },
      { axis: 'y', value: 3.142 },
    ]);
    expect(new Set(guides.map(g => g.id)).size).toBe(2);
  });

  it('reads anything but an array as no guides', () => {
    expect(parseGuides(undefined)).toEqual([]);
    expect(parseGuides({ axis: 'x', value: 1 })).toEqual([]);
  });

  it('saves the guides without their ids', () => {
    expect(guidesToJSON([{ id: '1', axis: 'x', value: 5 }])).toEqual([{ axis: 'x', value: 5 }]);
  });
});
