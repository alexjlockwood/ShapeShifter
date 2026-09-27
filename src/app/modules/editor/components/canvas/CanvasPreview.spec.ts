import { GroupLayer, PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import {
  createEditorServices,
  type EditorServices,
} from 'app/modules/editor/services/createEditorServices';
import { createEditorStore } from 'app/modules/editor/store';
import { getVectorLayer } from 'app/modules/editor/store/layers/selectors';
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

  it('shows the working copies, and nothing else changes', () => {
    const { store, preview, path, other, group, rendered, pathDataOf } = setUp();
    const { vl, currentTime } = rendered();
    expect(preview.apply(vl, currentTime)).toBe(vl);

    preview.begin();
    preview.setPath(path.id, new Path(TRIANGLE));
    const previewed = preview.apply(vl, currentTime);
    expect(pathDataOf(previewed, path.id)).toBe(TRIANGLE);
    // The layer, its ancestors, and nothing else are copied.
    expect(previewed.findLayerById(other.id)).toBe(vl.findLayerById(other.id));
    expect(previewed.findLayerById(group.id)).not.toBe(vl.findLayerById(group.id));
    expect(pathDataOf(vl, path.id)).toBe(SQUARE);
    expect(pathDataOf(getVectorLayer(store.getState()), path.id)).toBe(SQUARE);

    // It's remembered until the paths or the time change, since the rendered layer changes in
    // place.
    expect(preview.apply(vl, currentTime)).toBe(previewed);
    expect(preview.apply(vl, currentTime + 10)).not.toBe(previewed);
    preview.setPath(path.id, new Path(SQUARE));
    expect(pathDataOf(preview.apply(vl, currentTime), path.id)).toBe(SQUARE);
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

  it('only edits the paths of path layers that no animation block sets at the time', () => {
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
    // Before the block starts, the layer's own path shows.
    expect(preview.canEditPath(path.id)).toBe(true);
    store.dispatch(new SetCurrentTime(100));
    expect(preview.canEditPath(path.id)).toBe(false);
    store.dispatch(new SetCurrentTime(250));
    expect(preview.canEditPath(path.id)).toBe(false);
    expect(preview.canEditPath(other.id)).toBe(true);
    expect(preview.canEditPath(group.id)).toBe(false);
    preview.begin();
    expect(() => preview.setPath(path.id, new Path(TRIANGLE))).toThrow();
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
