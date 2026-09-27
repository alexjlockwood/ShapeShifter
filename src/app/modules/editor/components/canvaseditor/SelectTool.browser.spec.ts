import { CanvasPreview } from 'app/modules/editor/components/canvas/CanvasPreview';
import { ClipPathLayer, GroupLayer, PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { AnimationRenderer } from 'app/modules/editor/scripts/animator';
import { createEditorServices } from 'app/modules/editor/services/createEditorServices';
import { createEditorStore } from 'app/modules/editor/store';
import {
  getHiddenLayerIds,
  getSelectedLayerIds,
  getVectorLayer,
} from 'app/modules/editor/store/layers/selectors';
import {
  getAnimatedVectorLayer,
  getCurrentTime,
} from 'app/modules/editor/store/playback/selectors';
import { ActionCreators } from 'redux-undo';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Modifiers, SelectTool } from './SelectTool';

const NONE: Modifiers = { shift: false, alt: false, command: false, ctrl: false };
const SHIFT: Modifiers = { ...NONE, shift: true };
const ALT: Modifiers = { ...NONE, alt: true };

function square(name: string, l: number, t: number) {
  return new PathLayer({
    name,
    children: [],
    pathData: new Path(`M ${l} ${t} L ${l + 4} ${t} L ${l + 4} ${t + 4} L ${l} ${t + 4} Z`),
    fillColor: '#000',
  });
}

