import {
  ColorProperty,
  FractionProperty,
  NameProperty,
  NumberProperty,
  PathProperty,
} from 'app/modules/editor/model/properties';
import { describe, expect, it } from 'vitest';

import { getSteppedValue } from './steppedValue';

const UP = { up: true, shiftKey: false, modifierKey: false };
const DOWN = { up: false, shiftKey: false, modifierKey: false };

describe('getSteppedValue', () => {
  it('steps numbers', () => {
    const property = new NumberProperty('rotation');
    expect(getSteppedValue(property, '5', UP)).toBe(6);
    expect(getSteppedValue(property, '5', DOWN)).toBe(4);
    expect(getSteppedValue(property, '5', { ...UP, shiftKey: true })).toBe(15);
    expect(getSteppedValue(property, '5', { ...UP, modifierKey: true })).toBe(5.1);
  });

  it('steps fractions by a tenth', () => {
    expect(getSteppedValue(new FractionProperty('alpha'), '0.5', UP)).toBe(0.6);
  });

  it('ignores empty and non-numeric text', () => {
    const property = new NumberProperty('rotation');
    expect(getSteppedValue(property, '', UP)).toBeUndefined();
    expect(getSteppedValue(property, '  ', UP)).toBeUndefined();
    expect(getSteppedValue(property, 'abc', UP)).toBeUndefined();
  });

  // These were reported to Bugsnag: empty colors turned black, empty names threw, and empty
  // paths were replaced with a number.
  it("doesn't step colors, names, or paths", () => {
    expect(getSteppedValue(new ColorProperty('fillColor'), '', UP)).toBeUndefined();
    expect(getSteppedValue(new NameProperty('name'), '1', UP)).toBeUndefined();
    expect(getSteppedValue(new PathProperty('pathData'), '', DOWN)).toBeUndefined();
  });
});
