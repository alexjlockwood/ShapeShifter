import { CanvasPreview } from 'app/modules/editor/components/canvas/CanvasPreview';
import { GroupLayer, Layer, PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { Matrix } from 'app/modules/editor/scripts/common';
import { Path } from 'app/modules/editor/model/paths';
import * as PathEdit from 'app/modules/editor/model/paths/PathEdit';
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

import type { CanvasTool, DrawToolContext } from './drawTools';
import { createPathLayer, getNewLayerPlace, getNewLayerSpot } from './newLayers';
import { PencilTool } from './PencilTool';
import { PenTool } from './PenTool';
import type { Modifiers } from './SelectTool';
import { ShapeTool } from './ShapeTool';

const NONE: Modifiers = { shift: false, alt: false, command: false, ctrl: false };
const SHIFT: Modifiers = { ...NONE, shift: true };
const ALT: Modifiers = { ...NONE, alt: true };
const CTRL: Modifiers = { ...NONE, ctrl: true };

describe('drawing tools', () => {
  let dispose: () => void = () => {};

  beforeEach(() => {
    // Edits less than a second apart are undone together.
    vi.useFakeTimers();
  });

  afterEach(() => {
    dispose();
    vi.useRealTimers();
  });

  /** A viewport unit is 10 CSS pixels. The group is scaled by 2, and far from the rest. */
  function setUp() {
    const store = createEditorStore({ logActions: false });
    const services = createEditorServices(store);
    const inGroup = new PathLayer({
      name: 'inGroup',
      children: [],
      pathData: new Path('M 40 40 L 41 40'),
      strokeColor: '#000',
    });
    const group = new GroupLayer({ name: 'group', children: [inGroup], scaleX: 2, scaleY: 2 });
    const existing = new PathLayer({
      name: 'existing',
      children: [],
      pathData: new Path('M 30 30 L 34 30 L 34 34'),
      strokeColor: '#000',
    });
    services.layerTimelineService.setVectorLayer(
      new VectorLayer({ name: 'vector', children: [group, existing] }),
    );
    vi.advanceTimersByTime(2000);
    const preview = new CanvasPreview(store, services.layerTimelineService);
    preview.init();
    dispose = () => {
      preview.dispose();
      services.dispose();
    };
    const finish = vi.fn<() => void>();
    const context: DrawToolContext = {
      getVectorLayer: () => {
        const { vl, currentTime } = getAnimatedVectorLayer(store.getState());
        return preview.apply(vl, currentTime);
      },
      getHiddenLayerIds: () => getHiddenLayerIds(store.getState()),
      getSelectedLayerIds: () => getSelectedLayerIds(store.getState()),
      toViewportLength: length => length / 10,
      getSnapThresholds: () => ({ lines: 0.8, grid: 0.4 }),
      getGuides: () => [],
      canEditPath: layerId => preview.canEditPath(layerId),
      render: document =>
        new AnimationRenderer(document.vectorLayer, document.animation).setCurrentTime(
          getCurrentTime(store.getState()),
        ),
      preview,
      redraw: () => {},
      finish,
    };
    const vl = () => getVectorLayer(store.getState());
    const layerNamed = (name: string) => vl().findLayerByName(name) as PathLayer | undefined;
    const selectedNames = () =>
      [...getSelectedLayerIds(store.getState())].map(id => vl().findLayerById(id)?.name);
    const select = (layer: Layer) =>
      services.layerTimelineService.setSelectedLayers(new Set([layer.id]));
    const undo = () => {
      vi.advanceTimersByTime(2000);
      store.dispatch(ActionCreators.undo());
    };
    const idOf = (name: string) => {
      const id = vl().findLayerByName(name)?.id;
      if (!id) {
        throw new Error(`No layer named ${name}`);
      }
      return id;
    };
    return {
      store,
      services,
      preview,
      context,
      finish,
      vl,
      layerNamed,
      selectedNames,
      select,
      undo,
      idOf,
    };
  }

  function drag(tool: CanvasTool, from: [number, number], to: [number, number], modifiers = NONE) {
    // Time passes between the moves, so that edits dispatched on each move would be separate undo
    // steps.
    tool.onPress({ x: from[0], y: from[1] }, modifiers);
    vi.advanceTimersByTime(2000);
    tool.onMove({ x: (from[0] + to[0]) / 2, y: (from[1] + to[1]) / 2 }, modifiers);
    vi.advanceTimersByTime(2000);
    tool.onMove({ x: to[0], y: to[1] }, modifiers);
    vi.advanceTimersByTime(2000);
    tool.onRelease({ x: to[0], y: to[1] });
  }

  function click(tool: PenTool, x: number, y: number, modifiers = NONE, clickCount = 1) {
    tool.onPress({ x, y }, modifiers, clickCount);
    tool.onRelease({ x, y });
    vi.advanceTimersByTime(2000);
  }

  describe('getNewLayerSpot', () => {
    it('puts new layers at the top of the selected group, just above the selected layer, or at the top', () => {
      const { vl, idOf } = setUp();
      const spot = (...names: string[]) => {
        const { parentId, index } = getNewLayerSpot(vl(), new Set(names.map(idOf)));
        return [vl().findLayerById(parentId)?.name, index];
      };
      expect(spot()).toEqual(['vector', 2]);
      expect(spot('group')).toEqual(['group', 1]);
      // Above inGroup, which is the first layer in the group.
      expect(spot('inGroup')).toEqual(['group', 1]);
      expect(spot('existing')).toEqual(['vector', 2]);
      expect(spot('group', 'existing')).toEqual(['vector', 2]);
    });
  });

  describe('getNewLayerPlace', () => {
    it("skips groups that are hidden or scaled to 0, where the layer couldn't be seen", () => {
      const { store, services, context, idOf } = setUp();
      const document = () => {
        const state = store.getState().present;
        return { vectorLayer: state.layers.vectorLayer, animation: state.timeline.animation };
      };
      const selected = new Set([idOf('group')]);
      const inGroup = getNewLayerPlace(document(), selected, new Set(), doc => context.render(doc));
      expect(inGroup.parentId).toBe(idOf('group'));
      expect(inGroup.toLocal.equals(new Matrix(0.5, 0, 0, 0.5, 0, 0))).toBe(true);
      // Above the group, which is the vector layer's first layer.
      const hidden = getNewLayerPlace(document(), selected, new Set([idOf('group')]), doc =>
        context.render(doc),
      );
      expect([hidden.parentId, hidden.index]).toEqual([document().vectorLayer.id, 1]);
      const group = document().vectorLayer.findLayerById(idOf('group')) as GroupLayer;
      const flat = group.clone();
      flat.scaleX = 0;
      services.layerTimelineService.updateLayer(flat);
      const scaledToZero = getNewLayerPlace(document(), selected, new Set(), doc =>
        context.render(doc),
      );
      expect([scaledToZero.parentId, scaledToZero.index]).toEqual([document().vectorLayer.id, 1]);
    });

    it('makes strokes a viewport unit wide, whatever the size of the artboard', () => {
      // The morphinganimals demo's artboard, which used to get strokes 409 / 24 = 17.042 wide.
      const vl = new VectorLayer({ name: 'vector', children: [], width: 409, height: 300 });
      const top = { parentId: vl.id, index: 0, toLocal: Matrix.identity() };
      const path = new Path('M 0 0 L 1 1');
      expect(createPathLayer(vl, 'a', path, 'stroked', top).strokeWidth).toBe(1);
      // In a group scaled by 3, rounded to 3 decimals.
      const inGroup = { ...top, toLocal: Matrix.scaling(1 / 3, 1 / 3) };
      expect(createPathLayer(vl, 'a', path, 'stroked', inGroup).strokeWidth).toBe(0.333);
    });

    it("makes strokes a unit wide in the place's coordinates", () => {
      const { store, context, idOf } = setUp();
      const state = store.getState().present;
      const document = {
        vectorLayer: state.layers.vectorLayer,
        animation: state.timeline.animation,
      };
      const path = new Path('M 0 0 L 1 1');
      const top = getNewLayerPlace(document, new Set(), new Set(), doc => context.render(doc));
      expect(createPathLayer(document.vectorLayer, 'a', path, 'stroked', top).strokeWidth).toBe(1);
      // The group is scaled by 2.
      const inGroup = getNewLayerPlace(document, new Set([idOf('group')]), new Set(), doc =>
        context.render(doc),
      );
      expect(createPathLayer(document.vectorLayer, 'a', path, 'stroked', inGroup).strokeWidth).toBe(
        0.5,
      );
    });
  });

  describe('ShapeTool', () => {
    it('draws a rectangle as one undo step, snapping its corners, and selects it', () => {
      const { context, finish, layerNamed, selectedNames, undo } = setUp();
      const tool = new ShapeTool('rectangle', context);
      drag(tool, [2.3, 2.2], [8.1, 6.2]);
      expect(layerNamed('rectangle')?.pathData?.getPathString()).toBe('M 2 2 L 8 2 L 8 6 L 2 6 Z');
      expect(layerNamed('rectangle')?.fillColor).toBe('#000000');
      expect(selectedNames()).toEqual(['rectangle']);
      expect(finish).toHaveBeenCalledTimes(1);
      undo();
      expect(layerNamed('rectangle')).toBeUndefined();
    });

    it('draws squares with Shift, and from the middle with Alt', () => {
      const { context, layerNamed } = setUp();
      drag(new ShapeTool('rectangle', context), [2, 2], [5, 8], SHIFT);
      expect(layerNamed('rectangle')?.pathData?.getPathString()).toBe('M 2 2 L 8 2 L 8 8 L 2 8 Z');
      drag(new ShapeTool('rectangle', context), [10, 10], [12, 11], ALT);
      expect(layerNamed('rectangle_1')?.pathData?.getPathString()).toBe(
        'M 8 9 L 12 9 L 12 11 L 8 11 Z',
      );
    });

    it('draws an ellipse in the coordinates of the selected group', () => {
      const { context, layerNamed, select, vl } = setUp();
      select(vl().findLayerByName('group') as Layer);
      drag(new ShapeTool('ellipse', context), [2, 2], [10, 6], CTRL);
      const ellipse = layerNamed('ellipse');
      expect(
        vl()
          .findLayerByName('group')
          ?.children.map(l => l.name),
      ).toEqual(['inGroup', 'ellipse']);
      // Drawn from (2, 2) to (10, 6), which is half that in the group.
      const box = ellipse?.pathData?.getBoundingBox();
      expect(box?.l).toBeCloseTo(1);
      expect(box?.t).toBeCloseTo(1);
      expect(box?.r).toBeCloseTo(5);
      expect(box?.b).toBeCloseTo(3);
      // An ellipse from the top, clockwise, rather than a box.
      expect(ellipse?.pathData?.getPathString()).toMatch(/^M 3 1 C 4.105 1 5 1.448 5 2 C /);
    });

    it('draws a stroked line, at 45 degrees with Shift', () => {
      const { context, layerNamed } = setUp();
      drag(new ShapeTool('line', context), [2, 2], [6.3, 5.8], SHIFT);
      const line = layerNamed('line');
      // It's on the pixel grid too.
      expect(line?.pathData?.getPathString()).toBe('M 2 2 L 6 6');
      expect(line?.strokeWidth).toBe(1);
    });

    it("doesn't draw a shape with no area, e.g. when a click jitters near a snap", () => {
      const { context, finish, vl } = setUp();
      // 0.7 from the existing path's corner at (30, 30), which both ends snap to.
      drag(new ShapeTool('rectangle', context), [30.7, 30], [30.7, 30.5]);
      drag(new ShapeTool('ellipse', context), [2, 2], [10, 2.1]);
      expect(vl().children).toHaveLength(2);
      expect(finish).not.toHaveBeenCalled();
    });

    it("doesn't draw anything for a click, or once the pointer leaves", () => {
      const { context, finish, vl } = setUp();
      const tool = new ShapeTool('rectangle', context);
      tool.onPress({ x: 2, y: 2 }, NONE);
      tool.onRelease({ x: 2, y: 2 });
      tool.onPress({ x: 2, y: 2 }, NONE);
      tool.onMove({ x: 6, y: 6 }, NONE);
      tool.onLeave();
      tool.onRelease({ x: 6, y: 6 });
      expect(vl().children).toHaveLength(2);
      expect(finish).not.toHaveBeenCalled();
    });
  });

  describe('PencilTool', () => {
    it('fits curves to a stroke, and makes a stroked layer', () => {
      const { context, layerNamed, selectedNames } = setUp();
      const tool = new PencilTool(context);
      tool.onPress({ x: 2, y: 10 }, NONE);
      for (let x = 2; x <= 20; x += 0.25) {
        tool.onMove({ x, y: 10 + 3 * Math.sin(x / 2) }, NONE);
      }
      tool.onRelease({ x: 20, y: 10 + 3 * Math.sin(10) });
      const path = layerNamed('path')?.pathData;
      expect(path?.getPathString()).toMatch(/^M 2 10 C /);
      expect(
        path
          ?.getCommands()
          .slice(1)
          .every(c => c.type === 'C'),
      ).toBe(true);
      expect(layerNamed('path')?.strokeColor).toBe('#000000');
      expect(selectedNames()).toEqual(['path']);
    });

    it("doesn't draw anything for a click", () => {
      const { context, vl } = setUp();
      const tool = new PencilTool(context);
      tool.onPress({ x: 2, y: 2 }, NONE);
      tool.onMove({ x: 2.1, y: 2 }, NONE);
      tool.onRelease({ x: 2.1, y: 2 });
      expect(vl().children).toHaveLength(2);
    });
  });

  describe('PenTool', () => {
    it('adds a point for each click, and closes the path on its first point', () => {
      const { context, finish, layerNamed, selectedNames, undo } = setUp();
      const pen = new PenTool(context);
      click(pen, 2, 2);
      expect(layerNamed('path')?.pathData?.getPathString()).toBe('M 2 2');
      expect(selectedNames()).toEqual(['path']);
      click(pen, 6, 2);
      click(pen, 6, 6);
      expect(pen.isDrawing()).toBe(true);
      expect(pen.getCursor()).toBe('pen');
      pen.onMove({ x: 2.2, y: 2.2 }, NONE);
      expect(pen.getCursor()).toBe('pen-close');
      click(pen, 2.2, 2.2);
      expect(layerNamed('path')?.pathData?.getPathString()).toBe('M 2 2 L 6 2 L 6 6 Z');
      expect(pen.isDrawing()).toBe(false);
      expect(finish).toHaveBeenCalledTimes(1);
      // Each point is its own undo step.
      undo();
      expect(layerNamed('path')?.pathData?.getPathString()).toBe('M 2 2 L 6 2 L 6 6');
    });

    it('pulls out mirrored handles with a drag, and breaks them with Alt', () => {
      const { context, layerNamed } = setUp();
      const pen = new PenTool(context);
      click(pen, 2, 2);
      drag(pen, [6, 2], [8, 2]);
      expect(layerNamed('path')?.pathData?.getPathString()).toBe('M 2 2 C 2 2 4 2 6 2');
      // The next segment starts with the handle that was pulled out.
      click(pen, 6, 6);
      expect(layerNamed('path')?.pathData?.getPathString()).toBe(
        'M 2 2 C 2 2 4 2 6 2 C 8 2 6 6 6 6',
      );
      vi.advanceTimersByTime(2000);
      // With Alt held, the segment into the point stays a line, and only the next one curves.
      drag(pen, [2, 6], [2, 8], ALT);
      click(pen, 2, 10);
      expect(layerNamed('path')?.pathData?.getPathString()).toBe(
        'M 2 2 C 2 2 4 2 6 2 C 8 2 6 6 6 6 L 2 6 C 2 8 2 10 2 10',
      );
    });

    it('keeps segments at 45 degrees with Shift', () => {
      const { context, layerNamed } = setUp();
      const pen = new PenTool(context);
      click(pen, 2, 2);
      click(pen, 6.3, 5.8, SHIFT);
      expect(layerNamed('path')?.pathData?.getPathString()).toBe('M 2 2 L 6 6');
    });

    it('finishes with a double-click, and deletes a path with one point', () => {
      const { context, finish, layerNamed, vl } = setUp();
      const pen = new PenTool(context);
      click(pen, 2, 2);
      click(pen, 6, 2);
      pen.onPress({ x: 6, y: 2 }, NONE, 2);
      pen.onRelease({ x: 6, y: 2 });
      expect(finish).toHaveBeenCalledTimes(1);
      expect(layerNamed('path')?.pathData?.getPathString()).toBe('M 2 2 L 6 2');
      const other = new PenTool(context);
      click(other, 10, 10);
      expect(vl().children).toHaveLength(4);
      other.finish();
      expect(vl().children).toHaveLength(3);
    });

    it('adds a subpath to the path being edited, or goes on from one of its ends', () => {
      const { context, layerNamed, idOf } = setUp();
      const pen = new PenTool({ ...context, targetLayerId: idOf('existing') });
      // The start of 'M 30 30 L 34 30 L 34 34'.
      click(pen, 30, 30);
      click(pen, 30, 34);
      expect(layerNamed('existing')?.pathData?.getPathString()).toBe(
        'M 34 34 L 34 30 L 30 30 L 30 34',
      );
      pen.finish();
      click(pen, 40, 40);
      click(pen, 44, 40);
      expect(layerNamed('existing')?.pathData?.getPathString()).toBe(
        'M 34 34 L 34 30 L 30 30 L 30 34 M 40 40 L 44 40',
      );
    });

    it("pulls out both of the first point's handles when it closes the path with a drag", () => {
      const { context, layerNamed } = setUp();
      const pen = new PenTool(context);
      click(pen, 2, 2);
      click(pen, 6, 2);
      click(pen, 6, 6);
      drag(pen, [2, 2], [2, 0]);
      expect(layerNamed('path')?.pathData?.getPathString()).toBe(
        'M 2 2 C 2 0 4.667 2 6 2 L 6 6 C 6 6 2 4 2 2 Z',
      );
    });

    it('finishes with a click on the last point, and a release of Shift frees the handle', () => {
      const { context, finish, layerNamed } = setUp();
      const pen = new PenTool(context);
      click(pen, 2, 2);
      pen.onPress({ x: 6, y: 2 }, SHIFT);
      pen.onMove({ x: 8, y: 2.5 }, SHIFT);
      pen.onModifiersChange(NONE);
      pen.onRelease({ x: 8, y: 2.5 });
      expect(layerNamed('path')?.pathData?.getPathString()).toBe('M 2 2 C 2 2 4 1.5 6 2');
      vi.advanceTimersByTime(2000);
      click(pen, 6, 2);
      expect(finish).toHaveBeenCalledTimes(1);
      expect(pen.isDrawing()).toBe(false);
    });

    it('stops drawing a path that an animation block starts to set', () => {
      const { context, services, preview, idOf, vl } = setUp();
      const pen = new PenTool(context);
      click(pen, 2, 2);
      click(pen, 6, 2);
      services.layerTimelineService.addBlocks([
        {
          layerId: idOf('path'),
          propertyName: 'pathData',
          fromValue: new Path('M 2 2 L 6 2'),
          toValue: new Path('M 2 2 L 6 6'),
          currentTime: 0,
          duration: 100,
        },
      ]);
      // A new path, rather than an error.
      click(pen, 6, 6);
      expect(preview.isEditing()).toBe(false);
      expect(vl().findLayerByName('path_1')?.id).toBeTruthy();
    });

    it("doesn't delete a one-point subpath that the pen didn't start", () => {
      const { context, services, vl, layerNamed, idOf } = setUp();
      const existing = layerNamed('existing')?.clone() as PathLayer;
      existing.pathData = new Path('M 30 30 L 34 30 M 50 50');
      services.layerTimelineService.updateLayer(existing);
      const pen = new PenTool({ ...context, targetLayerId: idOf('existing') });
      click(pen, 50, 50);
      expect(pen.isDrawing()).toBe(true);
      pen.finish();
      expect(layerNamed('existing')?.pathData?.getPathString()).toBe('M 30 30 L 34 30 M 50 50');
      expect(vl().children).toHaveLength(2);
    });

    it("isn't an undo step to press the end of a subpath and let go", () => {
      const { context, store, idOf } = setUp();
      const pen = new PenTool({ ...context, targetLayerId: idOf('existing') });
      const steps = store.getState().past.length;
      click(pen, 34, 34);
      expect(store.getState().past.length).toBe(steps);
    });

    it('keeps drawing the same subpath when the ones before it change', () => {
      const { context, services, layerNamed, idOf } = setUp();
      const existing = layerNamed('existing')?.clone() as PathLayer;
      existing.pathData = new Path('M 60 60 L 64 60 M 60 70 L 64 70 M 60 80 L 64 80');
      services.layerTimelineService.updateLayer(existing);
      vi.advanceTimersByTime(2000);
      const pen = new PenTool({ ...context, targetLayerId: idOf('existing') });
      click(pen, 64, 70);
      click(pen, 66, 72);
      // E.g. the edit mode's Backspace, while the pen is drawing.
      const edited = layerNamed('existing')?.clone() as PathLayer;
      const path = edited.pathData as Path;
      const firstSubPath = PathEdit.getAnchors(path).filter(a => a.subIdx === 0);
      edited.pathData = PathEdit.deleteAnchors(path, new Set(firstSubPath.map(a => a.id)));
      services.layerTimelineService.updateLayer(edited);
      expect(layerNamed('existing')?.pathData?.getPathString()).toBe(
        'M 60 70 L 64 70 L 66 72 M 60 80 L 64 80',
      );
      click(pen, 68, 74);
      expect(layerNamed('existing')?.pathData?.getPathString()).toBe(
        'M 60 70 L 64 70 L 66 72 L 68 74 M 60 80 L 64 80',
      );
    });

    it('removes the last point, and goes on from the one before', () => {
      const { context, layerNamed } = setUp();
      const pen = new PenTool(context);
      click(pen, 2, 2);
      click(pen, 6, 2);
      click(pen, 6, 6);
      expect(pen.removeLastPoint()).toBe(true);
      expect(layerNamed('path')?.pathData?.getPathString()).toBe('M 2 2 L 6 2');
      click(pen, 10, 2);
      expect(layerNamed('path')?.pathData?.getPathString()).toBe('M 2 2 L 6 2 L 10 2');
    });

    it('leaves the handle into the point where it is once Alt is pressed', () => {
      const { context, layerNamed } = setUp();
      const pen = new PenTool(context);
      click(pen, 2, 2);
      pen.onPress({ x: 6, y: 2 }, NONE);
      pen.onMove({ x: 8, y: 2 }, NONE);
      pen.onModifiersChange(ALT);
      pen.onMove({ x: 8, y: 4 }, ALT);
      pen.onRelease({ x: 8, y: 4 });
      expect(layerNamed('path')?.pathData?.getPathString()).toBe('M 2 2 C 2 2 4 2 6 2');
      vi.advanceTimersByTime(2000);
      click(pen, 6, 8);
      expect(layerNamed('path')?.pathData?.getCommands()[2].points[1]).toEqual({ x: 8, y: 4 });
    });

    it('keeps a smooth first point smooth when a click closes the path', () => {
      const { context, layerNamed } = setUp();
      const pen = new PenTool(context);
      drag(pen, [2, 2], [4, 2], CTRL);
      click(pen, 6, 6);
      click(pen, 2, 6);
      click(pen, 2, 2);
      expect(layerNamed('path')?.pathData?.getPathString()).toBe(
        'M 2 2 C 4 2 6 6 6 6 L 2 6 C 2 6 0 2 2 2 Z',
      );
    });

    it("doesn't change a path when the pen goes on from its start without adding anything", () => {
      const { context, store, layerNamed, idOf } = setUp();
      const pen = new PenTool({ ...context, targetLayerId: idOf('existing') });
      const steps = store.getState().past.length;
      click(pen, 30, 30);
      pen.finish();
      expect(layerNamed('existing')?.pathData?.getPathString()).toBe('M 30 30 L 34 30 L 34 34');
      expect(store.getState().past.length).toBe(steps);
    });

    it('forgets the handle it pulled out when undo changes the path', () => {
      const { context, layerNamed, undo } = setUp();
      const pen = new PenTool(context);
      click(pen, 2, 2);
      drag(pen, [6, 2], [8, 2]);
      undo();
      expect(layerNamed('path')?.pathData?.getPathString()).toBe('M 2 2');
      click(pen, 6, 6);
      expect(layerNamed('path')?.pathData?.getPathString()).toBe('M 2 2 L 6 6');
    });
  });
});
