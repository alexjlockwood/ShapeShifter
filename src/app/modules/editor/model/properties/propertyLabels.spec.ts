import { describe, expect, it } from 'vitest';

import { getPropertyLabel, getPropertyTitle } from './propertyLabels';

describe('getPropertyLabel', () => {
  it('splits camel case into lowercase words', () => {
    expect(getPropertyLabel('strokeColor')).toBe('stroke color');
    expect(getPropertyLabel('trimPathStart')).toBe('trim path start');
    expect(getPropertyLabel('rotation')).toBe('rotation');
  });

  it('keeps a single letter in capitals', () => {
    expect(getPropertyLabel('scaleX')).toBe('scale X');
    expect(getPropertyLabel('translateY')).toBe('translate Y');
  });

  it('uses the names the property inspector shows', () => {
    expect(getPropertyLabel('alpha')).toBe('opacity');
    expect(getPropertyLabel('fillAlpha')).toBe('fill opacity');
    expect(getPropertyLabel('strokeAlpha')).toBe('stroke opacity');
    expect(getPropertyLabel('pathData')).toBe('path');
  });
});

describe('getPropertyTitle', () => {
  it('starts with a capital', () => {
    expect(getPropertyTitle('strokeWidth')).toBe('Stroke width');
    expect(getPropertyTitle('fillAlpha')).toBe('Fill opacity');
    expect(getPropertyTitle('pathData')).toBe('Path');
  });
});
