import { describe, expect, it } from 'vitest';

import { HoldSpaceToPan } from './HoldSpaceToPan';

describe('HoldSpaceToPan', () => {
  it('plays or pauses when the key is tapped', () => {
    const space = new HoldSpaceToPan();
    space.keyDown({ repeat: false });
    expect(space.isHeld()).toBe(true);
    expect(space.keyUp()).toBe(true);
    expect(space.isHeld()).toBe(false);
  });

  it("doesn't play or pause after panning", () => {
    const space = new HoldSpaceToPan();
    space.keyDown({ repeat: false });
    space.keyDown({ repeat: true });
    space.pan();
    expect(space.keyUp()).toBe(false);
    // The next tap plays or pauses again.
    space.keyDown({ repeat: false });
    expect(space.keyUp()).toBe(true);
  });

  it('ignores a release without a press, e.g. after typing a space in a text field', () => {
    const space = new HoldSpaceToPan();
    expect(space.keyUp()).toBe(false);
    space.keyDown({ repeat: true });
    expect(space.isHeld()).toBe(false);
  });

  it('only counts pans while the key is held', () => {
    const space = new HoldSpaceToPan();
    space.pan();
    space.keyDown({ repeat: false });
    expect(space.keyUp()).toBe(true);
  });

  it('forgets the press when reset', () => {
    const space = new HoldSpaceToPan();
    space.keyDown({ repeat: false });
    space.reset();
    expect(space.isHeld()).toBe(false);
    expect(space.keyUp()).toBe(false);
  });
});
