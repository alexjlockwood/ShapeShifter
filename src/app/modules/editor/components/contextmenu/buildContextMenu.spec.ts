import type {
  CanvasEditorCommands,
  CanvasEditorMenuState,
} from 'app/modules/editor/components/canvas/CanvasEditorApi';
import { ActionMode } from 'app/modules/editor/model/actionmode';
import {
  ClipPathLayer,
  GroupLayer,
  type Layer,
  PathLayer,
  VectorLayer,
} from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { Animation, AnimationBlock } from 'app/modules/editor/model/timeline';
import {
  createEditorServices,
  type EditorServices,
} from 'app/modules/editor/services/createEditorServices';
import { createEditorStore, type State, type Store } from 'app/modules/editor/store';
import { getSelectedLayerIds } from 'app/modules/editor/store/layers/selectors';
import { ResetWorkspace } from 'app/modules/editor/store/reset/actions';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import {
  buildContextMenu,
  type ContextMenuItem,
  type ContextMenuSection,
  formatShortcut,
} from './buildContextMenu';
import type { ContextMenuTarget } from './contextmenu.service';

describe('buildContextMenu', () => {
  let store: Store<State>;
  let services: EditorServices;
  let editor: CanvasEditorCommands & { menuState: CanvasEditorMenuState };
  let runCommand: Mock<CanvasEditorCommands['runCommand']>;
  let runPointCommand: Mock<CanvasEditorCommands['runPointCommand']>;

  beforeEach(() => {
    store = createEditorStore();
    services = createEditorServices(store);
    runCommand = vi.fn<CanvasEditorCommands['runCommand']>();
    runPointCommand = vi.fn<CanvasEditorCommands['runPointCommand']>();
    editor = {
      menuState: {},
      getLayerAt: () => undefined,
      getMenuState: () => editor.menuState,
      runCommand,
      startPointEdit: () => false,
      stopPointEdit: () => {},
      setSelectedAnchorIds: () => {},
      editPoints: () => {},
      runPointCommand,
      selectPointAt: () => {},
    };
  });

  afterEach(() => {
    services.dispose();
  });

  function load(children: Layer[], blocks: AnimationBlock[] = []) {
    const vectorLayer = new VectorLayer({ name: 'vector', children, width: 24, height: 24 });
    const animation = new Animation();
    animation.blocks = blocks;
    store.dispatch(new ResetWorkspace(vectorLayer, animation));
  }

  /** Builds the menu for the layers, with the editor loaded unless it's told otherwise. */
  function build(selected: ReadonlyArray<Layer>, { withEditor = true } = {}) {
    services.layerTimelineService.setSelectedLayers(new Set(selected.map(l => l.id)));
    if (withEditor) {
      services.canvasEditorBridgeService.attach(editor);
    } else {
      services.canvasEditorBridgeService.detach(editor);
    }
    return buildContextMenu(
      {
        document: services.layerTimelineService.getDocument(),
        selectedLayerIds: getSelectedLayerIds(store.getState()),
        target: 'canvas',
        blockIds: [],
        currentTime: 0,
        editor: services.canvasEditorBridgeService.getMenuState(),
      },
      services,
    );
  }

  /** Builds the menu for blocks, in the timeline or the canvas editor's keyframe badge. */
  function buildForBlocks(blockIds: ReadonlyArray<string>, target: ContextMenuTarget) {
    services.canvasEditorBridgeService.attach(editor);
    return buildContextMenu(
      {
        document: services.layerTimelineService.getDocument(),
        selectedLayerIds: getSelectedLayerIds(store.getState()),
        target,
        blockIds,
        currentTime: 0,
        editor: services.canvasEditorBridgeService.getMenuState(),
      },
      services,
    );
  }

  function ids(sections: ReadonlyArray<ContextMenuSection>) {
    return sections.map(section => section.map(item => item.id));
  }

  function find(sections: ReadonlyArray<ContextMenuSection>, id: string) {
    return sections.flat().find(item => item.id === id);
  }

  function run(item: ContextMenuItem | undefined) {
    if (!item?.run) {
      throw new Error(`${item?.id} doesn't run anything`);
    }
    item.run();
  }

  function path(name: string, extra: object = {}) {
    return new PathLayer({
      name,
      children: [],
      pathData: new Path('M 2 2 L 10 2 L 10 10 Z'),
      fillColor: '#000000',
      ...extra,
    });
  }

  function stroked(name: string, extra: object = {}) {
    return path(name, { fillColor: '', strokeColor: '#000000', strokeWidth: 2, ...extra });
  }

  function block(layerId: string, propertyName: string, fromValue: unknown, toValue: unknown) {
    const type =
      propertyName === 'pathData' ? 'path' : propertyName.endsWith('Color') ? 'color' : 'number';
    return AnimationBlock.from({ layerId, propertyName, type, fromValue, toValue });
  }

  describe('outline stroke', () => {
    it('is offered for a stroked path, and runs through the editor', () => {
      const line = stroked('line');
      load([line]);
      const menu = build([line]);
      const outline = find(menu, 'outline');
      expect(outline).toMatchObject({ label: 'Outline stroke', shortcut: 'Command+Alt+O' });
      expect(outline?.disabledReason).toBeUndefined();
      run(outline);
      expect(runCommand).toHaveBeenCalledWith('outline');
    });

    it('is disabled, with the reason, for an animated path', () => {
      const line = stroked('line');
      load([line], [block(line.id, 'strokeWidth', 1, 4)]);
      expect(find(build([line]), 'outline')?.disabledReason).toBe(
        "Outline stroke doesn't work on animated paths yet",
      );
    });

    it("isn't offered for a path without a stroke, or with the editor off", () => {
      const filled = path('filled');
      const line = stroked('line');
      load([filled, line]);
      expect(find(build([filled]), 'outline')).toBeUndefined();
      expect(find(build([line], { withEditor: false }), 'outline')).toBeUndefined();
      // A stroke that's too thin to see doesn't count either.
      const hairline = stroked('hairline', { strokeWidth: 0 });
      load([hairline]);
      expect(find(build([hairline]), 'outline')).toBeUndefined();
    });
  });

  it('offers the layer commands for a path, in sections', () => {
    const a = path('a');
    load([a]);
    expect(ids(build([a]))).toEqual([
      ['duplicate', 'group', 'convert'],
      ['morphInto'],
      ['animate'],
      ['delete'],
    ]);
    // With the editor off, as on the live site, its commands are left out.
    expect(ids(build([a], { withEditor: false }))).toEqual([
      ['group', 'convert'],
      ['morphInto'],
      ['animate'],
      ['delete'],
    ]);
  });

  describe('points', () => {
    const points = {
      selectedCount: 1,
      pointType: 'straight' as const,
      isSubPathClosed: true,
      setFirstReason: undefined,
    };

    it('offers the selected points commands first while points are edited', () => {
      const a = path('a');
      load([a]);
      editor.menuState = { editingLayerId: a.id, points };
      const menu = build([a]);
      // The points have their own Delete, rather than the layer's.
      expect(ids(menu)).toEqual([
        ['deletePoints', 'pointType', 'toggleClosed', 'setFirstPoint'],
        ['duplicate', 'group', 'convert'],
        ['animate'],
      ]);
      expect(find(menu, 'deletePoints')?.label).toBe('Delete point');
      expect(find(menu, 'toggleClosed')?.label).toBe('Open subpath');
      const types = find(menu, 'pointType')?.submenu ?? [];
      expect(types.map(item => [item.label, item.shortcut])).toEqual([
        ['Straight (current)', '1'],
        ['Mirrored', '2'],
        ['Disconnected', '3'],
        ['Asymmetric', '4'],
      ]);
      run(types[1]);
      expect(runPointCommand).toHaveBeenCalledWith({
        type: 'setPointType',
        pointType: 'mirrored',
      });
      run(find(menu, 'setFirstPoint'));
      expect(runPointCommand).toHaveBeenCalledWith({ type: 'setFirstPoint' });
      run(find(menu, 'deletePoints'));
      expect(runPointCommand).toHaveBeenCalledWith({ type: 'delete' });
    });

    it("says why a command can't run", () => {
      const a = path('a');
      load([a]);
      editor.menuState = {
        editingLayerId: a.id,
        points: {
          ...points,
          selectedCount: 2,
          isSubPathClosed: false,
          toggleClosedReason: undefined,
          setFirstReason: 'Select just one point',
        },
      };
      const menu = build([a]);
      expect(find(menu, 'deletePoints')?.label).toBe('Delete points');
      expect(find(menu, 'toggleClosed')?.label).toBe('Close subpath');
      expect(find(menu, 'setFirstPoint')?.disabledReason).toBe('Select just one point');
    });

    it("isn't offered without selected points", () => {
      const a = path('a');
      load([a]);
      editor.menuState = { editingLayerId: a.id };
      expect(find(build([a]), 'deletePoints')).toBeUndefined();
      expect(find(build([a]), 'delete')).toBeDefined();
    });
  });

  it('only offers select all with nothing selected', () => {
    load([path('a')]);
    const menu = build([]);
    expect(ids(menu)).toEqual([['selectAll']]);
    run(find(menu, 'selectAll'));
    expect(services.layerTimelineService.getSelectedLayers().map(l => l.name)).toEqual(['a']);
    load([]);
    expect(find(build([]), 'selectAll')?.disabledReason).toBe('There are no layers');
  });

  it('only says why while the editor is busy', () => {
    const a = path('a');
    load([a]);
    editor.menuState = { busyReason: "Finish the path you're drawing first" };
    expect(build([a])).toEqual([
      [{ id: 'busy', label: "Finish the path you're drawing first", disabledReason: '' }],
    ]);
  });

  it('groups, ungroups, and flattens groups', () => {
    const a = path('a');
    const b = path('b');
    load([a, b]);
    run(find(build([a, b]), 'group'));
    const group = services.layerTimelineService.getVectorLayer().children[0];
    expect(group).toBeInstanceOf(GroupLayer);
    const menu = build([group]);
    expect(ids(menu)[0]).toEqual(['duplicate', 'group', 'ungroup', 'flatten']);
    expect(find(menu, 'ungroup')?.shortcut).toBe('Command+Shift+G');
    run(find(menu, 'flatten'));
    expect(services.layerTimelineService.getVectorLayer().children.map(l => l.name)).toEqual([
      'a',
      'b',
    ]);
  });

  it('says why a group or its children keep it from being flattened', () => {
    const inner = new GroupLayer({ name: 'inner', children: [path('a')] });
    const outer = new GroupLayer({ name: 'outer', children: [inner] });
    const empty = new GroupLayer({ name: 'empty', children: [] });
    load([outer, empty], [block(inner.id, 'rotation', 0, 90)]);
    expect(find(build([outer]), 'flatten')?.disabledReason).toBe("inner's transform is animated");
    expect(find(build([inner]), 'flatten')?.disabledReason).toBe(
      "The group's transform is animated",
    );
    expect(find(build([empty]), 'flatten')?.disabledReason).toBe('The group is empty');
    expect(find(build([outer, empty]), 'flatten')).toBeUndefined();
  });

  it("says when a path's animated transform or a skew keeps a group from being flattened", () => {
    const spinning = path('spinning');
    const withPath = new GroupLayer({ name: 'withPath', children: [spinning, path('still')] });
    const turned = new GroupLayer({ name: 'turned', children: [path('b')], rotation: 30 });
    const stretched = new GroupLayer({ name: 'stretched', children: [turned], scaleX: 2 });
    // A transformed path would be skewed too, but its transform goes into its path instead.
    const turnedPath = path('turnedPath', { rotation: 30 });
    const stretchedPath = new GroupLayer({
      name: 'stretchedPath',
      children: [turnedPath],
      scaleX: 2,
    });
    load([withPath, stretched, stretchedPath], [block(spinning.id, 'rotation', 0, 90)]);
    expect(find(build([withPath]), 'flatten')?.disabledReason).toBe(
      "spinning's transform is animated",
    );
    expect(find(build([stretched]), 'flatten')?.disabledReason).toBe(
      'Flattening would skew turned',
    );
    expect(find(build([stretchedPath]), 'flatten')?.disabledReason).toBeUndefined();
  });

  it('combines paths, breaks them apart, and offers the boolean operations', () => {
    const a = path('a');
    const b = path('b', { pathData: new Path('M 12 12 L 20 12 L 20 20 Z') });
    load([a, b]);
    const menu = build([a, b]);
    expect(ids(menu)[1]).toEqual(['combine', 'boolean']);
    expect(ids(menu)[2]).toEqual([`morph.${a.id}.${b.id}`, `morph.${b.id}.${a.id}`]);
    const booleans = find(menu, 'boolean')?.submenu ?? [];
    expect(booleans.map(item => [item.label, item.shortcut])).toEqual([
      ['Union', 'Alt+Shift+U'],
      ['Subtract', 'Alt+Shift+S'],
      ['Intersect', 'Alt+Shift+I'],
      ['Exclude', 'Alt+Shift+E'],
    ]);
    run(booleans[1]);
    expect(runCommand).toHaveBeenCalledWith('subtract');

    run(find(menu, 'combine'));
    const [combined] = services.layerTimelineService.getVectorLayer().children;
    expect(combined.id).toBe(a.id);
    expect((combined as PathLayer).fillType).toBe('evenOdd');
    const brokenApart = find(build([combined]), 'breakApart');
    expect(brokenApart?.disabledReason).toBeUndefined();
    run(brokenApart);
    expect(services.layerTimelineService.getVectorLayer().children.map(l => l.name)).toEqual([
      'a',
      'a_1',
    ]);
  });

  it("says why paths can't be combined, and shows it again if it still fails", () => {
    const a = path('a');
    const b = path('b');
    load([a, b], [block(b.id, 'fillColor', '#000000', '#ffffff')]);
    const menu = build([a, b]);
    const combine = find(menu, 'combine');
    expect(combine?.disabledReason).toBe("b's animations would be lost");
    expect(find(menu, 'boolean')?.disabledReason).toBe("b's animations would be lost");
    const show = vi.spyOn(services.snackBarService, 'show');
    run(combine);
    expect(show).toHaveBeenCalledWith(
      "b's animations would be lost",
      'Dismiss',
      expect.any(Number),
    );
  });

  it('converts paths to clip paths, unless they have animations clip paths lack', () => {
    const a = path('a');
    load([a]);
    const convert = find(build([a]), 'convert');
    expect(convert?.label).toBe('Convert to clip path');
    run(convert);
    const clipPath = services.layerTimelineService.getVectorLayer().children[0];
    expect(clipPath).toBeInstanceOf(ClipPathLayer);
    expect(find(build([clipPath]), 'convert')?.label).toBe('Convert to path');

    // Another layer's animations don't matter (GitHub #332).
    const b = path('b');
    const other = path('other');
    load([b, other], [block(other.id, 'fillColor', '#000000', '#ffffff')]);
    expect(find(build([b]), 'convert')?.disabledReason).toBeUndefined();
    load([b], [block(b.id, 'fillColor', '#000000', '#ffffff'), block(b.id, 'strokeWidth', 0, 1)]);
    expect(find(build([b]), 'convert')?.disabledReason).toBe(
      "Clip paths can't animate fillColor, strokeWidth",
    );
  });

  it('animates the properties that have no blocks yet', () => {
    const a = path('a');
    load([a], [block(a.id, 'fillColor', '#000000', '#ffffff')]);
    const animate = find(build([a]), 'animate');
    const labels = animate?.submenu?.map(item => item.label) ?? [];
    expect(labels).toContain('strokeWidth');
    expect(labels).not.toContain('fillColor');
    run(animate?.submenu?.find(item => item.label === 'strokeWidth'));
    expect(services.layerTimelineService.getAnimation().blocks.map(b => b.propertyName)).toEqual([
      'fillColor',
      'strokeWidth',
    ]);
    // Only for one layer at a time.
    const b = path('b');
    load([a, b]);
    expect(find(build([a, b]), 'animate')).toBeUndefined();
  });

  describe('morph into', () => {
    const TRIANGLE = 'M 14 14 L 22 14 L 18 22 Z';

    it('lists the other paths without blocks, and says why some are refused', () => {
      const a = path('a');
      const b = path('b', { pathData: new Path(TRIANGLE) });
      const animated = path('animated');
      const clip = new ClipPathLayer({ name: 'clip', children: [], pathData: new Path(TRIANGLE) });
      const spinning = new GroupLayer({ name: 'spinning', children: [path('inSpinning')] });
      const group = new GroupLayer({ name: 'group', children: [] });
      load(
        [a, b, animated, clip, spinning, group],
        [block(animated.id, 'fillAlpha', 1, 0), block(spinning.id, 'rotation', 0, 90)],
      );
      const morphInto = find(build([a]), 'morphInto');
      expect(morphInto?.disabledReason).toBeUndefined();
      expect(
        morphInto?.submenu?.map(item => ({ label: item.label, reason: item.disabledReason })),
      ).toEqual([
        { label: 'b', reason: undefined },
        { label: 'inSpinning', reason: "spinning's transform is animated" },
      ]);

      run(morphInto?.submenu?.[0]);
      const { layerTimelineService, actionModeService } = services;
      expect(layerTimelineService.getVectorLayer().findLayerById(b.id)).toBeUndefined();
      expect(actionModeService.isActionMode()).toBe(true);
    });

    it('is disabled, with the reason, when nothing can be morphed into', () => {
      const a = path('a');
      load([a]);
      expect(find(build([a]), 'morphInto')?.disabledReason).toBe('There are no other paths');
      const b = path('b');
      load([a, b], [block(b.id, 'fillAlpha', 1, 0)]);
      expect(find(build([a]), 'morphInto')?.disabledReason).toBe('The other paths are animated');
      const empty = new PathLayer({ name: 'empty', children: [], pathData: undefined });
      load([empty, path('c')]);
      expect(find(build([empty]), 'morphInto')?.disabledReason).toBe('empty has no path');
    });

    it('morphs either of two selected paths into the other', () => {
      const a = path('a');
      const b = path('b', { pathData: new Path(TRIANGLE) });
      load([a, b], [block(a.id, 'fillAlpha', 1, 0)]);
      // In the layer list's order, whichever was selected first.
      const menu = build([b, a]);
      expect(find(menu, 'morphInto')).toBeUndefined();
      const [aIntoB, bIntoA] = menu[2];
      expect(aIntoB).toMatchObject({ label: "Morph 'a' into 'b'", disabledReason: undefined });
      expect(bIntoA).toMatchObject({
        label: "Morph 'b' into 'a'",
        disabledReason: 'a is animated',
      });
      run(aIntoB);
      expect(services.layerTimelineService.getVectorLayer().children.map(l => l.name)).toEqual([
        'a',
      ]);
    });

    it('is only offered for one or two paths', () => {
      const a = path('a');
      const b = path('b');
      const c = path('c');
      const group = new GroupLayer({ name: 'group', children: [] });
      load([a, b, c, group]);
      const isOffered = (layers: Layer[]) =>
        build(layers)
          .flat()
          .some(item => item.id === 'morphInto' || item.id.startsWith('morph.'));
      expect(isOffered([a])).toBe(true);
      expect(isOffered([a, b])).toBe(true);
      expect(isOffered([a, b, c])).toBe(false);
      expect(isOffered([a, group])).toBe(false);
      expect(isOffered([group])).toBe(false);
    });
  });

  describe('for blocks', () => {
    const SQUARE = 'M 2 2 L 10 2 L 10 10 L 2 10 Z';
    const TRIANGLE = 'M 14 14 L 22 14 L 18 22 Z';

    function pathBlock(layerId: string, from: string, to: string, startTime: number) {
      return AnimationBlock.from({
        layerId,
        propertyName: 'pathData',
        type: 'path',
        startTime,
        endTime: startTime + 100,
        fromValue: new Path(from),
        toValue: new Path(to),
      });
    }

    it('edits, auto fixes, and deletes a path block in the timeline', () => {
      const a = path('a');
      const broken = pathBlock(a.id, SQUARE, TRIANGLE, 0);
      load([a], [broken]);
      services.layerTimelineService.selectBlock(broken.id, true);
      const menu = buildForBlocks([broken.id], 'timelineBlock');
      expect(ids(menu)).toEqual([[`editMorph.${broken.id}`, 'autoFix'], ['delete']]);
      expect(find(menu, 'autoFix')?.disabledReason).toBeUndefined();
      run(find(menu, 'autoFix'));
      const [fixed] = services.layerTimelineService.getAnimation().blocks;
      expect(fixed.isAnimatable()).toBe(true);
      expect(find(buildForBlocks([broken.id], 'timelineBlock'), 'autoFix')?.disabledReason).toBe(
        'The paths already morph',
      );

      run(find(menu, `editMorph.${broken.id}`));
      expect(services.actionModeService.isActionMode()).toBe(true);
      services.actionModeService.setActionMode(ActionMode.None);
      run(find(menu, 'delete'));
      expect(services.layerTimelineService.getAnimation().blocks).toEqual([]);
    });

    it('only deletes blocks that have no morph', () => {
      const a = path('a');
      const fade = block(a.id, 'fillAlpha', 1, 0);
      load([a], [fade]);
      services.layerTimelineService.selectBlock(fade.id, true);
      expect(ids(buildForBlocks([fade.id], 'timelineBlock'))).toEqual([['delete']]);
    });

    it("offers both morphs where two meet at the keyframe badge's time", () => {
      const a = path('a');
      const first = pathBlock(a.id, SQUARE, SQUARE, 0);
      const second = pathBlock(a.id, SQUARE, TRIANGLE, 100);
      load([a], [first, second]);
      // The badge is about the selected path, which stays selected.
      services.layerTimelineService.setSelectedLayers(new Set([a.id]));
      const menu = buildForBlocks([first.id, second.id], 'keyframeBadge');
      expect(menu.map(section => section.map(item => item.label))).toEqual([
        ['Edit previous morph', 'Edit next morph', 'Auto fix'],
        ['Delete previous morph', 'Delete next morph'],
      ]);
      run(menu[1][1]);
      expect(services.layerTimelineService.getAnimation().blocks.map(b => b.id)).toEqual([
        first.id,
      ]);
      expect(services.layerTimelineService.getSelectedLayerIds()).toEqual(new Set([a.id]));
    });

    it('says why a morph with an empty path is disabled', () => {
      const a = path('a');
      const empty = AnimationBlock.from({
        layerId: a.id,
        propertyName: 'pathData',
        type: 'path',
        fromValue: new Path(SQUARE),
        toValue: undefined,
      });
      load([a], [empty]);
      const menu = buildForBlocks([empty.id], 'keyframeBadge');
      expect(find(menu, `editMorph.${empty.id}`)?.disabledReason).toBe(
        'Set both of the paths before editing the morph',
      );
      expect(find(menu, 'autoFix')?.disabledReason).toBe('Set both of the paths first');
      expect(find(menu, 'delete')?.label).toBe('Delete morph');
    });
  });

  it('deletes the selection', () => {
    const a = path('a');
    load([a, path('b')]);
    run(find(build([a]), 'delete'));
    expect(services.layerTimelineService.getVectorLayer().children.map(l => l.name)).toEqual(['b']);
  });

  it('shows shortcuts with Cmd on a Mac and Ctrl elsewhere', () => {
    expect(formatShortcut('Command+Shift+G', true)).toBe('Cmd+Shift+G');
    expect(formatShortcut('Command+Alt+O', false)).toBe('Ctrl+Alt+O');
    expect(formatShortcut('Delete', true)).toBe('Delete');
  });
});
