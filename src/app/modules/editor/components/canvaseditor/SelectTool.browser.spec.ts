import { ClipPathLayer, PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { describe, expect, it } from 'vitest';

import { Modifiers, SelectTool } from './SelectTool';

const NONE: Modifiers = { isAdding: false, isContaining: false };
const ADDING: Modifiers = { isAdding: true, isContaining: false };

function setUp() {
  const square = (name: string, l: number, t: number) =>
    new PathLayer({
      name,
      children: [],
      pathData: new Path(`M ${l} ${t} L ${l + 4} ${t} L ${l + 4} ${t + 4} L ${l} ${t + 4} Z`),
      fillColor: '#000',
    });
  const a = square('a', 2, 2);
  const b = square('b', 10, 2);
  const c = square('c', 2, 10);
  const clip = new ClipPathLayer({
    name: 'clip',
    children: [],
    pathData: new Path('M 0 0 L 24 0 L 24 24 L 0 24 Z'),
  });
  const vl = new VectorLayer({ name: 'vector', children: [clip, a, b, c] });
  let selection: ReadonlySet<string> = new Set();
  let redraws = 0;
  const tool = new SelectTool({
    getVectorLayer: () => vl,
    getHiddenLayerIds: () => new Set(),
    getSelectedLayerIds: () => selection,
    setSelectedLayerIds: ids => (selection = new Set(ids)),
    // Ten CSS pixels per viewport unit.
    toViewportLength: length => length / 10,
    redraw: () => redraws++,
  });
  const click = (x: number, y: number, modifiers = NONE) => {
    tool.onPress({ x, y }, modifiers);
    tool.onRelease({ x, y });
  };
  const drag = (from: [number, number], to: [number, number], modifiers = NONE) => {
    tool.onPress({ x: from[0], y: from[1] }, modifiers);
    tool.onMove({ x: (from[0] + to[0]) / 2, y: (from[1] + to[1]) / 2 });
    tool.onMove({ x: to[0], y: to[1] });
    tool.onRelease({ x: to[0], y: to[1] });
  };
  const selected = () => [...selection].sort();
  return { tool, a, b, c, clip, click, drag, selected, redraws: () => redraws };
}

describe('SelectTool', () => {
  it('selects the path that is clicked, and clears the selection for a click on nothing', () => {
    const { a, b, click, selected } = setUp();
    click(4, 4);
    expect(selected()).toEqual([a.id]);
    click(12, 4);
    expect(selected()).toEqual([b.id]);
    // Inside of the clip path's area, but not near its outline.
    click(20, 20);
    expect(selected()).toEqual([]);
  });

  it('adds and removes paths with Shift', () => {
    const { a, b, click, selected } = setUp();
    click(4, 4);
    click(12, 4, ADDING);
    expect(selected()).toEqual([a.id, b.id].sort());
    click(4, 4, ADDING);
    expect(selected()).toEqual([b.id]);
    // Clicking nothing with Shift held keeps the selection.
    click(20, 20, ADDING);
    expect(selected()).toEqual([b.id]);
  });

  it('selects on the press, so that a drag starts with what is under the pointer', () => {
    const { tool, a, selected } = setUp();
    tool.onPress({ x: 4, y: 4 }, NONE);
    expect(selected()).toEqual([a.id]);
  });

  it('selects the paths a marquee touches, but not clip paths', () => {
    const { a, b, drag, selected } = setUp();
    drag([1, 1], [11, 3]);
    expect(selected()).toEqual([a.id, b.id].sort());
  });

  it('only selects the paths a marquee contains with Alt held', () => {
    const { a, drag, selected } = setUp();
    drag([1, 1], [11, 7], { isAdding: false, isContaining: true });
    expect(selected()).toEqual([a.id]);
  });

  it('adds to the selection with a marquee and Shift', () => {
    const { a, c, click, drag, selected } = setUp();
    click(4, 12);
    drag([1, 1], [7, 7], ADDING);
    expect(selected()).toEqual([a.id, c.id].sort());
  });

  it("doesn't start a marquee until the pointer moves a few pixels", () => {
    const { tool, a, click, selected } = setUp();
    click(4, 4);
    tool.onPress({ x: 20, y: 20 }, NONE);
    // Three CSS pixels.
    tool.onMove({ x: 20.3, y: 20 });
    expect(tool.getMarquee()).toBeUndefined();
    expect(selected()).toEqual([a.id]);
    tool.onMove({ x: 0, y: 0 });
    expect(tool.getMarquee()).toEqual({ l: 0, t: 0, r: 20, b: 20 });
  });

  it('hovers the path under the pointer, and forgets it when the pointer leaves', () => {
    const { tool, b } = setUp();
    tool.onMove({ x: 12, y: 4 });
    expect(tool.getHoveredLayerId()).toBe(b.id);
    tool.onLeave();
    expect(tool.getHoveredLayerId()).toBeUndefined();
  });
});
