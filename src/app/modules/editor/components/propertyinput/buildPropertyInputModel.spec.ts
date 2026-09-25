import { createEditorServices } from 'app/modules/editor/services/createEditorServices';
import { createEditorStore } from 'app/modules/editor/store';
import { getPropertyInputState } from 'app/modules/editor/store/common/selectors';
import { SetSelectedLayers } from 'app/modules/editor/store/layers/actions';
import { SetSelectedBlocks } from 'app/modules/editor/store/timeline/actions';

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
});
