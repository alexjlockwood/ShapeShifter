import { CanvasPreview } from 'app/modules/editor/components/canvas/CanvasPreview';
import { GroupLayer, PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import * as PathEdit from 'app/modules/editor/model/paths/PathEdit';
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
      // A square with a square hole, far from the others, so that they don't snap to it.
      pathLayer('holes', 'M 60 60 L 80 60 L 80 80 L 60 80 Z M 64 64 L 64 76 L 76 76 L 76 64 Z'),
      // Turned a quarter turn clockwise around its start by its own transform, so it's drawn from
      // (200, 200) down to (200, 210).
      new PathLayer({
        name: 'turned',
        children: [],
        pathData: new Path('M 200 200 L 210 200'),
        strokeColor: '#000',
        rotation: 90,
        pivotX: 200,
        pivotY: 200,
      }),
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

    it('selects points across subpaths with a marquee', () => {
      const { drag, selected } = setUp('holes');
      drag([59, 59], [65, 65]);
      expect(selected()).toEqual([0, 4]);
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
      const { drag, pathData } = setUp('curve');
      // Only the middle point is at x = 8, and 0.5 away is close enough.
      drag([14, 16], [8.5, 18.5]);
      expect(pathData()).toBe('M 2 16 C 2 13 5 13 8 16 C 11 19 8 21.5 8 18.5');
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

    it("finds and moves points through the path's own transform", () => {
      const { click, drag, pathData, selected } = setUp('turned');
      click(200, 210);
      expect(selected()).toEqual([1]);
      // Right on the screen is up in the path's coordinates.
      drag([200, 210], [202, 210], CTRL);
      expect(pathData()).toBe('M 200 200 L 210 198');
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
      const move = tool.getPointsMove();
      preview.setPath(tool.layerId, move?.move(2, 0) ?? new Path(''));
      preview.commit();
      expect(pathData()).toBe('M 1 1 L 6 1');
    });
  });

  describe('moving handles', () => {
    it("moves a handle on its own, even a mirrored point's", () => {
      const { click, drag, pathData, undo } = setUp('curve');
      const before = pathData();
      click(8, 16);
      drag([11, 19], [11, 20], CTRL);
      expect(pathData()).toBe('M 2 16 C 2 13 5 13 8 16 C 11 20 14 19 14 16');
      undo();
      expect(pathData()).toBe(before);
    });

    it('mirrors the other handle with Cmd', () => {
      const { click, drag, pathData } = setUp('curve');
      click(8, 16);
      drag([11, 19], [11, 20], { ...COMMAND, ctrl: true });
      expect(pathData()).toBe('M 2 16 C 2 13 5 12 8 16 C 11 20 14 19 14 16');
    });

    it('mirrors a handle that was on its own, making the point mirrored', () => {
      const { click, drag, path } = setUp('curve');
      click(8, 16);
      drag([11, 19], [12, 19], CTRL);
      expect(PathEdit.getAnchors(path())[1].type).toBe('disconnected');
      vi.advanceTimersByTime(2000);
      drag([12, 19], [12, 20], { ...COMMAND, ctrl: true });
      const anchor = PathEdit.getAnchors(path())[1];
      expect(anchor.type).toBe('mirrored');
      expect(anchor.in).toEqual({ x: 4, y: 12 });
    });

    it('does nothing different with Alt', () => {
      const { click, drag, pathData } = setUp('curve');
      click(8, 16);
      drag([11, 19], [11, 20], { ...ALT, ctrl: true });
      expect(pathData()).toBe('M 2 16 C 2 13 5 13 8 16 C 11 20 14 19 14 16');
    });

    it('mirrors while Cmd is held, starting or stopping in the middle of the drag', () => {
      const { tool, click, pathData } = setUp('curve');
      click(8, 16);
      tool.onPress({ x: 11, y: 19 }, CTRL);
      tool.onMove({ x: 11, y: 20 }, CTRL);
      expect(pathData()).toBe('M 2 16 C 2 13 5 13 8 16 C 11 19 14 19 14 16');
      tool.onModifiersChange({ ...COMMAND, ctrl: true });
      tool.onRelease({ x: 11, y: 20 });
      expect(pathData()).toBe('M 2 16 C 2 13 5 12 8 16 C 11 20 14 19 14 16');
      vi.advanceTimersByTime(2000);
      tool.onPress({ x: 11, y: 20 }, { ...COMMAND, ctrl: true });
      tool.onMove({ x: 11, y: 21 }, { ...COMMAND, ctrl: true });
      tool.onModifiersChange(CTRL);
      tool.onRelease({ x: 11, y: 21 });
      expect(pathData()).toBe('M 2 16 C 2 13 5 12 8 16 C 11 21 14 19 14 16');
    });

    it('snaps unless Ctrl is held without Cmd', () => {
      // Off of a Mac, Ctrl is Cmd too, so it mirrors and snaps.
      for (const [modifiers, x] of [
        [NONE, 14],
        [CTRL, 13.7],
        [COMMAND, 14],
        [{ ...COMMAND, ctrl: true }, 14],
      ] as const) {
        const { click, drag, path } = setUp('curve');
        click(8, 16);
        // The other end of the curve is at x = 14, and 0.3 away is close enough.
        drag([11, 19], [13.7, 19], modifiers);
        expect(PathEdit.getAnchors(path())[1].out?.x).toBeCloseTo(x);
        dispose();
        dispose = () => {};
      }
    });

    it('turns in steps of 45 degrees with Shift', () => {
      const { click, drag, path } = setUp('curve');
      click(8, 16);
      drag([11, 19], [12, 16.2], SHIFT);
      const anchor = PathEdit.getAnchors(path())[1];
      expect(anchor.out?.y).toBeCloseTo(16);
      expect(anchor.in).toEqual({ x: 5, y: 13 });
      vi.advanceTimersByTime(2000);
      // And the other one mirrors it with Cmd.
      drag([12, 16], [13, 16.6], { ...SHIFT, command: true });
      expect(PathEdit.getAnchors(path())[1].in?.y).toBeCloseTo(16);
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

  describe('copying points', () => {
    const ALT_CTRL: Modifiers = { ...ALT, ctrl: true };

    it('drags a copy out of a point with Alt, as one undo step', () => {
      const { drag, pathData, anchorIds, selected, undo } = setUp();
      const before = pathData();
      const ids = anchorIds();
      drag([12, 2], [15, 4], ALT_CTRL);
      expect(pathData()).toBe('M 2 2 L 12 2 L 15 4 L 12 12 L 2 12 Z');
      // The other points keep their ids, and only the copy is selected.
      expect(anchorIds()).toEqual([ids[0], ids[1], anchorIds()[2], ids[2], ids[3]]);
      expect(selected()).toEqual([2]);
      undo();
      expect(pathData()).toBe(before);
    });

    it('copies only the point that is dragged', () => {
      const { tool, drag, pathData, selected } = setUp();
      tool.selectAll();
      drag([2, 12], [0, 14], ALT_CTRL);
      expect(pathData()).toBe('M 2 2 L 12 2 L 12 12 L 2 12 L 0 14 Z');
      expect(selected()).toEqual([4]);
    });

    it('takes the out handle with the copy', () => {
      const { drag, pathData } = setUp('curve');
      drag([8, 16], [8, 18], ALT_CTRL);
      expect(pathData()).toBe('M 2 16 C 2 13 5 13 8 16 L 8 18 C 11 21 14 19 14 16');
    });

    it('extends either end of an open subpath', () => {
      const { drag, pathData, anchorIds } = setUp('diagonal');
      const ids = anchorIds();
      drag([50, 20], [52, 24], ALT_CTRL);
      expect(pathData()).toBe('M 30 0 L 50 20 L 52 24');
      vi.advanceTimersByTime(2000);
      drag([30, 0], [28, 2], ALT_CTRL);
      expect(pathData()).toBe('M 28 2 L 30 0 L 50 20 L 52 24');
      expect(anchorIds().slice(1, 3)).toEqual(ids);
    });

    it("doesn't snap the copy to the point it came from", () => {
      const { drag, pathData } = setUp('diagonal');
      // Snapping to (50, 20) would keep x at 50.
      drag([50, 20], [50.5, 23.2], ALT);
      expect(pathData()).toBe('M 30 0 L 50 20 L 50.5 23');
    });

    it('leaves nothing to undo when the copy is dropped back onto the point', () => {
      const { tool, store, pathData, selected } = setUp();
      const before = pathData();
      const steps = store.getState().past.length;
      tool.onPress({ x: 12, y: 2 }, ALT_CTRL);
      tool.onMove({ x: 15, y: 4 }, ALT_CTRL);
      expect(tool.getDrawing()?.anchors).toHaveLength(5);
      tool.onMove({ x: 12.3, y: 2.3 }, ALT_CTRL);
      tool.onRelease({ x: 12.3, y: 2.3 });
      expect(pathData()).toBe(before);
      expect(store.getState().past.length).toBe(steps);
      expect(selected()).toEqual([1]);
    });

    it('selects the point with a click, without copying it', () => {
      const { click, pathData, selected } = setUp();
      const before = pathData();
      click(12, 2, ALT);
      expect(pathData()).toBe(before);
      expect(selected()).toEqual([1]);
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

    it("doesn't change a point that the first click of a double-click added", () => {
      const { tool, path } = setUp();
      tool.onPress({ x: 5, y: 2 }, NONE, 1);
      tool.onRelease({ x: 5, y: 2 });
      tool.onPress({ x: 5, y: 2 }, NONE, 2);
      tool.onRelease({ x: 5, y: 2 });
      expect(path().getPathString()).toBe('M 2 2 L 5 2 L 12 2 L 12 12 L 2 12 Z');
      // A third press is a new click.
      tool.onPress({ x: 5, y: 2 }, NONE, 3);
      tool.onRelease({ x: 5, y: 2 });
      expect(PathEdit.getAnchors(path())[1].type).toBe('straight');
    });

    it("changes the selected points' type", () => {
      const { tool, click, path } = setUp('curve');
      click(8, 16);
      tool.setPointType('straight');
      expect(PathEdit.getAnchors(path())[1].type).toBe('straight');
    });

    it("leaves the path alone when a mirrored point's made disconnected", () => {
      const { tool, click, pathData, undo } = setUp('curve');
      const before = pathData();
      click(8, 16);
      tool.setPointType('disconnected');
      // Nothing about the path changed, so there's nothing to undo.
      expect(pathData()).toBe(before);
      tool.setPointType('straight');
      undo();
      expect(pathData()).toBe(before);
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

    it('leaves the layer to be deleted for one end of a line', () => {
      const { tool, click } = setUp('scaled');
      click(10, 2);
      expect(tool.deleteSelected()).toBe('empty');
    });
  });
});
