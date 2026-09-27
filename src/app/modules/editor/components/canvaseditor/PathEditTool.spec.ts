import { CanvasPreview } from 'app/modules/editor/components/canvas/CanvasPreview';
import { GroupLayer, PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { Path, PathEdit } from 'app/modules/editor/model/paths';
import { createEditorServices } from 'app/modules/editor/services/createEditorServices';
import { createEditorStore } from 'app/modules/editor/store';
import { getHiddenLayerIds, getVectorLayer } from 'app/modules/editor/store/layers/selectors';
import { getAnimatedVectorLayer } from 'app/modules/editor/store/playback/selectors';
import { ActionCreators } from 'redux-undo';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PathEditTool } from './PathEditTool';
import type { Modifiers } from './SelectTool';

const NONE: Modifiers = { shift: false, alt: false, command: false, ctrl: false };
const SHIFT: Modifiers = { ...NONE, shift: true };
const ALT: Modifiers = { ...NONE, alt: true };
const COMMAND: Modifiers = { ...NONE, command: true };
const CTRL: Modifiers = { ...NONE, ctrl: true };

function pathLayer(name: string, pathData: string) {
  return new PathLayer({ name, children: [], pathData: new Path(pathData), strokeColor: '#000' });
}

describe('PathEditTool', () => {
  let dispose: () => void = () => {};

  beforeEach(() => {
    // Edits less than a second apart are undone together.
    vi.useFakeTimers();
  });

  afterEach(() => {
    dispose();
    vi.useRealTimers();
  });

  /** Edits the layer with the name, where a viewport unit is 10 CSS pixels. */
  function setUp(name = 'square') {
    const store = createEditorStore({ logActions: false });
    const services = createEditorServices(store);
    const layers = [
      pathLayer('square', 'M 2 2 L 12 2 L 12 12 L 2 12 Z'),
      // A mirrored point at (8, 16).
      pathLayer('curve', 'M 2 16 C 2 13 5 13 8 16 C 11 19 14 19 14 16'),
      pathLayer('other', 'M 20 20 L 23 20 L 23 23 Z'),
      // Off of the artboard, away from the others.
      pathLayer('diagonal', 'M 30 0 L 50 20'),
      new GroupLayer({
        name: 'group',
        children: [pathLayer('scaled', 'M 1 1 L 5 1')],
        scaleX: 2,
        scaleY: 2,
      }),
    ];
    services.layerTimelineService.setVectorLayer(
      new VectorLayer({ name: 'vector', children: layers }),
    );
    vi.advanceTimersByTime(2000);
    const preview = new CanvasPreview(store, services.layerTimelineService);
    preview.init();
    dispose = () => {
      preview.dispose();
      services.dispose();
    };
    const layerId = getVectorLayer(store.getState()).children.find(l => l.name === name)?.id;
    const scaled = getVectorLayer(store.getState()).findLayerByName('scaled');
    const id = name === 'scaled' ? scaled?.id : layerId;
    if (!id) {
      throw new Error(`No layer named ${name}`);
    }
    const tool = new PathEditTool({
      layerId: id,
      getVectorLayer: () => {
        const { vl, currentTime } = getAnimatedVectorLayer(store.getState());
        return preview.apply(vl, currentTime);
      },
      getHiddenLayerIds: () => getHiddenLayerIds(store.getState()),
      toViewportLength: length => length / 10,
      preview,
      redraw: () => {},
    });
    const click = (x: number, y: number, modifiers = NONE) => {
      tool.onPress({ x, y }, modifiers);
      tool.onRelease({ x, y });
    };
    const drag = (from: [number, number], to: [number, number], modifiers = NONE) => {
      tool.onPress({ x: from[0], y: from[1] }, modifiers);
      tool.onMove({ x: (from[0] + to[0]) / 2, y: (from[1] + to[1]) / 2 }, modifiers);
      tool.onMove({ x: to[0], y: to[1] }, modifiers);
      tool.onRelease({ x: to[0], y: to[1] });
    };
    const path = () =>
      (getVectorLayer(store.getState()).findLayerById(id) as PathLayer).pathData as Path;
    const pathData = () => path().getPathString();
    const anchorIds = () => PathEdit.getAnchors(path()).map(a => a.id);
    const selected = () => {
      const ids = anchorIds();
      return [...tool.getSelectedAnchorIds()]
        .map(anchorId => ids.indexOf(anchorId))
        .sort((a, b) => a - b);
    };
    const undo = () => {
      vi.advanceTimersByTime(2000);
      store.dispatch(ActionCreators.undo());
    };
    return { store, tool, preview, click, drag, path, pathData, anchorIds, selected, undo };
  }

  describe('selecting', () => {
    it('selects the point that is clicked, and clears the selection for a click on nothing', () => {
      const { click, selected } = setUp();
      click(12, 2);
      expect(selected()).toEqual([1]);
      click(12.3, 12.3);
      expect(selected()).toEqual([2]);
      click(7, 7);
      expect(selected()).toEqual([]);
    });

    it('adds and removes points with Shift', () => {
      const { click, selected } = setUp();
      click(2, 2);
      click(12, 2, SHIFT);
      expect(selected()).toEqual([0, 1]);
      click(2, 2, SHIFT);
      expect(selected()).toEqual([1]);
      click(7, 7, SHIFT);
      expect(selected()).toEqual([1]);
    });

    it('selects the points in a marquee', () => {
      const { drag, selected } = setUp();
      drag([0, 0], [13, 5]);
      expect(selected()).toEqual([0, 1]);
      drag([10, 10], [13, 13], SHIFT);
      expect(selected()).toEqual([0, 1, 2]);
    });

    it('selects the next and previous points, going around', () => {
      const { tool, click, selected } = setUp();
      tool.selectAdjacent(1);
      expect(selected()).toEqual([0]);
      click(2, 12);
      tool.selectAdjacent(1);
      expect(selected()).toEqual([0]);
      tool.selectAdjacent(-1);
      expect(selected()).toEqual([3]);
      tool.selectAll();
      expect(selected()).toEqual([0, 1, 2, 3]);
    });
  });

  describe('moving points', () => {
    it('moves the point as one undo step, and undo puts it back', () => {
      const { drag, pathData, undo } = setUp();
      const before = pathData();
      drag([12, 2], [16.3, 3.5]);
      // Nothing else is in range, so x snaps to the pixel grid.
      expect(pathData()).toBe('M 2 2 L 16 3.5 L 12 12 L 2 12 Z');
      undo();
      expect(pathData()).toBe(before);
    });

    it('moves the selected points together', () => {
      const { click, drag, pathData } = setUp();
      click(2, 2);
      click(12, 2, SHIFT);
      drag([12, 2], [12.5, 5.5], CTRL);
      expect(pathData()).toBe('M 2.5 5.5 L 12.5 5.5 L 12 12 L 2 12 Z');
    });

    it('keeps a move straight with Shift', () => {
      const { drag, pathData } = setUp();
      drag([12, 2], [15.5, 2.5], { ...SHIFT, ctrl: true });
      expect(pathData()).toBe('M 2 2 L 15.5 2 L 12 12 L 2 12 Z');
    });

    it('snaps to the other points', () => {
      const { drag, pathData } = setUp();
      // The first point is at x = 2, and 0.6 away is close enough.
      drag([12, 2], [2.6, 5.5]);
      expect(pathData()).toBe('M 2 2 L 2 5.5 L 12 12 L 2 12 Z');
    });

    it('snaps onto a curve without anything to line up with', () => {
      const { drag, path } = setUp('curve');
      // 0.14 from the diagonal line, where y = x - 30, and far from its bounds' edges and middle.
      drag([14, 16], [35.3, 5.5]);
      const end = PathEdit.getAnchors(path())[2].point;
      expect(end.x - end.y).toBeCloseTo(30);
      expect(end.x).toBeCloseTo(35.4);
    });

    it('moves the handles with the point', () => {
      const { drag, pathData } = setUp('curve');
      drag([8, 16], [8, 17], CTRL);
      expect(pathData()).toBe('M 2 16 C 2 13 5 14 8 17 C 11 20 14 19 14 16');
    });

    it('moves points in the coordinates of a scaled group', () => {
      const { drag, pathData } = setUp('scaled');
      // (5, 1) is drawn at (10, 2).
      drag([10, 2], [12, 2], CTRL);
      expect(pathData()).toBe('M 1 1 L 6 1');
    });

    it('stops when the edit is canceled', () => {
      const { tool, preview, pathData } = setUp();
      const before = pathData();
      tool.onPress({ x: 12, y: 2 }, NONE);
      tool.onMove({ x: 14, y: 4 }, NONE);
      expect(tool.isGestureInProgress()).toBe(true);
      // E.g. playback starting.
      preview.cancel();
      expect(tool.isGestureInProgress()).toBe(false);
      tool.onRelease({ x: 14, y: 4 });
      expect(pathData()).toBe(before);
    });

    it('nudges the selected points', () => {
      const { tool, click, preview, pathData } = setUp('scaled');
      click(10, 2);
      preview.begin();
      const base = preview.getBase();
      const move = base && tool.getPointsMove(base);
      preview.setPath(tool.layerId, move?.move(2, 0) ?? new Path(''));
      preview.commit();
      expect(pathData()).toBe('M 1 1 L 6 1');
    });
  });

  describe('moving handles', () => {
    it("mirrors a mirrored point's other handle", () => {
      const { click, drag, pathData } = setUp('curve');
      click(8, 16);
      drag([11, 19], [11, 20], CTRL);
      expect(pathData()).toBe('M 2 16 C 2 13 5 12 8 16 C 11 20 14 19 14 16');
    });

    it('breaks the mirroring with Alt', () => {
      const { click, drag, pathData } = setUp('curve');
      click(8, 16);
      drag([11, 19], [11, 20], { ...ALT, ctrl: true });
      expect(pathData()).toBe('M 2 16 C 2 13 5 13 8 16 C 11 20 14 19 14 16');
    });

    it('turns in steps of 45 degrees with Shift', () => {
      const { click, drag, path } = setUp('curve');
      click(8, 16);
      drag([11, 19], [12, 16.2], SHIFT);
      const anchor = PathEdit.getAnchors(path())[1];
      expect(anchor.out?.y).toBeCloseTo(16);
      expect(anchor.in?.y).toBeCloseTo(16);
    });

    it("shows the handles across the selected point's segments", () => {
      const { tool, click } = setUp('curve');
      expect(tool.getDrawing()?.handles).toHaveLength(0);
      click(2, 16);
      // The first point's handle, and the one across its segment.
      expect(tool.getDrawing()?.handles).toHaveLength(2);
      click(8, 16);
      expect(tool.getDrawing()?.handles).toHaveLength(4);
    });
  });

  describe('adding points', () => {
    it('adds a point where a segment is clicked, and selects it', () => {
      const { click, pathData, selected } = setUp();
      click(5, 2.2);
      expect(pathData()).toBe('M 2 2 L 5 2 L 12 2 L 12 12 L 2 12 Z');
      expect(selected()).toEqual([1]);
    });

    it('adds a point in the middle of the segment with Shift', () => {
      const { click, pathData } = setUp();
      click(3, 2, SHIFT);
      expect(pathData()).toBe('M 2 2 L 7 2 L 12 2 L 12 12 L 2 12 Z');
    });

    it('shows where a point would go', () => {
      const { tool } = setUp();
      const insertPoint = () => {
        const point = tool.getDrawing()?.insertPoint;
        return point && [Number(point.x.toFixed(3)), Number(point.y.toFixed(3))];
      };
      tool.onMove({ x: 4, y: 2.2 }, NONE);
      expect(insertPoint()).toEqual([4, 2]);
      tool.onModifiersChange(SHIFT);
      expect(insertPoint()).toEqual([7, 2]);
      // Cmd bends instead.
      tool.onModifiersChange(COMMAND);
      expect(insertPoint()).toBeUndefined();
    });

    it('adds a point and moves it, as one undo step', () => {
      const { drag, pathData, undo } = setUp();
      const before = pathData();
      drag([5, 2], [5, 0.5], CTRL);
      expect(pathData()).toBe('M 2 2 L 5 0.5 L 12 2 L 12 12 L 2 12 Z');
      undo();
      expect(pathData()).toBe(before);
    });

    it('bends a segment with Cmd', () => {
      const { drag, path } = setUp();
      drag([7, 2], [7, 0], COMMAND);
      const [, segment] = path().getCommands();
      expect(segment.type).toBe('C');
      expect(PathEdit.getPointOnSegment(path(), segment.id, 0.5).y).toBeCloseTo(0);
    });
  });

  describe('changing points', () => {
    it('makes a double-clicked point smooth, and straight again', () => {
      const { tool, path } = setUp();
      tool.onPress({ x: 12, y: 2 }, NONE, 1);
      tool.onRelease({ x: 12, y: 2 });
      tool.onPress({ x: 12, y: 2 }, NONE, 2);
      tool.onRelease({ x: 12, y: 2 });
      expect(PathEdit.getAnchors(path())[1].type).toBe('mirrored');
      vi.advanceTimersByTime(2000);
      tool.onPress({ x: 12, y: 2 }, NONE, 2);
      tool.onRelease({ x: 12, y: 2 });
      expect(PathEdit.getAnchors(path())[1].type).toBe('straight');
    });

    it("changes the selected points' type", () => {
      const { tool, click, path } = setUp('curve');
      click(8, 16);
      tool.setPointType('straight');
      expect(PathEdit.getAnchors(path())[1].type).toBe('straight');
    });

    it('deletes the selected points, but not all of them', () => {
      const { tool, click, pathData } = setUp();
      click(12, 2);
      expect(tool.deleteSelected()).toBe('deleted');
      expect(pathData()).toBe('M 2 2 L 12 12 L 2 12 Z');
      expect(tool.getSelectedAnchorIds().size).toBe(0);
      expect(tool.deleteSelected()).toBe('none');
      tool.selectAll();
      expect(tool.deleteSelected()).toBe('empty');
      expect(pathData()).toBe('M 2 2 L 12 12 L 2 12 Z');
    });
  });
});
