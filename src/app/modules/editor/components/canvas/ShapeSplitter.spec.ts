import { HitResult } from 'app/modules/editor/model/paths';

import type { CanvasOverlay } from './CanvasOverlay';
import { ShapeSplitter } from './ShapeSplitter';

describe('ShapeSplitter', () => {
  it('clears the hover highlight when the mouse leaves the canvas', () => {
    // Every point is near the top segment of a filled square.
    const segmentHit: HitResult = {
      isHit: true,
      isEndPointHit: false,
      isSegmentHit: true,
      isShapeHit: false,
      endPointHits: [],
      segmentHits: [{ subIdx: 0, cmdIdx: 1, projection: { x: 5, y: 0, t: 0.5, d: 0.5 } }],
      shapeHits: [],
    };
    const component = {
      actionModeService: {},
      draw: vi.fn<() => void>(),
      performHitTest: () => segmentHit,
    };
    const shapeSplitter = new ShapeSplitter(component as unknown as CanvasOverlay);

    shapeSplitter.onMouseMove({ x: 5, y: 0.5 });
    expect(shapeSplitter.getCurrentProjectionOntoPath()).toBeDefined();
    component.draw.mockClear();

    shapeSplitter.onMouseLeave({ x: 5, y: 0.5 });
    expect(shapeSplitter.getCurrentProjectionOntoPath()).toBeUndefined();
    expect(component.draw).toHaveBeenCalled();
  });
});
