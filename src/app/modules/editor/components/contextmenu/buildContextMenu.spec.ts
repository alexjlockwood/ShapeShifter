import type {
  CanvasEditorCommands,
  CanvasEditorMenuState,
} from 'app/modules/editor/components/canvas/CanvasEditorApi';
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

describe('buildContextMenu', () => {
  let store: Store<State>;
  let services: EditorServices;
  let editor: CanvasEditorCommands & { menuState: CanvasEditorMenuState };
  let runCommand: Mock<CanvasEditorCommands['runCommand']>;

  beforeEach(() => {
    store = createEditorStore();
    services = createEditorServices(store);
    runCommand = vi.fn<CanvasEditorCommands['runCommand']>();
    editor = {
      menuState: {},
      getLayerAt: () => undefined,
      getMenuState: () => editor.menuState,
      runCommand,
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
    expect(ids(build([a]))).toEqual([['duplicate', 'group', 'convert'], ['animate'], ['delete']]);
    // With the editor off, as on the live site, its commands are left out.
    expect(ids(build([a], { withEditor: false }))).toEqual([
      ['group', 'convert'],
      ['animate'],
      ['delete'],
    ]);
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
