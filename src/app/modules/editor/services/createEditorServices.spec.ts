import { ActionMode, ActionSource, SelectionType } from 'app/modules/editor/model/actionmode';
import { GroupLayer, PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { CURRENT_PROJECT_VERSION } from 'app/modules/editor/model/projectVersion';
import { Animation, AnimationBlock, PathAnimationBlock } from 'app/modules/editor/model/timeline';
import { AnimationRenderer } from 'app/modules/editor/scripts/animator';
import * as ModelUtil from 'app/modules/editor/scripts/common/ModelUtil';
import { createEditorStore, type State, type Store } from 'app/modules/editor/store';
import {
  getActionModeEndState,
  getActionModeStartState,
} from 'app/modules/editor/store/actionmode/selectors';
import { ResetWorkspace } from 'app/modules/editor/store/reset/actions';
import { ActionCreators } from 'redux-undo';

import { createEditorServices, type EditorServices } from './createEditorServices';
import { FileExportService } from './fileexport.service';

const demos = import.meta.glob('/public/demos/*.shapeshifter', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('createEditorServices', () => {
  let store: Store<State>;
  let services: EditorServices;
  let downloads: Blob[];

  beforeEach(() => {
    store = createEditorStore();
    services = createEditorServices(store);
    downloads = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation(blob => {
      downloads.push(blob as Blob);
      return 'blob:download';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    services.dispose();
    vi.restoreAllMocks();
  });

  function loadDemo(json: string) {
    const { vectorLayer, animation, hiddenLayerIds } = FileExportService.fromJSON(JSON.parse(json));
    const project = ModelUtil.regenerateModelIds(vectorLayer, animation, hiddenLayerIds);
    store.dispatch(
      new ResetWorkspace(project.vectorLayer, project.animation, project.hiddenLayerIds),
    );
    return project;
  }

  for (const [path, json] of Object.entries(demos)) {
    describe(path, () => {
      // Auto fixing morphinganimals takes about a second locally, but over 5 on GitHub's runners.
      it('auto fixes each path animation', { timeout: 30_000 }, () => {
        const { animation } = loadDemo(json);
        const pathBlocks = animation.blocks.filter(b => b instanceof PathAnimationBlock);
        for (const { id } of pathBlocks) {
          services.layerTimelineService.selectBlock(id, true);
          services.actionModeService.autoFix();
          const block = services.layerTimelineService
            .getAnimation()
            .blocks.find(b => b.id === id) as PathAnimationBlock;
          expect(block.fromValue!.isMorphableWith(block.toValue!)).toBe(true);
        }
      });

      it('exports the project in every format', async () => {
        const { vectorLayer, animation, hiddenLayerIds } = loadDemo(json);

        services.fileExportService.exportJSON();
        const rawExported = JSON.parse(await downloads[0].text());
        // The demos only use features that every version has.
        expect(rawExported.version).toBe(1);
        expect(rawExported.version).toBeLessThanOrEqual(CURRENT_PROJECT_VERSION);
        const exported = FileExportService.fromJSON(rawExported);
        expect(exported.vectorLayer.toJSON()).toEqual(vectorLayer.toJSON());
        expect(exported.animation.toJSON()).toEqual(animation.toJSON());
        expect(exported.hiddenLayerIds).toEqual(hiddenLayerIds);
        // A file this build just wrote never trips its own newer-version warning.
        expect(exported.newerVersion).toBe(false);

        services.fileExportService.exportVectorDrawable();
        services.fileExportService.exportAnimatedVectorDrawable();
        expect(downloads.length).toBe(3);
        expect(await downloads[1].text()).toMatch(/^<vector\s/);
        expect(await downloads[2].text()).toMatch(/^<animated-vector\s/);

        services.fileExportService.exportSvg();
        services.fileExportService.exportSvgSpritesheet();
        await vi.waitFor(() => expect(downloads.length).toBe(5));
        expect(downloads.slice(3).map(d => d.size > 0)).toEqual([true, true]);
      });
    });
  }

  it('saves a project with a custom interpolator as version 2, and loads it back', async () => {
    const { animation } = loadDemo(demos['/public/demos/playtopause.shapeshifter']);
    const curve = 'M 0 0 C 0.2 0 0 1.4 0.5 1.2 C 0.8 1 0.9 1 1 1';
    const block = animation.blocks[0].clone();
    block.interpolator = curve;
    services.layerTimelineService.updateBlocks([block]);

    services.fileExportService.exportJSON();
    const rawExported = JSON.parse(await downloads[0].text());
    expect(rawExported.version).toBe(2);
    const exported = FileExportService.fromJSON(rawExported);
    expect(exported.newerVersion).toBe(false);
    expect(exported.animation.blocks.find(b => b.id === block.id)?.interpolator).toBe(curve);
  });

  it('can undo setting the paths of the selected block in action mode', () => {
    vi.useFakeTimers();
    try {
      const { actionModeService, layerTimelineService } = services;
      const layer = new PathLayer({ name: 'path', children: [], pathData: undefined });
      layerTimelineService.addLayer(layer);
      vi.advanceTimersByTime(2000);
      layerTimelineService.addBlocks([
        {
          layerId: layer.id,
          propertyName: 'pathData',
          fromValue: undefined,
          toValue: undefined,
          currentTime: 0,
        },
      ]);
      const [emptyBlock] = layerTimelineService.getSelectedBlocks() as PathAnimationBlock[];
      vi.advanceTimersByTime(2000);
      const block = emptyBlock.clone() as PathAnimationBlock;
      block.fromValue = new Path('M 8 5 L 8 19 L 19 12 Z');
      block.toValue = new Path('M 6 5 L 10 5 L 10 19 L 6 19 Z');
      layerTimelineService.updateBlocks([block]);
      actionModeService.setActionMode(ActionMode.Selection);

      // The action mode canvases are still subscribed when the undone state is emitted.
      const errors: unknown[] = [];
      for (const selector of [getActionModeStartState, getActionModeEndState]) {
        store.select(selector).subscribe({ error: e => errors.push(e) });
      }
      vi.advanceTimersByTime(2000);
      store.dispatch(ActionCreators.undo());

      expect(layerTimelineService.getSelectedBlocks()).toEqual([emptyBlock]);
      expect(errors).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  describe('auto fix', () => {
    function selectPathBlock(fromValue: string, toValue: string) {
      const { layerTimelineService } = services;
      const layer = new PathLayer({ name: 'path', children: [], pathData: new Path(fromValue) });
      layerTimelineService.addLayer(layer);
      layerTimelineService.addBlocks([
        {
          layerId: layer.id,
          propertyName: 'pathData',
          fromValue: undefined,
          toValue: undefined,
          currentTime: 0,
        },
      ]);
      const block = layerTimelineService.getSelectedBlocks()[0].clone() as PathAnimationBlock;
      block.fromValue = new Path(fromValue);
      block.toValue = new Path(toValue);
      layerTimelineService.updateBlocks([block]);
      layerTimelineService.selectBlock(block.id, true);
      return () =>
        layerTimelineService
          .getAnimation()
          .blocks.find(b => b.id === block.id) as PathAnimationBlock;
    }

    // The most common crash in Bugsnag, with a lone "M" typed or pasted into the path data.
    it('makes a lone point morphable with a triangle', () => {
      const getBlock = selectPathBlock('M 6 5', 'M 12 6 L 13 11 Z');
      services.actionModeService.autoFix();
      const { fromValue, toValue } = getBlock();
      expect(fromValue!.isMorphableWith(toValue!)).toBe(true);
    });

    it('shows a snackbar when it fails', () => {
      const getBlock = selectPathBlock('M 8 5 L 8 19 L 19 12 Z', 'M 6 5 L 10 5 L 10 19 L 6 19 Z');
      const blockBefore = getBlock();
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(Path.prototype, 'mutate').mockImplementationOnce(() => {
        throw new Error('Auto fix failed');
      });

      expect(() => services.actionModeService.autoFix()).not.toThrow();
      expect(services.snackBarService.getSnackBar()?.message).toBe("Couldn't auto fix these paths");
      expect(getBlock()).toBe(blockBefore);
    });

    // The selected points may not exist in the new paths, and drawing them would throw.
    it('clears the selections', () => {
      selectPathBlock('M 8 5 L 8 19 L 19 12 Z', 'M 6 5 L 10 5 L 10 19 L 6 19 Z');
      const { actionModeService } = services;
      actionModeService.setActionMode(ActionMode.Selection);
      actionModeService.setSelections([
        { type: SelectionType.Point, source: ActionSource.From, subIdx: 0, cmdIdx: 3 },
      ]);
      actionModeService.autoFix();
      expect(store.getState().present.actionmode.selections).toEqual([]);
    });

    // Auto fix can reorder the subpaths, so the ones paired so far may have moved.
    it('forgets the subpaths paired so far', () => {
      selectPathBlock(
        'M 0 0 L 4 0 L 4 4 Z M 20 20 L 24 20 L 24 24 Z',
        'M 20 20 L 24 20 L 24 24 Z M 0 0 L 4 0 L 4 4 Z',
      );
      const { actionModeService } = services;
      actionModeService.setActionMode(ActionMode.PairSubPaths);
      actionModeService.pairSubPath(1, ActionSource.From);
      expect(store.getState().present.actionmode.unpairedSubPath).toBeDefined();
      actionModeService.autoFix();
      const { unpairedSubPath, pairedSubPaths } = store.getState().present.actionmode;
      expect(unpairedSubPath).toBeUndefined();
      expect(pairedSubPaths.size).toBe(0);
    });
  });

  describe('in action mode', () => {
    function editBlock() {
      const { layerTimelineService, actionModeService } = services;
      const layer = new PathLayer({ name: 'path', children: [], pathData: undefined });
      layerTimelineService.addLayer(layer);
      layerTimelineService.addBlocks([
        {
          layerId: layer.id,
          propertyName: 'pathData',
          fromValue: new Path('M 8 5 L 8 19 L 19 12 Z'),
          toValue: new Path('M 6 5 L 10 5 L 10 19 L 6 19 Z'),
          currentTime: 0,
        },
      ]);
      const [block] = layerTimelineService.getSelectedBlocks();
      actionModeService.setActionMode(ActionMode.Selection);
      return block;
    }

    function cut() {
      const setData = vi.fn<(format: string, data: string) => void>();
      const event = new Event('cut', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'clipboardData', { value: { setData } });
      window.dispatchEvent(event);
      return setData;
    }

    it('copies the block being edited instead of cutting it', () => {
      const block = editBlock();
      services.clipboardService.init();
      const setData = cut();
      expect(setData).toHaveBeenCalledWith('text/plain', expect.stringContaining(block.id));
      expect(services.layerTimelineService.getAnimation().blocks.map(b => b.id)).toContain(
        block.id,
      );
    });

    // E.g. when it's deleted from the timeline.
    it('does nothing once the block being edited is gone', () => {
      editBlock();
      const { actionModeService, layerTimelineService } = services;
      actionModeService.setSelections([
        { type: SelectionType.SubPath, source: ActionSource.From, subIdx: 0 },
      ]);
      layerTimelineService.deleteSelectedModels();
      expect(layerTimelineService.getSelectedBlocks()).toEqual([]);
      expect(() => {
        actionModeService.autoFix();
        actionModeService.reverseSelectedSubPaths();
        actionModeService.shiftBackSelectedSubPaths();
        actionModeService.shiftForwardSelectedSubPaths();
        actionModeService.deleteSelectedActionModeModels();
      }).not.toThrow();
    });

    it('leaves once the block being edited is gone', () => {
      editBlock();
      services.layerTimelineService.deleteSelectedModels();
      expect(services.actionModeService.getActionMode()).toBe(ActionMode.None);
    });
  });

  describe('editMorph', () => {
    function addPathBlocks(...paths: ReadonlyArray<readonly [string, string]>) {
      const { layerTimelineService } = services;
      const layer = new PathLayer({ name: 'path', children: [], pathData: undefined });
      layerTimelineService.addLayer(layer);
      return paths.map(([from, to], i) => {
        layerTimelineService.addBlocks([
          {
            layerId: layer.id,
            propertyName: 'pathData',
            fromValue: from ? new Path(from) : undefined,
            toValue: to ? new Path(to) : undefined,
            currentTime: i * 1000,
          },
        ]);
        return layerTimelineService.getSelectedBlocks()[0];
      });
    }

    const TRIANGLE = 'M 8 5 L 8 19 L 19 12 Z';
    const SQUARE = 'M 6 5 L 10 5 L 10 19 L 6 19 Z';

    it('selects the block and enters action mode', () => {
      const [first] = addPathBlocks([TRIANGLE, SQUARE], [SQUARE, TRIANGLE]);
      const { actionModeService, layerTimelineService } = services;
      expect(actionModeService.editMorph(first.id)).toBe(true);
      expect(layerTimelineService.getSelectedBlocks().map(b => b.id)).toEqual([first.id]);
      expect(actionModeService.getActionMode()).toBe(ActionMode.Selection);
    });

    it('switches to another block, forgetting the selections in the first one', () => {
      const [first, second] = addPathBlocks([TRIANGLE, SQUARE], [SQUARE, TRIANGLE]);
      const { actionModeService, layerTimelineService } = services;
      actionModeService.editMorph(first.id);
      actionModeService.setActionMode(ActionMode.SplitCommands);
      actionModeService.setSelections([
        { type: SelectionType.SubPath, source: ActionSource.From, subIdx: 0 },
      ]);
      expect(actionModeService.editMorph(second.id)).toBe(true);
      expect(layerTimelineService.getSelectedBlocks().map(b => b.id)).toEqual([second.id]);
      expect(actionModeService.getActionMode()).toBe(ActionMode.Selection);
      expect(actionModeService.getSelections()).toEqual([]);
    });

    it("keeps editing the block when it's already being edited", () => {
      const [block] = addPathBlocks([TRIANGLE, SQUARE]);
      const { actionModeService } = services;
      actionModeService.editMorph(block.id);
      actionModeService.setActionMode(ActionMode.SplitCommands);
      expect(actionModeService.editMorph(block.id)).toBe(true);
      expect(actionModeService.getActionMode()).toBe(ActionMode.SplitCommands);
    });

    it("does nothing for a block that isn't a path block", () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { actionModeService, layerTimelineService } = services;
      const layer = new PathLayer({ name: 'path', children: [], pathData: undefined });
      layerTimelineService.addLayer(layer);
      layerTimelineService.addBlocks([
        { layerId: layer.id, propertyName: 'fillAlpha', fromValue: 0, toValue: 1, currentTime: 0 },
      ]);
      const [block] = layerTimelineService.getSelectedBlocks();
      expect(actionModeService.editMorph(block.id)).toBe(false);
      expect(actionModeService.editMorph('missing')).toBe(false);
      expect(actionModeService.isActionMode()).toBe(false);
      expect(warn).toHaveBeenCalledTimes(2);
    });

    it('says so when one of the paths is empty', () => {
      const [block] = addPathBlocks([TRIANGLE, '']);
      const { actionModeService, snackBarService } = services;
      expect(actionModeService.editMorph(block.id)).toBe(false);
      expect(actionModeService.isActionMode()).toBe(false);
      expect(snackBarService.getSnackBar()?.message).toBe(
        'Set both of the paths before editing the morph',
      );
    });
  });

  describe('with blocks that animate hidden or missing layers', () => {
    function buildProject() {
      const path = new PathLayer({
        name: 'path',
        children: [],
        pathData: new Path('M 0 0 L 10 10'),
        strokeColor: '#000',
      });
      const group = new GroupLayer({ name: 'group', children: [path] });
      const vectorLayer = new VectorLayer({ name: 'vector', children: [group] });
      const newBlock = (layerId: string, propertyName: string) =>
        AnimationBlock.from({ type: 'number', layerId, propertyName, fromValue: 1, toValue: 2 });
      const animation = new Animation({
        blocks: [
          newBlock(path.id, 'strokeWidth'),
          newBlock('missing', 'strokeWidth'),
          newBlock(group.id, 'strokeWidth'),
        ],
      });
      return { path, group, vectorLayer, animation };
    }

    it('drops them when loading a project', () => {
      const { path, vectorLayer, animation } = buildProject();
      const project = FileExportService.fromJSON({
        layers: { vectorLayer: vectorLayer.toJSON(), hiddenLayerIds: [] },
        timeline: { animation: animation.toJSON() },
      });
      expect(project.animation.blocks.map(b => b.layerId)).toEqual([path.id]);
    });

    it('renders the other blocks', () => {
      const { path, vectorLayer, animation } = buildProject();
      const rendered = new AnimationRenderer(vectorLayer, animation).setCurrentTime(50);
      const { strokeWidth } = rendered.findLayerById(path.id) as PathLayer;
      expect(strokeWidth).toBeGreaterThan(1);
      expect(strokeWidth).toBeLessThan(2);
    });

    it('exports without the hidden layers', async () => {
      const { group, vectorLayer, animation } = buildProject();
      store.dispatch(new ResetWorkspace(vectorLayer, animation, new Set([group.id])));
      services.fileExportService.exportAnimatedVectorDrawable();
      const avd = await downloads[0].text();
      expect(avd).toMatch(/^<animated-vector\s/);
      expect(avd).not.toContain('android:name="path"');
    });

    it('exports an empty vector layer when the root is hidden', async () => {
      const { vectorLayer, animation } = buildProject();
      store.dispatch(new ResetWorkspace(vectorLayer, animation, new Set([vectorLayer.id])));
      services.fileExportService.exportSvg();
      services.fileExportService.exportVectorDrawable();
      services.fileExportService.exportAnimatedVectorDrawable();
      services.fileExportService.exportSvgSpritesheet();
      await vi.waitFor(() => expect(downloads.length).toBe(4));

      const [svg, vd, avd] = await Promise.all(downloads.slice(0, 3).map(d => d.text()));
      expect(svg).toMatch(/^<svg\s/);
      expect(vd).toMatch(/^<vector\s/);
      expect(avd).toMatch(/^<animated-vector\s/);
      for (const xml of [svg, vd, avd]) {
        expect(xml).not.toContain('path');
      }
      expect(avd).not.toContain('<target');
    });
  });
});
