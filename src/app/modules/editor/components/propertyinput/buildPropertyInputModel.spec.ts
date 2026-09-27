import { PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { createEditorServices } from 'app/modules/editor/services/createEditorServices';
import { createEditorStore } from 'app/modules/editor/store';
import { getPropertyInputState } from 'app/modules/editor/store/common/selectors';
import { SetSelectedLayers } from 'app/modules/editor/store/layers/actions';
import { ResetWorkspace } from 'app/modules/editor/store/reset/actions';
import { SetSelectedBlocks } from 'app/modules/editor/store/timeline/actions';
import { ActionCreators } from 'redux-undo';

import { buildPropertyInputModel, type PropertyInputModel } from './buildPropertyInputModel';

describe('buildPropertyInputModel', () => {
  it("shows nothing if the selected layer or block doesn't exist", () => {
    const store = createEditorStore();
    const { layerTimelineService } = createEditorServices(store);
    const deps = { store, layerTimelineService, enteredValueMap: new Map() };

    const noSelections: PropertyInputModel = {
      numSelections: 0,
      inspectedProperties: [],
      availablePropertyNames: [],
    };

    store.dispatch(new SetSelectedLayers(new Set(['missing'])));
    expect(buildPropertyInputModel(deps, getPropertyInputState(store.getState()))).toEqual(
      noSelections,
    );
    store.dispatch(new SetSelectedLayers(new Set()));
    store.dispatch(new SetSelectedBlocks(new Set(['missing'])));
    expect(buildPropertyInputModel(deps, getPropertyInputState(store.getState()))).toEqual(
      noSelections,
    );
  });

  it("previews a layer's property and saves it as one undo step", () => {
    vi.useFakeTimers();
    try {
      const store = createEditorStore();
      const { layerTimelineService } = createEditorServices(store);
      const deps = { store, layerTimelineService, enteredValueMap: new Map() };
      const path = new PathLayer({
        name: 'path',
        children: [],
        pathData: new Path('M 1 1 L 5 5'),
        fillColor: '#000000',
      });
      store.dispatch(new ResetWorkspace(new VectorLayer({ name: 'vector', children: [path] })));
      store.dispatch(new SetSelectedLayers(new Set([path.id])));
      vi.advanceTimersByTime(2000);

      const getFillColor = () => {
        const pim = buildPropertyInputModel(deps, getPropertyInputState(store.getState()));
        const ip = pim.inspectedProperties.find(p => p.propertyName === 'fillColor');
        if (!ip) {
          throw new Error('fillColor is missing');
        }
        return ip;
      };
      expect(getFillColor().canPreview).toBe(true);
      getFillColor().previewValue('#ff0000');
      vi.advanceTimersByTime(1500);
      getFillColor().previewValue('#00ff00');
      expect(getFillColor().value).toBe('#00ff00');
      getFillColor().commitPreview();

      store.dispatch(ActionCreators.undo());
      expect(getFillColor().value).toBe('#000000');
    } finally {
      vi.useRealTimers();
    }
  });
});
