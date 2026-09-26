import { ActionSource } from 'app/modules/editor/model/actionmode';
import { ClipPathLayer, GroupLayer, PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { Animation } from 'app/modules/editor/model/timeline';
import {
  createEditorServices,
  type EditorServices,
} from 'app/modules/editor/services/createEditorServices';
import { createEditorStore, type State, type Store } from 'app/modules/editor/store';
import { SetSelectedLayers } from 'app/modules/editor/store/layers/actions';
import { ResetWorkspace } from 'app/modules/editor/store/reset/actions';

import { CanvasOverlay } from './CanvasOverlay';

describe('CanvasOverlay', () => {
  let store: Store<State>;
  let services: EditorServices;
  let canvas: HTMLCanvasElement;
  let overlay: CanvasOverlay;

  beforeEach(() => {
    store = createEditorStore();
    services = createEditorServices(store);
    canvas = document.createElement('canvas');
    overlay = new CanvasOverlay(
      canvas,
      ActionSource.Animated,
      store,
      services.actionModeService,
      services.layerTimelineService,
    );
    overlay.init();
  });

  afterEach(() => {
    overlay.dispose();
    services.dispose();
  });

  it("doesn't clip the selections of later layers to a selected clip path", () => {
    const clipPath = new ClipPathLayer({
      name: 'clip',
      children: [],
      pathData: new Path('M 0 0 L 4 0 L 4 4 L 0 4 Z'),
    });
    const path = new PathLayer({
      name: 'path',
      children: [],
      pathData: new Path('M 14 14 L 20 14 L 20 20 L 14 20 Z'),
      fillColor: '#000000',
    });
    const vl = new VectorLayer({
      name: 'vector',
      children: [
        new GroupLayer({ name: 'group1', children: [clipPath] }),
        new GroupLayer({ name: 'group2', children: [path] }),
      ],
    });
    store.dispatch(new ResetWorkspace(vl, new Animation()));
    // (17, 14) is on the top edge of the path, far outside of the clip path.
    const isHighlightedFn = () => canvas.getContext('2d')!.getImageData(17, 14, 1, 1).data[3] > 0;

    store.dispatch(new SetSelectedLayers(new Set([path.id])));
    expect(isHighlightedFn()).toBe(true);
    store.dispatch(new SetSelectedLayers(new Set([clipPath.id, path.id])));
    expect(isHighlightedFn()).toBe(true);
  });
});
