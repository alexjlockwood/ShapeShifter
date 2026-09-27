import { GroupLayer, PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { AnimationBlock } from 'app/modules/editor/model/timeline';
import {
  createEditorServices,
  type EditorServices,
} from 'app/modules/editor/services/createEditorServices';
import { createEditorStore } from 'app/modules/editor/store';
import {
  getHiddenLayerIds,
  getSelectedLayerIds,
  getVectorLayer,
} from 'app/modules/editor/store/layers/selectors';
import { getAnimation } from 'app/modules/editor/store/timeline/selectors';
import { SetCurrentTime, SetIsPlaying } from 'app/modules/editor/store/playback/actions';
import { getAnimatedVectorLayer } from 'app/modules/editor/store/playback/selectors';
import { ActionCreators } from 'redux-undo';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CanvasPreview } from './CanvasPreview';

const SQUARE = 'M 4 4 L 20 4 L 20 20 L 4 20 Z';
const TRIANGLE = 'M 4 20 L 12 4 L 20 20 Z';

describe('CanvasPreview', () => {
  let services: EditorServices | undefined;
  let preview: CanvasPreview | undefined;

  beforeEach(() => {
    // Edits less than a second apart are undone together.
    vi.useFakeTimers();
  });

  afterEach(() => {
    preview?.dispose();
    services?.dispose();
    vi.useRealTimers();
  });

  function setUp() {
    const store = createEditorStore({ logActions: false });
    services = createEditorServices(store);
    const path = new PathLayer({
      name: 'path',
      children: [],
      pathData: new Path(SQUARE),
      fillColor: '#000',
    });
    const other = new PathLayer({ name: 'other', children: [], pathData: new Path(SQUARE) });
    const group = new GroupLayer({ name: 'group', children: [path] });
    services.layerTimelineService.setVectorLayer(
      new VectorLayer({ name: 'vector', children: [group, other] }),
    );
    vi.advanceTimersByTime(2000);
    preview = new CanvasPreview(store, services.layerTimelineService);
    preview.init();
    const rendered = () => getAnimatedVectorLayer(store.getState());
    const pathDataOf = (vl: VectorLayer, layerId: string) =>
      (vl.findLayerById(layerId) as PathLayer).pathData?.getPathString();
    return { store, services, preview, path, other, group, rendered, pathDataOf };
  }

  it('shows the working copy, without changing the document', () => {
    const { store, preview, path, other, rendered, pathDataOf } = setUp();
    const { vl, currentTime } = rendered();
    expect(preview.apply(vl, currentTime)).toBe(vl);

    preview.begin();
    preview.setPath(path.id, new Path(TRIANGLE));
    const previewed = preview.apply(vl, currentTime);
    expect(pathDataOf(previewed, path.id)).toBe(TRIANGLE);
    expect(pathDataOf(previewed, other.id)).toBe(SQUARE);
    expect(pathDataOf(vl, path.id)).toBe(SQUARE);
    expect(pathDataOf(getVectorLayer(store.getState()), path.id)).toBe(SQUARE);
    // A later change replaces it.
    preview.setPath(path.id, new Path(SQUARE));
    expect(pathDataOf(preview.apply(vl, currentTime), path.id)).toBe(SQUARE);
  });

  it('draws a working document at the current time, animation and all', () => {
    const { store, preview, other, rendered } = setUp();
    preview.begin();
    const base = preview.getBase()!;
    const animation = base.animation.clone();
    animation.blocks = [
      AnimationBlock.from({
        type: 'number',
        layerId: other.id,
        propertyName: 'fillAlpha',
        startTime: 0,
        endTime: 100,
        fromValue: 0.5,
        toValue: 0.5,
      }),
    ];
    preview.setDocument({ vectorLayer: base.vectorLayer, animation });
    const { vl, currentTime } = rendered();
    const drawn = preview.apply(vl, currentTime).findLayerById(other.id) as PathLayer;
    expect(drawn.fillAlpha).toBe(0.5);
    expect(getAnimation(store.getState())).toBe(base.animation);
  });

  it("commits a working document's animation and layer states in the same undo step", () => {
    const { store, preview, other } = setUp();
    preview.begin();
    const base = preview.getBase()!;
    const copy = other.clone();
    copy.id = 'copy';
    copy.name = 'copy';
    const vectorLayer = base.vectorLayer.clone();
    vectorLayer.children = [...vectorLayer.children, copy];
    const animation = base.animation.clone();
    animation.blocks = [
      AnimationBlock.from({
        type: 'number',
        layerId: copy.id,
        propertyName: 'fillAlpha',
        startTime: 0,
        endTime: 100,
        fromValue: 0,
        toValue: 1,
      }),
    ];
    preview.setDocument(
      { vectorLayer, animation },
      { selectedLayerIds: new Set(['copy']), hiddenLayerIds: new Set(['copy']) },
    );
    preview.commit();
    expect(getAnimation(store.getState()).blocks.map(b => b.layerId)).toEqual(['copy']);
    expect(getSelectedLayerIds(store.getState())).toEqual(new Set(['copy']));
    expect(getHiddenLayerIds(store.getState())).toEqual(new Set(['copy']));
    store.dispatch(ActionCreators.undo());
    expect(getVectorLayer(store.getState()).findLayerById('copy')).toBeUndefined();
    expect(getAnimation(store.getState())).toBe(base.animation);
    expect(getSelectedLayerIds(store.getState())).toEqual(new Set());
    expect(getHiddenLayerIds(store.getState())).toEqual(new Set());
  });

  it('tells the canvas to redraw', () => {
    const { preview, path } = setUp();
    const changes = vi.fn<() => void>();
    preview.asObservable().subscribe(changes);
    preview.begin();
    preview.setPath(path.id, new Path(TRIANGLE));
    preview.cancel();
    expect(changes).toHaveBeenCalledTimes(2);
  });

  it('commits the edit as one undo step', () => {
    const { store, preview, path, pathDataOf } = setUp();
    const numPastStates = store.getState().past.length;
    preview.begin();
    preview.setPath(path.id, new Path('M 0 0 L 24 0 L 24 24 Z'));
    preview.setPath(path.id, new Path(TRIANGLE));
    preview.commit();
    expect(preview.isEditing()).toBe(false);
    expect(pathDataOf(getVectorLayer(store.getState()), path.id)).toBe(TRIANGLE);
    expect(store.getState().past.length).toBe(numPastStates + 1);

    store.dispatch(ActionCreators.undo());
    expect(pathDataOf(getVectorLayer(store.getState()), path.id)).toBe(SQUARE);
  });

  it("doesn't record an undo step for an edit that changed nothing", () => {
    const { store, preview } = setUp();
    const numPastStates = store.getState().past.length;
    preview.begin();
    preview.commit();
    expect(store.getState().past.length).toBe(numPastStates);
  });

  it("edits an animated path's keyframes, but not while it's morphing", () => {
    const { store, services, preview, path, other, group } = setUp();
    services.layerTimelineService.addBlocks([
      {
        layerId: path.id,
        propertyName: 'pathData',
        fromValue: new Path(SQUARE),
        toValue: new Path(TRIANGLE),
        currentTime: 100,
        duration: 100,
      },
    ]);
    const pathBlock = () => getAnimation(store.getState()).blocks[0];
    const layerPath = () =>
      (getVectorLayer(store.getState()).findLayerById(path.id) as PathLayer).pathData;
    const edit = (pathData: string) => {
      preview.begin();
      preview.setPath(path.id, new Path(pathData));
      preview.commit();
      vi.advanceTimersByTime(2000);
    };
    expect(preview.canEditPath(other.id)).toBe(true);
    expect(preview.canEditPath(group.id)).toBe(false);

    // Before the block, the layer's own path shows. The block starts from the same path, so it
    // changes too, and they still meet.
    const moved = 'M 5 4 L 20 4 L 20 20 L 4 20 Z';
    edit(moved);
    expect(layerPath()?.getPathString()).toBe(moved);
    expect(pathBlock().fromValue.getPathString()).toBe(moved);

    // At the end, and after it, the block's end shows.
    store.dispatch(new SetCurrentTime(250));
    const tipped = 'M 4 20 L 13 4 L 20 20 Z';
    edit(tipped);
    expect(pathBlock().toValue.getPathString()).toBe(tipped);
    expect(layerPath()?.getPathString()).toBe(moved);

    // While it morphs, it can't be edited.
    store.dispatch(new SetCurrentTime(150));
    expect(preview.canEditPath(path.id)).toBe(false);
    preview.begin();
    expect(() => preview.setPath(path.id, new Path(TRIANGLE))).toThrow();
    preview.cancel();

    // At the start, the block's start shows.
    store.dispatch(new SetCurrentTime(100));
    expect(preview.canEditPath(path.id)).toBe(true);
    preview.begin();
    expect(preview.getBasePath(path.id)?.getPathString()).toBe(moved);
  });

  it('is canceled when the animation changes, e.g. by deleting a block', () => {
    const { services, preview, path, other } = setUp();
    preview.begin();
    preview.setPath(path.id, new Path(TRIANGLE));
    services.layerTimelineService.addBlocks([
      {
        layerId: other.id,
        propertyName: 'fillAlpha',
        fromValue: 1,
        toValue: 0,
        currentTime: 0,
      },
    ]);
    expect(preview.isEditing()).toBe(false);
  });

  it('is canceled by undo, other edits, scrubbing, and playback', () => {
    const { store, preview, path, rendered } = setUp();
    const onCancel = vi.fn<() => void>();
    const begin = () => {
      preview.begin(onCancel);
      preview.setPath(path.id, new Path(TRIANGLE));
    };

    begin();
    store.dispatch(ActionCreators.undo());
    expect(preview.isEditing()).toBe(false);
    const { vl, currentTime } = rendered();
    expect(preview.apply(vl, currentTime)).toBe(vl);

    store.dispatch(ActionCreators.redo());
    begin();
    store.dispatch(new SetCurrentTime(100));
    expect(preview.isEditing()).toBe(false);

    begin();
    store.dispatch(new SetIsPlaying(true));
    expect(preview.isEditing()).toBe(false);
    expect(onCancel).toHaveBeenCalledTimes(3);
  });

  it('is canceled when the layer is deleted', () => {
    const { store, services, preview, path } = setUp();
    preview.begin();
    preview.setPath(path.id, new Path(TRIANGLE));
    const vl = getVectorLayer(store.getState()).clone();
    vl.children = [];
    services.layerTimelineService.setVectorLayer(vl);
    expect(preview.isEditing()).toBe(false);
  });

  it('only changes paths during an edit', () => {
    const { preview, path } = setUp();
    expect(() => preview.setPath(path.id, new Path(TRIANGLE))).toThrow();
  });
});
