import type { Guide } from 'app/modules/editor/model/guides';
import { PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { beforeEach, describe, expect, it } from 'vitest';

import { GuideTool } from './GuideTool';
import type { Modifiers } from './SelectTool';

const NONE: Modifiers = { shift: false, alt: false, command: false, ctrl: false };
const CTRL: Modifiers = { ...NONE, ctrl: true };

// A 24 unit artboard with a square from 4 to 8, at ten CSS pixels a unit.
const VECTOR_LAYER = new VectorLayer({
  name: 'vl',
  width: 24,
  height: 24,
  children: [
    new PathLayer({ name: 'square', children: [], pathData: new Path('M 4 4 H 8 V 8 H 4 Z') }),
  ],
});

describe('GuideTool', () => {
  let guides: ReadonlyArray<Guide>;
  let saves: number;
  let tool: GuideTool;

  beforeEach(() => {
    guides = [{ id: 'g', axis: 'x', value: 12 }];
    saves = 0;
    tool = new GuideTool({
      getGuides: () => guides,
      setGuides: value => {
        guides = value;
        saves++;
      },
      getVectorLayer: () => VECTOR_LAYER,
      getHiddenLayerIds: () => new Set(),
      toViewportLength: length => length / 10,
      getSnapThresholds: () => ({ lines: 0.8, grid: 0.4 }),
      // The horizontal ruler covers y < 0, and the vertical one x < 0.
      isRemoving: (axis, point) => point[axis] < 0,
      redraw: () => {},
    });
  });

  it('adds a guide dragged out of a ruler, snapped to the paths', () => {
    tool.startNew('y', { x: 10, y: -1 }, NONE);
    expect(tool.getDrawing().guides).toHaveLength(1);
    tool.onMove({ x: 10, y: 7.7 }, NONE);
    expect(tool.getDrawing().label?.text).toBe('8');
    tool.onRelease();
    expect(guides.map(({ axis, value }) => ({ axis, value }))).toEqual([
      { axis: 'x', value: 12 },
      { axis: 'y', value: 8 },
    ]);
    expect(saves).toBe(1);
  });

  it("doesn't snap with Ctrl held", () => {
    tool.startNew('y', { x: 10, y: 7.7 }, CTRL);
    tool.onRelease();
    expect(guides[1].value).toBe(7.7);
  });

  it("doesn't add a guide that goes back onto its ruler", () => {
    tool.startNew('x', { x: -1, y: 10 }, NONE);
    tool.onMove({ x: 5, y: 10 }, NONE);
    tool.onMove({ x: -2, y: 10 }, NONE);
    tool.onRelease();
    expect(saves).toBe(0);
  });

  it('moves a guide, and removes it when it goes back onto its ruler', () => {
    const [guide] = guides;
    expect(tool.hitTest({ x: 12.3, y: 3 })).toBe(guide);
    expect(tool.hitTest({ x: 12.5, y: 3 })).toBeUndefined();
    tool.startMove(guide, { x: 12, y: 3 });
    tool.onMove({ x: 17.3, y: 3 }, NONE);
    expect(tool.getCursor()).toBe('col-resize');
    tool.onRelease();
    expect(guides).toEqual([{ id: 'g', axis: 'x', value: 17 }]);

    tool.startMove(guides[0], { x: 17, y: 3 });
    tool.onMove({ x: -3, y: 3 }, NONE);
    expect(tool.getDrawing().guides).toEqual([]);
    tool.onRelease();
    expect(guides).toEqual([]);
    expect(saves).toBe(2);
  });

  it("doesn't save a guide that's put back where it was, or a drag that's canceled", () => {
    tool.startMove(guides[0], { x: 12, y: 3 });
    tool.onRelease();
    tool.startMove(guides[0], { x: 12, y: 3 });
    tool.onMove({ x: 20, y: 3 }, NONE);
    tool.onLeave();
    expect(tool.isDragging()).toBe(false);
    expect(saves).toBe(0);
  });

  it("keeps a guide's distance from the pointer, so that a click doesn't move it", () => {
    // Pressed 0.3 to the right of the guide at 12.
    tool.startMove(guides[0], { x: 12.3, y: 3 });
    expect(tool.getDrawing().label?.text).toBe('12');
    tool.onRelease();
    expect(saves).toBe(0);
    tool.startMove(guides[0], { x: 12.3, y: 3 });
    tool.onMove({ x: 14.7, y: 3 }, CTRL);
    tool.onRelease();
    expect(guides[0].value).toBe(14.4);
  });
});
