import { ActionSource } from 'app/modules/editor/model/actionmode';
import { PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { HitResult, Path } from 'app/modules/editor/model/paths';
import { MathUtil, Point } from 'app/modules/editor/scripts/common';

import type { CanvasOverlay } from './CanvasOverlay';
import { SelectionHelper } from './SelectionHelper';

const NO_HIT: HitResult = {
  isHit: false,
  isEndPointHit: false,
  isSegmentHit: false,
  isShapeHit: false,
  endPointHits: [],
  segmentHits: [],
  shapeHits: [],
};

describe('SelectionHelper', () => {
  it('keeps a dragged split point on its subpath when another subpath is closer', () => {
    // Two parallel lines 1 unit apart, with a split point at (10, 0) on the first.
    const path = new Path('M 0 0 L 20 0 M 0 1 L 20 1').mutate().splitCommand(0, 1, 0.5).build();
    const splitPoint = { x: 10, y: 0 };
    expect(path.getCommand(0, 1).end).toEqual(splitPoint);
    const pathLayer = new PathLayer({ name: 'path', children: [], pathData: path });
    const vectorLayer = new VectorLayer({ name: 'vector', children: [pathLayer] });
    const actionModeService = {
      clearHover: vi.fn(),
      setHover: vi.fn(),
      setSelections: vi.fn(),
      updateActivePathBlock: vi.fn(),
    };
    const component = {
      actionSource: ActionSource.From,
      actionModeService,
      vectorLayer,
      activePathLayer: pathLayer,
      get activePath() {
        return pathLayer.pathData;
      },
      dragTriggerTouchSlop: 1,
      draw: vi.fn(),
      performHitTest: (point: Point): HitResult =>
        MathUtil.distance(point, splitPoint) < 1
          ? {
              ...NO_HIT,
              isHit: true,
              isEndPointHit: true,
              endPointHits: [{ subIdx: 0, cmdIdx: 1 }],
            }
          : NO_HIT,
    };
    const helper = new SelectionHelper(component as unknown as CanvasOverlay);

    // Drag the split point to (5, 0.8), which is closer to the second line than to the first.
    helper.onMouseDown(splitPoint, false);
    helper.onMouseMove({ x: 7, y: 0.4 });
    helper.onMouseMove({ x: 5, y: 0.8 });
    // The drag preview snaps the point onto its own subpath...
    expect(helper.getProjectionOntoPath()?.subIdx).toBe(0);
    helper.onMouseUp({ x: 5, y: 0.8 }, false);

    // ...and so should the final path, rather than giving up and leaving the point at (10, 0).
    expect(actionModeService.updateActivePathBlock).toHaveBeenCalledTimes(1);
    const newPath: Path = actionModeService.updateActivePathBlock.mock.calls[0][1];
    expect(newPath.getCommand(0, 1).end).toEqual({ x: 5, y: 0 });
    expect(newPath.getCommand(0, 1).isSplitPoint()).toBe(true);
  });
});