describe('SelectTool', () => {
  let dispose: () => void = () => {};

  beforeEach(() => {
    // Edits less than a second apart are undone together.
    vi.useFakeTimers();
  });

  afterEach(() => {
    dispose();
    vi.useRealTimers();
  });

  /** @param pixelsPerUnit How many CSS pixels a viewport unit is on the screen. */
  function setUp({ pixelsPerUnit = 10 } = {}) {
    const store = createEditorStore({ logActions: false });
    const services = createEditorServices(store);
    const a = square('a', 2, 2);
    const b = square('b', 10, 2);
    const c = square('c', 2, 10);
    const inGroup = square('inGroup', 10, 10);
    const group = new GroupLayer({ name: 'group', children: [inGroup] });
    const clip = new ClipPathLayer({
      name: 'clip',
      children: [],
      pathData: new Path('M 0 0 L 24 0 L 24 24 L 0 24 Z'),
    });
    services.layerTimelineService.setVectorLayer(
      new VectorLayer({ name: 'vector', children: [clip, a, b, c, group] }),
    );
    vi.advanceTimersByTime(2000);
    const preview = new CanvasPreview(store, services.layerTimelineService);
    preview.init();
    dispose = () => {
      preview.dispose();
      services.dispose();
    };
    const editedPaths: string[] = [];
    const tool = new SelectTool({
      getVectorLayer: () => {
        const { vl, currentTime } = getAnimatedVectorLayer(store.getState());
        return preview.apply(vl, currentTime);
      },
      getHiddenLayerIds: () => getHiddenLayerIds(store.getState()),
      getSelectedLayerIds: () => getSelectedLayerIds(store.getState()),
      setSelectedLayerIds: ids => services.layerTimelineService.setSelectedLayers(new Set(ids)),
      toViewportLength: length => length / pixelsPerUnit,
      render: document =>
        new AnimationRenderer(document.vectorLayer, document.animation).setCurrentTime(
          getCurrentTime(store.getState()),
        ),
      preview,
      redraw: () => {},
      editPath: layerId => {
        editedPaths.push(layerId);
        return true;
      },
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
    const selected = () => [...getSelectedLayerIds(store.getState())].sort();
    const pathDataOf = (layerId: string) =>
      (
        getVectorLayer(store.getState()).findLayerById(layerId) as PathLayer
      ).pathData?.getPathString();
    return {
      store,
      services,
      tool,
      preview,
      a,
      b,
      c,
      group,
      click,
      drag,
      selected,
      pathDataOf,
      editedPaths,
    };
  }

  describe('selecting', () => {
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
      click(12, 4, SHIFT);
      expect(selected()).toEqual([a.id, b.id].sort());
      click(4, 4, SHIFT);
      expect(selected()).toEqual([b.id]);
      // Clicking nothing with Shift held keeps the selection.
      click(20, 20, SHIFT);
      expect(selected()).toEqual([b.id]);
    });

    it('selects just the clicked one of several selected paths', () => {
      const { a, b, click, selected } = setUp();
      click(4, 4);
      click(12, 4, SHIFT);
      click(4, 4);
      expect(selected()).toEqual([a.id]);
      expect(b.id).toBeTruthy();
    });

    it('selects the paths a marquee touches, but not clip paths', () => {
      const { a, b, drag, selected } = setUp();
      drag([1, 1], [11, 3]);
      expect(selected()).toEqual([a.id, b.id].sort());
    });

    it('only selects the paths a marquee contains with Alt held', () => {
      const { a, drag, selected } = setUp();
      drag([1, 1], [11, 7], ALT);
      expect(selected()).toEqual([a.id]);
    });

    it('adds to the selection with a marquee and Shift', () => {
      const { a, c, click, drag, selected } = setUp();
      click(4, 12);
      drag([1, 1], [7, 7], SHIFT);
      expect(selected()).toEqual([a.id, c.id].sort());
    });

    it("doesn't start a marquee until the pointer moves a few pixels", () => {
      const { tool, a, click, selected } = setUp();
      click(4, 4);
      tool.onPress({ x: 20, y: 20 }, NONE);
      // Three CSS pixels.
      tool.onMove({ x: 20.3, y: 20 }, NONE);
      expect(tool.getMarquee()).toBeUndefined();
      expect(selected()).toEqual([a.id]);
      tool.onMove({ x: 0, y: 0 }, NONE);
      expect(tool.getMarquee()).toEqual({ l: 0, t: 0, r: 20, b: 20 });
    });

    it('edits the path that is double-clicked', () => {
      const { a, tool, click, editedPaths } = setUp();
      click(4, 4);
      tool.onPress({ x: 4, y: 4 }, NONE, 2);
      tool.onRelease({ x: 4, y: 4 });
      expect(editedPaths).toEqual([a.id]);
      // Double-clicking nothing edits nothing.
      tool.onPress({ x: 20, y: 20 }, NONE, 2);
      tool.onRelease({ x: 20, y: 20 });
      expect(editedPaths).toEqual([a.id]);
    });

    it('hovers the path under the pointer, and forgets it when the pointer leaves', () => {
      const { tool, b } = setUp();
      tool.onMove({ x: 12, y: 4 }, NONE);
      expect(tool.getHoveredLayerId()).toBe(b.id);
      tool.onLeave();
      expect(tool.getHoveredLayerId()).toBeUndefined();
    });
  });

  describe('moving', () => {
    it('moves the path under the pointer, as one undo step', () => {
      const { store, a, drag, pathDataOf } = setUp();
      drag([4, 4], [7, 5]);
      expect(pathDataOf(a.id)).toBe('M 5 3 L 9 3 L 9 7 L 5 7 Z');
      store.dispatch(ActionCreators.undo());
      expect(pathDataOf(a.id)).toBe('M 2 2 L 6 2 L 6 6 L 2 6 Z');
    });

    it('shows the move before it ends, without changing the document', () => {
      const { tool, preview, a, pathDataOf } = setUp();
      tool.onPress({ x: 4, y: 4 }, NONE);
      tool.onMove({ x: 7, y: 4 }, NONE);
      expect(preview.isEditing()).toBe(true);
      expect(pathDataOf(a.id)).toBe('M 2 2 L 6 2 L 6 6 L 2 6 Z');
      // Where the path is shown, it's hit.
      tool.onRelease({ x: 7, y: 4 });
      expect(pathDataOf(a.id)).toBe('M 5 2 L 9 2 L 9 6 L 5 6 Z');
    });

    it('moves the whole selection', () => {
      const { a, b, click, drag, pathDataOf } = setUp();
      click(4, 4);
      click(12, 4, SHIFT);
      drag([12, 4], [12, 6]);
      expect(pathDataOf(a.id)).toBe('M 2 4 L 6 4 L 6 8 L 2 8 Z');
      expect(pathDataOf(b.id)).toBe('M 10 4 L 14 4 L 14 8 L 10 8 Z');
    });

    it('only moves horizontally or vertically with Shift held', () => {
      const { a, drag, pathDataOf } = setUp();
      drag([4, 4], [7, 5], SHIFT);
      expect(pathDataOf(a.id)).toBe('M 5 2 L 9 2 L 9 6 L 5 6 Z');
    });

    it('moves a selected group by dragging something in it', () => {
      const { store, group, click, drag, selected } = setUp();
      click(12, 12);
      // Selects the group, like the layer list would.
      const services = createEditorServices(store);
      services.layerTimelineService.setSelectedLayers(new Set([group.id]));
      drag([12, 12], [14, 12]);
      const moved = getVectorLayer(store.getState()).findLayerById(group.id) as GroupLayer;
      expect(moved.translateX).toBe(2);
      expect(selected()).toEqual([group.id]);
      services.dispose();
    });

    it('selects and moves what is under the pointer with the vector layer selected', () => {
      const { store, a, drag, selected, pathDataOf } = setUp();
      const services = createEditorServices(store);
      services.layerTimelineService.setSelectedLayers(
        new Set([getVectorLayer(store.getState()).id]),
      );
      drag([4, 4], [4, 6]);
      expect(selected()).toEqual([a.id]);
      expect(pathDataOf(a.id)).toBe('M 2 4 L 6 4 L 6 8 L 2 8 Z');
      services.dispose();
    });

    it('moves copies with Alt held, and selects them', () => {
      const { store, a, drag, selected, pathDataOf } = setUp();
      drag([4, 4], [4, 7], ALT);
      expect(pathDataOf(a.id)).toBe('M 2 2 L 6 2 L 6 6 L 2 6 Z');
      const [copyId] = selected();
      expect(copyId).not.toBe(a.id);
      expect(pathDataOf(copyId)).toBe('M 2 5 L 6 5 L 6 9 L 2 9 Z');
      expect(getVectorLayer(store.getState()).findLayerById(copyId)?.name).toBe('a_1');
      store.dispatch(ActionCreators.undo());
      expect(getVectorLayer(store.getState()).findLayerById(copyId)).toBeUndefined();
      expect(selected()).toEqual([a.id]);
    });

    it('throws a move away when the pointer leaves, or something else changes the document', () => {
      const { services, tool, a, b, pathDataOf } = setUp();
      tool.onPress({ x: 4, y: 4 }, NONE);
      tool.onMove({ x: 8, y: 8 }, NONE);
      tool.onLeave();
      expect(pathDataOf(a.id)).toBe('M 2 2 L 6 2 L 6 6 L 2 6 Z');

      // E.g. renaming b in the layer list during the move.
      tool.onPress({ x: 4, y: 4 }, NONE);
      tool.onMove({ x: 8, y: 8 }, NONE);
      const renamed = b.clone();
      renamed.name = 'renamed';
      services.layerTimelineService.updateLayer(renamed);
      tool.onRelease({ x: 8, y: 8 });
      expect(pathDataOf(a.id)).toBe('M 2 2 L 6 2 L 6 6 L 2 6 Z');
    });
  });

  describe('scaling and rotating', () => {
    // Square a covers 2 to 6, so its handles are at 2, 4, and 6.
    function selectA(click: (x: number, y: number) => void) {
      click(4, 4);
    }

    it('scales from the handle across from the one dragged, as one undo step', () => {
      const { store, a, click, drag, pathDataOf } = setUp();
      selectA(click);
      drag([6, 6], [10, 8]);
      expect(pathDataOf(a.id)).toBe('M 2 2 L 10 2 L 10 8 L 2 8 Z');
      store.dispatch(ActionCreators.undo());
      expect(pathDataOf(a.id)).toBe('M 2 2 L 6 2 L 6 6 L 2 6 Z');
    });

    it('scales from the middle with Alt held, and keeps the proportions with Shift', () => {
      const { a, click, drag, pathDataOf } = setUp();
      selectA(click);
      drag([6, 6], [8, 6], ALT);
      expect(pathDataOf(a.id)).toBe('M 0 2 L 8 2 L 8 6 L 0 6 Z');
      drag([8, 6], [12, 6], SHIFT);
      expect(pathDataOf(a.id)).toBe('M 0 2 L 12 2 L 12 8 L 0 8 Z');
    });

    it('only scales across an edge handle', () => {
      const { a, click, drag, pathDataOf } = setUp();
      selectA(click);
      drag([6, 4], [10, 9]);
      expect(pathDataOf(a.id)).toBe('M 2 2 L 10 2 L 10 6 L 2 6 Z');
    });

    it('rotates around the middle from just outside of a corner, in steps with Shift', () => {
      const { a, click, drag, pathDataOf } = setUp();
      selectA(click);
      // From just outside the top right corner, at -45 degrees around the middle at (4, 4), to 43
      // degrees, which turns to a quarter turn clockwise.
      drag([7, 1], [7.1, 6.9], SHIFT);
      expect(pathDataOf(a.id)).toBe('M 6 2 L 6 6 L 2 6 L 2 2 Z');
    });

    it('scales by how far the pointer moves, when it presses a little way from the handle', () => {
      const { a, click, drag, pathDataOf } = setUp();
      selectA(click);
      drag([6.3, 6.3], [10.3, 8.3]);
      expect(pathDataOf(a.id)).toBe('M 2 2 L 10 2 L 10 8 L 2 8 Z');
    });

    it("doesn't scale until the pointer moves a few pixels", () => {
      const { store, tool, preview, a, click, pathDataOf } = setUp();
      selectA(click);
      tool.onPress({ x: 6, y: 6 }, NONE);
      // Three CSS pixels.
      tool.onMove({ x: 6.3, y: 6 }, NONE);
      // Nothing is drawn differently.
      const { vl, currentTime } = getAnimatedVectorLayer(store.getState());
      expect(preview.apply(vl, currentTime)).toBe(vl);
      tool.onRelease({ x: 6.3, y: 6 });
      expect(pathDataOf(a.id)).toBe('M 2 2 L 6 2 L 6 6 L 2 6 Z');
    });

    it('redoes a drag when a modifier key changes', () => {
      const { tool, a, click, pathDataOf } = setUp();
      selectA(click);
      tool.onPress({ x: 4, y: 4 }, NONE);
      tool.onMove({ x: 7, y: 5 }, NONE);
      tool.onModifiersChange(SHIFT);
      tool.onRelease({ x: 7, y: 5 });
      expect(pathDataOf(a.id)).toBe('M 5 2 L 9 2 L 9 6 L 5 6 Z');
    });

    it('moves a small selection that is pressed inside of its handles', () => {
      // Square a is 20 pixels wide.
      const { a, click, drag, pathDataOf } = setUp({ pixelsPerUnit: 5 });
      selectA(click);
      // On the bottom right handle, but inside of the square.
      drag([5.8, 5.8], [7.8, 5.8]);
      expect(pathDataOf(a.id)).toBe('M 4 2 L 8 2 L 8 6 L 4 6 Z');
      // Outside of it, the handle scales.
      drag([8.5, 6.5], [10.5, 6.5]);
      expect(pathDataOf(a.id)).toBe('M 4 2 L 10 2 L 10 6 L 4 6 Z');
    });

    it('hovers and presses a path in a rotation zone, rather than rotating', () => {
      const { tool, b, click, drag, selected, pathDataOf } = setUp({ pixelsPerUnit: 5 });
      selectA(click);
      // Near b's left edge, and within 20 pixels of a's top right corner.
      tool.onMove({ x: 9.5, y: 3 }, NONE);
      expect(tool.getCursor()).toBeUndefined();
      expect(tool.getHoveredLayerId()).toBe(b.id);
      drag([9.5, 3], [9.5, 5]);
      expect(selected()).toEqual([b.id]);
      expect(pathDataOf(b.id)).toBe('M 10 4 L 14 4 L 14 8 L 10 8 Z');
    });

    it('scales with a handle that is over a path', () => {
      const { b, click, drag, pathDataOf } = setUp();
      // Square b's top left handle is at (10, 2), on its own corner.
      click(12, 4);
      drag([10, 2], [8, 2]);
      expect(pathDataOf(b.id)).toBe('M 8 2 L 14 2 L 14 6 L 8 6 Z');
    });

    it('shows the cursor for the handle under the pointer', () => {
      const { tool, click } = setUp();
      selectA(click);
      tool.onMove({ x: 6, y: 6 }, NONE);
      expect(tool.getCursor()).toBe('nwse-resize');
      // 1.2 units, or 12 pixels, from the top right corner.
      tool.onMove({ x: 6.85, y: 1.15 }, NONE);
      expect(tool.getCursor()).toBe('rotate-ne');
      tool.onMove({ x: 4, y: 4 }, NONE);
      expect(tool.getCursor()).toBeUndefined();
    });
  });

  describe('snapping', () => {
    it("snaps a move to another path's edge, and shows a guide", () => {
      const { tool, a, pathDataOf } = setUp();
      // a's right edge lands at 9.6, less than 8 pixels from b's left edge at 10.
      tool.onPress({ x: 4, y: 4 }, NONE);
      tool.onMove({ x: 7.6, y: 4 }, NONE);
      expect(tool.getGuides()).toContainEqual({ axis: 'x', value: 10, from: 2, to: 6 });
      tool.onRelease({ x: 7.6, y: 4 });
      expect(pathDataOf(a.id)).toBe('M 6 2 L 10 2 L 10 6 L 6 6 Z');
      expect(tool.getGuides()).toEqual([]);
    });

    it('snaps a move to the pixel grid away from other paths', () => {
      const { a, drag, pathDataOf } = setUp();
      drag([4, 4], [18.3, 18.2]);
      expect(pathDataOf(a.id)).toBe('M 16 16 L 20 16 L 20 20 L 16 20 Z');
    });

    it("doesn't snap with Ctrl held", () => {
      const { a, drag, pathDataOf } = setUp();
      // Without Ctrl, this small move would snap back to c's left edge and b's top one.
      drag([4, 4], [4.5, 4.2]);
      expect(pathDataOf(a.id)).toBe('M 2 2 L 6 2 L 6 6 L 2 6 Z');
      drag([4, 4], [4.5, 4.2], { ...NONE, ctrl: true });
      expect(pathDataOf(a.id)).toBe('M 2.5 2.2 L 6.5 2.2 L 6.5 6.2 L 2.5 6.2 Z');
    });

    it('snaps a scale handle, and shows a guide', () => {
      const { tool, a, click, pathDataOf } = setUp();
      click(4, 4);
      // The right edge stops at b's left edge.
      tool.onPress({ x: 6, y: 4 }, NONE);
      tool.onMove({ x: 9.5, y: 4 }, NONE);
      expect(tool.getGuides()).toContainEqual({ axis: 'x', value: 10, from: 2, to: 6 });
      tool.onRelease({ x: 9.5, y: 4 });
      expect(pathDataOf(a.id)).toBe('M 2 2 L 10 2 L 10 6 L 2 6 Z');
    });

    it('snaps where the handle is dragged to, rather than the pointer', () => {
      const { a, click, drag, pathDataOf } = setUp();
      click(4, 4);
      // Half a unit to the right of the handle, so the handle lands at 9.6, in range of b.
      drag([6.5, 4], [10.1, 4]);
      expect(pathDataOf(a.id)).toBe('M 2 2 L 10 2 L 10 6 L 2 6 Z');
    });

    it('only snaps the side that sets the scale when Shift keeps the proportions', () => {
      const { tool, a, click, pathDataOf } = setUp();
      click(4, 4);
      // Wider more than taller, so the width sets the scale. The bottom is near b's, at 6, but it
      // ends up at 10.
      tool.onPress({ x: 6, y: 6 }, NONE);
      tool.onMove({ x: 9.7, y: 6.3 }, SHIFT);
      expect(tool.getGuides().map(guide => [guide.axis, guide.value])).toEqual([
        ['x', 10],
        ['x', 10],
      ]);
      tool.onRelease({ x: 9.7, y: 6.3 });
      expect(pathDataOf(a.id)).toBe('M 2 2 L 10 2 L 10 10 L 2 10 Z');
    });
  });
});
