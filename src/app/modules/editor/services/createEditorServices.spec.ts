import { ActionMode } from 'app/modules/editor/model/actionmode';
import { GroupLayer, PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
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
        const exported = FileExportService.fromJSON(JSON.parse(await downloads[0].text()));
        expect(exported.vectorLayer.toJSON()).toEqual(vectorLayer.toJSON());
        expect(exported.animation.toJSON()).toEqual(animation.toJSON());
        expect(exported.hiddenLayerIds).toEqual(hiddenLayerIds);

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
